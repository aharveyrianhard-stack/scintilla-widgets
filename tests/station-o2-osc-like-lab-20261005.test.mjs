/* O2 (5 Oct 2026, Linear SCI-69) — THE RSI + WILLIAMS PANE, THE REST OF THE WAY TO THE LAB'S "MTF REVIEW V2".
   S7 (2 Oct) already drew the Lab's pane rule by rule (one pink, the opacity ladder, RSI solid / Williams dotted, the RSI-only
   cloud, 30/70 solid 20/80 dashed 50 dotted, two chips); CH1 (5 Oct) gave the pane its room rule. O2 looked at both side by
   side and adopted the three rules that still differed, each read off the Lab's last saved revision (2.0, 2 Oct 13:51 UTC:
   INDICATOR_LAB/sprints/2026-10-02-rotation/SCINTILLA_RSI_Williams_MTF_REVIEW_V2_Clear_Value.pine + DESKTOP-DELIVERY.md) and
   its 3 Oct picture. One test per adopted rule, one that CH1's room rule is untouched, one for the wiring. No browser. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const read = (p) => fs.readFileSync(new URL(p, import.meta.url), "utf8");
const context = { Intl, Date, Math, Number, JSON, Array, Object, Set, Map, isFinite, parseInt, console };
vm.runInNewContext(read("../station-shells/detail-v1/indicators.js"), context);
vm.runInNewContext(read("../_indicators/station-rsi-fan.js"), context);
vm.runInNewContext(read("../_indicators/station-osc-merge.js"), context);
const F = context.SC_RSI_FAN, O = context.SC_OSC_LAB;
const plain = (v) => JSON.parse(JSON.stringify(v));
const chart = read("../chart/index.html"), twin = read("../station-shells/chart-v1/index.html");

/* the drawer, run against a canvas that records what it is told (the S7 suite's recorder) */
const drawSrc = chart.slice(chart.indexOf("function drawRsiOnly(ctx, o) {"), chart.indexOf("const cloudSpecOptions"));
function recorder() {
  const ops = []; let cur = { dash:[], path:[] };
  const ctx = new Proxy({ measureText:(t) => ({ width:String(t).length * 6 }) }, {
    get(target, k) {
      if (k in target) return target[k];
      if (k === "setLineDash") return (d) => { cur.dash = Array.from(d); };
      if (k === "beginPath") return () => { cur.path = []; };
      if (k === "moveTo" || k === "lineTo") return (x, y) => { cur.path.push([x, y]); };
      if (k === "stroke") return () => ops.push({ op:"stroke", style:target.strokeStyle, width:target.lineWidth, dash:cur.dash.slice(), path:cur.path.slice() });
      if (k === "fillText") return (t, x, y) => ops.push({ op:"text", t, x, y, style:target.fillStyle, align:target.textAlign });
      return () => {};
    },
    set(target, k, v) { target[k] = v; return true; }
  });
  return { ctx, ops };
}
const sandbox = { window:{ SC_RSI_FAN:F, SC_OSC_LAB:O }, rsiAsOf:() => "5 OCT", isFinite, Math, Number, Object, Array, Date, String };
vm.runInNewContext(drawSrc + "\nthis.drawOsc = drawOsc;", sandbox);
const KEYS = ["3h", "4h", "6h", "8h", "12h", "1D"], N = 40, TOP = 300, PH = 120;
const lineOf = (key, last, rest) => ({ key, values:Array.from({ length:N }, (_, i) => (i === N - 1 ? last : rest)),
  status:{ value:last, t:Date.UTC(2026, 9, 5), stale:false }, approx:false, from:"served", tip:null });
