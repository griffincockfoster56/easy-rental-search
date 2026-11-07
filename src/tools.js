// Free search tools: no API key needed. Each returns links the user can open.

const EXCLUDE = "-site:airbnb.com -site:vrbo.com -site:booking.com -site:expedia.com -site:tripadvisor.com -site:hotels.com";

const google = (q) => "https://www.google.com/search?q=" + encodeURIComponent(q);

export function placeName(l) {
  // "Tahoe City, California, United States" -> "Tahoe City, California"
  return (l.address || "").split(",").slice(0, 2).join(",").trim();
}

function distinctivePhrase(description) {
  const sentences = (description || "")
    .replace(/\n/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.split(" ").length >= 6 && !/^(the space|guest access|other things|welcome)/i.test(s));
  const s = sentences[0] || "";
  return s.split(" ").slice(0, 10).join(" ").replace(/[.,!?;:"]+$/g, "");
}

export function textSearches(l) {
  const place = placeName(l);
  const out = [];
  if (l.title) out.push({ label: "Exact listing title", q: `"${l.title}" ${EXCLUDE}` });
  const phrase = distinctivePhrase(l.description);
  if (phrase) out.push({ label: "Description phrase", q: `"${phrase}" ${EXCLUDE}` });
  if (l.hostName && !/^(airbnb|vrbo)$/i.test(l.hostName))
    out.push({ label: "Host / manager", q: `"${l.hostName}" ${place} vacation rental` });
  if (place) {
    const beds = (l.facts || []).find((f) => /bedroom/i.test(f)) || "";
    out.push({ label: "Book direct in area", q: `${place} ${beds} vacation rental "book direct" ${EXCLUDE}` });
  }
  return out.map((s) => ({ ...s, url: google(s.q) }));
}

export function imageSearches(photoUrl) {
  const u = encodeURIComponent(photoUrl);
  return [
    { label: "Google Lens", url: `https://lens.google.com/uploadbyurl?url=${u}` },
    { label: "Bing", url: `https://www.bing.com/images/search?view=detailv2&iss=sbi&q=imgurl:${u}` },
    { label: "Yandex", url: `https://yandex.com/images/search?rpt=imageview&url=${u}` },
    { label: "TinEye", url: `https://tineye.com/search?url=${u}` },
  ];
}

export function mapLink(l) {
  if (l.lat != null && l.lng != null) return `https://www.google.com/maps/search/?api=1&query=${l.lat},${l.lng}`;
  if (l.address) return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(l.address)}`;
  return "";
}
