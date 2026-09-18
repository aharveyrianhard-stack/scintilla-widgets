import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const page = fs.readFileSync(new URL("../geiger/index.html", import.meta.url), "utf8");

// Stroke-inclusive extents of an SVG large-arc "M x1,y1 A r,r,0,1,1,x2,y2" drawn over the top (round caps).
function arcExtents(d, strokeWidth) {
  const m = d.match(/M([\d.]+),([\d.]+) A([\d.]+),[\d.]+,0,1,1,([\d.]+),([\d.]+)/);
  const [x1, y1, r, x2] = [m[1], m[2], m[3], m[4]].map(Number);
  const cx = (x1 + x2) / 2, cy = y1 - Math.sqrt(r * r - ((x2 - x1) / 2) ** 2), h = strokeWidth / 2;
  return { top: cy - r - h, bottom: y1 + h, left: cx - r - h, right: cx + r + h };
}

test("/geiger composite rings sit wholly inside the meter viewBox (no clipped ends)", () => {
  const svg = page.match(/<svg width="100%" height="100%" viewBox="([\d. ]+)" preserveAspectRatio="xMidYMid meet" fill="none" style="max-height:150px">([\s\S]*?)<\/svg>/);
  assert.ok(svg, "meter svg present");
  const [vx, vy, vw, vh] = svg[1].split(" ").map(Number);
  assert.deepEqual([vw, vh], [340, 240], "same window size, so the rings render at the same scale as before");
  const paths = [...svg[2].matchAll(/d="(M[^"]+)"[^>]*stroke-width="(\d+)"/g)];
  assert.equal(paths.length, 6, "three tracks + three fills");
  for (const [, d, sw] of paths) {
    const e = arcExtents(d, +sw);
    assert.ok(e.top >= vy && e.bottom <= vy + vh && e.left >= vx && e.right <= vx + vw,
      `ring ${d.slice(0, 22)} extents ${JSON.stringify(e)} exceed viewBox ${svg[1]}`);
  }
});

// Execute the real renderer with a minimal DOM.
function loadMacd() {
  const a = page.indexOf("const GS_MACD_BAR_MAX_PX"), b = page.indexOf("gsTrendMotion(node, svg);\n}", a);
  assert.ok(a > 0 && b > a, "renderer source located");
  const src = page.slice(a, b) + "}\nreturn { gsMacdScale, gsMacdHist, GS_MACD_BAR_MAX_PX };";
  const el = (tag) => ({ tag, attrs: {}, children: [], setAttribute(k, v) { this.attrs[k] = v; }, appendChild(c) { this.children.push(c); } });
  const document = { createElementNS: (_ns, tag) => el(tag) };
  const num = (x) => (x == null ? null : Number(x));
  return new Function("document", "GS_NS", "num", "gsTrendMotion", src)(document, "http://www.w3.org/2000/svg", num, () => {});
}
const panel = () => ({ clientWidth: 446, clientHeight: 406, innerHTML: "", kids: [], appendChild(c) { this.kids.push(c); } });
const bars = (node) => node.kids[0].children.filter((c) => c.tag === "rect").map((r) => r.attrs);

test("/geiger MACD: a single provider snapshot draws a bar-width bar scaled against its own MACD line", () => {
  const { gsMacdScale, gsMacdHist, GS_MACD_BAR_MAX_PX } = loadMacd();
  const snap = { state: "AVAILABLE", value: 0.11720701586884275, signal: 0.10006149698333963, histogram: 0.017145518885503114 };
  const node = panel();
  gsMacdHist(node, [snap.histogram], gsMacdScale(snap));
  const [r] = bars(node);
  const half = 406 / 2 - 3;
  assert.ok(+r.width <= GS_MACD_BAR_MAX_PX, "not a panel-wide block");
  assert.ok(Math.abs(+r.height - snap.histogram / snap.value * half) < 1e-9, "height = hist / max(|MACD|,|signal|) of the half-height");
  assert.ok(+r.height < 0.2 * half, "0.0171 against 0.1172 is a small bar, not a full one");
  assert.equal(r.fill, "#00FFA3");
  const neg = panel();
  gsMacdHist(neg, [-0.05], gsMacdScale({ state: "AVAILABLE", value: -0.2, signal: -0.15, histogram: -0.05 }));
  const [rn] = bars(neg);
  assert.equal(rn.fill, "#FF3060"); assert.equal(+rn.y, 406 / 2, "negative bar hangs below the zero line");
  assert.ok(Math.abs(+rn.height - 0.25 * half) < 1e-9);
});

test("/geiger MACD: a real series still scales against its own largest bar exactly as before", () => {
  const { gsMacdHist } = loadMacd();
  const series = Array.from({ length: 40 }, (_, i) => Math.sin(i / 5) * (i + 1) / 40);
  const node = panel();
  gsMacdHist(node, series);
  const rs = bars(node);
  assert.equal(rs.length, 40);
  assert.ok(Math.abs(+rs[0].width - 446 / 40 * 0.7) < 1e-9, "series bar width unchanged (below the single-bar cap)");
  const tallest = Math.max(...rs.map((r) => +r.height));
  assert.ok(Math.abs(tallest - (406 / 2 - 3)) < 1e-9, "largest series bar still spans the half-height");
});

test("/geiger MACD: unavailable snapshot has no scale and an empty lane still says no data", () => {
  const { gsMacdScale, gsMacdHist } = loadMacd();
  assert.equal(gsMacdScale(null), null);
  assert.equal(gsMacdScale({ state: "UNAVAILABLE", value: 1 }), null);
  const node = panel();
  gsMacdHist(node, [], null);
  assert.match(node.innerHTML, /no data/);
  assert.match(page, /gsMacdHist\(q\("macd"\), d\.macd, gsMacdScale\(d\.massiveMacd\)\)/, "the page passes the snapshot scale");
});
