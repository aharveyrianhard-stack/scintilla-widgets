/* THE STATION DOCK — one row, and bigger where you point.
   ============================================================================
   Alan, 22 Sep: "I like the top of the station, all of these buttons, to be more like the
   Apple dock... consolidate it all in one row... the apps get bigger where you're selected...
   what we have to reduce is the space these rows take up."
   Two promises are tested here. The first is arithmetic: dockLayout decides how much each
   control swells and how far it slides, and it must never let two controls overlap, never
   push one out of the dock, and never move the control the pointer is actually on. The
   second is that none of it touches layout — the boxes stay exactly where the browser put
   them, which is why a magnified dock cannot move a button out from under a click.
   ============================================================================ */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { execFileSync } from "node:child_process";

const deck = fs.readFileSync(new URL("../deck/index.html", import.meta.url), "utf8");
/* the deployed Station this branch starts from */
const baseDeck = execFileSync("git", ["show", "39f83a2:deck/index.html"], { encoding:"utf8", maxBuffer:64e6 });

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
const DOCK_MAX_SCALE = constant("DOCK_MAX_SCALE"), DOCK_FALLOFF = constant("DOCK_FALLOFF");
const sandbox = { Math, Number, Array, Object, JSON, DOCK_MAX_SCALE, DOCK_FALLOFF };
vm.runInNewContext(lift("dockLayout") + "\nglobalThis.dockLayout = dockLayout;", sandbox);
const dockLayout = sandbox.dockLayout;
assert.ok(DOCK_MAX_SCALE >= 1.5 && DOCK_MAX_SCALE <= 2, "Mac-Dock magnification, not a cartoon");

/* A plausible strip: twenty controls of mixed width, six pixels apart, centred in the dock
   with the row's spare space split evenly at both ends — which is how the real dock lays
   itself out, and what gives the magnification room to grow into. */
const row = (count = 20, gap = 6, start = 130) => {
  const boxes = [];
  let left = start;
  for (let i = 0; i < count; i++) {
    const width = 24 + (i % 5) * 14;
    boxes.push({ left, width });
    left += width + gap;
  }
  return boxes;
};
const BOUNDS = { min:4, max:1400 };
const centre = (box) => box.left + box.width / 2;
const magnified = (boxes, out) => boxes.map((box, i) => ({
  left:box.left + out[i].shift - box.width * out[i].scale / 2 + box.width / 2,
  width:box.width * out[i].scale
}));

test("the control under the pointer is the biggest, and its neighbours fall away from it", () => {
  const boxes = row();
  const target = 9;
  const out = dockLayout(boxes, centre(boxes[target]), { bounds:BOUNDS });
  assert.ok(out[target].scale > 1.6, "the pointed-at control is at full magnification");
  for (let i = target; i > 0; i--)
    assert.ok(out[i].scale >= out[i - 1].scale - 1e-9, "scales fall away to the left");
  for (let i = target; i < boxes.length - 1; i++)
    assert.ok(out[i].scale >= out[i + 1].scale - 1e-9, "and to the right");
  assert.ok(out[0].scale < 1.01 && out.at(-1).scale < 1.01, "a control across the row is left alone");
});

test("you keep hitting what you aimed at: the pointer stays on the control it magnified", () => {
  const boxes = row();
  for (let target = 0; target < boxes.length; target++) {
    for (const where of [.15, .5, .85]) {
      const pointer = boxes[target].left + boxes[target].width * where;
      const out = dockLayout(boxes, pointer, { bounds:BOUNDS });
      const box = magnified(boxes, out)[target];
      assert.ok(pointer >= box.left && pointer <= box.left + box.width,
        "pointer at " + Math.round(pointer) + " is still inside control " + target);
      /* it may slide to make room at the row's ends, but never further than it grew */
      const growth = boxes[target].width * (out[target].scale - 1);
      assert.ok(Math.abs(out[target].shift) <= growth + 2,
        "control " + target + " moved " + out[target].shift.toFixed(1) + "px while growing " + growth.toFixed(1) + "px");
    }
  }
});

