/* TAPES (18 Nov 2026). Alan, dictated: "The tapes, the earnings tape, the scintilla tape, the economic tape, I need them on the
   station ... the coolest method is the one with the economic, with the flashing and such, but that one I can barely see anything.
   On the station, if we express more things like that with the flashing and the scintillation, we'll have more space."
   1. floorLensWall, pure: with a strip height it carves the strip off the bottom of the lens area (one seam above), the lenses give
      up exactly that height, the band (YouTube, volume) does not move; with no strip, or where the lenses would drop under 120 px,
      the slot is exactly the old one plus an empty `events` box.
   2. The strip is a share of the wall's height: 3.3 % a row, 28-50 px.
   3. The switch: on by default; this machine's "0" or ?eventtapes=0 takes it off; ?eventtapes=1 wins for one load.
   4. The deck makes, mounts and places the frame; slotFor's W15 line is untouched (the strip is decided inside floorLensWall).
   5. The shell reads econ_calendar, earnings_events and scintillas, shows the NEXT release with its countdown and flash states, and
      takes new content only at the end of a lap. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
const read = (p) => fs.readFileSync(new URL(p, import.meta.url), "utf8");
const deck = read("../deck/index.html");
const shell = read("../station-shells/tapes-v1/index.html");
const grab = (src, re, what) => { const m = src.match(re); assert.ok(m, what + " must exist"); return m[0]; };
const fn = (src, name) => grab(src, new RegExp("\\nfunction " + name.replace(/[$]/g, "\\$") + "\\([^)]*\\) \\{[\\s\\S]*?\\n\\}"), name);
const plain = (v) => JSON.parse(JSON.stringify(v));

function api() {
  const src = [
    grab(deck, /const VIDEO_CHROME_FALLBACK_PX = [^;]*;/, "the shell's bar fallback"),
    grab(deck, /const FLOOR_SEAM_PX = \d+;/, "the seam"),
    grab(deck, /const WIDGETS_X_SHARE = [^\n]*/, "the wall's shares"),
    grab(deck, /const LENSWALL_PLAYER_W = [^\n]*/, "the lens wall's shares"),
    grab(deck, /const LENSWALL_LENS_ROW_PX = [^\n]*/, "the lens row"), grab(deck, /const lensWallRows = [^\n]*/, "lensWallRows"),
    grab(deck, /const EVENT_TAPES_KEY = [^\n]*/, "the strip's constants"), grab(deck, /const eventTapesRowPx = [^\n]*/, "eventTapesRowPx"),
    grab(deck, /const eventTapesPx = [^\n]*/, "eventTapesPx"), fn(deck, "eventTapesChoice"), fn(deck, "floorLensWall"),
    "globalThis.out = { floorLensWall, eventTapesRowPx, eventTapesPx, eventTapesChoice, EVENT_TAPES_KEY, EVENT_TAPES_ROWS, EVENT_TAPES_SHELL, FLOOR_SEAM_PX };"
  ].join("\n");
  const ctx = {}; vm.runInNewContext(src, ctx); return ctx.out;
}
/* his screens: the MacBook on its 2560 × 1440 external, the built-in and the iMac at 1280 × 800; and a 1920 × 1080 */
const SCREENS = [[2560, 1440], [1920, 1080], [1280, 800]];
const CHROME = 26;
const colOf = (w) => Math.round(w * 0.18);

test("TAPES · the strip comes off the bottom of the lens area; the lenses give up exactly that; the band never moves", () => {
  const D = api();
  for (const [W, H] of SCREENS) {
    const col = colOf(W), areaW = W - col - D.FLOOR_SEAM_PX;
    const before = plain(D.floorLensWall(areaW, H, 66, col, 9, CHROME, 0));
    const px = D.eventTapesPx(H, D.EVENT_TAPES_ROWS);
    const after = plain(D.floorLensWall(areaW, H, 66, col, 9, CHROME, px));
    assert.equal(before.events.on, false, W + ": no strip asked, none given");
    assert.equal(after.events.on, true, W + ": the strip is there");
    assert.equal(after.events.h, px);
    assert.equal(after.events.left, 0); assert.equal(after.events.w, after.lensTape.w, "as wide as the lenses");
    assert.equal(after.lensTape.h, before.lensTape.h - px - D.FLOOR_SEAM_PX, "the lenses give up the strip and one seam");
    assert.equal(after.events.top, after.lensTape.h + D.FLOOR_SEAM_PX, "the strip sits one seam under the lenses");
    assert.equal(after.events.top + after.events.h + D.FLOOR_SEAM_PX, before.lensTape.h + D.FLOOR_SEAM_PX, "and ends where the lenses used to end");
    for (const k of ["box", "volume", "picture", "bandH", "rowBelow", "tapeLeft", "playerW", "wall", "col"]) assert.deepEqual(after[k], before[k], W + ": " + k + " does not move");
    assert.ok(after.lensTape.h >= 120, W + ": the lenses keep at least 120 px");
  }
});

