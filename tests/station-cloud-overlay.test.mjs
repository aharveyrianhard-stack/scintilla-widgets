import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const read = (p) => fs.readFileSync(new URL(p, import.meta.url), "utf8");
const moduleSource = read("../_indicators/cloud-overlay.js");
const chart = read("../chart/index.html");
const shell = read("../station-shells/chart-v1/index.html");
const deck = read("../deck/index.html");

const context = vm.createContext({ console });
new vm.Script(moduleSource, { filename:"cloud-overlay.js" }).runInContext(context);
const cloud = context.SC_CLOUD_OVERLAY;

test("approved Station cloud hierarchy is preserved", () => {
  assert.equal(cloud.palette.blue, "#3455FF");
  assert.equal(cloud.palette.pink, "#FF00A8");
  assert.deepEqual(Array.from(cloud.specs, (s) => s.label), ["8D","13D","21D","50D","100D","200D"]);
  assert.deepEqual(Array.from(cloud.specs, (s) => s.width), [.6,1,2,3,3,4]);
  assert.equal(cloud.specs[0].style, "dashed", "8D is the quiet dashed fast level");
  assert.equal(cloud.specs[4].style, "dashed", "100D is dashed");
  assert.equal(cloud.specs[4].optional, true, "100D is optional rather than another cloud");
  assert.deepEqual(Array.from(cloud.activeSpecs(false), (s) => s.label), ["8D","13D","21D","50D","200D"]);
});

test("daily averages use first-close EMA seeds and complete SMA windows", () => {
  const day = 86400;
  const rows = Array.from({ length:210 }, (_, i) => ({ timestamp:1_700_000_000+i*day, close:100 }));
  const out = cloud.computeDaily(rows);
  assert.equal(out.length, 210);
  for (const key of ["e8","e13","e21","s50","s100","s200"])
    assert.equal(out.at(-1)[key], 100, key+" remains exact on a constant series");
  assert.equal(out[48].s50, null);
  assert.equal(out[49].s50, 100);
  assert.equal(out[198].s200, null);
  assert.equal(out[199].s200, 100);
});

test("daily values lock to supplied sessions and labels keep exact price height", () => {
  const rows = [1,2,3].map((n) => ({ time:n*1000, close:n, e13:n, e21:n, s50:n, s200:n, f:true, m:true, o:true }));
  const anchors = cloud.curveAnchors(rows, 4000);
  assert.deepEqual(Array.from(anchors, (r) => [r.sourceTime,r.time]), [[1000,2000],[2000,3000],[3000,4000]]);
  const labels = cloud.endpointLabels([
    { label:"13D", y:50 }, { label:"21D", y:53 }, { label:"200D", y:120 }
  ], { width:500, height:200, endpointX:100, labelWidth:108, gap:29, font:10 });
  assert.equal(labels[0].y, 50);
  assert.equal(labels[1].y, 53, "nearby label does not receive an invented vertical price");
  assert.ok(labels[1].x > labels[0].x, "nearby labels separate horizontally");
});

test("existing Station chart and active shell share one overlay implementation", () => {
  assert.equal(chart, shell, "the active chart-v1 shell is byte-identical to the standalone chart");
  assert.match(chart, /src="\/_indicators\/cloud-overlay\.js"/);
  assert.match(chart, /fetchProviderCandles\(key,"D",400,2\)/,
    "daily calculations use completed provider daily candles with enough SMA200 warmup");
  assert.match(chart, /lineWidth = cloudMetrics\.priceWidth/,
    "price retains a dynamically thicker visual hierarchy");
  assert.match(chart, /class="sc-cloud-labels"/);
  assert.match(chart, /endpointLabels\(items/);
  assert.match(chart, /Y\(latest\[spec\.key\]\)/, "labels stay at exact line height");
});

test("Station deck exposes and remembers only the optional dashed 100D level", () => {
  assert.match(deck, /id="sma100Toggle"/);
  assert.match(deck, /remember\("station\.clouds\.sma100",SHOW_SMA100\?"1":"0"\)/);
  assert.match(deck, /postMessage\(\{sc:"chart",sma100:SHOW_SMA100\}/);
  assert.match(deck, /SHOW_SMA100 \? "&sma100=1" : ""/);
});

test("modified inline scripts remain syntactically valid", () => {
  for (const [name,source] of [["chart",chart],["shell",shell],["deck",deck]]) {
    const blocks=Array.from(source.matchAll(/<script>([\s\S]*?)<\/script>/g), (m) => m[1]);
    assert.ok(blocks.length, name+" has inline scripts");
    blocks.forEach((code,index) => assert.doesNotThrow(() => new vm.Script(code,{filename:name+"-inline-"+index+".js"})));
  }
});
