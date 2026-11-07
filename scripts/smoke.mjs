// Loads the unpacked extension and checks the side panel boots without errors.
import { chromium } from "playwright";
import path from "node:path";
const ext = path.resolve("extension");
const ctx = await chromium.launchPersistentContext("", {
  executablePath: process.env.PW_CHROME,
  headless: true,
  args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`],
});
let sw = ctx.serviceWorkers()[0] || (await ctx.waitForEvent("serviceworker"));
const id = sw.url().split("/")[2];
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
await page.goto(`chrome-extension://${id}/sidepanel.html`);
await page.waitForTimeout(2500);
console.log("id", id, "visible empty:", await page.isVisible("#empty"), "errors:", errors);
await page.screenshot({ path: "/tmp/ers-smoke.png" });
await ctx.close();
