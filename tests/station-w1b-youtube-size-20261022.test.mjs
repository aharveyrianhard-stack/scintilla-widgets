/* W1B (22 Oct 2026). Alan, 14:10 ET: "I don't want YouTube to keep the grid next to it. It's going to make the video smaller. I want
   the YouTube the size that it is, shift it to the side, keep the grid to the side of it … the widget somewhere can fit there …
   If the Twitter has to be a little slimmer, that's fine."
   1. The floor: today's playing picture - the larger of the WALL's (nine charts) and SIMPLE's - from the deck's own numbers.
      Measured on @a4fae52: 2560 × 1440 → 1296 × 729 (the WALL), 1280 × 800 → 648 × 365 (the WALL).
   2. While a video plays on WIDGETS: X slimmer (16 %), the pane = the floor picture + the grid's fixed column, the picture at least
      the floor; the meter and the lenses to its right; a column too thin for a lens stands the lens set down.
   3. The shells: a fixed column (--beside-col, the deck's number), and the deck told when a video starts and stops. Twins identical. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
const read = (p) => fs.readFileSync(new URL(p, import.meta.url), "utf8");
const deck = read("../deck/index.html");
const SHELLS = ["personal-video-v1", "scintilla-video-v1"];
const shells = Object.fromEntries(SHELLS.map((n) => [n, read(`../station-shells/${n}/index.html`)]));
const lens = read("../station-shells/lens-v1/index.html");
const tv = read("../station-shells/tv-v1/index.html");
const grab = (src, re, what) => { const m = src.match(re); assert.ok(m, what + " must exist"); return m[0]; };
const fn = (src, name) => grab(src, new RegExp("\\nfunction " + name + "\\([^)]*\\) \\{[\\s\\S]*?\\n\\}"), name);
const plain = (v) => JSON.parse(JSON.stringify(v));
function deckApi() {
  const src = [
    grab(deck, /const FLOOR_COLUMN_SHARE = [\s\S]*?const FLOOR_COUNTS = \[[^\]]*\];/, "the floor plan constants"),
    grab(deck, /const VIDEO_CHROME_FALLBACK_PX = [^;]*;/, "the shell's bar fallback"),
    grab(deck, /const SLOT_SPAN = \d+;/, "the slot span"),
    fn(deck, "floorGrid"), fn(deck, "floorPlan"), fn(deck, "floorSlot"),
    grab(deck, /const SIMPLE_KEY = [\s\S]*?const SIMPLE_SPLIT_DEFAULT = [^;]*;/, "the SIMPLE constants"),
    fn(deck, "simpleSplitOf"), fn(deck, "floorSimple"),
    grab(deck, /const WIDGETS_KEY = [\s\S]*?const WIDGETS_TAPE_PX = \d+;/, "the WIDGETS constants"),
    grab(deck, /const widgetsArrangementOf = [^\n]*/, "widgetsArrangementOf"),
    grab(deck, /const WIDGETS_METER_PX = [^\n]*/, "the arrangement shares"), fn(deck, "floorWidgets"),
    grab(deck, /const TAPE_ROW_PX = \d+;/, "the tape's height"), fn(deck, "tapesHeight"), fn(deck, "widgetsTapesHeight"),
    grab(deck, /const WIDGETS_X_SLIM_SHARE = [^\n]*/, "the slim share"), grab(deck, /const WIDGETS_LENS_MIN_PX = [^\n]*/, "the minimums"),
    grab(deck, /const widgetsBesideCol = [^\n]*/, "widgetsBesideCol"), fn(deck, "widgetsFloorPicture"), fn(deck, "floorWidgetsPlaying"),
    "globalThis.out = { floorPlan, floorWidgets, floorWidgetsPlaying, widgetsFloorPicture, widgetsBesideCol, widgetsTapesHeight, FLOOR_COLUMN_SHARE, WIDGETS_X_SLIM_SHARE, WIDGETS_BESIDE_COL_PX, WIDGETS_BESIDE_COL_NARROW_PX, WIDGETS_LENS_MIN_PX, WIDGETS_METER_MIN_PX, FLOOR_SEAM_PX };"
  ].join("\n");
  const ctx = {}; vm.runInNewContext(src, ctx); return ctx.out;
}
const CHROME = 26;
/* measured 22 Oct on @a4fae52 (deliverables/20261022/w1/measure/w1b-today.json): the playing picture, the WALL with nine charts and SIMPLE */
const TODAY = { "2560x1440": { W: 2560, H: 1440, wall: { w: 1296, h: 729 }, simple: { w: 972, h: 547 } }, "1280x800": { W: 1280, H: 800, wall: { w: 648, h: 365 }, simple: { w: 517, h: 291 } } };

