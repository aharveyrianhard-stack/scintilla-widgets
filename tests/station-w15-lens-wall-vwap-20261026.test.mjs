/* W15 (26 Oct 2026, coordinator) — THE LENS WALL and HIS VWAP ON EVERY LENS. Alan: "I don't really use our charts too much, bro … make
   … the YouTubes a little bit bigger, the volume a little bit bigger. And then cover the chart area of the two charts with context
   lenses, but with the VWAP … that's like proper support resistance … of the intraday." */
import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const read = (rel) => fs.readFileSync(new URL(rel, import.meta.url), "utf8");
const deck = read("../deck/index.html"), lens = read("../station-shells/lens-v1/index.html");
function fnFromSource(source, name, bindings = {}) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} must exist`);
  let depth = 0, end = -1;
  for (let i = source.indexOf("{", start); i < source.length; i += 1) {
    if (source[i] === "{") depth += 1;
    else if (source[i] === "}") { depth -= 1; if (depth === 0) { end = i + 1; break; } }
  }
  return vm.runInNewContext(`(${source.slice(start, end)})`, bindings);
}

/* ---- the wall ---- */
const SEAM = +deck.match(/const FLOOR_SEAM_PX = (\d+)/)[1];
const floorLensWall = fnFromSource(deck, "floorLensWall", { FLOOR_SEAM_PX:SEAM, VIDEO_CHROME_FALLBACK_PX:36, LENSWALL_PLAYER_W:0.48, LENSWALL_BAND_MAX:0.48,
  WIDGETS_VOLUME_MIN_PX:120, WIDGETS_LENS_ROW_PX:150,
  widgetsLensRows:(h) => Math.max(1, Math.min(Math.floor(h / 120), Math.round((h + SEAM) / (150 + SEAM)))) });

test("W15 · the lens wall: no chart, the lenses over the charts' whole area, YouTube and the volume share the band", () => {
  /* the computer's window (1416 × 883, X's column 255) and the TV's laid-out wall (1658 × 883, X's column 298) */
  for (const [w, h, col] of [[1416 - 255 - SEAM, 883, 255], [1658 - 298 - SEAM, 883, 298]]) {
    const s = floorLensWall(w, h, 68, col, 2, 36);
    assert.equal(s.lensWall, true); assert.equal(s.charts, 0); assert.equal(s.cells.length, 0); assert.equal(s.hidden, 2);
    assert.deepEqual([s.lensTape.left, s.lensTape.top, s.lensTape.w], [0, 0, w], "the lenses take the charts' whole width, from the top");
    assert.equal(s.lensTape.h, s.box.top - SEAM, "down to the band");
    assert.equal(s.lensTape.rows, 3, "three ~150 px rows");
    assert.ok(s.bandH <= Math.round(h * 0.48), "the band never over 48 % of the height");
    assert.ok(s.playerW <= Math.round((col + SEAM + w) * 0.48), "the player at most 48 % of the wall");
    assert.equal(s.box.w, col + SEAM + s.playerW, "the YouTube pane: the feed column in X's line + the player");
    assert.equal(s.picture.w, s.playerW, "the player is as wide as its picture: no black bars");
    assert.equal(s.volume.left, s.playerW + SEAM, "the volume panel from the player's right edge");
    assert.equal(s.volume.left + s.volume.w, w, "to the screen's right edge");
    assert.equal(s.volume.h, s.bandH - 68, "over the FAVORITES tape");
    assert.equal(s.tapeLeft, s.box.w + SEAM, "the FAVORITES tape from the player's right edge");
  }
});

test("W15 · bigger than W10: the player and the volume panel both grow, at the computer's size", () => {
  const w = 1416 - 255 - SEAM;
  const s = floorLensWall(w, 883, 68, 255, 2, 36);
  assert.ok(s.playerW > Math.round(1416 * 0.35), "the player over W10's 35 %");
  assert.ok(s.volume.w > Math.round(1416 * 0.17), "the volume panel over W10's 17 %");
});

test("W15 · the switch: the lens wall unless this machine (or one load) asks for the two charts", () => {
  const choice = fnFromSource(deck, "lensWallChoice");
  assert.equal(choice(null, null), true); assert.equal(choice("0", null), true);
  assert.equal(choice("1", null), false, "station.widgets.charts = 1: the two charts");
  assert.equal(choice(null, "1"), false, "?charts=1 for one load"); assert.equal(choice("1", "0"), true, "?charts=0 for one load");
  assert.match(deck, /if \(widgetsOn\(\)\) return \(lensWallOn\(\) \? floorLensWall : floorWidgets\)\(plan\.charts\.w, plan\.charts\.h, tapePx, plan\.col, count, chromePx\);/);
});

test("W15 · the charts stay off the lens wall: never mounted, taken down, no page-change frame, no chart controls", () => {
  assert.match(deck, /function mount\(obj, options\) \{\n  if \(obj\.isDock \|\| obj\.frame\) return;\n  if \(obj\.def\.kind === "chart" && lensWallOn\(\)\) return;/);
  assert.match(deck, /function preparePageSlot\(pane, i, box, now, fade\) \{\n  if \(lensWallOn\(\)\) return null;/);
  assert.match(deck, /if \(slot && slot\.lensWall\) parkChartsForLensWall\(\);/);
  assert.match(deck, /body\.lens-wall #wgCtl, body\.lens-wall #tfNow\{ display:none !important; \}/);
});

/* ---- his VWAP ---- */
const ET_OPTS = { timeZone:"America/New_York", year:"numeric", month:"2-digit", day:"2-digit", hour:"2-digit", minute:"2-digit", hourCycle:"h23" };
const etParts = fnFromSource(lens, "etParts", { ET_FMT:new Intl.DateTimeFormat("en-US", ET_OPTS), ET_CACHE:new Map() });
const sessionDay = vm.runInNewContext(lens.match(/const sessionDay = [^\n]*;/)[0] + "; sessionDay", { etParts });
const hlc3 = (b) => (b.h + b.l + b.c) / 3;
const vwapCalc = fnFromSource(lens, "vwapCalc", { etParts, sessionDay, hlc3 });
const at = (iso) => Date.parse(iso);
const bar = (iso, h, l, c, v) => ({ t:at(iso), o:c, h, l, c, v });

test("W15 · VWAP: TradingView's definition - sum(hlc3 × volume) / sum(volume), Band #1 one standard deviation", () => {
  const bars = [bar("2026-10-26T09:30:00-04:00", 11, 9, 10, 100), bar("2026-10-26T09:35:00-04:00", 21, 19, 20, 300)];
  const r = vwapCalc(bars, 300000, "0400", 1);
  assert.equal(r.vwap[0], 10); assert.equal(r.vwap[1], (10 * 100 + 20 * 300) / 400);
  const w = r.vwap[1], sd = Math.sqrt((100 * 100 + 400 * 300) / 400 - w * w);
  assert.ok(Math.abs(r.upper[1] - (w + sd)) < 1e-9 && Math.abs(r.lower[1] - (w - sd)) < 1e-9);
});

test("W15 · VWAP anchors: 04:00 New York on a stock (nothing before it), a new day restarts it; 18:00 on futures", () => {
  const stock = vwapCalc([bar("2026-10-26T03:55:00-04:00", 11, 9, 10, 100), bar("2026-10-26T04:00:00-04:00", 21, 19, 20, 100),
    bar("2026-10-27T04:00:00-04:00", 31, 29, 30, 100)], 300000, "0400", 1);
  assert.ok(Number.isNaN(stock.vwap[0]), "03:55 is before the 04:00 anchor");
  assert.equal(stock.vwap[1], 20); assert.equal(stock.vwap[2], 30, "the next day starts again");
  const fut = vwapCalc([bar("2026-10-26T17:55:00-04:00", 11, 9, 10, 100), bar("2026-10-26T18:00:00-04:00", 21, 19, 20, 100),
    bar("2026-10-26T23:00:00-04:00", 31, 29, 30, 100)], 300000, "1800", 1);
  assert.equal(fut.vwap[0], 10, "17:55 closes the old CME day");
  assert.equal(fut.vwap[1], 20, "18:00 opens the new one"); assert.equal(fut.vwap[2], 25, "and it runs through the evening");
});

test("W15 · each lens reads its whole session for the VWAP, and draws its last LENS_BARS with it behind the bars", () => {
  const vwapLimit = fnFromSource(lens, "vwapLimit", { TF_MIN:{ "1m":1, "5m":5, "15m":15, "30m":30, "1h":60 } });
  assert.equal(vwapLimit("5m", false), 196); assert.equal(vwapLimit("5m", true), 280); assert.equal(vwapLimit("1h", false), 20);
  assert.equal(vwapLimit("1m", true), 1000, "1-minute futures stop at 1,000 bars (said in the source)");
  assert.equal(vwapLimit("1D", false), 0, "no VWAP on daily");
  assert.match(lens, /const fut = FUTURES\.includes\(t\), vlim = DAILY_ONLY\[t\] \? 0 : vwapLimit\(TF, fut\);/);
  assert.match(lens, /const rows = all\.slice\(-LENS_BARS\);/);
  assert.match(lens, /drawBars\(ctx, W, H, bars, live, entry\.vw\) : drawTight\(ctx, W, H, bars, day, live, entry\.vw\)/);
  assert.match(lens, /drawVwap\(ctx, vw, n, X, Y\);   \/\* W15: behind the candles \*\//);
  assert.match(lens, /export const VWAP_COL = Object\.freeze\(\{ line:"#F2B33D", band:"rgba\(242,179,61,\.5\)", fill:"rgba\(242,179,61,\.07\)" \}\);/, "live-v1's amber");
});
