/* M69 · THE LAST TWO SCREENS — TO-DO and SCRATCH, and the timeframe you can always see.
 *
 * Alan, 24 Sep: "one empty six chart screen layout kind of as the ending screen so that I can
 * search tickers in and that it'll work and that they will change"; "I still see ADD gray, tick
 * gray, cumulative tick gray, trend gray... I would send them to an empty layout at the end, as
 * kind of like to do reminders, and kind of save VIX and PCC on their own"; "I'm on the three
 * hour... I kind of do need to know while I'm on screen what time frame I'm viewing."
 *
 * Everything the model can answer is answered by the model, so it is checkable without a browser.
 * The rest is pinned against the deck's real source, because a behaviour nobody can see in the
 * bytes is a behaviour that can quietly go away.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const scenesSource = fs.readFileSync(new URL("../deck/scenes.js", import.meta.url), "utf8");
const context = { globalThis: {} };
vm.runInNewContext(scenesSource, context);
const scenes = context.globalThis.StationScenes;
const deck = fs.readFileSync(new URL("../deck/index.html", import.meta.url), "utf8");

function functionFromDeck(name, bindings = {}) {
  const start = deck.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} must exist`);
  let depth = 0, end = -1;
  for (let i = deck.indexOf("{", start); i < deck.length; i += 1) {
    if (deck[i] === "{") depth += 1;
    else if (deck[i] === "}" && --depth === 0) { end = i + 1; break; }
  }
  return vm.runInNewContext(`(${deck.slice(start, end)})`, bindings);
}

/* ---- SCRATCH, the ending screen ------------------------------------------------------ */

test("SCRATCH is the last page in the deck, and TO-DO is the one before it", () => {
  const order = scenes.SCREENS.map((s) => s.scene);
  assert.equal(order[order.length - 1], "scratch", "SCRATCH ends the deck");
  assert.equal(order[order.length - 2], "todo", "TO-DO sits just before it");
  assert.equal(scenes.nextScreen("scratch").scene, "wkIndexes", "and it wraps to the first page - INDEXES · WEEK since the 25 Sep workflow");
  for (const page of ["todo", "scratch"])
    assert.equal(scenes.ROTATION_IDS.includes(page), false, `${page} is never auto-rotated onto`);
});

test("SCRATCH opens empty: eight slots, no symbol invented for any of them", () => {
  const fresh = scenes.scratchState([], "3h");
  assert.equal(fresh.chartCount, 8, "eight since 25 Sep: SAVE AS TARGETS takes up to eight");
  assert.deepEqual(Array.from(fresh.tickers), ["", "", "", "", "", "", "", ""]);
  assert.equal(fresh.empty, true);
  assert.equal(Array.from(fresh.tickers).some(Boolean), false,
    "no SPY/SNDK starter: an empty slot on SCRATCH is the state the user left");
});

test("SCRATCH is a workspace, not a preset — which is what keeps it eight slots wide", () => {
  /* Found in a real browser during this build: with a PRESETS entry, the deck treated SCRATCH
     as a fixed page, handed its empty ticker list to basketWindow, got a chartCount of one and
     opened the "empty six" as a TWO-up wall. The page has no preset now, and says so. */
  assert.equal(scenes.PRESETS.scratch, undefined, "an empty fixed page collapses; SCRATCH is not one");
  assert.match(deck, /if \(scene === "scratch"\) return null;/, "fixedSceneState refuses it by name");
  assert.match(deck, /RANGES\.includes\(QS\.get\("range"\)\) \? QS\.get\("range"\) : "3h";/,
    "and the wall still opens on 3h unless a URL or SCRATCH's own memory says otherwise");
  assert.equal(scenes.scratchState([], "3h").chartCount, 8, "eight slots, from the model (grown from six on 25 Sep so a scratch wall can be saved as the eight TARGETS)");
});

test("SCRATCH keeps what was typed, cleans it, and keeps the gaps between", () => {
  const state = scenes.scratchState(["aapl", "", "nvda!!", "", "", "x".repeat(20)], "1D");
  assert.deepEqual(Array.from(state.tickers), ["AAPL", "", "NVDA", "", "", "XXXXXXXXXXXX", "", ""], "eight slots since 25 Sep");
  assert.equal(state.range, "1D");
  assert.equal(state.totalItems, 3, "an empty slot is not a chart");
  assert.equal(scenes.scratchState(["SPY"], "3h", 8).tickers.length, 8, "an eight-up scratch wall is eight slots");
});

