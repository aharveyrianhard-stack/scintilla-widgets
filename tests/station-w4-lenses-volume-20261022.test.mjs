/* W4 (22 Oct 2026). Alan, ~19:10 ET, on the live wall, for the Asia session: "Make sure that they're 5 minutes, make sure that they're live …
   Keep it tight, make them smaller, and make them more on screen and faster … I don't see the need of the circle … add Nebius, CoreWeave,
   NVIDIA, Bloom Energy, Micron, SanDisk … I need NDX futures … S&P futures, NASDAQ futures … oil … the buy or sell flow needs to be way bigger …
   a timer for candle closes that flashes … just like a heartbeat circle … unzoom a little bit the trading view." */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
const read = (p) => fs.readFileSync(new URL(p, import.meta.url), "utf8");
const deck = read("../deck/index.html"), lens = read("../station-shells/lens-v1/index.html"), vol = read("../station-shells/volume-v1/index.html"), tv = read("../station-shells/tv-v1/index.html");
const grab = (src, re, what) => { const m = src.match(re); assert.ok(m, what + " must exist"); return m[0]; };
const fn = (src, name) => grab(src, new RegExp("\\nfunction " + name + "\\([^)]*\\) \\{[\\s\\S]*?\\n\\}"), name);
const plain = (v) => JSON.parse(JSON.stringify(v));
function lensApi() {
  const src = ['const CLEAN = (t) => String(t || "").toUpperCase().replace(/[^A-Z0-9.\\-]/g, "").slice(0, 12); const MAX_LENSES = 24; const CLOSE_READ_DELAY_MS = 4000, CLOSE_RETRY_MS = [8000, 12000, 16000, 25000, 40000];',
    grab(lens, /const LISTS = \[[^\]]*\];/, "LISTS"), grab(lens, /const MACRO = Object\.freeze\(\[[^\]]*\]\);/, "MACRO"), grab(lens, /const NAMES = Object\.freeze\(\{[^}]*\}\);/, "NAMES"),
    grab(lens, /export function listChoice[^\n]*/, "listChoice").replace("export ", ""), grab(lens, /export function listNames[^\n]*/, "listNames").replace("export ", ""), grab(lens, /export function closeDue\([^)]*\) \{[\s\S]*?\n\}/, "closeDue").replace("export ", ""),
    "globalThis.out = { LISTS, MACRO, NAMES, listChoice, listNames, closeDue };"].join("\n");
  const ctx = {}; vm.runInNewContext(src, ctx); return ctx.out;
}

