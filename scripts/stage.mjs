// Renders store screenshots, promo tiles and video backgrounds from captured stills.
// Inputs live in .dev/stage (listing.png + side panel stills); outputs go to store/ and media/.
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const IN = path.resolve(".dev/stage");
const img = (f) => "data:image/png;base64," + fs.readFileSync(path.join(IN, f)).toString("base64");
const logo = "data:image/svg+xml;base64," + Buffer.from(fs.readFileSync("assets/logo.svg")).toString("base64");

const FONT = `-apple-system, BlinkMacSystemFont, "SF Pro Display", Inter, "Segoe UI", sans-serif`;

// A browser window showing the listing with the side panel docked on the right.
function stage({ W, H, headline, sub, panel, slotOnly = false, scale = 1 }) {
  const pad = Math.round(W * 0.045);
  const headH = Math.round(H * 0.165);
  const frameW = W - pad * 2;
  const frameH = H - headH - Math.round(pad * 0.55);
  const barH = Math.round(frameH * 0.058);
  const contentH = frameH - barH;
  const panelW = Math.round(contentH / 2) + 2; // panel stills are 1:2
  const s = scale;
  return {
    slot: { x: pad + frameW - panelW + 1, y: headH + barH, w: panelW - 1, h: contentH },
    html: `<!doctype html><html><head><style>
    *{box-sizing:border-box;margin:0}
    body{width:${W}px;height:${H}px;overflow:hidden;font-family:${FONT};
      background:radial-gradient(120% 90% at 0% 0%,#1bb38c 0%,#0e8a6c 45%,#085846 100%);}
    .head{height:${headH}px;display:flex;align-items:center;gap:${18 * s}px;padding:0 ${pad}px;color:#fff8e7}
    .head img{width:${58 * s}px;height:${58 * s}px;border-radius:${14 * s}px;box-shadow:0 6px 18px rgba(0,0,0,.25)}
    h1{font-size:${34 * s}px;font-weight:780;letter-spacing:-.02em;line-height:1.1}
    h1 em{font-style:normal;color:#ffc94d}
    .sub{font-size:${17 * s}px;opacity:.88;margin-top:${4 * s}px}
    .win{position:absolute;left:${pad}px;top:${headH}px;width:${frameW}px;height:${frameH}px;background:#fff;border-radius:${12 * s}px ${12 * s}px 0 0;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.35)}
    .bar{height:${barH}px;background:#eef1f0;display:flex;align-items:center;gap:${8 * s}px;padding:0 ${14 * s}px;border-bottom:1px solid #dde3e0}
    .dot{width:${11 * s}px;height:${11 * s}px;border-radius:50%}
    .url{flex:1;margin-left:${14 * s}px;height:${barH * 0.62}px;border-radius:999px;background:#fff;display:flex;align-items:center;padding:0 ${14 * s}px;font-size:${13 * s}px;color:#4b5853}
    .ext{width:${barH * 0.62}px;height:${barH * 0.62}px;border-radius:${7 * s}px;background:url(${logo}) center/cover;outline:${2 * s}px solid #0e8a6c;outline-offset:${2 * s}px}
    .content{display:flex;height:${contentH}px}
    .listing{flex:1;background:url(${img("listing.png")}) left top/ ${frameW - panelW}px auto no-repeat}
    .panel{width:${panelW}px;border-left:1px solid #dde3e0;background:${slotOnly ? "#f7f5ef" : `url(${panel ? img(panel) : ""}) left top/100% auto no-repeat`}}
    </style></head><body>
    <div class="head"><img src="${logo}"><div><h1>${headline}</h1>${sub ? `<div class="sub">${sub}</div>` : ""}</div></div>
    <div class="win"><div class="bar"><span class="dot" style="background:#ff5f57"></span><span class="dot" style="background:#febc2e"></span><span class="dot" style="background:#28c840"></span>
      <div class="url">airbnb.com/rooms/611694523750838423</div><div class="ext"></div></div>
      <div class="content"><div class="listing"></div><div class="panel"></div></div></div>
    </body></html>`,
  };
}

function card({ W, H, title, sub, small }) {
  return `<!doctype html><html><head><style>*{margin:0;box-sizing:border-box}
  body{width:${W}px;height:${H}px;overflow:hidden;font-family:${FONT};color:#fff8e7;display:flex;align-items:center;justify-content:center;gap:${H * 0.07}px;
  background:radial-gradient(120% 120% at 0% 0%,#1bb38c 0%,#0e8a6c 45%,#085846 100%);padding:${H * 0.08}px}
  img{width:${H * (small ? 0.36 : 0.3)}px;height:${H * (small ? 0.36 : 0.3)}px;border-radius:22%;box-shadow:0 10px 30px rgba(0,0,0,.3);flex:none}
  h1{font-size:${H * (small ? 0.13 : 0.11)}px;font-weight:800;letter-spacing:-.02em;line-height:1.05}
  p{font-size:${H * (small ? 0.065 : 0.05)}px;opacity:.9;margin-top:${H * 0.035}px;line-height:1.3}
  em{font-style:normal;color:#ffc94d}</style></head><body><img src="${logo}"><div><h1>${title}</h1>${sub ? `<p>${sub}</p>` : ""}</div></body></html>`;
}

