import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const read = (p) => fs.readFileSync(new URL("../" + p, import.meta.url), "utf8");
const xv2 = read("station-shells/x-v2/index.html");
const panex = read("pane-x/index.html");
const chart = read("chart/index.html");
const deck = read("deck/index.html");

/* ---- the link that heals itself: the plan is pure, so the frames can be killed here ---- */
function planOf(src) {
  const code = src.match(/const STATION_STALL_MS[\s\S]*?\nfunction stationLinkPlan\(now, s\) \{[\s\S]*?\n\}\n/)[0]
    .replace(/^let .*$/gm, "");
  return new Function(code + "return stationLinkPlan;")();
}
for (const [name, src] of [["x-v2", xv2], ["pane-x", panex]]) {
  const plan = planOf(src);
  const T = 1_000_000;
  /* M29 changed this deliberately for the shell the Station actually mounts: a
     pane with no stream was exactly the state that sat black until Alan pressed
     reload, so x-v2 now asks for one. /pane-x is the older standalone shell and
     keeps the M25 contract. */
  test(name + (name === "x-v2" ? ": a pane with no stream asks for one (M29)" : ": a pane with no stream is not healed"), () => {
    if (name === "x-v2") {
      const asking = plan(T, { attached: false, bootAt: T - 10000, readyAt: T - 9000, tries: 0 });
      assert.equal(asking.relink, true, "it asks instead of waiting for a person");
      assert.match(asking.state, /asking the X source/);
      assert.equal(plan(T, { attached: false, bootAt: T - 1000, tries: 0 }).stalled, false, "but not in the first seconds");
      return;
    }
    assert.deepEqual(plan(T, { attached: false, lastFrameAt: 0 }), { state: "", relink: false, stalled: false });
  });
  test(name + ": frames still arriving means nothing happens", () => {
    const r = plan(T, { attached: true, lastFrameAt: T - 2000, lastCropAt: T - 4000, attachedAt: T - 60000 });
    assert.equal(r.stalled, false); assert.equal(r.relink, false); assert.equal(r.state, "");
  });
  test(name + ": a crop alone keeps the link alive - either signal counts", () => {
    assert.equal(plan(T, { attached: true, lastFrameAt: T - 30000, lastCropAt: T - 1000, attachedAt: T - 60000 }).stalled, false);
  });
  test(name + ": attached with no frame and no crop for six seconds relinks, and says so", () => {
    const r = plan(T, { attached: true, lastFrameAt: T - 7000, lastCropAt: T - 9000, attachedAt: T - 60000 });
    assert.equal(r.stalled, true); assert.equal(r.relink, true);
    assert.match(r.state, /relinking · 7s without a frame/);
  });
  test(name + ": a pane that just attached is given its six seconds before anything is called broken", () => {
    assert.equal(plan(T, { attached: true, lastFrameAt: 0, lastCropAt: 0, attachedAt: T - 1000 }).stalled, false);
    assert.equal(plan(T, { attached: true, lastFrameAt: 0, lastCropAt: 0, attachedAt: T - 8000 }).relink, true);
  });
  test(name + ": the bridge is never hammered - one relink, then a cooldown", () => {
    const s = { attached: true, lastFrameAt: T - 9000, lastCropAt: 0, attachedAt: T - 60000, lastRelinkAt: T - 3000, tries: 1 };
    const r = plan(T, s);
    assert.equal(r.relink, false, "still inside the cooldown");
    assert.equal(r.stalled, true, "but the pane still says what is wrong");
    assert.equal(plan(T, { ...s, lastRelinkAt: T - 13000 }).relink, true, "and tries again once the cooldown passes");
  });
  test(name + ": after three failed relinks it says what is wrong instead of looping quietly", () => {
    const r = plan(T, { attached: true, lastFrameAt: T - 40000, lastCropAt: 0, attachedAt: T - 60000, lastRelinkAt: T - 30000, tries: 3 });
    assert.equal(r.relink, false);
    assert.match(r.state, /no picture for 40s · the X window may be closed/);
  });
}

