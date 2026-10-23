/* W10 (23 Oct 2026). Alan, ~00:50 ET on the Apple TV: "I need the grid to have a permanent spot. No shifting … why are the context lens and the
   ticker tape jumpy? … I don't like descriptions … what about the lot size? … you removed the graph now? … The positions of things are fixed." */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const read = (p) => fs.readFileSync(new URL(p, import.meta.url), "utf8");
const deck = read("../deck/index.html"), lens = read("../station-shells/lens-v1/index.html"), vol = read("../station-shells/volume-v1/index.html");
const shells = Object.fromEntries(["personal-video-v1", "scintilla-video-v1"].map((n) => [n, read(`../station-shells/${n}/index.html`)]));
const grab = (src, re, what) => { const m = src.match(re); assert.ok(m, what + " must exist"); return m[0]; };
const fn = (src, name) => grab(src, new RegExp("\\nfunction " + name + "\\([^)]*\\) \\{[\\s\\S]*?\\n\\}"), name);

test("W10 · the grid is a permanent feed: a fixed column on the left, the player the rest, always; the refresh repaints the grid only", () => {
  assert.equal(shells["personal-video-v1"], shells["scintilla-video-v1"], "byte-identical twins");
  const s = shells["scintilla-video-v1"];
  assert.match(s, /let FIXED = QS\.get\("fixed"\) === "1";/);
  assert.match(s, /body\.fixed\{ display:grid; grid-template-columns:var\(--beside-col, 300px\) minmax\(0,1fr\); grid-template-rows:auto minmax\(0,1fr\); \}/, "the grid column first, the player the rest");
  assert.match(s, /body\.fixed > #grid\{ grid-column:1; grid-row:2; display:grid; border-right:1px solid var\(--line\); \}/, "the grid always shown, on the left");
  assert.match(s, /body\.fixed > #stage\{ grid-column:2; grid-row:2; display:flex; min-width:0; \}/, "the player always there");
  assert.match(s, /body\.fixed:not\(\.playing\) #idleNote\{ display:flex; \}/, "one line until a video is tapped");
  assert.match(fn(s, "paintBeside"), /classList\.toggle\("fixed", FIXED && !STACK\)/   /* W12: the phone's one column is STACK */);
  assert.match(s, /const besideNow = \(\) => FIXED \|\| \(BESIDE && document\.body\.classList\.contains\("playing"\)\);/, "the column counts its own width always");
  /* the refresh touches #grid only; the player is in #stage */
  assert.match(fn(s, "paint"), /grid\.innerHTML = rows\.map\(cardHTML\)\.join\(""\);/); assert.doesNotMatch(fn(s, "paint"), /stage|YT_PLAYER|#video/, "a repaint of the grid never touches the player");
  assert.match(deck, /"\?shell=v1&feed=scintilla&cols=2" \+ \(widgetsOn\(\) \? "&beside=1&fixed=1" : ""\)/, "the WIDGETS wall mounts the pane fixed");
  assert.match(fn(deck, "tellVideoBeside"), /fixed:!!on/);
  assert.match(grab(deck, /const widgetsBesideCol = [^\n]*/, "widgetsBesideCol"), /SLOT_NOW\.plan\.col/, "the feed column is X's column's width");
});

test("W10 · the tapes do not jump: the lens tape is never rebuilt for the same names and a track is never restarted while its run is the same", () => {
  assert.match(fn(lens, "paintSet"), /const key = sets\(\)\.join\("\+"\) \+ "\|" \+ ROWS \+ "\|" \+ list\.join\(","\);\n\s+if \(!force && key === SET_KEY && box\.firstChild\) return;/   /* W12: the sets in the key */);
  const run = fn(lens, "runTape");
  assert.match(run, /const mark = originals \+ ":" \+ win \+ ":" \+ \(one > win \? "run" : "still"\);\n\s+if \(track\.dataset\.fit === mark\) continue;/, "the same run is never restarted (the restart was the jump)");
  assert.match(lens, /if \(r !== ROWS\) \{ ROWS = r; paintSet\(true\); \}/, "a changed row count rebuilds; the same count does not");
  /* the FAVORITES tape: fixed-width cells, so a price never changes the run's length (W1C's rule, still) */
  assert.match(deck, /body\.widgets #tapes \.tape\.tall \.cell\{ height:var\(--tape-row-px, 66px\); width:176px;/);
});

test("W10 · the lenses tighter with the RVol tube above the chart; the same tube on the tape cells", () => {
  assert.match(lens, /body\.tape \.track\{ height:100%; gap:6px; background:var\(--bg\); \}/, "a clear gap between neighbours");
  assert.match(lens, /body\.tape \.lens canvas\{ margin:2px 10px 7px; width:calc\(100% - 20px\); \}/, "the chart inset");
  assert.match(lens, /body\.tape \.lens \.rv i\{ display:block; flex:1 1 0; height:6px; border-radius:3px; background:#1d1d1b; border:1px solid #33332f;/, "the tube, flat");
  assert.match(lens, /background:linear-gradient\(90deg, #3987e5, #fab219 55%, #ec835a\)/, "the meter's gradient");
  assert.match(deck, /body\.widgets #tapes \.tape\.tall \.cell \.rv i\{ display:block; flex:1 1 0; height:6px; border-radius:3px; background:#1d1d1b; border:1px solid #33332f;/, "the same tube on the tape");
  assert.match(deck, /body\.widgets #tapes \.tape\.tall \.cell \.rv\{ order:-1;/, "above the line");
});

test("W10 · the volume panel: the research graph back with its pulsing dot at NOW, the numbers big and short, lot size never a bare dash, no descriptions; the synced zoom forwarded", () => {
  assert.match(vol, /const slots = all\.slice\(-24\), n = slots\.length;/, "the last two hours");
  assert.match(vol, /class="beat-ring"/); assert.match(vol, /class="\$\{data\.live \? "beat-core" : ""\}"/, "its glowing pulsing dot at NOW");
  assert.match(vol, /\[\[2, "2×", "2 6", "var\(--grid\)"\], \[1, "normal", "6 6", "#4a4a46"\]\]/); assert.match(vol, /b\.dir === "up" \? "var\(--up\)" : "var\(--dn\)"/, "the block dots");
  assert.match(vol, /<span class="ib" id="iSize"[^>]*><i>◫<\/i><b id="tsize">—<\/b><em id="sizeAt"><\/em><\/span>/   /* W12: a small icon badge */); assert.match(vol, /if \(nowS && nowS\.x != null\) LAST_SIZE = \{/, "the last size seen is kept"); assert.match(vol, /"closed · none in the feed"/, "and said when there is none");
  assert.match(vol, /badge\("bVol", "vol", Lg\.vol\); badge\("bDir", "dir", Lg\.dir\); badge\("bVwap", "vwap", Lg\.vwap\); badge\("bHour", "hour", Lg\.hour\);/   /* W12: lights in icon badges */, "the four badges");
  assert.doesNotMatch(vol, /of a usual|who is in control|does it sustain/, "no descriptions");
  assert.match(vol, /#tube\{ position:relative; width:8px; height:22px;/   /* W12: small */); assert.match(vol, /@keyframes vmpulse/);
  assert.match(deck, /if \(event\.data\?\.type === "SCINTILLA_CHART_VIEW" && event\.data\.view && typeof event\.data\.view === "object"\) \{/, "the zoom message");
  assert.match(deck, /other\.frame\.contentWindow !== event\.source && widgetsSrc\(n === 1 \? 1 : 0\) === "live"\) \{ try \{ other\.frame\.contentWindow\.postMessage\(\{ sc:"chart", view \}, location\.origin\); \}/, "to the other live chart, never the sender");
});