test("copy layout is one line, and an empty slot is part of what it says", () => {
  const line = scenes.scratchLayout(["MU", "", "SNDK", "", "", ""], "3h");
  assert.equal(line.includes("\n"), false, "one line, so it survives a text message");
  assert.deepEqual(JSON.parse(line), { scene: "scratch", tickers: ["MU", "", "SNDK", "", "", "", "", ""], range: "3h" },
    "eight slots since 25 Sep, and every empty one is part of what the line says");
  assert.deepEqual(JSON.parse(scenes.scratchLayout(["MU"], "1W", 2)),
    { scene: "scratch", tickers: ["MU", ""], range: "1W" });
});

test("the deck builds that line from the wall in front of Alan, and copies nothing anywhere else", () => {
  assert.match(deck, /const line = SceneModel\.scratchLayout\(CHARTS, RANGE, CHART_COUNT\);/,
    "the copied line is this wall's own symbols, count and timeframe");
  assert.match(deck, /await navigator\.clipboard\.writeText\(line\)/);
  assert.match(deck, /button\.textContent = ok \? "copied" : "copy failed";/,
    "the button says whether the clipboard took it");
  assert.match(deck, /\(ok \? "layout copied · " : "clipboard refused · "\) \+ line/,
    "and the line itself is shown either way, so it can always be read off the screen");
  const copySection = deck.slice(deck.indexOf("async function copyScratchLayout"), deck.indexOf("el(\"copyLayout\").addEventListener"));
  assert.doesNotMatch(copySection, /fetch\(|XMLHttpRequest|sendBeacon/, "nothing leaves the device");
});

test("SCRATCH is remembered on the device, not just for the tab", () => {
  assert.match(deck, /const DEVICE_WORKSPACES = \["live", "custom", "scratch"\];/);
  assert.match(deck, /const statePrefix = \(\) => SCENE === "custom" \? "station\.custom" : SCENE === "scratch" \? "station\.scratch" : "station\.live";/);
  assert.match(deck, /const SCRATCH_RANGE_KEY = "station\.scratch\.range";/);
  assert.match(deck, /if \(SCENE === "scratch"\) remember\(SCRATCH_RANGE_KEY, RANGE\);/,
    "the one range control for the screen is remembered when it is used");
  /* every localStorage touch in the deck is wrapped, so a browser with storage off still paints */
  assert.match(deck, /const remembered = \(key\) => \{ try \{ return localStorage\.getItem\(key\) \|\| ""; \} catch \(_\) \{ return ""; \} \};/);
  assert.match(deck, /const remember = \(key, value\) => \{ try \{ localStorage\.setItem\(key, value\); \} catch \(_\) \{\} \};/);
});

test("the remembered scratch window is read before the panes mount, and only if it is a real range", () => {
  const range = functionFromDeck("scratchRange", {
    SCRATCH_RANGE_KEY: "station.scratch.range",
    remembered: (key) => (key === "station.scratch.range" ? "12h" : ""),
    RANGES: ["15m", "30m", "1h", "2h", "3h", "4h", "6h", "12h", "1D", "3D", "1W"],
    RANGE: "3h"
  });
  assert.equal(range(), "12h", "SCRATCH opens on the window it was left in");
  const junk = functionFromDeck("scratchRange", {
    SCRATCH_RANGE_KEY: "station.scratch.range",
    remembered: () => "banana",
    RANGES: ["15m", "3h", "1D"],
    RANGE: "3h"
  });
  assert.equal(junk(), "3h", "a stored value that is not a range is ignored, never passed to a chart");
  assert.match(deck, /RANGE = scratchRange\(\);\s*\n\s*state = hasStoredScene\("scratch"\)/,
    "the range is set BEFORE the wall is built, so a scratch chart is not loaded twice");
});

/* ---- clearing a field empties the slot ------------------------------------------------ */

function slotHarness(scene) {
  const notes = [];
  const pane = {
    def: { key: "c1", src: "/station-shells/chart-v1?t=MU", open: "x", short: "MU", title: "MU" },
    frame: { removed: false, remove() { this.removed = true; } },
    body: { querySelector: () => null },
    showCard: (note) => notes.push(note)
  };
  const input = { value: "" };
  const bindings = {
    SCENE: scene,
    CHARTS: ["MU", "", "", "", "", "", "", ""],
    PANES: [pane],
    LIVE: [pane],
    el: (id) => (id === "t1" ? input : { textContent: "" }),
    rememberEditableState: () => {},
    /* 25 Sep (P1): clearing a slot is an edit, and edits reach the shared list */
    shareScratchSoon: () => { notes.push("shared"); },
    closeSymbolGuide: () => {},
    paintChips: () => {},
    paintPaneNotes: () => {}
  };
  return { pane, input, bindings, notes, clear: functionFromDeck("clearSlot", bindings) };
}

test("on SCRATCH, clearing the field empties the slot and takes its chart down", () => {
  const h = slotHarness("scratch");
  h.clear(0, h.input);
  assert.equal(h.bindings.CHARTS[0], "", "the slot is empty");
  assert.equal(h.pane.def.src, "", "and it is no longer pointed at a chart");
  assert.equal(h.pane.frame, null, "the frame is taken down, not left running behind a card");
  assert.equal(h.bindings.LIVE.length, 0, "and it leaves the live budget");
  assert.deepEqual(h.notes, ["empty slot · type a symbol", "shared"],
    "the slot says what it is, and the emptied slot is handed to the shared SCRATCH list (25 Sep)");
});

test("everywhere else, an emptied box still restores the symbol that was there", () => {
  assert.match(deck, /const clearsEmptySlots = \(\) => SCENE === "scratch";/,
    "only SCRATCH treats an empty box as an instruction");
  assert.match(deck, /if \(!n\.value\.trim\(\) && clearsEmptySlots\(\)\) \{ clearSlot\(index, n\); n\.blur\(\); return; \}/,
    "Return on an empty SCRATCH field empties the slot");
  assert.match(deck, /if \(!raw && clearsEmptySlots\(\) && CHARTS\[index\]\) clearSlot\(index, n\);\s*\n\s*else if \(!raw\) n\.value = CHARTS\[index\] \|\| "";/,
    "and a preset page still puts its symbol back, so a stray backspace cannot blank it");
});

test("an unknown symbol is still refused in words, on SCRATCH like everywhere else", () => {
  assert.match(deck, /el\("symbolNote"\)\.textContent = "not charted on Hub";/,
    "a symbol the Hub does not carry is said, never drawn as a black box");
  assert.match(deck, /if \(!obj\.def\.src\) \{ obj\.showCard\(SCENE === "scratch" \? "empty slot \\u00b7 type a symbol" : "empty editable slot"\); return; \}/,
    "and an empty slot mounts nothing at all");
});

/* ---- TO-DO, the reminders ------------------------------------------------------------- */

test("TO-DO holds the four grey internals and the two that were INTERNALS SLOW", () => {
  const todo = scenes.todoState();
  assert.deepEqual(Array.from(todo.tickers), ["ADD", "CUMTICK", "TICK", "TRIN", "TICK", "TRIN"]);
  assert.equal(todo.chartCount, 6, "six slots, so nothing pages and nothing is dropped");
  assert.deepEqual(Array.from(todo.ranges), [null, null, null, null, "1D", "1D"],
    "the last two keep INTERNALS SLOW's own 1D window");
});

test("every TO-DO chart says why it is there, and never claims the number is ours", () => {
  const todo = scenes.todoState();
  for (const note of todo.notes) {
    assert.ok(note && note.length > 10, "every slot carries a reason");
    assert.match(note, /TradingView|INTERNALS SLOW/, "and the reason names whose picture it is");
  }
  assert.match(scenes.todoNote("ADD", 0), /not served natively yet/);
  assert.match(scenes.todoNote("CUMTICK", 1), /no cumulative series of our own/,
    "cumulative tick says plainly that TradingView is drawing plain TICK");
  assert.match(scenes.todoNote("TICK", 4), /was INTERNALS SLOW/, "the 1D pair says where it came from");
  assert.equal(scenes.todoNote("SPY", 0), "", "a symbol that is not on the page gets no reason");
});

test("the note cell is painted for TO-DO and cleared by every other page", () => {
  assert.match(deck, /: SCENE === "todo" \? SceneModel\.todoNote\(CHARTS\[i\], i\) : "";/);
  assert.match(deck, /function paintPaneNotes\(\)/, "one painter serves SCINTILLAS and TO-DO");
});

test("INTERNALS is VIX and PCC on their own, and INTERNALS SLOW is retired into TO-DO", () => {
  assert.deepEqual(Array.from(scenes.PRESETS.internalsFast.tickers), ["VIX", "PCC"]);
  assert.equal(scenes.PRESETS.internalsFast.chartCount, 2);
  assert.equal(scenes.PRESETS.internalsSlow, undefined);
  assert.equal(scenes.normalizeScene("internalsSlow"), "todo");
  assert.equal(scenes.ROTATION_IDS.includes("internalsSlow"), false);
  assert.match(deck, /<option value="todo">to-do<\/option>/);
  assert.match(deck, /<option value="scratch">scratch<\/option>/);
  assert.doesNotMatch(deck, /<option value="internalsSlow">/, "the retired page leaves the menu too");
});

/* ---- the timeframe, always on screen --------------------------------------------------- */

test("the timeframe is said in the strip and again on its own chip when the strip tucks away", () => {
  assert.match(deck, /<span id="tfReadout"/, "in the strip's readout");
  assert.match(deck, /<span id="tfNow"/, "and outside it");
  const tfNowAt = deck.indexOf('<span id="tfNow"');
  const dockEndsAt = deck.indexOf("</div><!-- /#dock -->");
  assert.ok(tfNowAt > dockEndsAt,
    "the chip lives OUTSIDE the dock, because a tucked dock is a transformed box and would carry it away");
  assert.match(deck, /function paintTfNow\(\) \{/);
  assert.match(deck, /for \(const id of \["tfNow", "tfReadout"\]\)/, "one painter, two places, never out of step");
  assert.match(deck, /box\.appendChild\(clouds\);\s*\n\s*paintTfNow\(\);/,
    "it is repainted wherever the timeframe bar is painted, so it cannot lag the wall");
});

test("the timeframe chip wears the dock's clothes: grey, quiet, and legible", () => {
  const rule = deck.match(/#tfNow\{[^}]*\}/);
  assert.ok(rule, "the chip has its own rule");
  assert.match(rule[0], /position:fixed/);
  assert.match(rule[0], /font-size:11px/, "body text is at least 11px");
  assert.match(rule[0], /pointer-events:none/, "it is a readout, never something to click by accident");
  assert.match(rule[0], /z-index:24/, "it sits under the dock, which is z-index 25 and carries its own answer");
  for (const colour of rule[0].match(/#[0-9A-Fa-f]{6}/g) || []) {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(colour.slice(i, i + 2), 16));
    assert.ok(Math.max(r, g, b) - Math.min(r, g, b) <= 24, `${colour} is a grey`);
    assert.ok(Math.max(r, g, b) <= 210, `${colour} is never white`);
  }
});

/* ---- the TradingView panes follow the day ---------------------------------------------- */

test("the TradingView internals are no longer painted grey by us", () => {
  const shells = [
    fs.readFileSync(new URL("../station-shells/chart-v1/index.html", import.meta.url), "utf8"),
    fs.readFileSync(new URL("../chart/index.html", import.meta.url), "utf8")
  ];
  for (const shell of shells) {
    const whole = shell.slice(shell.indexOf("const TV_PANE_URL"), shell.indexOf("/* sym \u2014 the TradingView symbol"));
    assert.ok(whole.length > 100, "the embed configuration is where it was");
    /* the keys the widget is actually sent, with the reasoning stripped out */
    const cfg = whole.replace(/\/\*[\s\S]*?\*\//g, "");
    assert.doesNotMatch(cfg, /lineColor:/, "we no longer overrule the line colour");
    assert.doesNotMatch(cfg, /topColor:|bottomColor:/, "nor the fill under it");
    assert.match(cfg, /backgroundColor:TV_PANE_BG/, "the pane is still our dark panel");
    assert.match(cfg, /gridLineColor:TV_PANE_GRID/, "with our grid");
    assert.match(cfg, /chartType:"area"/,
      "measured: chartType 'line' ignores the key anyway, and area keeps the fill Alan already sees");
    assert.match(whole, /MEASURED HEADLESS, 24 Sep/, "the measurement is written down beside the change");
  }
});

test("the copy layout button belongs to SCRATCH alone, and is somewhere it can be seen", () => {
  assert.match(deck, /<button type="button" class="btn" id="copyLayout" hidden/, "hidden until a page asks for it");
  assert.match(deck, /if \(copy\) copy\.hidden = SCENE !== "scratch";/);
  /* Found in a real browser: the button's first home was the dock's charts section, which the
     23 Sep dock hides outright - so a button that was "not hidden" was still invisible. It rides
     with the timeframe now, which is the section that is always on the strip. */
  const timeframe = deck.slice(deck.indexOf('<span class="dsec" data-sec="timeframe"'),
                               deck.indexOf('<span class="dsec" data-sec="charts"'));
  assert.match(timeframe, /id="copyLayout"/, "it lives in the timeframe section");
  assert.match(deck, /\.dsec\[data-sec="charts"\]\{ display:none !important; \}/,
    "because the charts section is display:none - the trap this test exists to hold shut");
});
