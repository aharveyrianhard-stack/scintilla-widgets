/* M48 — THE SCINTILLAS PAGE. Alan, 24 Sep: "there should be a multi-chart layout on station that
   displays these kinds of things. It puts that chart on there. These scintillas go to station."
   What is pinned here: the page exists and is walked like every other page; it fills ITSELF from
   the store — newest replacing oldest, biggest first, one chart per name; each chart says why it
   is there in the Hub's words and never in Greek; and an empty store shows an empty page, not
   yesterday's. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../deck/scenes.js", import.meta.url), "utf8");
const context = { globalThis: {} };
vm.runInNewContext(source, context);
const scenes = context.globalThis.StationScenes;
const deck = fs.readFileSync(new URL("../deck/index.html", import.meta.url), "utf8");

/* rows exactly as public.scintillas serves them: newest first */
const row = (ticker, minutesAgo, magnitude, movePct, extra = {}) => ({
  ts: new Date(Date.parse("2026-09-23T20:00:00Z") - minutesAgo * 60000).toISOString(),
  kind: "price_outlier", subject: ticker, subject_kind: "ticker",
  direction: movePct > 0 ? 1 : -1, magnitude,
  detail: { move_pct: movePct, daily_vol_pct: 3.2, n_days: 60, asset_class: "equity" }, ...extra,
});
/* the five that were actually stored on 23 Sep, in the order the store returns them */
const SEP23 = [row("MCD", 120, 3.4, -4.57), row("ABNB", 150, 2.7, -7.36),
  row("BYND", 96, 2.4, -12.16), row("NEE", 200, 2.3, -2.61), row("BKNG", 260, 2.0, -4.95)];

test("SCINTILLAS is a page: in the list, in the menu, and reachable by the arrows", () => {
  const screen = scenes.screenForScene("scintillas");
  assert.ok(screen, "it is a page");
  assert.equal(screen.label, "SCINTILLAS");
  assert.ok(scenes.IDS.includes("scintillas"));
  assert.match(deck, /<option value="scintillas">scintillas<\/option>/, "and it is in the jump list");
  /* walking forward from every page reaches it, and walking back from it returns */
  const reached = new Set();
  let at = scenes.SCREENS[0].scene;
  for (let i = 0; i < scenes.SCREENS.length; i++) { at = scenes.nextScreen(at).scene; reached.add(at); }
  assert.ok(reached.has("scintillas"), "the right arrow gets there");
  assert.ok(scenes.previousScreen("scintillas"), "and the left arrow leaves it");
  assert.equal(scenes.shortLabel(screen).length <= 11, true,
    "the rail button is a fixed 81px ≈ eleven characters, so the name must fit without ambiguity");
  assert.ok(!scenes.ROTATION_SCENES.includes("scintillas"),
    "auto-rotate keeps cycling the curated nine: this is a page you go to, not a slideshow");
});

test("it is filled by the store, so the preset path must never claim it", () => {
  assert.deepEqual(Array.from(scenes.PRESETS.scintillas.tickers), [], "no rows of its own");
  assert.equal(scenes.PRESETS.scintillas.chartCount, 6);
  assert.match(deck, /if \(scene === "scintillas"\) return null;/,
    "fixedSceneState hands it to the store branch, like the cohort page");
  assert.match(deck, /const SCINT_SEL = "scintillas\?select=ts,kind,subject,subject_kind,direction,magnitude,detail&order=ts\.desc/,
    "and it reads the same rows the Hub's strip lists");
  assert.ok(!/scintillas[\s\S]{0,300}(insert|upsert|POST)/i.test(deck), "the page writes nothing");
});

test("BIGGEST FIRST: the loudest scintilla is chart one", () => {
  const page = scenes.scintillasPage(SEP23, 6);
  assert.deepEqual(Array.from(page.tickers), ["MCD", "ABNB", "BYND", "NEE", "BKNG"],
    "3.4×, 2.7×, 2.4×, 2.3×, 2.0× — the store's own order was by time, not by size");
  assert.equal(page.chartCount, 6, "five names in a six-up wall, with one empty slot");
  assert.equal(page.empty, false);
});

test("NEWEST REPLACING OLDEST: a full wall drops the oldest, not the smallest", () => {
  const many = [row("NEW1", 1, 2.1, 5), row("NEW2", 2, 2.2, -6)].concat(SEP23);
  const page = scenes.scintillasPage(many, 6);
  assert.equal(page.tickers.length, 6);
  assert.ok(page.tickers.includes("NEW1") && page.tickers.includes("NEW2"), "the two newest are on the wall");
  assert.ok(!page.tickers.includes("BKNG"), "and the oldest of the six it replaced is off it");
  assert.deepEqual(Array.from(page.tickers), ["MCD", "ABNB", "BYND", "NEE", "NEW2", "NEW1"],
    "what is left is still ordered biggest first");
});

