/* THE STATION DOCK — readable, in sections, one row at every width; and the TradingView pane's
   waiting line can no longer sit on a chart that has drawn.
   ============================================================================
   Alan, 23 Sep: "I like the new dock. But they kind of blend together." · "Some of these are grayed
   out. I can't see shit." · "How's that going to work on mobile?" · the faint "TRADINGVIEW · DRAWING"
   caption over internals that had already drawn.
   These tests read the deployed files and compute the contrast the way a browser would, so a
   token change that makes a dock label unreadable fails here before Alan sees it.
   ============================================================================ */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const deck = fs.readFileSync(new URL("../deck/index.html", import.meta.url), "utf8");
const chart = fs.readFileSync(new URL("../chart/index.html", import.meta.url), "utf8");
const twin = fs.readFileSync(new URL("../station-shells/chart-v1/index.html", import.meta.url), "utf8");
const dockCss = deck.slice(deck.indexOf("/* ── THE DOCK"), deck.indexOf("/* FIRST-PAINT SKELETON")).replace(/\/\*[\s\S]*?\*\//g, "");

const tokens = {};
for (const m of deck.slice(deck.indexOf(":root{"), deck.indexOf("}", deck.indexOf(":root{"))).matchAll(/--([a-z0-9]+):(#[0-9A-Fa-f]{6})/g)) tokens[m[1]] = m[2];
const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
const lum = (hex) => { const [r, g, b] = rgb(hex); return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b); };
const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const sectionTint = (/#dock \.dsec\{[^}]*background:(#[0-9A-Fa-f]{6})/.exec(dockCss) || [])[1];

test("every colour a dock label is painted in reads at 4.5:1 or better on the strip and on a section tint", () => {
  assert.ok(sectionTint, "the sections have a tint");
  for (const bg of [tokens.bg, sectionTint, tokens.panel2]) {
    for (const [name, hex] of [["ink3", tokens.ink3], ["dim", tokens.dim], ["crk", tokens.crk], ["rest", "#A6A8C0"], ["hover", "#B4B6CC"]])
      assert.ok(contrast(hex, bg) >= 4.5, name + " on " + bg + " is " + contrast(hex, bg).toFixed(2) + ":1");
  }
  assert.ok(contrast(tokens.mute, tokens.bg) < 3, "--mute is a hairline colour (" + contrast(tokens.mute, tokens.bg).toFixed(2) + ":1), which is why no dock word may use it");
  assert.doesNotMatch(dockCss, /#dock[^{]*\{[^}]*color:var\(--mute\)/, "no dock rule paints a word in --mute");
});

test("a disabled chip is legible: --dim, full opacity, a dashed edge", () => {
  const rule = /#dock button\.btn:disabled[^{]*\{([^}]*)\}/.exec(dockCss);
  assert.ok(rule, "the dock has its own disabled rule");
  assert.match(rule[1], /color:var\(--dim\)/);
  assert.match(rule[1], /opacity:1/);
  assert.match(rule[1], /border-style:dashed/);
});

test("sections are visibly distinct: a tint, a hairline you can see, and a gap between neighbours", () => {
  const rule = /#dock \.dsec\{([^}]*)\}/.exec(dockCss)[1];
  assert.match(rule, /background:#[0-9A-Fa-f]{6}/);
  assert.match(rule, /border:1px solid (#[0-9A-Fa-f]{6})/);
  const edge = /border:1px solid (#[0-9A-Fa-f]{6})/.exec(rule)[1];
  assert.ok(contrast(edge, tokens.bg) >= 1.6, "the section edge is visible against the strip (" + contrast(edge, tokens.bg).toFixed(2) + ":1)");
  assert.ok(contrast(edge, tokens.bg) < 4, "but is a hairline, not a wall");
  assert.match(rule, /margin:0 3px/);
  for (const hex of dockCss.match(/#[0-9A-Fa-f]{6}\b/g) || []) {
    const [r, g, b] = rgb(hex); assert.ok((Math.max(r, g, b) + Math.min(r, g, b)) / 2 / 255 < .8, hex + " is near white");
  }
});

test("one row at every width: when it does not fit it scrolls at full size, it never shrinks", () => {
  const fit = deck.slice(deck.indexOf("function fitDock("), deck.indexOf("function dockAutoHideOn("));
  assert.match(fit, /dock\.classList\.add\("dock-scroll"\)/);
  assert.doesNotMatch(fit, /classList\.add\("dock-wrap"\)/, "nothing adds the wrap any more");
  assert.match(dockCss, /#dock\.dock-scroll #dockRail\{[^}]*overflow-x:auto/, "the rail scrolls, and the strip keeps its size");
  assert.match(dockCss, /#dock\.dock-scroll\{[^}]*justify-content:flex-start/, "a centred scroll box would hide its left end");
  assert.doesNotMatch(dockCss, /@media \(max-width: 720px\)\{ #dock\{ flex-wrap:wrap/, "no media query forces a wrap on phones");
  /* Alan, 23 Sep: "there's no reason to compress it all into one screen." There is no shrink factor
     left to get wrong - the type is the same size at 2240 and at 390. */
  assert.doesNotMatch(deck, /DOCK_FIT_FLOOR|--dock-fit/, "nothing scales the strip down to make it fit");
  assert.match(dockCss, /body\.stack #dock\.dock-scroll \.control-label[\s\S]{0,240}?color:var\(--dim\)/,
    "where a finger does the scrolling the group words come back, and they are readable");
  assert.match(dockCss, /#dock\.dock-scroll \.dsec\[data-sec="readout"\]\{[^}]*position:static/,
    "the age stands beside the rail instead of lying over it");
  assert.doesNotMatch(deck.slice(deck.indexOf("const dockMagnifies"), deck.indexOf("function dockContentChanged")),
    /dock-scroll/, "a strip that scrolls magnifies exactly like a wide one");
});

test("the video-feed buttons stay out of the dock", () => {
  assert.match(deck, /\.dsec\[data-sec="video"\]\{ display:none !important; \}/);
});

test("the TradingView waiting line lives under the frame and is tidied away shortly after load", () => {
  assert.match(chart, /\.sc-tvinternal__frame\{[^}]*z-index:2/);
  assert.match(chart, /\.sc-tvinternal__wait\{[^}]*z-index:1/);
  assert.match(chart, /\.sc-tvinternal__cap\{[^}]*z-index:3/, "the attribution stays on top");
  assert.match(chart, /\.sc-tvinternal__frame\{[^}]*background:transparent/, "the frame lets the line show through only until it paints");
  const draw = Number(/const TV_PANE_DRAW_MS = (\d+);/.exec(chart)[1]);
  const max = Number(/const TV_PANE_WAIT_MAX_MS = (\d+);/.exec(chart)[1]);
  assert.ok(draw <= 2000, "post-load grace is " + draw + " ms (was 14000)");
  assert.ok(max <= 10000 && max > draw, "and the line goes regardless after " + max + " ms");
  assert.equal(twin, chart, "station-shells/chart-v1 is byte-identical to chart");
});