/* rDaily / wDaily = the two Daily values at the newest bar; everything else rests at `rest` */
function fan(rDaily, wDaily, rest = 50) {
  const cloud = { band:Array.from({ length:N }, () => ({ lo:44, hi:58 })),
    parts:F.CONTEXT.map((c, k) => ({ key:c.key, values:Array(N).fill([44, 50, 58, 52][k]), absence:null, from:"served" })) };
  const rsi = { lines:KEYS.map((k) => lineOf(k, k === "1D" ? rDaily : rest, rest)), cloud };
  const williams = { lines:KEYS.map((k) => lineOf(k, k === "1D" ? wDaily : rest, rest)), cloud:null };
  return { lines:rsi.lines, cloud, sets:{ rsi, williams } };
}
const opts = (f, extra) => Object.assign({ fan:f, X:(i) => 10 + i * 10, start:0, end:N - 1, last:N - 1, left:6, width:400,
  top:TOP, height:PH, gap:6, hairline:"#556", font:9, chipFont:10, gutterRight:460, axisX:459, axisFont:7, scrubIx:null, oscReadout:"compact", dateAt:() => null }, extra);

test("rule 1 · the Williams chip is the Lab's revision 2.0 text: 'W%R D −14.4', the native value alone, at the plotted height", () => {
  assert.equal(O.williamsChip(85.6), "W%R D −14.4");
  assert.equal(O.williamsChip(100), "W%R D 0.0"); assert.equal(O.williamsChip(0), "W%R D −100.0"); assert.equal(O.williamsChip(null), "W%R D —");
  const r = sandbox.drawOsc(recorder().ctx, opts(fan(55, 85.6)));
  assert.equal(r.wChip.text, "W%R D −14.4"); assert.equal(r.wChip.native, -14.4);
  /* still anchored at the height the line is DRAWN at (85.6 on the pane), and the RSI chip is untouched */
  assert.equal(r.wChip.y, +O.lookY(85.6, TOP, PH, [r.yLo, r.yHi]).toFixed(2));
  assert.equal(r.chip.text, "RSI D 55.0");
  /* the Lab's own source says the same */
  assert.doesNotMatch(read("../_indicators/station-osc-merge.js"), /"W D " \+/);
});

test("rule 2 · a dot is as long as its line is wide, the gap twice that: Daily Williams (width 2) [2, 4], intraday [1, 2]", () => {
  assert.deepEqual(plain(O.dotFor(1)), [1, 2]); assert.deepEqual(plain(O.dotFor(2)), [2, 4]); assert.deepEqual(plain(O.dotFor(3)), [3, 6]);
  for (const k of KEYS) {
    const spec = F.BY_KEY[k], w = O.lineStyle("williams", spec), r = O.lineStyle("rsi", spec);
    assert.equal(w.width, spec.daily ? 2 : 1); assert.deepEqual(plain(w.dash), spec.daily ? [2, 4] : [1, 2], k);
    assert.equal(w.alpha, spec.alpha, k + ": the ladder's opacity is unchanged");
    assert.equal(r.dash, null, k + ": RSI stays solid"); assert.equal(r.width, spec.daily ? 3 : 1);
  }
  /* on the canvas: the one width-2 dotted stroke is the Daily Williams */
  const { ctx, ops } = recorder(); sandbox.drawOsc(ctx, opts(fan(55, 85.6)));
  const dotted = ops.filter((o) => o.op === "stroke" && o.path.length === N && o.dash.length);
  assert.equal(dotted.length, 6);
  assert.deepEqual(plain(dotted.filter((s) => s.width === 2).map((s) => s.dash)), [[2, 4]]);
  assert.ok(dotted.filter((s) => s.width === 1).every((s) => s.dash.join() === "1,2"));
});

