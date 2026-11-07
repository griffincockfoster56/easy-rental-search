// Dev helper: load/reload the unpacked extension into a Chrome started with
// --remote-debugging-port and --enable-unsafe-extension-debugging.
import { chromium } from "playwright";
import path from "node:path";
const port = process.env.CDP_PORT || 9333;
const browser = await chromium.connectOverCDP(`http://localhost:${port}`);
const s = await browser.newBrowserCDPSession();
const { id } = await s.send("Extensions.loadUnpacked", { path: path.resolve("extension") });
console.log(id);
await browser.close();
