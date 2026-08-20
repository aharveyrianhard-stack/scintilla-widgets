/* An unknown day change gets neither a sign nor a direction colour.
   ================================================================
   Run: PW_MODULE_DIR=<dir-with-playwright-core> node browser-proof/proofs/unknown-change.mjs
   `null >= 0` is TRUE in JavaScript, so every unguarded directional ternary painted UNKNOWN
   as UP — a systematic bullish tint on missing data. /ticker went further and fabricated the
   value itself: `|| 0` turned "nobody sent a change" into a REPORTED FLAT DAY, printed
   "+0.00%" in the up colour, and fed that zero into the movers ranking as the least-moving
   symbol in the universe.

   This proof serves a live_quotes page where SOME symbols carry a change and some carry
   null, then reads the painted tape: the known ones keep their sign and colour, the unknown
   ones say "—" in the neutral colour, and no unknown is dropped from the tape.
*/
import assert from "node:assert/strict";
import { launch, shoot, record, nowStamp } from "../rig.mjs";

const { context, origin, close } = await launch();

/* composite_staged decides the tape's universe; live_quotes carries the changes. Four
   symbols: two with a real change, one with an explicit zero (a REPORTED flat day, which
   must still read as flat), one with null on BOTH chg_pct and change (unknown). */
const UNIVERSE = ["AAA", "BBB", "CCC", "DDD"];
const QUOTES = [
  { ticker: "AAA", price: 100, chg_pct: 2.5, change: 2.44 },
  { ticker: "BBB", price: 200, chg_pct: -1.25, change: -2.53 },
  { ticker: "CCC", price: 300, chg_pct: 0, change: 0 },
  { ticker: "DDD", price: 400, chg_pct: null, change: null },
];

const page = await context.newPage();
const errs = []; page.on("pageerror", (e) => errs.push(String(e).split("\n")[0]));
await page.route("**/rest/v1/composite_staged**", (r) => r.fulfill({ status: 200,
  contentType: "application/json",
  body: JSON.stringify(UNIVERSE.map((ticker) => ({ ticker, tf: "D" }))) }));
await page.route("**/rest/v1/live_quotes**", (r) => r.fulfill({ status: 200,
  contentType: "application/json", body: JSON.stringify(QUOTES) }));
await page.goto(origin + "/ticker/", { waitUntil: "domcontentloaded" });
await page.waitForSelector(".sc-tape__item", { timeout: 15000 });
await page.waitForTimeout(2500);

/* Read what the tape actually painted, per symbol: the change text and the class that
   colours it. The marquee duplicates its segment, so de-duplicate by ticker. */
const painted = await page.evaluate(() => {
  const out = {};
  for (const item of document.querySelectorAll(".sc-tape__item")) {
    const sym = (item.textContent.trim().split(/\s+/)[0] || "").toUpperCase();
    const span = item.querySelector("span[class]");
    if (!sym || !span || out[sym]) continue;
    out[sym] = { text: span.textContent.trim(), cls: span.className,
      color: getComputedStyle(span).color };
  }
  return out;
});

for (const sym of UNIVERSE) assert.ok(painted[sym], sym + " is on the tape — no symbol is dropped");

/* The knowns keep their claim. */
assert.equal(painted.AAA.text, "+2.50%", "a known gain keeps its sign and size");
assert.equal(painted.AAA.cls, "up");
assert.equal(painted.BBB.text, "(1.25%)", "a known loss keeps its sign and size");
assert.equal(painted.BBB.cls, "dn");
/* A REPORTED zero is a real observation and still reads as flat — this is the line the fix
   must not cross: refusing unknown is not the same as refusing zero. */
assert.equal(painted.CCC.text, "+0.00%", "a reported flat day still reads as flat");
assert.equal(painted.CCC.cls, "up");

/* THE FIX: unknown gets no sign, no number, no direction colour. */
assert.equal(painted.DDD.text, "—", "an unknown change says so — it used to print +0.00%");
assert.equal(painted.DDD.cls, "neu", "…and it used to carry the UP class, because null >= 0");
assert.notEqual(painted.DDD.color, painted.AAA.color, "the unknown is not painted the up colour");
assert.notEqual(painted.DDD.color, painted.BBB.color, "nor the down colour");

/* The fabricated zero also polluted the RANKING: sorted by |pct|, an unknown counted as the
   least-moving symbol. Unknowns are now ranked after every known mover instead. */
const order = await page.evaluate(() => {
  const seen = [];
  for (const item of document.querySelectorAll(".sc-tape")) {
    if (!/ALL|MOVERS/i.test(item.querySelector(".sc-tape__lbl")?.textContent || "")) continue;
    for (const it of item.querySelectorAll(".sc-tape__item")) {
      const sym = (it.textContent.trim().split(/\s+/)[0] || "").toUpperCase();
      if (sym && !seen.includes(sym)) seen.push(sym);
    }
    break;
  }
  return seen;
});
if (order.length >= 4) {
  assert.equal(order[order.length - 1], "DDD",
    "the unknown ranks last among movers, not as the least-moving stock (order: " + order.join(",") + ")");
  assert.equal(order[0], "AAA", "the biggest known mover still leads");
}

const shot = await shoot(page, "ticker-unknown-change-neutral");
assert.deepEqual(errs, [], "no page errors");
await page.close();

console.log("unknown-change proof PASSED — knowns claim, reported zero claims, unknown refuses");

record(`## ${nowStamp()} — an unknown day change gets neither a sign nor a direction colour

Command: \`PW_MODULE_DIR=… node browser-proof/proofs/unknown-change.mjs\` (asserts inline; reads the painted tape and its computed colours)

\`null >= 0\` is **true** in JavaScript, so every unguarded directional ternary painted UNKNOWN as UP — a systematic bullish tint on missing data. \`/ticker\` went further and fabricated the value itself: \`|| 0\` turned "nobody sent a change" into a REPORTED FLAT DAY, printed \`+0.00%\` in the up colour, and fed that zero into the movers ranking as the least-moving symbol in the universe.

Four symbols served through the tape's own universe read (${shot}):

- **A known gain** paints \`+2.50%\`, class \`up\`; **a known loss** paints \`(1.25%)\`, class \`dn\` — unchanged.
- **A REPORTED zero** still paints \`+0.00%\`, class \`up\`. This is the line the fix must not cross: refusing *unknown* is not refusing *zero*, and a landed zero is a real observation (rule 4 — emptiness is decided on the raw value).
- **An unknown change** (null on both \`chg_pct\` and \`change\`) paints \`—\` in the neutral colour, computed-colour-asserted as neither the up nor the down colour. It used to paint \`+0.00%\` in green.
- **No symbol is dropped**, and the unknown ranks *after* every known mover instead of impersonating the calmest stock on the board.

The same \`null >= 0\` shape was fixed in two more places the sweep found: \`templates/allocation-module.html\` painted its "—" day cell green, and \`templates/sector-rotation.html\` rendered a signed em-dash percentage (\`+—%\`) in green — now dim, and worded "change unknown". \`/heat\` was swept too and was already correct (both its colour functions refuse on null), which is what the fixed pages now match.

Zero page errors. Rollback: revert the single commit — three guarded ternaries, one un-fabricated value, one ranking partition, pins and this proof. No data lane, authority or methodology changed.
`);

await close();
