// S8 (2 Oct 2026): photograph and measure the X-strip mock (mock-x-strip.html) headless at 1680×1000, 2560×1440 (the MacBook's
// external), 2240×1260 (the iMac) and the phone 390×844. Reads window.__floorplan() and writes harness/mock-plan.json plus
// shots/plan-<w>x<h>.png. Headless only; every non-GET request is aborted by the rig. node mock-shots.mjs [WxH] [query]
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
import { serve, open } from "../../../20261001/station-layout-workshop/harness/rig.mjs";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../../../..");
const OUT = path.resolve(HERE, "..");
const SIZES = process.argv[2] ? [process.argv[2].split("x").map(Number)] : [[1680, 1000], [2560, 1440], [2240, 1260], [390, 844]];
const QUERY = process.argv[3] || "";
const { server, origin } = await serve(ROOT);
const jf = path.join(HERE, "mock-plan.json");
const res = fs.existsSync(jf) ? JSON.parse(fs.readFileSync(jf, "utf8")) : {};
for (const [w, h] of SIZES) {
  const { browser, context } = await open({ width: w });
  const page = await context.newPage(); await page.setViewportSize({ width: w, height: h });
  const errs = []; page.on("pageerror", (e) => errs.push(String(e.message || e).slice(0, 200)));
  await page.goto(origin + "/deliverables/20261002/station-floorplan/mock-x-strip.html" + (QUERY ? "?" + QUERY : ""));
  await page.waitForTimeout(w < 900 ? 30000 : 22000);
  const m = await page.evaluate(() => window.__floorplan()); m.errs = errs;
  const key = w + "x" + h + (QUERY ? "?" + QUERY : "");
  res[key] = m;
  await page.screenshot({ path: path.join(OUT, "shots", `plan-${w}x${h}${QUERY ? "-" + QUERY.replace(/[^a-z0-9]+/gi, "_") : ""}.png`), fullPage: w < 900 });
  console.log(key, JSON.stringify({ strip: m.strip, xFont: m.xFont, postsFully: m.postsFully, postsPartly: m.postsPartly, video: m.video, charts: m.charts, cols: m.cols, chart0: m.chart0, px: m.px, share: m.share, today: m.today, errs }));
  await browser.close();
  fs.writeFileSync(jf, JSON.stringify(res, null, 1));
}
server.close(); process.exit(0);