test("magnified controls never overlap and never change places", () => {
  const boxes = row();
  for (const pointer of [10, 120, 400, 900, 1300]) {
    const out = dockLayout(boxes, pointer, { bounds:BOUNDS });
    const shapes = magnified(boxes, out);
    for (let i = 1; i < shapes.length; i++) {
      assert.ok(shapes[i].left >= shapes[i - 1].left + shapes[i - 1].width - 1e-6,
        "control " + i + " still starts after control " + (i - 1) + " ends (pointer " + pointer + ")");
    }
  }
});

test("nothing is pushed out of the dock", () => {
  const boxes = row();
  for (const pointer of [4, 40, 700, 1380, 1400]) {
    const out = dockLayout(boxes, pointer, { bounds:BOUNDS });
    const shapes = magnified(boxes, out);
    assert.ok(shapes[0].left >= BOUNDS.min - 1e-6, "the first control stays inside the left edge");
    assert.ok(shapes.at(-1).left + shapes.at(-1).width <= BOUNDS.max + 1e-6, "and the last inside the right");
  }
});

test("a wide gap in the row gives way before the row does", () => {
  /* the kind of gap an auto margin opens in the middle of a strip */
  const boxes = [{ left:8, width:60 }, { left:74, width:60 }, { left:420, width:60 }, { left:486, width:60 }];
  const out = dockLayout(boxes, centre(boxes[2]), { bounds:BOUNDS });
  const shapes = magnified(boxes, out);
  const restGap = boxes[2].left - (boxes[1].left + boxes[1].width);
  const nowGap = shapes[2].left - (shapes[1].left + shapes[1].width);
  assert.ok(nowGap < restGap - 10, "the spare space absorbs the swell (" + Math.round(restGap) + "px → " + Math.round(nowGap) + "px)");
  assert.ok(nowGap > 0, "and never collapses into an overlap");
  assert.ok(shapes[0].left >= BOUNDS.min - 1e-6 && shapes.at(-1).left + shapes.at(-1).width <= BOUNDS.max + 1e-6);
});

test("an empty row asks nothing, and a single control still grows inside the dock", () => {
  assert.deepEqual(JSON.parse(JSON.stringify(dockLayout([], 100, { bounds:BOUNDS }))), []);
  const boxes = [{ left:8, width:40 }];
  const out = dockLayout(boxes, centre(boxes[0]), { bounds:BOUNDS });
  assert.ok(out[0].scale > 1.6);
  const box = magnified(boxes, out)[0];
  assert.ok(box.left >= BOUNDS.min - 1e-6, "it grows away from the edge rather than through it");
  assert.ok(centre(boxes[0]) >= box.left && centre(boxes[0]) <= box.left + box.width);
});

