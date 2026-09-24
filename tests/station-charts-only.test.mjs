/* CHARTS ONLY — the wall gives everything to the charts, and the X capture survives it. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const deck = fs.readFileSync(new URL("../deck/index.html", import.meta.url), "utf8");
const rule = (sel) => {
  const i = deck.indexOf(sel);
  assert.ok(i >= 0, "missing rule: " + sel);
  return deck.slice(i, deck.indexOf("}", i) + 1);
};

test("one key and one dock button, and they do the same thing", () => {
  assert.match(deck, /id="chartsOnlyBtn"/, "the dock carries the button");
  assert.match(deck, /event\.key === "w" \|\| event\.key === "W"[\s\S]{0,80}toggleChartsOnly\(\)/,
    "W toggles it");
  assert.match(deck, /b\.addEventListener\("click", toggleChartsOnly\)/, "the button toggles it");
  assert.match(deck, /function toggleChartsOnly\(\) \{ setChartsOnly\(!chartsOnlyOn\(\)\); \}/,
    "both go through one function, so the key and the button can never disagree");
});

test("it is remembered per device", () => {
  assert.match(deck, /const CHARTS_ONLY_KEY = "station\.chartsOnly"/);
  assert.match(deck, /localStorage\.setItem\(CHARTS_ONLY_KEY/, "the choice is written");
  assert.match(deck, /localStorage\.getItem\(CHARTS_ONLY_KEY\) === "1"/, "and read back");
  assert.match(deck, /function wireChartsOnly\(\)[\s\S]{0,200}paintChartsOnly\(\)/,
    "and painted on load, so a reload comes back the way it was left");
});

test("the media row is HIDDEN, not unloaded — the X capture keeps running", () => {
  const r = rule("body.charts-only #rowBot{");
  assert.doesNotMatch(r, /display\s*:\s*none/, "display:none would pull the X iframe out of the render tree");
  assert.doesNotMatch(r, /visibility\s*:\s*hidden/, "visibility:hidden risks the same");
  assert.match(r, /opacity\s*:\s*0/, "it is drawn at zero opacity instead");
  assert.match(r, /position\s*:\s*absolute/, "taken out of the flow so the charts get the wall");
  assert.match(r, /height\s*:\s*38%/, "and it keeps a real size: a pane squeezed to 0px re-lays-out its shell");
  /* the existing per-pane hide, which DOES unload, is untouched and still only used for
     the one video pane that is off the wall */
  assert.match(deck, /#rowBot > \.pane\.video-off\{ display:none; \}/);
});

test("the chart row takes the wall, and nothing else about the deck moves", () => {
  assert.match(rule("body.charts-only #rowTop{"), /flex\s*:\s*1 1 0/);
  assert.match(deck, /body\.stack\.charts-only #rowBot\{[^}]*height\s*:\s*56vh/,
    "the phone column gets the same treatment against its own height");
  /* M43 owns the X pane shell and the bridge this week: this lane may not touch either */
  assert.match(deck, /x: "\/station-shells\/x-v2"/, "the X shell pin is unchanged");
});
