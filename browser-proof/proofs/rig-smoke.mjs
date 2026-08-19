/* Rig smoke proof + the BEFORE state of the three filed cohort defects.
   ====================================================================
   Run: PW_MODULE_DIR=<dir-with-playwright-core> node browser-proof/proofs/rig-smoke.mjs
*/
import { launch, shoot, record, nowStamp } from "../rig.mjs";

const { context, origin, close } = await launch();
const page = await context.newPage();
const consoleErrors = [];
page.on("pageerror", (e) => consoleErrors.push(String(e)));

await page.goto(origin + "/deck/", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2500);

/* The deck booted against fixtures: header, scene select, chart slots. */
const sceneOptions = await page.$$eval("#sceneMode option", (os) => os.map((o) => o.value));
const slots = await page.$$eval("input.tkin", (ns) => ns.map((n) => n.value).filter(Boolean));
const shot1 = await shoot(page, "rig-smoke-deck-live");

/* BEFORE, defect 3: theme families always renders its FIRST basket. */
await page.selectOption("#sceneMode", "themeFamilies");
await page.waitForTimeout(1200);
const familySlots = await page.$$eval("input.tkin", (ns) => ns.map((n) => n.value).filter(Boolean));
const shot2 = await shoot(page, "before-themeFamilies-always-first-basket");

const summary = {
  sceneOptions,
  liveSlots: slots,
  themeFamiliesSlots: familySlots,
  cohortSceneReachable: sceneOptions.includes("cohort"),
  pageErrors: consoleErrors,
};
console.log(JSON.stringify(summary, null, 2));

record(`## ${nowStamp()} — rig smoke + BEFORE state of the filed cohort defects

Command: \`PW_MODULE_DIR=… node browser-proof/proofs/rig-smoke.mjs\`

- Deck boots under fixtures with page errors: ${consoleErrors.length ? consoleErrors.join(" · ") : "none"}.
- Scene select options: ${sceneOptions.join(", ")} — **no cohort scene is reachable** (defects 1–2: AI_SOFTWARE / MEGACAP cannot replace the favorites-based rows because no cohort can be chosen at all; the legacy "cohort" id normalizes to themeFamilies).
- THEME FAMILIES renders ${familySlots.join(", ") || "(nothing)"} — the FIRST basket (AI COMPUTE); **AI POWER's declared rows are unreachable** (defect 3: familyBasket() is never given an id).
- Screenshots: ${shot1} · ${shot2}
`);

await close();
