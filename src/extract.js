// Runs inside the listing page via chrome.scripting.executeScript.
// Must be fully self-contained: no imports, no closures over outer scope.
export function extractListing() {
  const txt = (el) => (el ? el.innerText.replace(/\s+\n/g, "\n").trim() : "");
  const meta = (key) => {
    const el =
      document.querySelector(`meta[property="${key}"]`) ||
      document.querySelector(`meta[name="${key}"]`);
    return el ? el.getAttribute("content") || "" : "";
  };
  const clip = (s, n) => (s && s.length > n ? s.slice(0, n) + "…" : s || "");
  const host = location.hostname.replace(/^www\./, "");
  const site = /airbnb\./.test(host)
    ? "Airbnb"
    : /vrbo\./.test(host)
      ? "Vrbo"
      : /booking\.com/.test(host)
        ? "Booking.com"
        : /expedia\./.test(host)
          ? "Expedia"
          : host;

  // Only individual listing pages, not search results.
  const path = location.pathname;
  const isListing =
    site === "Airbnb" ? /\/rooms\/(plus\/)?\d+/.test(path)
    : site === "Vrbo" ? /^\/(\d+(ha)?|[a-z-]+\/p\d+)/i.test(path) || /\/vacation-rental\//.test(path)
    : site === "Booking.com" ? /\/hotel\//.test(path)
    : true;
  if (!isListing) return { site, url: location.href, title: "", photos: [], description: "" };

  const scripts = Array.from(document.querySelectorAll("script"))
    .map((s) => s.textContent || "")
    .filter((s) => s.length > 50);
  const allScriptText = scripts.join("\n");

  // ---------- JSON-LD (Vrbo, Booking and many others publish it) ----------
  const ld = [];
  document.querySelectorAll('script[type="application/ld+json"]').forEach((s) => {
    try {
      const v = JSON.parse(s.textContent);
      (Array.isArray(v) ? v : [v]).forEach((x) => ld.push(x));
    } catch (_) {}
  });
  const ldNode = ld.find((x) => x && (x.address || x.geo || x.image)) || {};
  const ldAddress = ldNode.address
    ? typeof ldNode.address === "string"
      ? ldNode.address
      : [
          ldNode.address.streetAddress,
          ldNode.address.addressLocality,
          ldNode.address.addressRegion,
          ldNode.address.postalCode,
          ldNode.address.addressCountry && (ldNode.address.addressCountry.name || ldNode.address.addressCountry),
        ]
          .filter(Boolean)
          .join(", ")
    : "";

  // ---------- Title / description ----------
  const h1 = txt(document.querySelector("h1"));
  const ogTitle = meta("og:title");
  const title = h1 || ldNode.name || ogTitle || document.title;
  const sectionText = (id) => txt(document.querySelector(`[data-section-id^="${id}"]`));
  let description =
    sectionText("DESCRIPTION") ||
    txt(document.querySelector('[data-stid="content-markup"]')) ||
    txt(document.querySelector("#property_description_content, [data-testid='property-description']")) ||
    ldNode.description ||
    meta("og:description") ||
    meta("description");
  description = clip(description.replace(/\n{2,}/g, "\n"), 2500);

  // ---------- Photos ----------
  const photos = new Set();
  const addPhoto = (u) => {
    if (!u || u.startsWith("data:")) return;
    try {
      const url = new URL(u, location.href);
      if (/muscache\.com/.test(url.hostname)) {
        if (/\/user\/|\/AirbnbPlatformAssets|\/pictures\/airbnb-platform-assets|UserProfile|\/original_application\//i.test(url.pathname)) return;
        if (!/\/im\/pictures\//.test(url.pathname)) return;
        url.search = "?im_w=720";
      }
      photos.add(url.href);
    } catch (_) {}
  };
  if (site === "Airbnb") {
    document.querySelectorAll("img").forEach((img) => addPhoto(img.currentSrc || img.src));
    const re = /https:\/\/a0\.muscache\.com\/im\/pictures\/[^"'\s?\\]+\.(?:jpe?g|png|webp)/gi;
    (allScriptText.match(re) || []).forEach(addPhoto);
  } else {
    const ldImgs = [].concat(ldNode.image || []).map((i) => (typeof i === "string" ? i : i && (i.url || i.contentUrl)));
    ldImgs.forEach(addPhoto);
    document.querySelectorAll("img").forEach((img) => {
      const w = img.naturalWidth || img.width;
      if (w >= 300) addPhoto(img.currentSrc || img.src);
    });
  }
  const og = meta("og:image");
  if (og && !photos.size) addPhoto(og);

  // ---------- Location ----------
  let lat = null,
    lng = null;
  const geo = ldNode.geo || {};
  if (geo.latitude && geo.longitude) {
    lat = +geo.latitude;
    lng = +geo.longitude;
  } else {
    const m =
      allScriptText.match(/"lat(?:itude)?"\s*:\s*(-?\d{1,3}\.\d{3,})\s*,\s*"(?:lng|lon|longitude)"\s*:\s*(-?\d{1,3}\.\d{3,})/) ||
      allScriptText.match(/"latitude"\s*:\s*"?(-?\d{1,3}\.\d{3,})"?[^}]{0,80}"longitude"\s*:\s*"?(-?\d{1,3}\.\d{3,})/);
    if (m) {
      lat = +m[1];
      lng = +m[2];
    }
  }
  const locationSection = sectionText("LOCATION");
  let locationText = "";
  if (locationSection) {
    const lines = locationSection.split("\n").map((s) => s.trim()).filter(Boolean);
    const i = lines.findIndex((l) => /where you.ll be/i.test(l));
    locationText = lines.slice(i + 1, i + 3).find((l) => /,/.test(l)) || lines[1] || "";
  }
  // Airbnb og:title looks like "Home in Tahoe City · ★4.92 · 3 bedrooms · ..."
  const ogBits = (ogTitle || "").split(/\s+·\s+/);
  const kindAndPlace = ogBits[0] && / in /.test(ogBits[0]) ? ogBits[0] : "";
  const address = ldAddress || locationText || (kindAndPlace ? kindAndPlace.split(" in ").slice(1).join(" in ") : "");
  const facts = ogBits.slice(1).filter((b) => /bed|bath|guest|room|★/i.test(b));
  const overview = sectionText("OVERVIEW") || "";
  const overviewLine = overview.split("\n").find((l) => /guest|bedroom/i.test(l)) || "";

  // ---------- Host ----------
  const body = document.body.innerText;
  let hostName = "";
  const hm = body.match(/(?:Hosted by|Meet your host|Managed by|Property manager)\s*:?\s*\n?\s*([^\n·]{2,60})/i);
  if (hm) hostName = hm[1].trim();
  const coHosts = [];
  const ch = body.match(/Co-?hosts?\s*\n([\s\S]{0,200})/i);
  if (ch) ch[1].split("\n").map((s) => s.trim()).filter((s) => s && s.length < 40 && !/message|contact|language|response/i.test(s)).slice(0, 4).forEach((n) => coHosts.push(n));

  // ---------- Stay details (dates, guests, price) ----------
  const params = new URLSearchParams(location.search);
  const pick = (...keys) => keys.map((k) => params.get(k)).find(Boolean) || "";
  const checkIn = pick("check_in", "checkin", "startDate", "chkin", "arrival");
  const checkOut = pick("check_out", "checkout", "endDate", "chkout", "departure");
  const guests = pick("adults", "guests", "group_adults") || "";
  const priceMatch = body.match(/\$\s?[\d,]{2,7}(?:\.\d\d)?\s*(?:total|before taxes|\/?\s*night|night)/i);
  const totalMatch = body.match(/Total(?: before taxes)?\s*\n?\s*(\$\s?[\d,]+(?:\.\d\d)?)/i);

  // ---------- Amenities / distinctive bits ----------
  const amenities = sectionText("AMENITIES").split("\n").slice(1, 16).filter((s) => s.length < 60);
  const listingId = (location.pathname.match(/\/(?:rooms|h|hotel|vacation-rental\/p)\/?([\w-]+)/) || [])[1] || "";

  return {
    site,
    url: location.href.split("#")[0],
    listingId,
    title: clip(title, 200),
    subtitle: clip(kindAndPlace || overviewLine, 200),
    facts: facts.length ? facts : overviewLine ? [overviewLine] : [],
    description,
    address: clip(address, 200),
    lat,
    lng,
    hostName: clip(hostName, 60),
    coHosts,
    amenities,
    checkIn,
    checkOut,
    guests,
    price: priceMatch ? priceMatch[0].replace(/\s+/g, " ") : "",
    total: totalMatch ? totalMatch[1] : "",
    photos: Array.from(photos).slice(0, 40),
  };
}
