/* THE STATION DOCK — one strip, sections, the arc, and nothing sliding.
   ============================================================================
   Alan, 22 Sep: "The dock behaviour is glitchy. It moves sideways too much." · "I'm trying to
   click the arrows and it moves. That's unacceptable." · "Look how there's a slope. The icons
   get bigger AND they go higher." · "Maybe split it in sections and the behaviour applies within
   the section." · "Maybe fully hide when not in use."
   dockArc returns a SCALE per chip and nothing else. There is no horizontal term to get wrong:
   a chip grows about its own top-centre, so its centre — and every neighbour's — stays exactly
   where the layout put it. The rest of this file pins the wiring around that promise.
   ============================================================================ */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const deck = fs.readFileSync(new URL("../deck/index.html", import.meta.url), "utf8");

function lift(name) {
  const start = deck.indexOf("function " + name + "(");
  assert.notEqual(start, -1, "deck/index.html declares " + name);
  let depth = 0, i = deck.indexOf("{", start);
  for (; i < deck.length; i++) {
    if (deck[i] === "{") depth++;
    else if (deck[i] === "}") { depth--; if (depth === 0) break; }
  }
  return deck.slice(start, i + 1);
}
/* the constants come from the deck itself, so the suite tests the real feel, not a copy */
const constant = (name) => {
  const match = new RegExp("const " + name + " = ([0-9.]+);").exec(deck);
  assert.ok(match, "deck/index.html declares " + name);
  return Number(match[1]);
};
const DOCK_MAX_SCALE = constant("DOCK_MAX_SCALE"), DOCK_REACH = constant("DOCK_REACH"), DOCK_EDGE_PX = constant("DOCK_EDGE_PX");
const sandbox = { Math, Number, Array, Object, JSON, DOCK_MAX_SCALE, DOCK_REACH, DOCK_EDGE_PX };
vm.runInNewContext(lift("dockArc") + "\nglobalThis.dockArc = dockArc;", sandbox);
const dockArc = sandbox.dockArc;
assert.ok(DOCK_MAX_SCALE >= 1.8 && DOCK_MAX_SCALE <= 2.2, "Alan asked for about 2×");

/* A plausible strip: a timeframe section of eight short chips, a divider, then the scenes
   section with a 108 px select, two 22 px arrows, a 50 px select and a 46 px button. */
const strip = () => {
  const boxes = [];
  let left = 120;
  const add = (width, section) => { boxes.push({ left, width, section }); left += width + 5; };
  for (let i = 0; i < 8; i++) add(24 + (i % 4) * 8, "timeframe");
  left += 17;
  for (const w of [108, 22, 22, 50, 46]) add(w, "scenes");
  return boxes;
};
const centre = (box) => box.left + box.width / 2;

test("the chip under the pointer is 2×, its neighbours fall away, and the far end is untouched", () => {
  const boxes = strip();
  const out = dockArc(boxes, centre(boxes[4]));
  assert.ok(Math.abs(out[4].scale - DOCK_MAX_SCALE) < 1e-9, "the pointed-at chip is at full magnification");
  for (let i = 4; i > 0; i--) assert.ok(out[i].scale >= out[i - 1].scale - 1e-9, "scales fall away to the left");
  for (let i = 4; i < 7; i++) assert.ok(out[i].scale >= out[i + 1].scale - 1e-9, "and to the right");
  assert.ok(out[3].scale > 1.3 && out[3].scale < DOCK_MAX_SCALE, "the next chip out is clearly bigger, but smaller than the pointed one");
  assert.equal(out[0].scale, 1, "chips across the section are left at rest");
  assert.equal(out[1].scale, 1);
});

