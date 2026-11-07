import Anthropic from "@anthropic-ai/sdk";

// Per-million-token prices (USD) and web search price, for the cost readout.
const PRICES = {
  "claude-opus-5-5": { in: 4, out: 20, cacheRead: 0.2 },
  "claude-sonnet-5-5": { in: 2, out: 10, cacheRead: 0.2 },
};
const WEB_SEARCH_PER_1K = 10;

const SYSTEM = `You are Easy Rental Search, a research agent that helps travelers book vacation rentals directly with the owner or property manager instead of through Airbnb, Vrbo or Booking.com, which add service fees.

You are given a listing the traveler is looking at: its text, location, host name, and photos. Your job: find out whether this exact property has its own independent booking website (an owner's site, a local property management company, or a direct-booking platform page such as Lodgify, Hostaway, OwnerRez, Guesty, Hospitable or Uplisting sites).

How to work:
- Study the photos for distinctive features (views, pools, signage, decor, architecture) and the text for distinctive phrases, property names, amenities, bedroom counts and the host or co-host name. Hosts on Airbnb are often property management companies; search for their company website.
- Run several varied web searches: the property name, exact description phrases in quotes, the host/manager name with the town, the town plus key features plus "book direct", and so on. Fetch promising pages to verify.
- A match must be the same physical property: verify with several matching details (name, bedrooms/bathrooms, sleeps count, distinctive amenities, description wording, neighborhood, photo captions). Say what matched.
- Pages on airbnb.*, vrbo.*, booking.com, expedia.*, hotels.com or tripadvisor.* are not direct sites and never count as matches.
- If the traveler gave dates, check whether the direct site shows a nightly rate or availability for those dates and report it; never invent a price. If you can't see one, say so.
- Be honest. If you can't find a direct site, say so and give the best leads. Don't oversell weak matches.

Finish with one fenced \`\`\`json block (and nothing after it) with this shape:
{
  "verdict": "found" | "possible" | "not_found",
  "summary": "one or two plain sentences for the traveler",
  "matches": [
    {
      "name": "site or company name",
      "url": "https://...",
      "kind": "owner_site" | "property_manager" | "direct_booking_platform" | "other",
      "confidence": 0-100,
      "evidence": ["short matching detail", "..."],
      "price_note": "what the direct site shows for price/availability, or empty"
    }
  ],
  "leads": ["useful next step or contact, e.g. management company phone/email"]
}
Order matches by confidence, highest first.`;

function listingPrompt(l) {
  const lines = [
    `Listing on ${l.site}: ${l.url}`,
    `Title: ${l.title}`,
    l.subtitle && `Subtitle: ${l.subtitle}`,
    l.facts?.length && `Facts: ${l.facts.join(" · ")}`,
    l.address && `Location shown: ${l.address}`,
    l.lat != null && `Approx. map pin: ${l.lat}, ${l.lng} (platforms blur this by a few hundred meters)`,
    l.hostName && `Host: ${l.hostName}`,
    l.coHosts?.length && `Co-hosts: ${l.coHosts.join(", ")}`,
    l.amenities?.length && `Amenities: ${l.amenities.join(", ")}`,
    (l.checkIn || l.checkOut) && `Traveler's dates: ${l.checkIn || "?"} to ${l.checkOut || "?"}${l.guests ? `, ${l.guests} guests` : ""}`,
    (l.total || l.price) && `Price on ${l.site}: ${l.total ? l.total + " total" : l.price}`,
    l.description && `\nDescription:\n${l.description}`,
  ];
  return lines.filter(Boolean).join("\n");
}

export function parseResult(text) {
  const fences = [...text.matchAll(/```json\s*([\s\S]*?)```/g)];
  const raw = fences.length ? fences[fences.length - 1][1] : (text.match(/\{[\s\S]*\}\s*$/) || [""])[0];
  try {
    const r = JSON.parse(raw);
    r.matches = (r.matches || []).filter((m) => m && m.url && !/airbnb\.|vrbo\.|booking\.com|expedia\.|hotels\.com|tripadvisor\./i.test(m.url));
    return r;
  } catch (_) {
    return { verdict: "not_found", summary: text.replace(/```[\s\S]*?```/g, "").trim().slice(0, 600), matches: [], leads: [] };
  }
}

export function estimateCost(model, usage) {
  const p = PRICES[model] || PRICES["claude-opus-5-5"];
  const searches = usage.server_tool_use?.web_search_requests || 0;
  return (
    ((usage.input_tokens || 0) * p.in +
      (usage.cache_creation_input_tokens || 0) * p.in * 1.25 +
      (usage.cache_read_input_tokens || 0) * p.cacheRead +
      (usage.output_tokens || 0) * p.out) /
      1e6 +
    (searches * WEB_SEARCH_PER_1K) / 1000
  );
}

/**
 * Runs the AI deep search. onStep({kind, text}) is called for each search/fetch the agent makes.
 * Returns { result, cost, searches }.
 */
export async function deepSearch({ listing, apiKey, model = "claude-opus-5-5", onStep, signal }) {
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });

  const photoBlocks = listing.photos.slice(0, 8).map((url) => ({ type: "image", source: { type: "url", url } }));
  const messages = [
    {
      role: "user",
      content: [
        ...photoBlocks,
        { type: "text", text: listingPrompt(listing) + "\n\nFind this property's own direct-booking website." },
      ],
    },
  ];

  const total = { input_tokens: 0, output_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, server_tool_use: { web_search_requests: 0 } };
  let finalText = "";

  for (let turn = 0; turn < 6; turn++) {
    const stream = client.beta.messages.stream(
      {
        model,
        max_tokens: 64000,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        thinking: { type: "adaptive" },
        output_config: { effort: "medium" },
        system: SYSTEM,
        tools: [
          { type: "web_search_20260209", name: "web_search", max_uses: 12 },
          { type: "web_fetch_20260209", name: "web_fetch", max_uses: 10 },
        ],
        messages,
      },
      { signal },
    );

    stream.on("contentBlock", (block) => {
      if (block.type === "server_tool_use") {
        if (block.name === "web_search" && block.input?.query) onStep?.({ kind: "search", text: block.input.query });
        else if (block.name === "web_fetch" && block.input?.url) onStep?.({ kind: "fetch", text: block.input.url });
      }
    });

    const msg = await stream.finalMessage();
    const u = msg.usage || {};
    total.input_tokens += u.input_tokens || 0;
    total.output_tokens += u.output_tokens || 0;
    total.cache_creation_input_tokens += u.cache_creation_input_tokens || 0;
    total.cache_read_input_tokens += u.cache_read_input_tokens || 0;
    total.server_tool_use.web_search_requests += u.server_tool_use?.web_search_requests || 0;

    if (msg.stop_reason === "refusal") {
      throw new Error("The model declined this request. Try the free tools below instead.");
    }
    finalText += msg.content.filter((b) => b.type === "text").map((b) => b.text).join("");
    if (msg.stop_reason === "pause_turn") {
      messages.push({ role: "assistant", content: msg.content });
      continue;
    }
    break;
  }

  return {
    result: parseResult(finalText),
    cost: estimateCost(model, total),
    searches: total.server_tool_use.web_search_requests,
  };
}