test("W1B · the floor is today's playing picture, the larger of the WALL's and SIMPLE's, from the deck's own numbers", () => {
  const D = deckApi();
  for (const [key, t] of Object.entries(TODAY)) {
    const f = D.widgetsFloorPicture(t.W, t.H, CHROME);
    assert.equal(f.from, "wall", key + ": the WALL's nine-chart block is the bigger picture");
    assert.ok(Math.abs(f.w - t.wall.w) <= 1 && f.h === t.wall.h, key + ": the floor is the measured WALL picture (" + f.w + "×" + f.h + " vs " + t.wall.w + "×" + t.wall.h + ")");
    assert.ok(Math.abs(f.simple.w - t.simple.w) <= 5 && Math.abs(f.simple.h - t.simple.h) <= 3, key + ": SIMPLE's picture agrees with the measurement");
  }
  /* the plan's column share is a parameter now; nothing else about floorPlan moved */
  assert.equal(D.floorPlan(2560, 1440, CHROME).col, 614, "24 % by default, as S11 set it");
  assert.equal(D.floorPlan(2560, 1440, CHROME, 0.16).col, 410, "the slim column while a video plays");
  assert.equal(D.floorPlan(2560, 1440, CHROME, 7).col, 614, "a share that is not a share is ignored");
  assert.equal(D.WIDGETS_X_SLIM_SHARE, 0.16);
});

