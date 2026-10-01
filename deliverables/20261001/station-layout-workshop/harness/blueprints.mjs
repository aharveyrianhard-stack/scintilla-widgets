// W1: photograph and measure every blueprint at 1680×1050, 2560×1440, iPad 1024×768 and phone 390×844. Headless.
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
import { serve, open } from "./rig.mjs";
const HERE = path.dirname(fileURLToPath(import.meta.url)); const ROOT = path.resolve(HERE, "../../../.."); const OUT = path.resolve(HERE, "..");
const only = process.argv[2]; const LAYOUTS = only ? only.split(",") : ["today","A","B","C"]; const SIZES = (process.argv[3] ? [[+process.argv[3], +process.argv[4]]] : [[1680,1050],[2560,1440],[1024,768],[390,844]]);
const { server, origin } = await serve(ROOT); const res = JSON.parse(fs.existsSync(path.join(HERE, "blueprints.json")) ? fs.readFileSync(path.join(HERE, "blueprints.json"), "utf8") : "{}");
for (const L of LAYOUTS) for (const [w,h] of SIZES) {
  const { browser, context } = await open({ width: w }); const page = await context.newPage(); await page.setViewportSize({ width: w, height: h });
  const charts = w < 900 ? 3 : (w >= 2560 ? 8 : 6);
  await page.goto(origin + "/deliverables/20261001/station-layout-workshop/blueprints/?layout=" + L + "&charts=" + charts); await page.waitForTimeout(w < 900 ? 30000 : 18000);
  const m = await page.evaluate(() => window.__layout()); m.chartsAsked = charts;
  const key = L + "-" + w + "x" + h; res[key] = m; await page.screenshot({ path: path.join(OUT, "shots", `bp-${key}.png`), fullPage: w < 900 });
  if (L === "A" && w === 1680) { // the pointer on the column pauses it; the messy pane takes a ticker
    await page.hover("#ladder"); await page.waitForTimeout(400); res[key].pausedLabel = await page.evaluate(() => document.getElementById("lstate").textContent);
    await page.screenshot({ path: path.join(OUT, "shots", `bp-A-1680x1050-hover.png`) });
    await page.mouse.move(5, 5); await page.evaluate(() => { for (let k = 0; k < 2; k++) document.querySelector(".pane.x")._ladder.step(); }); await page.waitForTimeout(900);
    res[key].afterTwoSteps = await page.evaluate(() => window.__layout().postsFully);
    await page.click(".pane.messy input"); await page.keyboard.type("AVGO"); await page.keyboard.press("Enter"); await page.click(".pane.messy .tf button:nth-child(5)"); await page.click(".pane.messy .ph > button:last-child");
    await page.waitForTimeout(14000); res[key].messyAfter = await page.evaluate(() => ({ remembered: localStorage.getItem("station.messy.v1"), src: document.querySelector(".pane.messy iframe").getAttribute("src") }));
    await page.screenshot({ path: path.join(OUT, "shots", `bp-A-1680x1050-messy-AVGO.png`) });
  }
  console.log(key, JSON.stringify(m)); await browser.close();
  fs.writeFileSync(path.join(HERE, "blueprints.json"), JSON.stringify(res, null, 1));
}
server.close(); process.exit(0);
