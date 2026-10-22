/* X5 (22 Oct 2026). Alan, 22 Oct: "let's make the X scrolling faster. Please."
   8× (24 px/s) joins the pace row behind the ⋯, and the first pace a source reports in a browser after this build is
   moved up to 8× once if it is slower. The bridge already accepts up to 30 px/s, so nothing changes on either Mac. */
import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const read = (p) => fs.readFileSync(new URL("../" + p, import.meta.url), "utf8");
const pane = read("station-shells/x-v2/index.html");
const bridge = read("station-x-bridge-draft/content.js");

function fnSource(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} must exist`);
  let depth = 0;
  for (let i = source.indexOf("{", source.indexOf(")", start)); i < source.length; i++) {
    if (source[i] === "{") depth++;
    if (source[i] === "}") depth--;
    if (depth === 0) return source.slice(start, i + 1);
  }
  throw new Error(name + " did not close");
}
const constLine = (source, name) => {
  const m = source.match(new RegExp("^(?:const|let) " + name + "\\b[^\\n]*$", "m"));
  assert.ok(m, name + " must exist"); return m[0];
};

function world({ remote = false, stored = null, blocked = false } = {}) {
  const posted = [], store = new Map(stored ? [["station.x.pace.8x", stored]] : []);
  const localStorage = {
    getItem: (k) => { if (blocked) throw new Error("blocked"); return store.has(k) ? store.get(k) : null; },
    setItem: (k, v) => { if (blocked) throw new Error("blocked"); store.set(k, String(v)); }
  };
  const ctx = vm.createContext({ Number, localStorage, REMOTE_MODE: remote, postXFloat: (a, v) => posted.push([a, v]) });
  vm.runInContext([constLine(pane, "X_FASTER_PACE"), constLine(pane, "xFasterAsked"), fnSource(pane, "nudgeXFaster"),
    "globalThis.nudge = nudgeXFaster;"].join("\n"), ctx);
  return { ctx, posted, store };
}

test("X5 · 8× (24 px/s) is a fourth choice on the pace row, hidden until a source reports its pace", () => {
  assert.match(pane, /<button class="btn xs xs-row" type="button" data-v="24" title="eight times the calm pace: 24 pixels a second" hidden>8×<\/button>/);
  const ctx = vm.createContext({ Number });
  vm.runInContext(constLine(pane, "X_SPEED_CHOICES") + "\n" + fnSource(pane, "xSpeedChoice"), ctx);
  assert.deepEqual([3, 6, 12, 24, "24", 30, 48].map((v) => ctx.xSpeedChoice(v)), [3, 6, 12, 24, 24, null, null]);
});

test("X5 · the first reported pace below 8× is moved up once; after that his pick stands", () => {
  const w = world();
  w.ctx.nudge(12);
  assert.deepEqual(w.posted, [["speed", 24]], "4× today becomes 8×");
  assert.equal(w.store.get("station.x.pace.8x"), "1");
  w.ctx.nudge(6);
  assert.deepEqual(w.posted, [["speed", 24]], "a later pick (2×) is never overridden in this page");
  const again = world({ stored: "1" });
  again.ctx.nudge(3);
  assert.deepEqual(again.posted, [], "a browser that was already moved once keeps what he chose");
  const fast = world();
  fast.ctx.nudge(24);
  assert.deepEqual(fast.posted, [], "already at 8×: nothing to ask");
  assert.equal(fast.store.get("station.x.pace.8x"), "1");
});

test("X5 · no pace yet, the iPad mirror and a blocked store", () => {
  const w = world();
  w.ctx.nudge(undefined); w.ctx.nudge(0);
  assert.deepEqual(w.posted, [], "a crop without a pace (an older bridge) asks nothing and does not use up the move");
  w.ctx.nudge(12);
  assert.deepEqual(w.posted, [["speed", 24]]);
  const ipad = world({ remote: true });
  ipad.ctx.nudge(12);
  assert.deepEqual(ipad.posted, [], "the iPad mirror never asks");
  const blocked = world({ blocked: true });
  blocked.ctx.nudge(12); blocked.ctx.nudge(12);
  assert.deepEqual(blocked.posted, [["speed", 24]], "without storage it still asks only once per page");
});

test("X5 · wired after the pace is painted, and the bridge already takes 24 px/s", () => {
  assert.match(pane, /paintXSpeed\(xfloatCrop\?\.speedPxPerSecond\);\n\s+nudgeXFaster\(xfloatCrop\?\.speedPxPerSecond\);/);
  assert.match(bridge, /saveSettings\(\{ speedPxPerSecond: Math\.max\(0\.5, Math\.min\(30, speed\)\) \}\);/,
    "the bridge's cap is 30 px/s, so 8× needs no bridge release");
});