test("rule 3 · the pane carries its numbers: 70 and 30 on their bands at the right edge, in the bands' pink", () => {
  const { ctx, ops } = recorder();
  const r = sandbox.drawOsc(ctx, opts(fan(55, 45)));
  assert.deepEqual(plain(r.scale.map((m) => m.v)), [70, 30]);
  const dom = [r.yLo, r.yHi];
  for (const m of r.scale) {
    assert.equal(m.y, O.lookY(m.v, TOP, PH, dom), m.v + " sits on its own band");
    const t = ops.find((o) => o.op === "text" && o.t === String(m.v));
    assert.ok(t, m.v + " is printed"); assert.equal(t.x, 459); assert.equal(t.align, "right");
    assert.equal(t.style, F.rgba("#FF4FAD", .70), "the band's own pink at the band's opacity - never a grey");
  }
  assert.deepEqual(plain(O.SCALE.values), [70, 30]);
});

test("rule 3 · a number never sits under a chip, and a band outside the room has no number", () => {
  /* the Daily RSI at 70: its chip covers the 70 band's spot, so only 30 is printed */
  const r = sandbox.drawOsc(recorder().ctx, opts(fan(70, 45)));
  assert.deepEqual(plain(r.scale.map((m) => m.v)), [30]);
  const at = { x:459, h:7, w:(t) => t.length * 6 };
  const y = (v) => 400 - v;
  assert.deepEqual(plain(O.scaleMarks([26, 94], y, [], at).map((m) => m.v)), [70, 30]);
  assert.deepEqual(plain(O.scaleMarks([26, 94], y, [null, { x:440, y:y(30) - 5, w:30, h:10 }], at).map((m) => m.v)), [70]);
  assert.deepEqual(plain(O.scaleMarks([26, 94], y, [{ x:300, y:y(30) - 5, w:30, h:10 }], at).map((m) => m.v)), [70, 30], "a chip elsewhere on the row hides nothing");
  /* pure: the room decides (the room always holds 30 and 70 under CH1, so this is the guard, not the usual case) */
  assert.deepEqual(plain(O.scaleMarks([40, 94], y, [], at).map((m) => m.v)), [70]);
});

test("CH1 is kept: the room still holds the 30/70 bands, follows the visible traces plus 4, never past 0 or 100", () => {
  assert.deepEqual(plain(O.oscDomain([45, 55])), [26, 74]);
  assert.deepEqual(plain(O.oscDomain([3, 97])), [0, 100]);
  assert.deepEqual(plain(O.oscDomain([44, 90])), [26, 94]);
  assert.equal(O.DOMAIN_PAD, 4); assert.deepEqual(plain(O.BAND), [30, 70]);
  const r = sandbox.drawOsc(recorder().ctx, opts(fan(90, 85.6)));
  assert.deepEqual([r.yLo, r.yHi], [26, 94]);
  assert.deepEqual(plain(r.guides.map((g) => g.v)), [80, 70, 50, 30], "a band outside the room is not drawn (CH1), 0/100 never");
  assert.match(chart, /domain = M\.oscDomain\(seen\);/);
});

test("the look S7 took from the Lab is unchanged: one pink, the ladder, the cloud, the guides", () => {
  assert.equal(O.PINK, "#FF4FAD"); assert.equal(O.PINK_CLOUD, "#C84C86"); assert.equal(O.LOOK.cloud.opacity, .30);
  assert.deepEqual(KEYS.map((k) => F.BY_KEY[k].alpha), [.54, .57, .60, .63, .66, .90]);
  assert.deepEqual(plain(O.LOOK.guides.map((g) => [g.v, g.opacity, g.dash])), [[80, .45, [4, 3]], [70, .70, null], [50, .30, [1, 2]], [30, .70, null], [20, .45, [4, 3]]]);
});

test("wiring: both chart copies are the same file and hand the pane the axis column", () => {
  assert.equal(chart, twin, "chart/index.html and station-shells/chart-v1/index.html are identical copies");
  assert.match(chart, /gutterRight:w - 2, axisFont:\(ipadProfile \? 6\.5 : 7\) \* scale,/);
  assert.match(chart, /scale = M\.scaleMarks\(domain, RY, \[chip && chip\.box, wChip && wChip\.box\]/);
});