test("W4 · the lenses are 5-minute and live: the latest 30 completed bars read 4 s after every close (again at +8 +12 +16 +25 +40 s while missing), the quote every 10 s, the live price the last point; tight cells, no oval, twice the pace", () => {
  assert.match(lens, /const LENS_BARS = 30, USUAL_MS = 1800000;/   /* W12: the timeframe is the TF chips' */, "the chart API's tf=5m, the latest 30 bars");
  assert.match(lens, /const QUOTE_MS = TAPE \? 10000 : 15000, BARS_MS = 60000/   /* W12 */);
  assert.match(lens, /TAPE \? \{ limit: LENS_BARS, forming: true \} : \{ limit: LENS_BARS \}/, "a fresh read on the tape (the shared store skipped)");
  assert.match(lens, /const TAPE_SPEED_PX_S = TAPE \? 90 : 45;/, "twice the deck's tapes' pace");
  assert.match(lens, /body\.tape \.lens\{ flex:none; width:var\(--lens-w, 170px\); height:100%; background:var\(--panel2\); \}/, "170 px cells (W10: each its own panel, a gap between)");
  const L = lensApi();
  const m = 5 * 60000, b = 1000000 * m;   /* a boundary */
  assert.equal(L.closeDue(b + 1000, 0), null, "a second after the close: not yet");
  assert.deepEqual(plain(L.closeDue(b + 4500, 0)), { boundary: b, at: "close" }, "4 s after the close: read");
  assert.equal(L.closeDue(b + 6000, b + 4500), null, "read once");
  assert.deepEqual(plain(L.closeDue(b + 8500, b + 4500)), { boundary: b, at: "retry" }, "+8 s: again (the caller checks the bar is still missing)");
  assert.deepEqual(plain(L.closeDue(b + 16500, b + 12500)), { boundary: b, at: "retry" }, "+16 s: again");
  assert.deepEqual(plain(L.closeDue(b + 41000, b + 25500)), { boundary: b, at: "retry" }, "+40 s: the last");
  assert.equal(L.closeDue(b + 50000, b + 41000), null);
  assert.equal(L.closeDue(b + m + 4500, b + 31000).at, "close", "the next close");
  /* the drawing: a tight line of the closes in the day's colour, the live price last, never grey when the day is known */
  const draw = grab(lens, /export function drawTight\([\s\S]*?\n\}/, "drawTight");
  assert.match(draw, /const closes = bars\.map\(\(b\) => b\.c\); if \(livePrice > 0\) closes\.push\(livePrice\);/);
  assert.match(draw, /const col = day === "down" \? PALETTE\.bear : day === "up" \? PALETTE\.bull : PALETTE\.ink;/);
  assert.doesNotMatch(draw, /ellipse|ovalGeometry/, "no oval on the tape");
  assert.match(fn(lens, "drawOne"), /if \(TAPE \|\| !QS\.get\("oval"\)\) \{[^\n]*\n\s+const q = S\.quotes\.get\(t\), live = q && q\.price > 0 \? q\.price : 0;\n\s+const geo = STYLE === "bars" \? drawBars\(ctx, W, H, bars, live\) : drawTight\(ctx, W, H, bars, day, live\);/, "W7: bars by default, the line on the switch");
  assert.match(lens, /window\.__lens = \{ style: \(\) => STYLE, rows: \(\) => ROWS, rvol: [^\n]*newest:/, "the harness reads what the tape holds (W7: the style, the rows, the RVol too)");
  assert.match(lens, /\.map\(norm\)\.filter\(\(b\) => Number\.isFinite\(b\.t\) && b\.o > 0 && b\.c > 0\)\.sort\(\(a, b\) => a\.t - b\.t\)\.slice\(-LENS_BARS\)/, "the provider's rows come newest first: sorted oldest first, so the last row is the newest bar");
  /* the deck: the tape shorter */
  assert.match(deck, /WIDGETS_LENS_ROW_PX = 150/, "W7: restated - the lenses in rows of about 150 px");
});

test("W4 · MINE from the database (station_lists · mine), the tape opens on it, a visible '+ ticker · Enter' box writes there and × deletes there; MACRO is what trades overnight with plain names", () => {
  const L = lensApi();
  assert.equal(L.listChoice("", "", true), "mine", "the tape opens on MINE"); assert.equal(L.listChoice("", "", false), "radar", "the column still on RADAR");
  assert.equal(L.listChoice("macro", "", true), "macro"); assert.equal(L.listChoice("macro", "radar", true), "radar");
  assert.deepEqual(plain(L.listNames([{ position: 2, ticker: "crwv" }, { position: 1, ticker: "NBIS" }, { position: 3, ticker: "nbis" }])), ["NBIS", "CRWV"], "position order, cleaned, deduped");
  assert.match(lens, /station_lists\?select=position,ticker&list=eq\.mine&order=position\.asc/, "read from the database");
  const mineWrite = grab(lens, /async function mineWrite\([\s\S]*?\n\}/, "mineWrite"), mineDelete = grab(lens, /async function mineDelete\([\s\S]*?\n\}/, "mineDelete");
  assert.match(mineWrite, /station_lists\?on_conflict=list,position", \{ method: "POST", headers: Object\.assign\(\{ "Content-Type": "application\/json", Prefer: "resolution=merge-duplicates" \}, PG\)/, "the deck's door: an upsert at the next position");
  assert.match(mineWrite, /list: "mine", position: last \+ 1, ticker: c, updated_at/);
  assert.match(mineDelete, /station_lists\?list=eq\.mine&ticker=eq\." \+ encodeURIComponent\(c\), \{ method: "DELETE", headers: PG \}/);
  assert.match(lens, /<input id="add" placeholder="\+ ticker · Enter"/, "the box says what it does");
  assert.match(lens, /body\.tape #add\{ display:block; width:100%;/, "visible on the tape, always");
  assert.match(lens, /if \(!MINE_ON\) \{ MINE_ON = true; remember\(MINE_ON_KEY, "1"\); \}/   /* W12: an add opens MINE beside RADAR and MACRO */, "an add goes to MINE");
  assert.deepEqual(plain(L.MACRO), ["SPY", "QQQ", "ESUSD", "NQUSD", "VIX", "PCC", "ADVDEC", "CLUSD", "US10Y", "BTCUSD", "GCUSD", "DXUSD"], "W7: SPY and QQQ (never swapped for futures), the futures beside them, VIX, put/call, advance/decline, oil, the 10-year, bitcoin, gold, the dollar; NDX not served");
  assert.equal(L.NAMES.ESUSD, "S&P FUT"); assert.equal(L.NAMES.NQUSD, "NASDAQ FUT"); assert.equal(L.NAMES.CLUSD, "OIL"); assert.equal(L.NAMES.PCC, "PUT/CALL · daily"); assert.equal(L.NAMES.ADVDEC, "ADVANCE / DECLINE");
  assert.match(lens, /if \(NAMES\[t\]\) d\.querySelector\("\.nm"\)\.textContent = NAMES\[t\];/   /* W12: on the grid too */, "the plain name on the lens");
});

test("W4 · the volume panel (restated for W7): the flow and the 5-minute multiple side by side, big badges, trade size and the block, the heartbeat dot by level, no clock, a 5-minute countdown that flashes at the close", () => {
  assert.match(vol, /\.ib b\{ color:var\(--ink\); font-weight:800; \}/   /* W12: the numbers small in icon badges, the graph big (Alan) */, "the numbers big (W10: restated)");
  assert.match(vol, /\$\("buy"\)\.textContent = flow\.buyPct != null \? flow\.buyPct \+ "%" : "—"; \$\("sell"\)\.textContent = flow\.sellPct != null \? flow\.sellPct \+ "%" : "—";/);
  assert.match(vol, /<span class="ib" id="iSize"[^>]*><i>◫<\/i><b id="tsize">—<\/b><em id="sizeAt"><\/em><\/span>/, "lot size as an icon badge (W12: the graph is the big thing)");
  assert.match(vol, /\$\("tsize"\)\.innerHTML = S \? S\.x\.toFixed\(2\) \+ "×" \+ side\(S\.dir\) : "—"; \$\("sizeAt"\)\.textContent = S \? \(S\.t \|\| ""\) \+ \(nowS \? "" : " · last"\) : \(data\.live \? "" : "closed · none in the feed"\);/, "W10: the lot size is the last one seen, with its time; never a bare dash while one was seen");
  assert.match(vol, /badge\("bVol", "vol", Lg\.vol\); badge\("bDir", "dir", Lg\.dir\); badge\("bVwap", "vwap", Lg\.vwap\); badge\("bHour", "hour", Lg\.hour\);/   /* W12 */, "VWAP and DIRECTION as badges (W10: the four of them, the research page's order)"); assert.match(vol, /\.ib\{[^}]*font-size:10\.5px; font-weight:700;/   /* W12 (Alan: "everything is oversized and the volume oscillator is undersized"): the badges small icons, the graph big */, "readable from a TV");
  assert.match(vol, /document\.body\.classList\.toggle\("warm", lv === "warm"\); document\.body\.classList\.toggle\("hot", lv === "hot"\);/, "the dot coloured by its level");
  assert.doesNotMatch(vol, /id="clock"/, "no clock"); assert.match(vol, /beat-core/, "W10: the graph is back (Alan: \"you removed the graph now?\"); its dot at NOW beats as on the research page");
  assert.match(vol, /left = 300 - \(secs % 300\), boundary = Math\.floor\(secs \/ 300\);/, "the 5-minute countdown on the New York clock");
  assert.match(vol, /if \(lastBoundary >= 0 && boundary !== lastBoundary\) \{ const c = \$\("count"\); c\.classList\.remove\("flash"\); void c\.offsetWidth; c\.classList\.add\("flash"\);/, "flashes at each close");
  assert.match(vol, /@keyframes closeflash/);
  assert.match(vol, /wait = j\.marketState === "open" \|\| j\.marketState === "pre-market" \|\| j\.marketState === "after-hours" \? OPEN_MS : CLOSED_MS/, "the cadence as W1C");
});

test("W4 · the TradingView embed zoomed out (125 % scaled to 0.8), and both charts LIVE with nothing stored", () => {
  assert.match(tv, /#host \.zoom\{ position:absolute; left:0; top:0; width:125%; height:125%; transform:scale\(0\.8\); transform-origin:0 0; \}/);
  assert.match(fn(tv, "mountWidget"), /const zoom = document\.createElement\("div"\); zoom\.className = "zoom"; host\.appendChild\(zoom\);/); assert.match(fn(tv, "mountWidget"), /zoom\.appendChild\(box\);/);
  assert.match(deck, /WIDGETS_SRC_DEFAULT = Object\.freeze\(\["live", "live"\]\);/, "both LIVE by default; TV one click away");
  const src = [grab(deck, /const WIDGETS_SRC_KEY = [^\n]*/, "src constants"), fn(deck, "widgetsSrcOf"), "globalThis.out = { widgetsSrcOf };"].join("\n"); const ctx = {}; vm.runInNewContext(src, ctx);
  assert.equal(ctx.out.widgetsSrcOf("", "", 0), "live"); assert.equal(ctx.out.widgetsSrcOf("", "", 1), "live"); assert.equal(ctx.out.widgetsSrcOf("tv", "", 1), "tv");
});
