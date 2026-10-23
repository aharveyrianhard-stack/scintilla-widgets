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
    grab(deck, /const WIDGETS_X_SHARE = [^\n]*/, "the wall's shares (W7)"), grab(deck, /const widgetsLensRows = [^\n]*/, "widgetsLensRows"), fn(deck, "floorWidgets"),
    grab(deck, /const TAPE_ROW_PX = \d+;/, "the tape's height"), fn(deck, "tapesHeight"), fn(deck, "widgetsTapesHeight"),
    grab(deck, /const WIDGETS_X_SLIM_SHARE = [^\n]*/, "the slim share"), grab(deck, /const WIDGETS_LENS_MIN_PX = [^\n]*/, "the old minimum, kept"),
    grab(deck, /const widgetsBesideCol = [^\n]*/, "widgetsBesideCol"), fn(deck, "widgetsFloorPicture"),
    "globalThis.out = { floorPlan, floorWidgets, widgetsFloorPicture, widgetsTapesHeight, widgetsLensRows, FLOOR_COLUMN_SHARE, WIDGETS_X_SLIM_SHARE, WIDGETS_BESIDE_COL_PX, WIDGETS_BESIDE_COL_NARROW_PX, WIDGETS_LENS_MIN_PX, WIDGETS_VOLUME_MIN_PX, WIDGETS_VOL_W, FLOOR_SEAM_PX };"
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

test("W1B · (restated for W10) while a video plays on WIDGETS nothing moves: the playing layout is gone, X keeps its width, the slot is the same slot", () => {
  const D = deckApi();
  assert.match(fn(deck, "widgetsPlaying"), /return false;/, "W10: a playing video changes nothing on the wall");
  assert.doesNotMatch(deck, /function floorWidgetsPlaying\(/, "W1B's playing layout is gone");
  assert.doesNotMatch(fn(deck, "slotFor"), /floorWidgetsPlaying/, "the slot never switches on play");
  assert.match(fn(deck, "fitVideoPane"), /floorPlan\(grid\.clientWidth, grid\.clientHeight, onWall\?\.chromePx, widgetsOn\(\) \? WIDGETS_X_SHARE : undefined\)/, "X's column is one share, playing or not");
  assert.doesNotMatch(grab(deck, /if \(event\.data\?\.sc === "video-playing"\) \{[\s\S]*?\n    return;\n  \}/, "the video-playing branch"), /relayout\(\)/, "the shell's say re-lays nothing");
  /* the floor the picture once had is still measured by the deck's numbers (W1B's rule), for the record */
  for (const [key, t] of Object.entries(TODAY)) { const f = D.widgetsFloorPicture(t.W, t.H, CHROME); assert.ok(Math.abs(f.w - t.wall.w) <= 1 && f.h === t.wall.h, key + ": the WALL's picture"); }
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
  assert.match(s, /BESIDE = !!event\.data\.on; if \(typeof event\.data\.fixed === "boolean"\) FIXED = event\.data\.fixed; BESIDE_COL = Math\.max\(120, Math\.round\(Number\(event\.data\.col\) \|\| BESIDE_COL\)\); paintBeside\(\); relayout\(\); tellPlaying\(\);/);   /* W10: the fixed column too */
  /* Y7, Y8, Y10 as they were */
  assert.match(s, /function soundOnFirstTap/); assert.match(s, /SCINTILLA_VIDEO_PIP_TOGGLE/); assert.match(s, /body\.playing #grid\{ display:none; \}/);
  /* the two chart slots are not this pass's: tv-v1 is exactly W1's */
  assert.match(tv, /studies: \["STD;VWAP"\]/); assert.match(tv, /extended_hours: true/); assert.match(tv, /function heardFromWidget/);
});