test("W1B · while a video plays on WIDGETS the picture is at least the floor, moved to the left, the grid's column beside it, the widgets to the right", () => {
  const D = deckApi();
  for (const [key, t] of Object.entries(TODAY)) {
    const plan = D.floorPlan(t.W, t.H, CHROME, D.WIDGETS_X_SLIM_SHARE);
    const floor = D.widgetsFloorPicture(t.W, t.H, CHROME), col = D.widgetsBesideCol(plan.charts.w);
    const s = D.floorWidgetsPlaying(plan.charts.w, plan.charts.h, D.widgetsTapesHeight(true), floor, col, 9, CHROME);
    assert.equal(s.playing, true); assert.equal(s.widgets, true); assert.equal(s.cols, 2); assert.equal(s.charts, 2);
    assert.ok(s.picture.w >= floor.w && s.picture.h >= floor.h, key + ": the picture (" + s.picture.w + "×" + s.picture.h + ") is at least the floor (" + floor.w + "×" + floor.h + ")");
    assert.equal(s.box.left, 0, "moved to the left of the chart area"); assert.equal(s.box.top + s.box.h, plan.charts.h, "at the bottom");
    assert.equal(s.box.w, floor.w + col, key + ": the pane is the picture plus the grid's column"); assert.equal(s.besideCol, col);
    assert.equal(s.chartsH + 50 + D.FLOOR_SEAM_PX + s.bandH, plan.charts.h, "charts + tapes + seam + pane = the height");
    assert.ok(s.chartsH > 300, key + ": the charts keep over 300 px (" + s.chartsH + ")");
    assert.equal(s.meter.left, s.box.w + 1); assert.equal(s.lenses.left, s.box.w + 1); assert.equal(s.meter.w, plan.charts.w - s.box.w - 1, "the widgets take what is right of the pane");
  }
  /* at 2560 the right column holds lenses; at 1280 it is too thin and the lens set stands down, the meter scales */
  const wide = D.floorPlan(2560, 1440, CHROME, 0.16), fw = D.widgetsFloorPicture(2560, 1440, CHROME);
  const sw = D.floorWidgetsPlaying(wide.charts.w, wide.charts.h, 50, fw, 300, 9, CHROME);
  assert.equal(sw.besideCol, 300); assert.equal(sw.lenses.on, true); assert.equal(sw.meter.on, true); assert.equal(sw.meter.scale, 1); assert.equal(sw.lenses.w, 552);
  const narrow = D.floorPlan(1280, 800, CHROME, 0.16), fn_ = D.widgetsFloorPicture(1280, 800, CHROME);
  const sn = D.floorWidgetsPlaying(narrow.charts.w, narrow.charts.h, 50, fn_, D.widgetsBesideCol(narrow.charts.w), 9, CHROME);
  assert.equal(sn.besideCol, 220, "a narrower column on the small wall"); assert.equal(sn.lenses.on, false, "no room for a lens beside a 648 px picture and its column"); assert.equal(sn.meter.on, true); assert.ok(sn.meter.scale < 1 && sn.meter.scale >= 0.3);
  /* the deck: the plan goes slim while playing, the playing slot is planned before WIDGETS' own, the lenses' off class, the shell's say */
  assert.match(fn(deck, "fitVideoPane"), /floorPlan\(grid\.clientWidth, grid\.clientHeight, onWall\?\.chromePx, widgetsPlaying\(\) \? WIDGETS_X_SLIM_SHARE : undefined\)/);
  assert.match(fn(deck, "slotFor"), /if \(widgetsPlaying\(\)\) \{[\s\S]{0,400}?return floorWidgetsPlaying\(plan\.charts\.w, plan\.charts\.h, tapePx, floor, widgetsBesideCol\(plan\.charts\.w\), count, chromePx\);/);
  assert.match(fn(deck, "widgetsPlaying"), /widgetsOn\(\) && VIDEO_PLAYING\.on && VIDEO_PLAYING\.key === VIDEO_FEED && MEDIA_STAGE === 0 && !STACKED/, "only the pane on the wall, never the theatre or a phone");
  assert.match(deck, /if \(event\.data\?\.sc === "video-playing"\) \{[\s\S]{0,600}?VIDEO_PLAYING\.on = on; VIDEO_PLAYING\.key = pane\.def\.key; relayout\(\);/);
  assert.match(fn(deck, "placeWidgets"), /l\.classList\.toggle\("off", slot\.lenses\.on === false\); m\.classList\.toggle\("off", slot\.meter\.on === false\);/);
  assert.match(deck, /#wgMeter\.off, #wgLenses\.off\{ display:none !important; \}/);
  assert.match(deck, /if \(obj\.def\.kind === "video"\) tellVideoBeside\(widgetsOn\(\)\);/, "a pane that has just loaded is told the column");
  assert.match(fn(deck, "tellVideoBeside"), /type:"SCINTILLA_VIDEO_BESIDE", on:!!on, col:/);
  assert.match(lens, /minmax\(min\(var\(--lens-min, 290px\), 100%\), 1fr\)/, "a lens column narrower than a lens never overflows");
});

test("W1B · the shells: a fixed column the deck sizes, the deck told when a video starts and stops; the twins byte-identical; tv-v1 untouched", () => {
  assert.equal(shells["personal-video-v1"], shells["scintilla-video-v1"], "byte-identical twins");
  const s = shells["scintilla-video-v1"];
  assert.match(s, /body\.beside\.playing\{ display:grid; grid-template-columns:minmax\(0,1fr\) var\(--beside-col, 300px\);/, "the player takes the rest; the column is fixed");
  assert.match(s, /let BESIDE = QS\.get\("beside"\) === "1", BESIDE_COL = Math\.max\(120, Math\.round\(Number\(QS\.get\("besideCol"\)\) \|\| 300\)\);/);
  assert.match(fn(s, "paintBeside"), /setProperty\("--beside-col", BESIDE_COL \+ "px"\)/);
  assert.match(fn(s, "tellPlaying"), /parent\.postMessage\(\{ sc: "video-playing", on: document\.body\.classList\.contains\("playing"\), feed: FEED \}, location\.origin\)/);
  assert.match(s, /document\.body\.classList\.add\("playing"\);\n\s+if \(BESIDE\) relayout\(\);[^\n]*\n\s+tellPlaying\(\);/, "said when a video starts");
  assert.match(s, /document\.body\.classList\.remove\("playing"\);\n\s+if \(BESIDE\) relayout\(\);[^\n]*\n\s+tellPlaying\(\);/, "and when BACK stops it");
  assert.match(s, /BESIDE = !!event\.data\.on; BESIDE_COL = Math\.max\(120, Math\.round\(Number\(event\.data\.col\) \|\| BESIDE_COL\)\); paintBeside\(\); relayout\(\); tellPlaying\(\);/);
  /* Y7, Y8, Y10 as they were */
  assert.match(s, /function soundOnFirstTap/); assert.match(s, /SCINTILLA_VIDEO_PIP_TOGGLE/); assert.match(s, /body\.playing #grid\{ display:none; \}/);
  /* the two chart slots are not this pass's: tv-v1 is exactly W1's */
  assert.match(tv, /studies: \["STD;VWAP"\]/); assert.match(tv, /extended_hours: true/); assert.match(tv, /function heardFromWidget/);
});
