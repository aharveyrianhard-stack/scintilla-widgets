/* X4 (15 Oct 2026) - the X column: −30s on the bar where the "60s" label sat. Alan, ~06:50 ET: "I have to click three
   dots to go back 30 seconds. And then this 60 seconds thing is not even a button. That's a toggle. Let's put the 30
   seconds, minus 30 seconds there, no?"
   1. The place: −30s is a real button on the bar, right after ↻ and before ⋯ - where "60s" sat - with the bar icons'
      classes (their box and frame), the label "−30s" and the tooltip "back 30 seconds"; a <button>, so Tab reaches it
      and Enter or Space press it.
   2. One place only: it left the ⋯ panel; the "60s" label is gone from the bar and nothing writes to it any more; the
      cadence choices behind ⋯ are exactly as they were.
   3. The wiring: a press asks the bridge for "rewind" - on the Mac by the page's message to the bridge, on the iPad
      through the pair, as before. Measured with the real bridge 0.7.27: deliverables/20261015/x4/. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
const read = (p) => fs.readFileSync(new URL("../" + p, import.meta.url), "utf8");
const pane = read("station-shells/x-v2/index.html");
const bar = pane.slice(pane.indexOf('<div id="bar">'), pane.indexOf('<div id="body">'));
const panel = pane.slice(pane.indexOf('<div id="xMore"'), pane.indexOf('<div id="card">'));
const lift = (src, name) => { const m = src.match(new RegExp("\\n( *)(?:async )?function " + name + "\\(.*\\) \\{[\\s\\S]*?\\n\\1\\}")); assert.ok(m, "found " + name); return m[0]; };

test("X4 · −30s is a button on the X bar where the 60s label sat, and nowhere else; a press asks the bridge to rewind", () => {
  /* the place */
  const back = bar.match(/<button class="btn icon" id="bXBack" type="button" style="display:none" title="back 30 seconds" aria-label="Back 30 seconds">−30s<\/button>/);
  assert.ok(back, "a real button with the bar icons' classes, its label and its tooltip");
  const at = (id) => bar.indexOf('id="' + id + '"');
  assert.ok(at("bXRefresh") > 0 && at("bXRefresh") < at("bXBack") && at("bXBack") < at("bXMore"), "↻ · −30s · ⋯");
  assert.equal(bar.slice(bar.indexOf("</button>", at("bXRefresh")) + "</button>".length, bar.lastIndexOf("<", at("bXBack"))).trim(), "", "nothing between ↻ and −30s");
  assert.doesNotMatch(back[0], /tabindex|disabled|x-sec/, "Tab reaches it, and it shows without the ⋯ panel");
  assert.match(pane, /\n#bXBack\{ padding-left:0; padding-right:0; font-size:8px; letter-spacing:0; text-transform:none; white-space:nowrap; \}\n/, "the label fits the icon box and reads −30s, not −30S");
  assert.match(pane, /for \(const id of \["bXList", "bXNotify", "bXBack", "bXRefresh", "bXMore"\]\)\n    el\(id\)\.style\.display = on \? "" : "none";/, "it shows with the live controls, as before");
  assert.match(pane, /\n@media \(max-width: 300px\)\{ #bar\{ gap:3px; padding-left:3px; \} \}\n/, "on a pane as narrow as the iMac's the bar gives back the room −30s takes, so ⋯ stays clear");

  /* one place only; the 60s label gone; the cadence choices behind ⋯ untouched */
  assert.equal(pane.match(/id="bXBack"/g).length, 1, "one −30s");
  assert.doesNotMatch(panel, /bXBack|−30s/, "it left the ⋯ panel");
  assert.doesNotMatch(pane, /xfEvery/, "the 60s label is gone, and nothing writes to it any more");
  const cadence = '<span class="lab" title="how often the feed refreshes by itself — a page up: the newest posts to the top">a page up every</span>\n' +
    [30, 60, 90].map((s) => '    <button class="btn xr" type="button" data-s="' + s + '" title="refresh every ' + s + ' seconds">' + s + "s</button>").join("\n");
  assert.ok(panel.includes(cadence), "the cadence choices behind ⋯ are as they were");

  /* the wiring: run the pane's own press handler and postXFloat on a stand-in page */
  const wiring = pane.match(/\nel\("bXBack"\)\.addEventListener\("click", \(\) => postXFloat\("rewind"\)\);\n/);
  assert.ok(wiring, "a press asks for the rewind");
  const press = (globals) => {
    const listeners = {};
    const ctx = vm.createContext({ ...globals, el: (id) => ({ addEventListener: (type, fn) => { listeners[id + ":" + type] = fn; } }) });
    vm.runInContext(lift(pane, "postXFloat") + wiring[0], ctx);
    listeners["bXBack:click"]();
  };
  const posted = [];
  press({ REMOTE_MODE: false, window: { postMessage: (message, origin) => posted.push([message, origin]) }, location: { origin: "https://station.test" } });
  assert.deepEqual(JSON.parse(JSON.stringify(posted)), [[{ type: "XFF_STATION_CONTROL", action: "rewind" }, "https://station.test"]], "on the Mac: one message to the bridge");
  const sent = [];
  press({ REMOTE_MODE: true, REMOTE_PAIR: "pair", REMOTE_CODE: "123456", WebSocket: { OPEN: 1 }, remoteSocket: { readyState: 1, send: (s) => sent.push(JSON.parse(s)) }, Date, JSON });
  assert.equal(sent.length, 1, "on the iPad: one message through the pair");
  assert.deepEqual(sent[0].payload.payload, { code: "123456", action: "rewind" }, "asking the Mac's source for the rewind");
});
