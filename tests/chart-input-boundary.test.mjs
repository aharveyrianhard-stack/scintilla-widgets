import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const chart = fs.readFileSync(new URL("../chart/index.html", import.meta.url), "utf8");
const shell = fs.readFileSync(new URL("../station-shells/chart-v1/index.html", import.meta.url), "utf8");
const deck = fs.readFileSync(new URL("../deck/index.html", import.meta.url), "utf8");

test("chart drag cannot select text, drag imagery, or paint the native tap shade", () => {
  assert.match(chart, /\.sc-nchart__area\{[^}]*overscroll-behavior:none;[^}]*-webkit-user-select:none; user-select:none;/);
  assert.match(chart, /\.sc-nchart__area \*\{[^}]*-webkit-user-select:none; user-select:none; -webkit-user-drag:none;/);
  assert.match(chart, /\["selectstart", "dragstart"\][\s\S]*?event\) => event\.preventDefault\(\)/,
    "native selection and drag are blocked inside the chart area");
  assert.match(deck, /\.chart-pane,\.chart-pane > \.body,\.chart-pane > \.body > iframe\{[\s\S]*?user-select:none; -webkit-user-drag:none;/,
    "the parent iframe boundary cannot become a separate selectable layer");
});

test("child and parent chart boundaries synchronously cancel wheel and Safari gesture defaults", () => {
  assert.match(chart, /const captureChartWheel = \(event\) => \{ if \(host\.isConnected\) applyChartWheel\(event\); \};/);
  assert.match(chart, /document\.addEventListener\("wheel", captureChartWheel, \{ capture:true, passive:false \}\)/);
  assert.match(chart, /e\.preventDefault\?\.\(\); e\.stopPropagation\?\.\(\); e\.stopImmediatePropagation\?\.\(\)/,
    "the child cancels scroll before applying any chart motion");
  assert.match(chart, /document\.addEventListener\(phase,[\s\S]*?event\.preventDefault\(\); event\.stopPropagation\(\); event\.stopImmediatePropagation\?\.\(\)/);
  assert.match(deck, /document\.addEventListener\("wheel"[\s\S]*?event\.preventDefault\(\); event\.stopPropagation\(\); event\.stopImmediatePropagation\?\.\(\)[\s\S]*?capture:true, passive:false/,
    "the Station document also cancels a boundary wheel before relaying it");
  assert.match(deck, /document\.querySelector\("\.chart-pane:hover > \.body > iframe"\)/,
    "a Safari gesture without useful coordinates still resolves the hovered chart frame");
  assert.match(deck, /html,body\{[^}]*overscroll-behavior:none/);
  assert.match(chart, /html,body\{[^}]*overscroll-behavior:none/);
});

test("one trackpad transaction locks pan or zoom instead of oscillating between them", () => {
  assert.match(chart, /wheelGesture = \{ mode:null, lastAt:0, absX:0, absY:0, ctrl:false \}/);
  assert.match(chart, /now - wheelGesture\.lastAt > 180/,
    "a quiet boundary starts a fresh gesture transaction");
  assert.match(chart, /wheelGesture\.absX >= 2 && wheelGesture\.absX >= wheelGesture\.absY \* \.8/,
    "horizontal movement wins despite small diagonal trackpad noise");
  assert.match(chart, /wheelGesture\.mode = "pan"/);
  assert.match(chart, /if \(wheelGesture\.mode === "pan"\)[\s\S]*?const shift = dx/,
    "the locked pan uses normalized horizontal movement for the rest of the transaction");
  assert.match(chart, /if \(ctrl\) wheelGesture\.mode = "zoom"/,
    "Ctrl-wheel remains an explicit zoom gesture");
  assert.match(chart, /if \(hasActiveTouch\(\)\) return;[\s\S]*?applyTrackpadGesture/,
    "the existing direct-touch pointer pinch remains the sole touch scale path");
});

test("independently versioned chart shell mirrors the tightened input boundary", () => {
  assert.equal(shell, chart);
});