test("nothing slides: the engine has no horizontal output, and the DOM write is scale() only", () => {
  const boxes = strip();
  for (const px of [130, 200, 265, 400, 520, 600])
    for (const step of dockArc(boxes, px)) assert.deepEqual(Object.keys(step).sort(), ["scale", "weight"]);
  const apply = lift("applyDock");
  assert.match(apply, /node\.style\.transform = step\.scale > 1\.005 \? "scale\(" \+ step\.scale\.toFixed\(3\) \+ "\)" : "";/);
  assert.doesNotMatch(apply, /translateX\(/, "no translate is ever written to a chip");
  assert.doesNotMatch(deck.slice(deck.indexOf("function dockArc("), deck.indexOf("function wireDock(")), /\bshift\b/,
    "the word shift is gone from the engine");
});

test("the swell stays inside the section the pointer is in", () => {
  const boxes = strip();
  const out = dockArc(boxes, boxes[7].left + boxes[7].width - 1);
  assert.ok(out[7].scale > 1.8, "the last timeframe chip is still near full size at its own right edge");
  for (let i = 8; i < boxes.length; i++) assert.equal(out[i].scale, 1, "scene chip " + i + " ignores a timeframe swell");
  const out2 = dockArc(boxes, centre(boxes[8]));
  for (let i = 0; i < 8; i++) assert.equal(out2[i].scale, 1, "timeframe chip " + i + " ignores a scenes swell");
  assert.ok(Math.abs(out2[8].scale - DOCK_MAX_SCALE) < 1e-9, "a 108 px select swells exactly like a 24 px chip");
});

test("a wide chip is fully magnified anywhere across it, so pointing at its edge never favours the neighbour", () => {
  const boxes = strip();
  const sel = boxes[8];
  for (const u of [.02, .5, .98]) {
    const out = dockArc(boxes, sel.left + sel.width * u);
    assert.ok(out[8].scale >= out[9].scale - 1e-9 && out[8].scale >= out[7].scale - 1e-9, "the pointed chip is never smaller than a neighbour");
    assert.ok(out[8].scale > 1.85, "and stays close to full size right across it");
  }
});

test("the profile moves continuously as the pointer crosses from one chip to the next", () => {
  const boxes = strip();
  let prev = null;
  for (let px = boxes[0].left - 5; px <= boxes[7].left + boxes[7].width + 5; px += 1) {
    const out = dockArc(boxes, px).map((s) => s.scale);
    if (prev) out.forEach((s, i) => assert.ok(Math.abs(s - prev[i]) < .06,
      "chip " + i + " jumped " + (s - prev[i]).toFixed(3) + " for a one-pixel move at " + px));
    prev = out;
  }
});

test("the pointer off the strip, or on a divider far from any chip, leaves everything at rest", () => {
  const boxes = strip();
  for (const px of [0, 60, 2000]) for (const s of dockArc(boxes, px)) assert.equal(s.scale, 1);
  assert.deepEqual(dockArc([], 100), []);
});

/* ---- and the wiring around it ---- */
const dockCss = deck.slice(deck.indexOf("/* ── THE DOCK"), deck.indexOf("/* FIRST-PAINT SKELETON")).replace(/\/\*[\s\S]*?\*\//g, "");

test("the strip: one line, sections, pinned left, grows from its top edge, wraps only as a fallback, no will-change", () => {
  assert.match(deck, /#dock\{[^}]*flex-wrap:nowrap/, "the strip does not wrap by default");
  assert.match(deck, /#dock\{[^}]*justify-content:flex-start/,
    "it starts at the left edge - Alan, 23 Sep: \"a black space to the left of Station\"");
  assert.match(deck, /#dock\{[^}]*padding-right:calc\(var\(--dock-readout/,
    "and holds the room the pinned readout needs once, on the right");
  /* Alan, 23 Sep: "there's no reason to compress it all into one screen." Nothing may scale the
     strip down to make it fit: it is full size at every width, and scrolls when it runs out of wall. */
  assert.doesNotMatch(dockCss, /zoom:/, "the strip is never shrunk to fit");
  assert.doesNotMatch(deck, /--dock-fit/, "and nothing computes a shrink factor any more");
  assert.match(deck, /#dock\.dock-wrap\{ flex-wrap:wrap;/, "and keeps wrapping as its fallback");
  assert.doesNotMatch(deck, /class="dsec" data-sec="charts"/,
    "the 2/6/8 chart-count section is off the strip, not merely hidden");
  for (const sec of ["scene", "station", "timeframe", "scenes", "video", "more", "readout"])
    assert.match(deck, new RegExp('class="dsec" data-sec="' + sec + '"'), "section " + sec + " exists");
  assert.match(dockCss, /transform-origin:50% 0/, "chips grow from the strip's top edge: tops flat, bottoms trace the curve");
  assert.doesNotMatch(dockCss, /will-change/, "no will-change: Chrome would rasterise the chip at rest size and stretch it");
});

test("what Alan called junk is off the strip but one click away, and the screen readout is not a control", () => {
  const moreStart = deck.indexOf('<div id="moreGroup"');
  const more = deck.slice(moreStart, deck.indexOf("</div>", moreStart));
  for (const id of ["viewMode", "displayBtn", "resetScene", "stationFullBtn", "dockHideToggle"])
    assert.match(more, new RegExp('id="' + id + '"'), id + " lives under ⋯");
  const readoutStart = deck.indexOf('class="dsec" data-sec="readout"');
  const readout = deck.slice(readoutStart, deck.indexOf("</div>", readoutStart));
  assert.match(readout, /id="screenIndicator"/, "screen n / n is a readout");
  assert.doesNotMatch(readout, /<button|<select|<a /, "with nothing clickable in it");
  assert.match(deck, /#dock \.dsec\[data-sec="readout"\]\{[^}]*pointer-events:none/);
  /* The chart count is state a scene sets, kept outside the strip entirely. */
  assert.ok(deck.indexOf('id="chartCount"') > deck.indexOf("</div><!-- /#dock -->"),
    "the count select lives outside the dock, in #dockState");
  assert.doesNotMatch(deck, /countChips/, "and nothing paints count chips any more");
  assert.match(deck, /id="tf"/);
});

test("no white or near-white anywhere in the dock's stylesheet", () => {
  for (const hex of dockCss.match(/#[0-9A-Fa-f]{6}\b/g) || []) {
    const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
    const lightness = (Math.max(r, g, b) + Math.min(r, g, b)) / 2 / 255;
    assert.ok(lightness < .8, hex + " is too close to white (lightness " + lightness.toFixed(2) + ")");
  }
  assert.doesNotMatch(dockCss, /var\(--ink\)|var\(--ink2\)/, "the dock never uses the white or the #C6C8DE tokens");
});

test("auto-hide: two seconds, a lip, remembered per browser, and a switch under ⋯", () => {
  assert.match(deck, /const DOCK_TUCK_AFTER = 2000;/);
  assert.match(deck, /const DOCK_HIDE_KEY = "station\.dock\.autohide";/);
  assert.match(deck, /body\.dock-autohide #dock\.tucked\{ transform:translateY\(calc\(-100% \+ 5px\)\)/, "a 5 px lip");
  assert.match(lift("tuckDock"), /:focus-visible/, "keyboard focus keeps the strip out");
  assert.doesNotMatch(lift("tuckDock").replace(/\/\*[\s\S]*?\*\//g, "").replace(/catch \(_\) \{[^}]*\}/g, ""), /focus-within/,
    "but a chip that merely kept focus after a click must not pin it open");
  assert.match(lift("tuckDock"), /tagName === "SELECT"/, "an open select keeps the strip out");
  assert.match(lift("tuckDock"), /moreGroup/, "an open ⋯ panel keeps the strip out");
  assert.match(lift("wireDock"), /event\.clientY <= 8\) revealDock\(\)/, "the top edge brings it back");
  assert.match(lift("setDockAutoHide"), /localStorage\.setItem\(DOCK_HIDE_KEY/, "remembered per browser");
});

/* ---- round 2: no bunching, full size, and a list that still opens ---- */

test("every chip owns its full 2x footprint at every width, so a neighbour is never reached", () => {
  const reserve = lift("dockReserve");
  assert.match(reserve, /const swell = DOCK_MAX_SCALE;/,
    "the room reserved is the FULL swell - not a smaller one because the window is narrow");
  assert.match(reserve, /node\.style\.setProperty\("--slack", \(node\.offsetWidth \* \(swell - 1\) \/ 2\)/,
    "half of a chip's own growth on each side is its own slot");
  assert.match(reserve, /--dock-sec-h", Math\.ceil\(chipH \* swell \+ 4\)/,
    "and the section is tall enough to hold that growth, so it grows downward");
  assert.match(dockCss, /#dock \.btn, #dock select, #dock \.scene-pick\{[^}]*margin-left:var\(--slack,0px\)/,
    "the slot is real margin, held at rest");
});

test("when it does not fit, the strip scrolls at full size instead of wrapping or shrinking", () => {
  const fit = lift("fitDock");
  assert.match(fit, /if \(natural > available\) dock\.classList\.add\("dock-scroll"\);/,
    "too wide means scroll, not shrink");
  assert.doesNotMatch(fit, /zoom|--dock-fit/, "fitDock cannot make anything smaller");
  assert.match(dockCss, /#dock\.dock-scroll #dockRail\{[^}]*overflow-x:auto/, "the rail is the thing that scrolls");
  assert.match(dockCss, /#dock\.dock-scroll #dockRail\{[^}]*min-height:var\(--dock-sec-h/,
    "and it is tall enough that a swelling chip is not clipped");
});

test("a scrolling strip still magnifies, and the pointer is read in the scrolled frame", () => {
  assert.doesNotMatch(deck.slice(deck.indexOf("const dockMagnifies"), deck.indexOf("function dockContentChanged")),
    /dock-scroll/, "a strip that scrolls magnifies exactly like a wide one");
  assert.match(lift("dockPointerX"), /scroller \? scroller\.scrollLeft : 0/,
    "the pointer is put in the same frame the chip geometry is measured in");
});

test("the data age stands beside the rail, never on top of it", () => {
  assert.match(deck, /<div id="dockRail">/, "the sections scroll inside a rail");
  const rail = deck.slice(deck.indexOf('<div id="dockRail">'), deck.indexOf("</div><!-- /#dockRail -->"));
  assert.doesNotMatch(rail, /data-sec="readout"/, "the readout is outside the rail, so nothing scrolls under it");
  assert.match(dockCss, /#dock\.dock-scroll \.dsec\[data-sec="readout"\]\{[^}]*position:static/,
    "it is not a lid pinned over the strip");
  assert.doesNotMatch(dockCss, /mask-image/,
    "the edge fade is painted, not masked: a mask would anchor the fixed ⋯ panel to the rail");
});

test("the page switcher: first on the strip, first for the keyboard, whole chip opens it", () => {
  assert.match(dockCss, /#dock \.dsec\[data-sec="scene"\]\{ order:1; margin-left:0; \}/, "pinned all the way left");
  assert.match(dockCss, /#dock \.scene-pick select\{[^}]*width:calc\(100% \+ 2px\)/,
    "the list opens from anywhere on the chip, its edge included");
  assert.match(deck, /#dock \.scene-pick\{[^}]*width:46px/, "two letters wide when closed");
  assert.match(lift("paintSceneCode"), /pick\.title = name \? "screen: " \+ name : ""/,
    "and the full name is still carried, not thrown away");
});
