/* S5, 1 Oct: the crosshair stays, in proportion, on every chart at once; charts only; picture-in-picture.
   Alan's words are in each section. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const read = (p) => fs.readFileSync(new URL(p, import.meta.url), "utf8");
const chart = read("../chart/index.html");
const shell = read("../station-shells/chart-v1/index.html");
const deck = read("../deck/index.html");
const pane = read("../station-shells/personal-video-v1/index.html");
const pane2 = read("../station-shells/scintilla-video-v1/index.html");
const pip = read("../station-shells/pip-v1/index.html");
const liftFrom = (src, name) => {
  const start = src.search(new RegExp("(async )?function " + name + "\\("));
  assert.notEqual(start, -1, `declares ${name}`);
  let depth = 0, i = src.indexOf("{", start);
  for (; i < src.length; i++) { if (src[i] === "{") depth++; else if (src[i] === "}") { depth--; if (depth === 0) break; } }
  return src.slice(start, i + 1);
};
const body = (src, name) => liftFrom(src, name);
const fnFrom = (src, name, ctx = {}) => vm.runInNewContext("(" + liftFrom(src, name) + ")", ctx);
/* the arrow-function handlers inside scChartScrub */
const scrub = liftFrom(chart, "scChartScrub");
const arrow = (name) => {
  const i = scrub.indexOf(`const ${name} = `);
  assert.notEqual(i, -1, `scChartScrub declares ${name}`);
  return scrub.slice(i, scrub.indexOf("\n  };", i) + 5);
};

test("the chart shell the deck mounts is the chart, byte for byte; the two video shells match", () => {
  assert.equal(shell, chart);
  assert.equal(pane2, pane);
});

/* ---- 1. "it goes away very quickly when I stop moving my mouse" ---- */
test("1: the pointer's spot is kept on the pane, and every base paint repaints the crosshair from it", () => {
  assert.match(arrow("show"), /host\._hoverLocal = \{ x:clientX - r\.left, y:clientY - r\.top \};/);
  const draw = body(chart, "scChartDraw");
  /* a quote tick calls scChartDraw(host) with no crosshair argument: it must end by repainting the overlay */
  assert.match(draw, /host\._ov = \{[\s\S]*?\};\n  scChartOverlay\(host\);\n\}$/);
  assert.doesNotMatch(draw, /ctx\.moveTo\(sx, padT\)/, "the base paint no longer draws (and so no longer erases) the crosshair");
});