test("one chart per name: a ticker that scintillated twice keeps its freshest row", () => {
  const page = scenes.scintillasPage([row("BYND", 5, 2.9, -14.0), row("BYND", 96, 2.4, -12.16)], 6);
  assert.deepEqual(Array.from(page.tickers), ["BYND"]);
  assert.equal(page.cards[0].magnitude, 2.9, "the newer row wins");
  assert.match(page.cards[0].label, /−14\.0%/);
});

test("a release is not a chart: only tickers reach the wall", () => {
  const page = scenes.scintillasPage([
    { ts: "2026-09-23T18:30:00Z", kind: "econ_surprise", subject: "Core CPI", subject_kind: "event", magnitude: 9 },
  ].concat(SEP23), 6);
  assert.ok(!page.tickers.includes("Core CPI"));
  assert.equal(page.tickers.length, 5, "the 9× release does not take a chart slot from a name");
});

test("every chart says WHY it is there, in the Hub's words", () => {
  const page = scenes.scintillasPage(SEP23, 6);
  const byT = Object.fromEntries(page.cards.map((c) => [c.ticker, c.label]));
  assert.equal(byT.BYND, "−12.2% · 2.4× its usual day · 2:24 PM", "the exact sentence Alan asked for");
  assert.equal(byT.MCD, "−4.6% · 3.4× its usual day · 2:00 PM");
  for (const label of Object.values(byT)) {
    assert.ok(!/σ/.test(label), "no Greek letter on a chart label");
    assert.ok(!/undefined|NaN|null/.test(label), "no half-formed number: " + label);
  }
  const earn = scenes.scintillasPage([{ ts: "2026-09-23T20:05:00Z", kind: "earnings_surprise", subject: "MU",
    subject_kind: "ticker", magnitude: 3.1, detail: {} }], 6);
  assert.equal(earn.cards[0].label, "earnings · 3.1× its usual surprise · 4:05 PM",
    "an earnings surprise says what it is, and has no daily move to quote");
});

test("nothing is invented: a row with no numbers still charts, and simply says less", () => {
  const page = scenes.scintillasPage([{ ts: "2026-09-23T19:00:00Z", kind: "price_outlier",
    subject: "XYZ", subject_kind: "ticker", magnitude: null, detail: {} }], 6);
  assert.deepEqual(Array.from(page.tickers), ["XYZ"]);
  assert.equal(page.cards[0].label, "3:00 PM");
});

test("an empty store is an empty page, never yesterday's", () => {
  const page = scenes.scintillasPage([], 6);
  assert.deepEqual(Array.from(page.tickers), []);
  assert.equal(page.empty, true);
  assert.equal(page.chartCount, 1);
  assert.match(deck, /SCINT_NOTE = SCINT_ROWS\.length \? "" : "no scintillas stored today"/, "and it says so");
  assert.match(deck, /scintillas could not be read — showing nothing rather than something stale/,
    "a failed read shows nothing rather than something stale");
});

test("a three-scintilla day is three charts, not a snap to two", () => {
  const page = scenes.scintillasPage(SEP23.slice(0, 3), 6);
  assert.equal(page.chartCount, 3);
  assert.match(deck, /if \(fromPreset && \(scene === "cohort" \|\| scene === "scintillas"\)\)/,
    "the page owns its own count, like a cohort page");
});

test("the label lives in the pane header and leaves with the page", () => {
  assert.match(deck, /why\.className = "why";/, "every chart pane carries the slot");
  assert.match(deck, /\.pane > \.why:empty\{ display:none; \}/, "and it takes no room when it is empty");
  assert.match(deck, /\.pane > \.why\{ position:absolute;[^}]*bottom:6px/,
    "it sits in the pane itself: a chart pane's HEADER is hidden unless the slot is being edited");
  assert.match(deck, /const label = SCENE === "scintillas" \? \(SCINT_LABELS\.get\(CLEAN\(CHARTS\[i\]\)\) \|\| ""\) : "";/,
    "another page clears it rather than leaving a stale reason behind");
  assert.match(deck, /\.pane > \.why\{[^}]*font-size:11px/, "body text is at least 11px");
});