/* ---- the hold under the pointer ---- */
test("the pane renews its hover pause well inside the bridge's 500 ms lease", () => {
  for (const [name, src] of [["x-v2", xv2], ["pane-x", panex]]) {
    const ms = Number(src.match(/const STATION_HOVER_RENEW_MS = (\d+)/)[1]);
    assert.ok(ms > 0 && ms <= 250, name + ": " + ms + "ms must be comfortably inside the 500 ms lease");
    assert.match(src, /setInterval\(\(\) => \{[\s\S]*?postXFloat\("pause", true\)/, name + " renews the hold");
  }
});
test("x-v2 takes the hold on enter and on movement, and releases it on leave, blur and hide", () => {
  assert.match(xv2, /pointerenter", \(\) => \{ if \(xfloatStream\) setStationHoverPause\(true\)/);
  assert.match(xv2, /pointermove", \(\) => \{ if \(xfloatStream && !stationHoverInside\) setStationHoverPause\(true\)/);
  assert.match(xv2, /pointerleave", \(\) => \{ if \(xfloatStream && !xfloatPaused\) setStationHoverPause\(false\)/);
  assert.match(xv2, /window\.addEventListener\("blur", \(\) => setStationHoverPause\(false\)\)/);
  assert.match(xv2, /visibilitychange[\s\S]{0,120}setStationHoverPause\(false\)/);
});
test("the pane asks the bridge for a fresh capture with the message the bridge already handles", () => {
  for (const [name, src] of [["x-v2", xv2], ["pane-x", panex]])
    assert.match(src, /XFF_STATION_RECONNECT_VIEWER/, name);
});
test("the state line can actually be seen, and the button says what it does", () => {
  for (const [name, src] of [["x-v2", xv2], ["pane-x", panex]]) {
    assert.match(src, /#xfState\{[^}]*font-size:10px/, name + " styles its state line");
    assert.match(src, /node\.hidden = !text/, name + " shows the line only when it has something to say");
    assert.doesNotMatch(src, />pair iPad</, name + ' no longer says "pair iPad"');
    assert.match(src, />iPad link</, name + " says iPad link");
  }
});

/* ---- no shading under the line, clouds untouched ---- */
test("the line charts draw no direction-coloured fill under the price", () => {
  for (const p of ["chart/index.html", "station-shells/chart-v1/index.html"]) {
    const src = read(p);
    assert.doesNotMatch(src, /addColorStop\(0, c \+ "3D"\)/, p + " still shades under the line");
    assert.doesNotMatch(src, /ctx\.fillStyle = g; ctx\.fill\(\);/, p + " still fills a gradient under the trace");
    assert.match(src, /drawCloudRibbon\(ctx/, p + ": the clouds are Alan's and stay");
    assert.match(src, /ctx\.strokeStyle = c; ctx\.lineWidth = 2;/, p + ": the line keeps its direction colour");
  }
  assert.equal(read("chart/index.html"), read("station-shells/chart-v1/index.html"), "the two copies stay identical");
});

/* ---- every pane is served ---- */
test("the two symbols the chart API does not carry are routed to a TradingView series that draws", () => {
  for (const t of ["ESUSD", "NQUSD"]) {
    const entry = chart.match(new RegExp(t + ':\\s*Object\\.freeze\\(\\{([^}]*)\\}\\)'))[1];
    assert.match(entry, /embeds:true/, t + " must mount the TradingView pane");
    assert.match(entry, /near:true/, t + " is the nearest series, not the contract, and must say so");
    assert.doesNotMatch(entry, /CME_MINI/, t + ": TradingView refuses CME futures inside an embed - measured 23 Sep");
  }
});

/* ---- a way back ---- */
test("the four pages Alan opens by hand carry the grey BACK / CLOSE pair, and it returns to the Station", () => {
  for (const page of ["registry", "health", "handoff", "youtube"]) {
    const src = read(page + "/index.html");
    assert.match(src, /className = "scnav"/, page + " has no way back");
    assert.match(src, />BACK</, page + " has no BACK");
    assert.match(src, />CLOSE</, page + " has no CLOSE");
    assert.match(src, /location\.href = "\/deck\/"/, page + ": CLOSE must return to the Station deck");
  }
});
test("wall screens stay clean", () => {
  for (const page of ["wall", "tvwall", "geigerwall"])
    assert.doesNotMatch(read(page + "/index.html"), /className = "scnav"/, page + " is a wall screen and carries no chrome");
});

/* ---- the dock uses the room it has ---- */
test("the strip spreads across the dock and its readout is a row item, not a floating one", () => {
  assert.match(deck, /#dock\{[^}]*justify-content:space-between/);
  const readout = deck.match(/#dock \.dsec\[data-sec="readout"\]\{[^}]*\}/)[0];
  assert.doesNotMatch(readout, /position:absolute/, "a floating readout made the fit reserve twice its width");
  assert.match(readout, /pointer-events:none/, "it is still a fact, not a control");
  assert.doesNotMatch(deck, /const room = readout \? \(readout\.offsetWidth \+ 24\) \* 2 : 0;/, "the doubled reservation is gone");
});
