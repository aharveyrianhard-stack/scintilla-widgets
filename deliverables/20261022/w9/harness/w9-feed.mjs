// W9: the SCINTILLA feed pane standalone against the LIVE tables, read only (every request that is not GET/HEAD/OPTIONS is
// aborted), at a clock of our choosing: "now" leaves the browser's clock alone; an ISO time fixes Date for the page
// (Playwright clock.setFixedTime: timers keep running). The database's own clock is never moved: what YouTube and the
// table say is tonight's; only what the page does with it moves.
//   node w9-feed.mjs <tag> <root> <now|ISO> [width] [height]
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
import { chromium, EXE, serve } from "../../../20261001/station-layout-workshop/harness/rig.mjs";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const TAG = process.argv[2] || "build", ROOT = path.resolve(process.argv[3]), CLOCK = process.argv[4] || "now";
const W = +(process.argv[5] || 1312), H = +(process.argv[6] || 980);
const SHOTS = path.resolve(HERE, "../shots"), MEASURE = path.resolve(HERE, "../measure");
fs.mkdirSync(SHOTS, { recursive: true }); fs.mkdirSync(MEASURE, { recursive: true });
const { server, origin } = await serve(ROOT);
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ["--no-sandbox", "--mute-audio"] });
const context = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
const refused = [];
await context.route("**/*", (route) => {
  const req = route.request();
  if (["GET", "HEAD", "OPTIONS"].includes(req.method())) return route.fallback();
  refused.push(req.method() + " " + req.url().replace(/\?.*$/, ""));
  return route.abort();
});
const page = await context.newPage();
if (CLOCK !== "now") await page.clock.setFixedTime(new Date(CLOCK));
await page.goto(origin + "/station-shells/scintilla-video-v1/?feed=scintilla", { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForSelector("#grid .card", { timeout: 90000 });
await page.waitForTimeout(5000);
const res = await page.evaluate(() => {
  const cards = [...document.querySelectorAll("#grid .card")];
  return { at: new Date().toISOString(), width: innerWidth, height: innerHeight, tiles: cards.length,
    first: cards.slice(0, 16).map((c, i) => ({ n: i + 1, video: c.dataset.v,
      badge: (c.querySelector(".dur") || {}).textContent || "", due: !!c.querySelector(".dur.due"),
      age: (c.querySelector(".age") || {}).textContent || "", channel: (c.querySelector(".ch") || {}).textContent || "",
      title: ((c.querySelector(".t") || {}).textContent || "").slice(0, 70) })) };
});
res.clock = CLOCK; res.refused_writes = refused;
await page.screenshot({ path: path.join(SHOTS, TAG + ".png") });
fs.writeFileSync(path.join(MEASURE, TAG + ".json"), JSON.stringify(res, null, 2));
console.log(TAG, CLOCK, "tiles", res.tiles, "refused", refused.length);
for (const t of res.first.slice(0, 10)) console.log(" ", t.n, (t.badge || "-").padEnd(16), t.due ? "DUE" : "   ", (t.age || "").padEnd(9), t.channel.slice(0, 22).padEnd(22), "|", t.title.slice(0, 50));
await browser.close(); server.close(); process.exit(0);