const SHOTS = [
  { file: "1-found.png", panel: "3-results.png", headline: "Found it on its <em>own website</em>", sub: "Same cabin, booked direct with the manager — no Airbnb service fee." },
  { file: "2-listing.png", panel: "1-listing.png", headline: "Open any Airbnb or Vrbo listing", sub: "Easy Rental Search reads the photos, location, host and details." },
  { file: "3-searching.png", panel: "2-progress.png", headline: "An AI agent searches the web for you", sub: "Property names, exact description phrases, the host's management company…" },
  { file: "4-reverse.png", panel: "4-reverse.png", headline: "Free reverse image search on every photo", sub: "Google Lens, Bing, Yandex and TinEye — owners reuse photos on their own sites." },
];

const browser = await chromium.launch({ executablePath: process.env.PW_CHROME || undefined });
const render = async (html, W, H, out, dpr = 1) => {
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: dpr });
  await page.setContent(html, { waitUntil: "load" });
  await page.screenshot({ path: out });
  await page.close();
};
fs.mkdirSync("store/screenshots", { recursive: true });
fs.mkdirSync("media", { recursive: true });
fs.mkdirSync(".dev/video", { recursive: true });

for (const s of SHOTS) {
  const { html } = stage({ W: 1280, H: 800, ...s });
  await render(html, 1280, 800, `store/screenshots/${s.file}`); // Web Store: exactly 1280x800
  await render(html, 1280, 800, `media/${s.file}`, 2); // retina copy for social posts
}
await render(card({ W: 440, H: 280, title: "Easy Rental<br>Search", sub: "Skip the booking fees.", small: true }), 440, 280, "store/promo-small-440x280.png");
await render(card({ W: 1400, H: 560, title: "Easy Rental Search", sub: "Found a rental on Airbnb or Vrbo?<br>Find it on its <em>own website</em> and skip the booking fees." }), 1400, 560, "store/promo-marquee-1400x560.png");

// Video backgrounds (1920x1080) with an empty slot where the recorded panel goes.
const VIDEO = [
  { file: "bg-open.png", headline: "Found a rental on Airbnb? Open <em>Easy Rental Search</em>", sub: "It reads the photos, location, host and details." },
  { file: "bg-search.png", headline: "An AI agent searches the web for its <em>own website</em>", sub: "Real run, sped up." },
  { file: "bg-found.png", headline: "Found it: same cabin, <em>booked direct</em>", sub: "With the property manager, no Airbnb service fee." },
  { file: "bg-free.png", headline: "Plus free reverse image search on every photo", sub: "Free & open source." },
];
let slot;
for (const v of VIDEO) {
  const st = stage({ W: 1920, H: 1080, headline: v.headline, sub: v.sub, slotOnly: true, scale: 1.45 });
  slot = st.slot;
  await render(st.html, 1920, 1080, `.dev/video/${v.file}`);
}
await render(card({ W: 1920, H: 1080, title: "Easy Rental Search", sub: "Found a rental on Airbnb?<br>Find it on its <em>own website</em> and skip the booking fees." }), 1920, 1080, ".dev/video/intro.png");
await render(card({ W: 1920, H: 1080, title: "Easy Rental Search", sub: "Free Chrome extension · open source<br>github.com/griffincockfoster56/easy-rental-search" }), 1920, 1080, ".dev/video/outro.png");
fs.writeFileSync(".dev/video/slot.json", JSON.stringify(slot));

// Portrait (4:5) cut for phones: the panel big and centered under the caption.
const PW = 1080, PH = 1350, pSlot = { w: 560, h: 1120, x: Math.round((1080 - 560) / 2), y: 200 };
const portrait = (headline) => `<!doctype html><html><head><style>*{margin:0;box-sizing:border-box}
  body{width:${PW}px;height:${PH}px;overflow:hidden;font-family:${FONT};color:#fff8e7;background:radial-gradient(120% 90% at 0% 0%,#1bb38c 0%,#0e8a6c 45%,#085846 100%)}
  .head{height:${pSlot.y}px;display:flex;align-items:center;justify-content:center;gap:22px;padding:0 50px;text-align:left}
  .head img{width:84px;height:84px;border-radius:20px;box-shadow:0 6px 18px rgba(0,0,0,.25)}
  h1{font-size:46px;font-weight:800;letter-spacing:-.02em;line-height:1.08}
  em{font-style:normal;color:#ffc94d}
  .slot{position:absolute;left:${pSlot.x - 10}px;top:${pSlot.y - 10}px;width:${pSlot.w + 20}px;height:${pSlot.h + 40}px;border-radius:30px;background:#0b3d31;box-shadow:0 24px 60px rgba(0,0,0,.4)}
  </style></head><body><div class="head"><img src="${logo}"><h1>${headline}</h1></div><div class="slot"></div></body></html>`;
for (const v of VIDEO) await render(portrait(v.headline.replace("Found a rental on Airbnb? Open ", "Found a rental on Airbnb?<br>Open ")), PW, PH, `.dev/video/p-${v.file}`);
fs.writeFileSync(".dev/video/pslot.json", JSON.stringify(pSlot));
await browser.close();
console.log("rendered; video slot", slot);