test("TAPES · each row is 3.3 % of the wall's height, 28-50 px; two rows and the seam between them", () => {
  const D = api();
  assert.equal(D.eventTapesRowPx(1440), 48); assert.equal(D.eventTapesRowPx(1080), 36); assert.equal(D.eventTapesRowPx(800), 28);
  assert.equal(D.eventTapesRowPx(400), 28, "never under 28"); assert.equal(D.eventTapesRowPx(2160), 50, "never over 50");
  assert.equal(D.eventTapesPx(1440, 2), 97); assert.equal(D.eventTapesPx(800, 2), 57); assert.equal(D.eventTapesPx(1440, 0), 0);
});

test("TAPES · where the lenses would drop under 120 px the strip stands down and the slot is the old one", () => {
  const D = api();
  const short = plain(D.floorLensWall(1049, 420, 66, 231, 9, CHROME, 200));
  const none = plain(D.floorLensWall(1049, 420, 66, 231, 9, CHROME, 0));
  assert.equal(short.events.on, false);
  assert.deepEqual({ ...short, events:null }, { ...none, events:null });
});

test("TAPES · no 7th argument outside the page: no strip (the VM has no machine choice), the old slot", () => {
  const D = api();
  const six = plain(D.floorLensWall(2097, 1440, 66, 461, 9, CHROME));
  assert.equal(six.events.on, false);
  assert.equal(six.lensTape.h, plain(D.floorLensWall(2097, 1440, 66, 461, 9, CHROME, 0)).lensTape.h);
});

test("TAPES · the switch: on unless this machine says 0; the URL wins for one load and is not remembered", () => {
  const D = api();
  assert.equal(D.EVENT_TAPES_KEY, "station.eventtapes");
  assert.equal(D.eventTapesChoice("", null), true); assert.equal(D.eventTapesChoice(null, null), true);
  assert.equal(D.eventTapesChoice("0", null), false); assert.equal(D.eventTapesChoice("1", null), true);
  assert.equal(D.eventTapesChoice("1", "0"), false); assert.equal(D.eventTapesChoice("0", "1"), true);
  assert.equal(D.eventTapesChoice("junk", "junk"), true);
  assert.ok(!/remember\(EVENT_TAPES_KEY, QS/.test(deck), "the URL's choice is not remembered");
});

test("TAPES · the deck makes, mounts and places the frame; slotFor's W15 line is untouched", () => {
  assert.match(deck, /make\("wgEvents", "", "", ""\);/);
  assert.match(fn(deck, "mountWidgets"), /if \(ev && eventTapesOn\(\) && !ev\.querySelector\("iframe"\)\) \{[^\n]*EVENT_TAPES_SHELL \+ "\/\?shell=v1&rows=" \+ EVENT_TAPES_ROWS/);
  const place = fn(deck, "placeWidgets");
  assert.match(place, /const eb = slot\.events && slot\.events\.on \? slot\.events : null;/);
  assert.match(place, /ev\.classList\.toggle\("off", !eb\);/, "off where the slot has no strip");
  assert.match(place, /if \(NO_X && slot\.lensWall\) \{ ev\.style\.left = "0px";/, "with X off it starts at the screen's edge, like the lenses");
  assert.match(fn(deck, "slotFor"), /if \(widgetsOn\(\)\) return \(lensWallOn\(\) \? floorLensWall : floorWidgets\)\(plan\.charts\.w, plan\.charts\.h, tapePx, plan\.col, count, chromePx\);   \/\* W15 \*\//);
  assert.match(fn(deck, "floorLensWall"), /eventsPx === undefined \? \(typeof lensWallEventsPx === "function" \? lensWallEventsPx\(h\) : 0\) : eventsPx/);
  assert.match(deck, /#wgVolume\.off, #wgLensTape\.off, #wgEvents\.off\{ display:none !important; \}/);
});

test("TAPES · the shell: the Hub's three sources, read only; the NEXT box's flash states; new content waits for the end of a lap", () => {
  assert.match(shell, /pg\("econ_calendar\?select=event_ts,event,impact,actual,estimate,previous&country=eq\.US/);
  assert.match(shell, /pg\("earnings_events\?select=ticker,date,report_time,eps_estimate,eps_actual/);
  assert.match(shell, /pg\("scintillas\?select=ts,subject,direction,magnitude,detail&kind=eq\.price_outlier/);
  assert.ok(!/method:\s*"(POST|PATCH|DELETE)"/i.test(shell), "nothing is written");
  assert.match(shell, /\/\^\(high\|medium\)\$\/i\.test\(r\.impact\)/, "medium and high releases only");
  assert.match(shell, /left <= 0 \? " due" : left <= 60000 \? " last" : left <= 15 \* 60000 \? " soon" : ""/, "15 minutes: pulse; last minute: faster; due: held");
  assert.match(shell, /cls \+= " printed";/, "the print flashes and holds the box ten minutes");
  assert.match(shell, /its usual day/, "said as N× its usual day, never σ");
  assert.ok(!/σ|sigma/.test(shell.replace(/<!--[\s\S]*?-->/g, "")), "no σ on the Station");
  assert.match(shell, /if \(tr\.classList\.contains\("run"\)\) \{ PENDING\.set\(id, html\); return; \}/, "a running tape keeps its lap");
  assert.match(shell, /addEventListener\("animationiteration"/, "and takes the new content at the seam");
  assert.match(shell, /@keyframes tape-move\{ from\{ transform:translateX\(0\); \} to\{ transform:translateX\(-50%\); \} \}/, "one steady pace, two copies");
});
