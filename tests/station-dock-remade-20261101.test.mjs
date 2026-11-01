/* 1 Nov 2026. Alan, dictated: "that doc style thing that we did at the top of the station for the toggles ... There's not that many toggles now, and you put some toggles that take
   up a bunch of space. I think you need to relocate them to a remade doc style thing where we switch things around ... what is up there is useless and what you put takes up a ton of space."
   1. The rail beside the lenses is gone on the wall (?dock=1); the phone and the page on its own keep their bar.
   2. The dock holds MINE and the ticker box, the bars' timeframe, BARS or LINE, and the X column's switch; the frame keeps the state and says it after every change.
   3. On the WIDGETS wall the chart controls stand down; WALL and SIMPLE keep them; the wall modes live under the three dots.
   4. CHARTS ONLY no longer empties the lens wall. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const deck = read("../deck/index.html"), lens = read("../station-shells/lens-v1/index.html"), phone = read("../phone/index.html");

test("the rail: gone only when the deck's dock holds the controls", () => {
  assert.match(lens, /const DOCKED = QS\.get\("dock"\) === "1";/);
  assert.match(lens, /body\.docked #bar\{ display:none !important; \}/);
  assert.match(deck, /WIDGETS_LENS_SHELL \+ "\/\?shell=v1&mode=tape&dock=1&rows="/, "the wall's frame asks for it");
  assert.doesNotMatch(phone, /lens-v1\/\?[^"]*dock=1/, "the phone keeps its own bar");
});

test("the dock's chips: every control the rail had, and the frame's state comes back", () => {
  for (const id of ["lensMine", "lensAdd", "lensTfChips", "lensStyleChips", "xColToggle"]) assert.match(deck, new RegExp('id="' + id + '"'), id);
  assert.match(deck, /const LENS_TF_CHIPS = Object\.freeze\(\["1m", "5m", "15m", "30m", "1h", "1D"\]\);/);
  assert.match(lens, /const TFS = Object\.freeze\(\["1m", "5m", "15m", "30m", "1h", "1D"\]\);/, "the same six the frame takes");
  for (const type of ["SCINTILLA_LENS_TF", "SCINTILLA_LENS_MINE", "SCINTILLA_LENS_STYLE", "SCINTILLA_LENS_ADD"]) { assert.match(deck, new RegExp('type:"' + type + '"'), "the deck asks: " + type); assert.match(lens, new RegExp('e\\.data\\.type === "' + type + '"'), "the frame hears: " + type); }
  assert.match(lens, /parent\.postMessage\(\{ type:"SCINTILLA_LENS_STATE", tf:TF, style:STYLE, mineOn:MINE_ON, mine:MINE\.length, note:/);
  assert.match(deck, /event\.data\?\.type === "SCINTILLA_LENS_STATE"\) \{ LENS_DOCK = event\.data; paintLensDock\(\); return; \}/);
  assert.match(deck, /e\.stopPropagation\(\); if \(e\.key !== "Enter"\) return;/, "typing in the box never reaches the wall's keys");
});

test("the WIDGETS wall: the chart controls stand down, WALL and SIMPLE keep them, the modes are under the three dots", () => {
  assert.match(deck, /body\.widgets #dock \.dsec\[data-sec="timeframe"\], body\.widgets #dock \.dsec\[data-sec="scenes"\], body\.widgets #dock #tfReadout, body\.widgets #dock #marketStatus,\nbody\.widgets #edgePrev, body\.widgets #edgeNext, body\.lens-wall #dock #chartsOnlyBtn\{ display:none !important; \}/);
  assert.match(deck, /#dock \.dsec\[data-sec="lenses"\], #dock \.dsec\[data-sec="lenstf"\], #dock \.dsec\[data-sec="lensstyle"\], #dock \.dsec\[data-sec="xcol"\]\{ display:none; \}/, "off the WIDGETS wall the lens chips are not there");
  const more = deck.slice(deck.indexOf('<div id="moreGroup"'), deck.indexOf('<span class="dsec" data-sec="readout"'));
  for (const id of ["wallBtn", "simpleBtn", "widgetsBtn"]) assert.match(more, new RegExp('id="' + id + '"'), id + " under the three dots");
});

test("CHARTS ONLY stands down on the lens wall; the X switch goes through the ?nox= door; no empty corner", () => {
  assert.match(deck, /const on = chartsOnlyOn\(\) && !lensWallOn\(\);/);
  assert.match(deck, /function toggleChartsOnly\(\) \{ if \(lensWallOn\(\)\) return; setChartsOnly\(!chartsOnlyOn\(\)\); \}/);
  assert.match(deck, /u\.searchParams\.set\("nox", NO_X \? "0" : "1"\); location\.assign\(u\.href\);/);
  assert.match(deck, /if \(NO_X && slot\.lensWall\) \{ l\.style\.left = "0px"; l\.style\.width = \(plan\.col \+ FLOOR_SEAM_PX \+ slot\.lensTape\.w\) \+ "px"; \}/);
});
