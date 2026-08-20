/* Filed defect 3, AFTER: AI POWER shows its declared rows.
   =======================================================
   Run: PW_MODULE_DIR=<dir-with-playwright-core> node browser-proof/proofs/family-scene.mjs
   scenes.js declares AI_POWER = OKLO, IREN, CIFR, BE, WULF, USAR. Before this unit,
   familyBasket() was never given an id, so every family scene rendered its FIRST basket
   forever and those rows were unreachable.
*/
import assert from "node:assert/strict";
import { launch, shoot, record, nowStamp } from "../rig.mjs";

const { context, origin, close } = await launch();
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));

const slots = () => page.$$eval("input.tkin", (ns) =>
  ns.filter((n) => !n.closest(".chart-off")).map((n) => n.value).filter(Boolean));

/* 1 — theme families still lands on its first basket by default (AI COMPUTE). */
await page.goto(origin + "/deck/?scene=themeFamilies", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2500);
assert.deepEqual(await slots(), ["NVDA", "TSM", "AVGO", "ASML", "MU", "SNDK"],
  "the default basket is unchanged");
const pickerVisible = await page.$eval("#familyPicker", (n) => !n.hidden);
assert.equal(pickerVisible, true, "the family picker is visible on a family scene");

/* 2 — choosing AI POWER shows its DECLARED rows. */
await page.selectOption("#familyPick", "AI_POWER");
await page.waitForTimeout(1500);
const power = await slots();
assert.deepEqual(power, ["OKLO", "IREN", "CIFR", "BE", "WULF", "USAR"],
  "AI POWER renders exactly its declared tickers");
const shotPower = await shoot(page, "family-AI_POWER-declared-rows");

/* 3 — the choice survives leaving and re-entering the scene (session memory). */
await page.selectOption("#sceneMode", "indexLeadership");
await page.waitForTimeout(1200);
await page.selectOption("#sceneMode", "themeFamilies");
await page.waitForTimeout(1500);
assert.deepEqual(await slots(), ["OKLO", "IREN", "CIFR", "BE", "WULF", "USAR"],
  "the chosen family survives a scene round-trip");

/* 4 — sector families gets the same selectability: DEFENSIVE is reachable too. */
await page.selectOption("#sceneMode", "sectorFamilies");
await page.waitForTimeout(1500);
assert.deepEqual(await slots(), ["XLK", "XLC", "XLY", "XLI", "XLF", "XLE"], "first basket default");
await page.selectOption("#familyPick", "DEFENSIVE");
await page.waitForTimeout(1500);
assert.deepEqual(await slots(), ["XLP", "XLV", "XLU", "XLRE", "XLB", "SECTOR12"],
  "DEFENSIVE renders its declared tickers");
const shotDef = await shoot(page, "family-DEFENSIVE-declared-rows");

/* 5 — the picker hides off family scenes. */
await page.selectOption("#sceneMode", "live");
await page.waitForTimeout(800);
assert.equal(await page.$eval("#familyPicker", (n) => n.hidden), true, "hidden outside family scenes");

assert.deepEqual(errors, [], "no page errors during the whole flow");
console.log("family-scene proof PASSED");

record(`## ${nowStamp()} — filed defect 3 FIXED and browser-verified: AI POWER shows its declared rows

Command: \`PW_MODULE_DIR=… node browser-proof/proofs/family-scene.mjs\` (asserts inline)

- THEME FAMILIES defaults unchanged (AI COMPUTE: NVDA, TSM, AVGO, ASML, MU, SNDK); the family picker is visible on family scenes and hidden elsewhere.
- Choosing **AI POWER** renders exactly its declared rows — **OKLO, IREN, CIFR, BE, WULF, USAR**: ${shotPower}
- The choice survives leaving and re-entering the scene (session memory).
- SECTOR FAMILIES' **DEFENSIVE** basket is reachable the same way: ${shotDef}
- Zero page errors across the flow.
`);

await close();
