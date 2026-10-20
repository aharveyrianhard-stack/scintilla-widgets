// Y7: the SCINTILLA feed itself, tall enough to show the search clips - the pane standalone, at the width it has on
// the 2560 wall (today 614 px, the build 1296 px), 1800 px tall, every tile with no SCINTILLA account framed and named.
//   node y7-feed.mjs <tag> <root> <width>
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
import { chromium, EXE, serve } from "../../../20261001/station-layout-workshop/harness/rig.mjs";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const TAG = process.argv[2] || "today", ROOT = path.resolve(process.argv[3]), W = +(process.argv[4] || 614), H = 1800;
const SHOTS = path.resolve(HERE, "../shots"), MEASURE = path.resolve(HERE, "../measure");
const { server, origin } = await serve(ROOT);
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ["--no-sandbox", "--mute-audio"] });
const context = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
await context.route("**/*", (route) => ["GET", "HEAD", "OPTIONS"].includes(route.request().method()) ? route.fallback() : route.abort());
const page = await context.newPage();
await page.goto(origin + "/station-shells/scintilla-video-v1/?feed=scintilla&cols=2", { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForSelector("#grid .card", { timeout: 90000 });
await page.waitForTimeout(6000);
const res = await page.evaluate(() => {
  const byId = typeof BYID === "object" ? BYID : {}; let search = 0, searchVisible = 0, visible = 0;
  const cards = [...document.querySelectorAll("#grid .card")];
  for (const c of cards) {
    const v = byId[c.dataset.v]; const a = Array.isArray(v && v.subscription_accounts) ? v.subscription_accounts.map((s) => String(s).toLowerCase()) : [];
    const r = c.getBoundingClientRect(), inView = r.bottom > 0 && r.top < innerHeight; if (inView) visible++;
    if (a.includes("scintilla")) continue; search++; if (inView) searchVisible++;
    c.style.outline = "4px solid #FF8A00"; c.style.outlineOffset = "-4px";
    const t = document.createElement("div"); t.textContent = "SEARCH" + (v && v.tickers ? " · " + String(v.tickers).split(",")[0] : "");
    t.style.cssText = "position:absolute;left:8px;top:8px;z-index:3;background:#FF8A00;color:#000;font:700 13px/1.4 ui-monospace,Menlo,monospace;padding:2px 8px;letter-spacing:.08em";
    const th = c.querySelector(".thumb"); if (th) th.appendChild(t);
  }
  const tile = cards[0] ? cards[0].querySelector(".thumb").getBoundingClientRect() : null;
  return { width: innerWidth, height: innerHeight, tiles: cards.length, search, visible, searchVisible, tile: tile && { w: Math.round(tile.width), h: Math.round(tile.height) },
    lists: [...document.querySelectorAll("#chips .btn:not(.mode)")].map((b) => b.textContent.trim()), list: typeof LIST === "string" ? LIST : null,
    menuHasMarket: [...document.querySelectorAll("#more *, #feedProfile option")].some((n) => /market/i.test(n.textContent || "")) };
});
await page.screenshot({ path: path.join(SHOTS, TAG + "-feed.png") });
fs.writeFileSync(path.join(MEASURE, "feed-" + TAG + ".json"), JSON.stringify(res, null, 2));
console.log(TAG, JSON.stringify(res));
await browser.close(); server.close(); process.exit(0);
