// Renders assets/logo.svg to the PNG icon sizes Chrome needs.
import { chromium } from "playwright";
import fs from "node:fs";
const svg = fs.readFileSync("assets/logo.svg", "utf8");
const browser = await chromium.launch({ executablePath: process.env.PW_CHROME || undefined });
const page = await browser.newPage();
for (const s of [16, 32, 48, 128, 512]) {
  await page.setViewportSize({ width: s, height: s });
  await page.setContent(`<html><body style="margin:0;background:transparent">${svg.replace("<svg ", `<svg width="${s}" height="${s}" `)}</body></html>`);
  const out = s === 512 ? "assets/logo-512.png" : `extension/icons/icon${s}.png`;
  await page.screenshot({ path: out, omitBackground: true });
}
await browser.close();
console.log("icons written");