/* ---- and the wiring around it ---- */
test("the dock is one line that shrinks to fit, and wraps rather than becoming unreadable", () => {
  assert.match(deck, /#dock\{[^}]*flex-wrap:nowrap/, "the strip does not wrap by default any more");
  assert.match(deck, /#dock\{[^}]*zoom:var\(--dock-fit,1\)/, "it shrinks as a whole, like a Dock full of icons");
  assert.match(deck, /#dock\.dock-wrap\{ flex-wrap:wrap;/, "and keeps the old wrapping as its fallback");
  assert.match(deck, /const DOCK_FIT_FLOOR = \.72;/);
  assert.match(deck, /if \(fit < DOCK_FIT_FLOOR\) \{ dock\.classList\.add\("dock-wrap"\); fit = 1; \}/);
  assert.match(deck, /const available = dock\.clientWidth - 2, natural = dock\.scrollWidth \+ DOCK_SWELL_ROOM;/,
    "the fit leaves the magnification room to grow into");
  assert.match(deck, /#dock:not\(\.dock-wrap\)\{ justify-content:center; \}/,
    "and the row is centred, so that room sits at both ends where the swell needs it");
});

test("magnification is transforms only — the layout never moves", () => {
  const apply = deck.slice(deck.indexOf("function applyDock("), deck.indexOf("function fitDock("));
  assert.match(apply, /node\.style\.transform = ""/);
  assert.match(apply, /translateX\(" \+ step\.shift\.toFixed\(2\) \+ "px\) scale\(/);
  assert.doesNotMatch(apply, /style\.(width|height|margin|left|top|padding|fontSize)/,
    "nothing that could reflow the row is written");
  assert.match(deck, /#dock \.btn, #dock select, #dock input[^}]*transform-origin:50% 0;/,
    "a top dock grows downwards, from the row's own top edge");
  const measure = deck.slice(deck.indexOf("function measureDock("), deck.indexOf("function ensureDockCaption("));
  assert.match(measure, /offsetLeft/, "rest geometry is read from layout values, which transforms cannot disturb");
  assert.doesNotMatch(measure, /getBoundingClientRect\(\)\.left/);
});

test("a finger never magnifies, and reduced motion keeps the row still", () => {
  assert.match(deck, /if \(event\.pointerType !== "mouse" \|\| !dockMagnifies\(\)\) return;/);
  assert.match(deck, /matchMedia\("\(hover: hover\) and \(pointer: fine\)"\)/);
  assert.match(deck, /matchMedia\("\(prefers-reduced-motion: reduce\)"\)/);
  assert.match(deck, /!dockFinePointer\.matches \|\| dockStillness\.matches|dockFinePointer\.matches && !dockStillness\.matches/);
  assert.match(deck, /@media \(prefers-reduced-motion: reduce\)\{[\s\S]*?transition:none;[\s\S]*?\}/);
});

test("the keyboard walks the same dock, and the caption says what you are on", () => {
  assert.match(deck, /dock\.addEventListener\("focusin"/);
  assert.match(deck, /dockFocusItem = item;/);
  assert.match(deck, /dockCaption\.id = "dockCaption";/);
  assert.match(deck, /dockCaption\.setAttribute\("aria-hidden", "true"\);/,
    "the caption is a visible echo; the control keeps its own accessible name");
  assert.match(deck, /#dockCaption\{ position:absolute; top:calc\(100% \+ 3px\)/,
    "it hangs under the row rather than widening it");
  assert.match(deck, /#dock:not\(\.dock-wrap\) \.control-label, #dock:not\(\.dock-wrap\) #tfbar \.lbl,[\s\S]{0,80}\{ display:none; \}/,
    "the group labels stop widening the row from under the pointer");
});

test("the dock still holds every control it held before, by id and by name", () => {
  const ids = (html) => new Set(Array.from(html.matchAll(/\bid="([^"]+)"/g), (m) => m[1]));
  const names = (html) => new Set(Array.from(html.matchAll(/aria-label="([^"]+)"/g), (m) => m[1]));
  const missingIds = [...ids(baseDeck)].filter((id) => !ids(deck).has(id));
  assert.deepEqual(missingIds, [], "every id from the deployed Station survives");
  const missingNames = [...names(baseDeck)].filter((name) => !names(deck).has(name));
  assert.deepEqual(missingNames, [], "and every accessible name");
  for (const control of ["sceneMode", "resetScene", "rotateEvery", "rotateToggle", "screenPrev", "screenNext",
                         "viewMode", "displayBtn", "stationFullBtn", "chartCount", "marketStatus", "size", "tf"])
    assert.ok(deck.includes('id="' + control + '"'), control + " is still in the dock markup");
  /* the one addition is built at runtime, so the markup's control count is unchanged */
  assert.equal((deck.match(/<button/g) || []).length, (baseDeck.match(/<button/g) || []).length);
  assert.equal((deck.match(/<select/g) || []).length, (baseDeck.match(/<select/g) || []).length);
  assert.match(deck, /clouds\.id = "cloudsToggle";/, "and the clouds switch is that runtime addition");
});
