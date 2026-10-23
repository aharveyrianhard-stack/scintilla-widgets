/* W1C (22 Oct 2026). Alan, ~17:55 ET: "Where you have the ticker tape is where I want a tape of context lenses … make it 5 minute charts …
   the ticker tape … goes below … Ticker percentage price and dollar value. Like top to down, and then the line to the right … resize the
   volume so that the line chart is actually a graph … with those comments, make it live."
   1. The lens tape (lens-v1, ?mode=tape): the chips rail, one moving row of 290 px lenses on the last 120 completed 5-minute bars.
   2. The FAVORITES tape at the very bottom, cells stacked (tested in the W1 file, restated).
   3. volume-v1: the research session's graph from its public feed, drawn its way; the compact head; 8 s / 2 min. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const read = (p) => fs.readFileSync(new URL(p, import.meta.url), "utf8");
const deck = read("../deck/index.html"), lens = read("../station-shells/lens-v1/index.html"), vol = read("../station-shells/volume-v1/index.html");
const tv = read("../station-shells/tv-v1/index.html");
const grab = (src, re, what) => { const m = src.match(re); assert.ok(m, what + " must exist"); return m[0]; };
const fn = (src, name) => grab(src, new RegExp("\\nfunction " + name + "\\([^)]*\\) \\{[\\s\\S]*?\\n\\}"), name);

test("W1C · the lens tape: lens-v1 in tape mode - the chips at the left, one row of fixed lenses that runs like the other tapes, 5-minute bars", () => {
  assert.match(lens, /const TAPE = QS\.get\("mode"\) === "tape";/);
  assert.match(lens, /const LENS_TF = TAPE \? "5m" : "1d", LENS_BARS = TAPE \? 30 : 60;/, "the latest 30 completed 5-minute bars on the tape (W4: restated from 120); the column's sixty daily candles stay");
  assert.match(lens, /BARS_MS = TAPE \? 60000 : 600000/, "read every minute on the tape (a 5-minute bar completes every five)");
  assert.match(lens, /const TAPE_SPEED_PX_S = TAPE \? 90 : 45;/, "W4: twice the deck's tapes' pace on the tape");
  const run = fn(lens, "runTape");
  assert.match(run, /if \(!one \|\| one <= win\) continue;/, "a row that fits stands still (W7: every row its own track)");
  assert.match(run, /c\.setAttribute\("aria-hidden", "true"\)/, "doubled with copies"); assert.match(run, /animationDuration = \(one \/ TAPE_SPEED_PX_S\)\.toFixed\(2\) \+ "s"/);
  assert.match(lens, /body\.tape \.track\.run\{ will-change:transform; animation:lens-tape-move linear infinite; \}/);
  assert.match(lens, /body\.tape #set:hover \.track\.run\{ animation-play-state:paused; \}/, "the pointer holds it still");
  assert.match(lens, /@keyframes lens-tape-move\{ from\{ transform:translateX\(0\); \} to\{ transform:translateX\(-50%\); \} \}/);
  assert.match(lens, /body\.tape \.lens\{ flex:none; width:var\(--lens-w, 170px\); height:100%; \}/, "a lens is 170 px wide on the tape (W7: bigger type)");
  assert.match(lens, /body\.tape #bar\{ flex:none; width:96px; flex-direction:column;/, "the chips in a rail at the left");
  assert.match(lens, /remember\(LIST_KEY, l\)/, "the choice remembered");
  /* the drawing is the column's: the oval, the edge in the day's colour, never grey */
  assert.match(lens, /ctx\.strokeStyle = day === "up" \? PALETTE\.bull : day === "down" \? PALETTE\.bear : INK\.frame;/);
  /* the deck mounts it over the band and gives it its height */
  assert.match(fn(deck, "mountWidgets"), /WIDGETS_LENS_SHELL \+ "\/\?shell=v1&mode=tape&view="/);
  assert.match(deck, /const WIDGETS_X_SHARE = 0\.18, WIDGETS_YT_W = 0\.34, WIDGETS_VOL_W = 0\.17, WIDGETS_LENS_ROW_PX = 150, WIDGETS_VOLUME_MIN_PX = 120;/);   /* W7: restated - the round-3 layout */
});

test("W1C · the volume panel (restated for W7): volume-v1 reads the research session's public feed; the meter's look - one pulsing dot, the thermometer tube; 8 s open, 2 min closed", () => {
  assert.match(vol, /const FEED = "https:\/\/volume-pulse-pied\.vercel\.app\/api\/heartbeat";/);
  assert.match(vol, /const OPEN_MS = 8000, CLOSED_MS = 120000/);
  assert.match(vol, /wait = j\.marketState === "open" \|\| j\.marketState === "pre-market" \|\| j\.marketState === "after-hours" \? OPEN_MS : CLOSED_MS/, "8 s while a session is open");
  /* the meter's own look (meter.js): the dot's pulse, the tube's gradient and ticks, its colours */
  assert.match(vol, /@keyframes vmpulse/); assert.match(vol, /#fill\{[^}]*background:linear-gradient\(var\(--hot\), var\(--warm\) 45%, var\(--glow\)\)/, "the tube's gradient");
  assert.match(vol, /--glow:#3987e5; --warm:#fab219; --hot:#ec835a; --up:#19b419; --dn:#e05252;/, "the page's own colours");
  assert.match(vol, /const T1 = 1\.2, T2 = 1\.5;/, "the page's default thresholds");
  assert.match(vol, /<span class="k">trade size<\/span>/); assert.match(vol, /<span class="k">last block<\/span>/);
  assert.match(vol, /nowS = sz\.now \|\| sz\.last \|\| \{\}/, "out of hours the last bar's size stands");
  assert.doesNotMatch(vol, /method:\s*"POST"|localStorage\.setItem/, "reads one GET, writes nothing");
  /* the deck: the column is the panel's, no meter on the wall */
  assert.match(deck, /make\("wgVolume", "Volume", "volume-pulse · SPY QQQ DIA IWM · × a usual 5 minutes", WIDGETS_VOLUME_OPEN\);/);
  assert.doesNotMatch(deck, /meter\.html/);
});

test("W1C · untouched: the two chart slots (tv-v1 as W1 built it), the video keeps W1B's size with the grid beside it, WALL and SIMPLE one click away", () => {
  assert.match(tv, /studies: \["STD;VWAP"\]/); assert.match(tv, /extended_hours: true/); assert.match(tv, /function heardFromWidget/);
  assert.match(fn(deck, "slotFor"), /if \(widgetsPlaying\(\)\) \{[\s\S]{0,400}?return floorWidgetsPlaying\(/);
  assert.match(deck, /<button type="button" class="btn" id="wallBtn"/); assert.match(deck, /<button type="button" class="btn" id="simpleBtn"/); assert.match(deck, /<button type="button" class="btn" id="widgetsBtn"/);
  assert.doesNotMatch(deck, /widgetsArrBtn/, "the A · B button is gone");
});
