// S9 (2 Oct 2026): measure and photograph the v2 mock (mock-v2.html) headless.
//   node mock-shots.mjs measure     every combination — 3 screens × 3 strips × 4 chart counts × 2 PIP sizes — geometry only
//                                   (no wait for the charts), written to harness/mock-plan-v2.json
//   node mock-shots.mjs shots [list] the pictures: charts loaded (22 s), shots/plan-<w>x<h>-strip<k>-pip<p>-c<n>.png
// Headless only; every non-GET request is aborted by the rig.
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
import { serve, open } from "../../../20261001/station-layout-workshop/harness/rig.mjs";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../../../..");
const OUT = path.resolve(HERE, "..");
const MODE = process.argv[2] || "measure";
const SCREENS = [[1680, 1050], [2560, 1440], [1920, 1080]];
const STRIPS = ["today", "-30", "-50"], CHARTS = [2, 4, 6, 9], PIPS = ["L", "S"];
const { server, origin } = await serve(ROOT);
const url = (s, p, c, extra = "") => origin + "/deliverables/20261002/station-floorplan-v2/mock-v2.html?strip=" + s + "&pip=" + p + "&charts=" + c + extra;
const tag = (w, h, s, p, c, extra = "") => `plan-${w}x${h}-strip${s.replace("-", "m")}-pip${p}-c${c}${extra ? "-" + extra.replace(/[^a-z0-9]+/gi, "_") : ""}`;
if (MODE === "measure") {
  const res = {};
  for (const [w, h] of SCREENS) {
    const { browser, context } = await open({ width: w });
    const page = await context.newPage(); await page.setViewportSize({ width: w, height: h });
    await context.route("**/station-shells/**", (r) => r.fulfill({ status: 200, contentType: "text/html", body: "<!doctype html><body style='background:#0A0A0F'>" }));
    for (const s of STRIPS) for (const p of PIPS) for (const c of CHARTS) {
      await page.goto(url(s, p, c)); await page.waitForTimeout(700);
      const m = await page.evaluate(() => window.__floorplan());
      res[`${w}x${h}|${s}|${p}|${c}`] = m;
      console.log(w + "x" + h, "strip", s, "pip", p, "charts", c, "→ strip", m.strip.w, "font", m.xFont, "cpl", m.charsPerLine, "posts", m.postsFully + "/" + m.postsPartly, "pic", m.picture.w + "x" + m.picture.h, "chart0", m.chart0.w + "x" + m.chart0.h, "charts%", Math.round(m.share.charts * 100));
    }
    /* the 6-chart fix candidates: 3 columns (the "weird" one) for the record */
    for (const s of STRIPS) { await page.goto(url(s, "L", 6, "&cols=3")); await page.waitForTimeout(700); res[`${w}x${h}|${s}|L|6|cols3`] = await page.evaluate(() => window.__floorplan()); }
    for (const s of STRIPS) { await page.goto(url(s, "L", 2, "&cols=2")); await page.waitForTimeout(700); res[`${w}x${h}|${s}|L|2|cols2`] = await page.evaluate(() => window.__floorplan()); }
    await browser.close();
  }
  fs.writeFileSync(path.join(HERE, "mock-plan-v2.json"), JSON.stringify(res, null, 1));
} else {
  /* the pictures: at 1680×1050 every strip × every chart count with the large PIP, the small PIP at the slim strip with 9 charts,
     the 6-chart 3-column "weird" grid; at 2560 and 1920 the recommended set (strip −30, 9 charts, both PIPs) */
  const LIST = process.argv[3] ? JSON.parse(process.argv[3]) : [
    ...STRIPS.flatMap((s) => CHARTS.map((c) => [1680, 1050, s, "L", c, ""])),
    [1680, 1050, "-30", "S", 9, ""], [1680, 1050, "-50", "S", 9, ""], [1680, 1050, "-30", "L", 6, "&cols=3"], [1680, 1050, "-30", "L", 2, "&cols=2"],
    [2560, 1440, "today", "L", 9, ""], [2560, 1440, "-30", "L", 9, ""], [2560, 1440, "-30", "S", 9, ""], [2560, 1440, "-30", "L", 4, ""],
    [1920, 1080, "today", "L", 9, ""], [1920, 1080, "-30", "L", 9, ""], [1920, 1080, "-30", "S", 9, ""], [1920, 1080, "-30", "L", 4, ""],
  ];
  const jf = path.join(HERE, "mock-shots-v2.json"); const res = fs.existsSync(jf) ? JSON.parse(fs.readFileSync(jf, "utf8")) : {};
  for (const [w, h, s, p, c, extra] of LIST) {
    const { browser, context } = await open({ width: w });
    const page = await context.newPage(); await page.setViewportSize({ width: w, height: h });
    const errs = []; page.on("pageerror", (e) => errs.push(String(e.message || e).slice(0, 200)));
    await page.goto(url(s, p, c, extra)); await page.waitForTimeout(22000);
    const m = await page.evaluate(() => window.__floorplan()); m.errs = errs;
    const name = tag(w, h, s, p, c, extra); res[name] = m;
    await page.screenshot({ path: path.join(OUT, "shots", name + ".png") });
    console.log(name, "charts%", Math.round(m.share.charts * 100), "chart0", m.chart0.w + "x" + m.chart0.h, "posts", m.postsFully + "/" + m.postsPartly, "cpl", m.charsPerLine, "errs", errs.length);
    await browser.close(); fs.writeFileSync(jf, JSON.stringify(res, null, 1));
  }
}
server.close(); process.exit(0);