test("1: it leaves when the pointer leaves the chart AREA, not the canvas; a click keeps it", () => {
  assert.match(scrub, /area\.addEventListener\("pointerleave", \(e\) => \{\n\s+if \(e\.pointerType === "mouse" && !pointers\.has\(e\.pointerId\)\) hideScrub\(\);/);
  assert.doesNotMatch(scrub, /cv\.addEventListener\("pointerleave"/, "the badge and the Geiger chip sit on the canvas: crossing them is not leaving");
  assert.match(scrub, /area\.addEventListener\("pointermove", \(e\) => \{\n\s+if \(e\.target !== cv && e\.pointerType === "mouse" && !pointers\.size\) show\(e\.clientX, e\.clientY\);/);
  assert.match(arrow("release"), /const tap = e\.type === "pointerup" && pointers\.size === 1 && gesture && gesture\.type === "pending";/);
  assert.match(arrow("release"), /if \(tap\) \{ if \(e\.pointerType === "mouse"\) show\(e\.clientX, e\.clientY\); else touchHover\(e\.clientX, e\.clientY\); \}\n\s+else hideScrub\(\);/);
});

test("1: touch - four seconds after the last touch", () => {
  assert.match(chart, /const CHART_TOUCH_HOVER_MS = 4000;/);
  const t = arrow("touchHover");
  assert.match(t, /if \(host\._touchHoverTimer\) clearTimeout\(host\._touchHoverTimer\);/, "a new touch restarts the four seconds");
  assert.match(t, /setTimeout\(\(\) => \{ host\._touchHoverTimer = null; if \(!pointers\.size\) hideScrub\(\); \}, CHART_TOUCH_HOVER_MS\)/);
});

/* ---- 2. "you made the percent bigger but it's too big, bro, crazy big… think UI UX proportions" ---- */
const readout = fnFrom(chart, "crosshairReadout");
const measure = (text, font) => text.length * 0.6 * parseFloat(font.split(" ")[1]);
const at = (h, scale = 1) => readout(measure, { w: 419, h, plotTop: 34, plotBottom: h - 21, priceText: "492.49", pctText: "−3.60%", up: false, scale });

test("2: the percent is about a quarter larger than the price - 13 px on the 8-up, scaling with the pane", () => {
  const eight = at(277);
  assert.equal(eight.pctFont, 13, "8-up at 1680 (277 px tall): 13 px, was 18");
  assert.equal(eight.priceFont, 11, "the price keeps the wall's 11 px floor");
  for (const h of [200, 277, 360, 473, 554, 900]) {
    const L = at(h);
    assert.ok(L.pctFont >= 12.5 && L.pctFont <= 16, `${h}: ${L.pctFont}`);
    assert.ok(L.priceFont >= 11, `${h}: price ${L.priceFont}`);
    const ratio = L.pctFont / L.priceFont;
    assert.ok(ratio >= 1.13 && ratio <= 1.26, `${h}: % / price = ${ratio.toFixed(2)} (about a quarter)`);
  }
  assert.ok(at(554).pctFont > at(277).pctFont, "a bigger pane, a bigger readout");
  assert.equal(at(277, 1.5).pctFont, 19.5, "the iPad scale multiplies it like every other pane text");
});

test("2: same fixed corner, the percent on top and the price under it", () => {
  const a = at(277), b = readout(measure, { w: 419, h: 277, plotTop: 34, plotBottom: 256, priceText: "7,012.25", pctText: "+0.28%", up: true, scale: 1 });
  assert.deepEqual(a.box, b.box);
  assert.equal(a.box.x + a.box.w, 418);
  assert.ok(a.lines[0].y < a.lines[1].y);
});

/* ---- 3. "make that grid work on all of the charts… I see the percentage price change to all of the charts" ---- */
const atOrBefore = fnFrom(chart, "chartBarAtOrBefore", { Date });
const pts = ["2026-09-28T13:30:00Z", "2026-09-28T16:30:00Z", "2026-09-29T13:30:00Z"].map((d, i) => ({ d, p: 100 + i }));

test("3: a pane with no bar at that moment uses its newest earlier bar; none earlier, none at all", () => {
  assert.equal(atOrBefore(pts, Date.parse("2026-09-28T16:30:00Z")), 1, "an exact bar");
  assert.equal(atOrBefore(pts, Date.parse("2026-09-28T19:00:00Z")), 1, "between bars: the earlier one");
  assert.equal(atOrBefore(pts, Date.parse("2026-10-01T00:00:00Z")), 2, "after the last: the last");
  assert.equal(atOrBefore(pts, Date.parse("2026-09-27T00:00:00Z")), -1, "before the first: nothing");
});

test("3: a date from another pane picks this pane's bar; on a daily chart a day matches its own day", () => {
  const S = { chartRange: "3h" };
  const idx = fnFrom(chart, "chartHoverIndex", { Date, Math, Number, S, chartBarAtOrBefore: atOrBefore });
  const host = { _series: pts, _plot: { padL: 6, iw: 300, start: 0, end: 2, rightBars: 0 }, _hoverLocal: null, _hoverAt: Date.parse("2026-09-28T19:00:00Z") };
  assert.deepEqual(JSON.parse(JSON.stringify(idx(host))), { ix: 1, local: false });
  host._hoverAt = null; assert.equal(idx(host), null, "no date: no crosshair");
  host._hoverLocal = { x: 306, y: 50 }; assert.deepEqual(JSON.parse(JSON.stringify(idx(host))), { ix: 2, local: true }, "the pointer here wins");
  /* a stock's daily bar is stamped at New York midnight (04:00Z), a crypto's at UTC midnight */
  const daily = [{ d: "2026-09-28T04:00:00Z", p: 1 }, { d: "2026-09-29T04:00:00Z", p: 2 }];
  const dhost = { _series: daily, _plot: {}, _range: "1D", _hoverLocal: null, _hoverAt: Date.parse("2026-09-29T00:00:00Z") };
  assert.equal(idx(dhost).ix, 1, "29 Sep from a UTC-midnight pane is 29 Sep here, not the 28th");
});

test("3: the corner reads this pane's price ON THAT DATE and the percent from then to now, green when now is higher", () => {
  const ov = body(chart, "scChartOverlay");
  assert.match(ov, /const then = bar\.p;\n\s+const sincePct = nowPx > 0 && then > 0 \? \(nowPx \/ then - 1\) \* 100 : null;/);
  assert.match(ov, /priceText: chPx\(then, t\), pctText: chartPctText\(sincePct\), up: sincePct >= 0/);
  assert.match(ov, /const nowPx = g\.livePriceValue != null \? g\.livePriceValue : g\.dayPx;/, "now = the badge's own price");
  /* the horizontal line and its level tag only on the pane under the pointer */
  assert.match(ov, /if \(hover\.local\) \{\n\s+sy = /);
  assert.match(ov, /if \(sy != null\) \{\n\s+const price = yLo \+ \(1 - \(sy - padT\) \/ ih\) \* \(yHi - yLo\);/);
});

test("3: only the overlay redraws - the pointer path never calls the base paint", () => {
  for (const name of ["show", "hideScrub", "touchHover"]) assert.doesNotMatch(arrow(name), /scChartDraw/, name);
  assert.doesNotMatch(body(chart, "scChartOverlay"), /scChartDraw|drawCloudRibbon|lensPaint\(/);
  assert.doesNotMatch(body(chart, "shareChartHover"), /scChartDraw/);
  assert.match(chart, /<canvas class="sc-nchart__cv"><\/canvas><canvas class="sc-nchart__ov" aria-hidden="true"><\/canvas>/);
  assert.match(chart, /\.sc-nchart__ov\{ position:absolute; inset:0; width:100%; height:100%; display:block; pointer-events:none; \}/);
});

test("3: one date per bar to the deck; the deck hands it to every OTHER chart pane; a stale 'left' cannot wipe the next pane", () => {
  const share = body(chart, "shareChartHover");
  assert.match(share, /if \(host\._hoverSent === at\) return;/, "once per bar, not once per pixel");
  assert.match(share, /for \(const other of CHART_HOSTS\) if \(other !== host && other\.isConnected\) \{ other\._hoverAt = at; scChartOverlay\(other\); \}/, "panes sharing a frame too");
  assert.match(share, /parent\.postMessage\(\{ sc:"chart-hover", at \}, location\.origin\)/);
  assert.match(chart, /event\.data\?\.type === "SCINTILLA_CHART_HOVER"[\s\S]{0,260}host\._hoverAt = Number\.isFinite\(at\) \? at : null; scChartOverlay\(host\);/);
  /* the deck's relay, run */
  const i = deck.indexOf('  if (event.data?.sc === "chart-hover") {');
  const relay = deck.slice(i, deck.indexOf("\n  }\n", i) + 4);
  const posts = [];
  const frame = (name) => ({ contentWindow: { name, postMessage: (m) => posts.push([name, m.at]) } });
  const PANES = [{ def: { kind: "chart" }, frame: frame("A") }, { def: { kind: "chart" }, frame: frame("B") },
    { def: { kind: "chart" }, frame: frame("C") }, { def: { kind: "video" }, frame: frame("V") }];
  const ctx = { PANES, CHART_HOVER_OWNER: null, location: { origin: "o" }, Number, posts };
  const run = vm.runInNewContext("(function (event) {" + relay + "})", ctx);
  run({ data: { sc: "chart-hover", at: 5 }, source: PANES[1].frame.contentWindow });   /* B hovered */
  assert.deepEqual(posts.splice(0), [["A", 5], ["C", 5]], "every other chart pane, never the video");
  run({ data: { sc: "chart-hover", at: 6 }, source: PANES[0].frame.contentWindow });   /* the pointer reached A first… */
  posts.splice(0);
  run({ data: { sc: "chart-hover", at: null }, source: PANES[1].frame.contentWindow }); /* …then B's 'left' arrives */
  assert.deepEqual(posts, [], "a 'left' from a pane that no longer owns the crosshair is dropped");
  run({ data: { sc: "chart-hover", at: null }, source: PANES[0].frame.contentWindow });
  assert.deepEqual(posts, [["B", null], ["C", null]], "the owner's 'left' clears the wall");
});

/* ---- 4. "a way to expand the chart area full screen so that I do not see the YouTube and the X. I've
   mentioned that several times." ---- */
test("4: the CHARTS ONLY button is in a dock section that is shown - it sat in the hidden video section", () => {
  const b = deck.indexOf('id="chartsOnlyBtn"');
  const open = deck.lastIndexOf('<span class="dsec" data-sec="', b);
  const sec = deck.slice(open, deck.indexOf(">", open)).match(/data-sec="([a-z]+)"/)[1];
  assert.equal(sec, "station", "beside HUB");
  assert.equal(deck.slice(open + 1, b).indexOf('<span class="dsec"'), -1, "inside that section");
  const css = deck.slice(0, deck.indexOf("</style>"));
  assert.doesNotMatch(css, /\.dsec\[data-sec="station"\]\{[^}]*display:\s*none/, "and that section is never hidden");
  assert.match(css, /\.dsec\[data-sec="video"\]\{ display:none !important; \}/, "(the video section still is - which is why the button moved)");
  assert.equal((deck.match(/id="chartsOnlyBtn"/g) || []).length, 1, "one button");
});

test("4: one key, one button, remembered, and the rotation is not touched", () => {
  assert.match(deck, /event\.key === "w" \|\| event\.key === "W"[\s\S]{0,80}toggleChartsOnly\(\)/);
  assert.match(deck, /localStorage\.setItem\(CHARTS_ONLY_KEY, on \? "1" : "0"\)/);
  for (const name of ["setChartsOnly", "paintChartsOnly", "toggleChartsOnly"])
    assert.doesNotMatch(body(deck, name), /ROTATE|scheduleRotation|setRotationPaused/, `${name} leaves rotation alone`);
});

/* ---- 5. "a little picture in picture player that actually goes off the station PWA" ---- */
test("5: the pane's button lifts the video at the second it is at; in the Station the deck opens the window", () => {
  assert.match(pane, /<button class="btn" id="bPipBar" type="button"/);
  assert.match(pane, /body\.playing #bPipBar\{ display:inline-flex; \}/, "on the bar while a video plays");
  const lift = body(pane, "liftVideo");
  assert.match(lift, /captureActiveVideoPosition\(\);\n\s+const start = Math\.max\(0, Math\.floor\(PLAYER_POSITION\.time \|\| 0\)\);/);
  assert.match(lift, /window\.parent\.postMessage\(\{ sc:"video-pip", video_id:id, start, title \}, location\.origin\)/);
  assert.match(pane, /el\("bPip"\)\.addEventListener\("click", liftVideo\);\nel\("bPipBar"\)\.addEventListener\("click", liftVideo\);/, "the menu item and the bar button do the same thing");
  assert.match(body(pane, "notePip"), /YT_PLAYER\.pauseVideo\(\)/, "the pane pauses so the two do not play over each other");
});

test("5: Document PiP first, a small window where the browser lacks it, and the path is said", async () => {
  const src = liftFrom(deck, "openVideoPip");
  const run = async (win) => {
    const opened = [];
    const ctx = Object.assign({ location: { origin: "https://station.scintillahub.ai" }, encodeURIComponent, String, Number, Math,
      window: Object.assign({ open: (u) => { opened.push(u); return win.openReturns; } }, win.window || {}) }, win.globals || {});
    ctx.window.open = ctx.window.open; ctx.documentPictureInPicture = ctx.window.documentPictureInPicture;
    const fn = vm.runInNewContext("(" + src + ")", ctx);
    return { path: await fn(win.msg || { video_id: "u1sbtiTQk1s", start: 24.9, title: "t" }), opened };
  };
  /* a fake Document PiP window */
  const made = [];
  const doc = { documentElement: { style: {} }, body: { style: {}, appendChild: (n) => made.push(n), set textContent(v) {} },
    createElement: () => ({ style: {} }) };
  const dpip = { window: null, requestWindow: async (o) => { dpip.size = o; return { document: doc }; } };
  const a = await run({ window: { documentPictureInPicture: dpip } });
  assert.equal(a.path, "document");
  assert.deepEqual(JSON.parse(JSON.stringify(dpip.size)), { width: 480, height: 270 });
  assert.equal(made[0].src, "https://station.scintillahub.ai/station-shells/pip-v1/?v=u1sbtiTQk1s&start=24&title=t", "the same video, the same second");
  const b = await run({ window: {}, openReturns: {} });
  assert.equal(b.path, "window");
  assert.deepEqual(Array.from(b.opened), ["https://www.youtube.com/watch?v=u1sbtiTQk1s&t=24s"]);
  assert.equal((await run({ window: {}, openReturns: null })).path, "blocked");
  assert.equal((await run({ window: {}, openReturns: {}, msg: { video_id: "x\"><script" } })).path, "blocked", "only a real video id");
  assert.match(deck, /source\.postMessage\(\{ type:"SCINTILLA_VIDEO_PIP", path \}, location\.origin\)/, "the deck tells the pane which path");
});

test("5: the floating page gives the embed a real address (Error 153), and holds nothing else", () => {
  assert.match(pip, /<meta name="referrer" content="strict-origin-when-cross-origin">/);
  assert.match(pip, /if \(!\/\^\[A-Za-z0-9_-\]\{6,20\}\$\/\.test\(id\)\)/);
  assert.match(pip, /"\?playsinline=1&rel=0&modestbranding=1&autoplay=1&start=" \+ start \+\n\s+"&origin=" \+ encodeURIComponent\(location\.origin\)/);
  assert.doesNotMatch(pip, /fetch\(|localStorage|supabase/i, "it reads nothing and writes nothing");
});
