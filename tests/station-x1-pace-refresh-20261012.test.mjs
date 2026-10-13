/* X1 · 12 OCT 2026 · the X column: a faster pace and a far rarer refresh, with the picture exactly as Alan has it.
   Alan, 12 Oct ~23:10 ET: "I don't need this slow speed anymore. A little bit faster would probably be better." ·
   "if it reloads so often, and I'm not looking at the screen … I prefer to let it run and then I get the context of
   stuff and I refresh manually, but I do think there should be some refresh. Just definitely not as tight as that."
   · and on bridge 0.7.24, installed that night and put back to 0.7.21 six minutes later: "now there's a bunch of
   black space to the left. There can never be the black space. It needs to be sized properly for the screen. I
   never asked to change any of that. Now it looks tiny."
   1. The picture rule, at the iMac's measured parameters: the post text from the same left edge as 0.7.21, the crop
      drawn edge to edge, no blank pixel, the text within 8% of today's size (it is 1% smaller).
   2. The pace behind the ⋯: 1× · 2× · 4× · 8× = 3 · 6 · 12 · 24 px/s, 1× the default.
   3. The refresh ("a page up"): 5 min / 15 min / 30 min / off, 15 min by default; a saved 30 / 60 / 90 reads as
      15 min; ↻ stays an immediate refresh; the hover hold and the other S13 rules stay; the bar shows 15m beside ↻.
   4. The bridge is 0.7.25 and the health page expects it; the pane behaves with 0.7.21 (today) and with 0.7.25.
   Pictures and the rig: deliverables/20261012/x1. */
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

/* ── the iMac, as the Station's own health table measured it on 12 Oct (client 58feb66c) ───────────── */
const IMAC = { viewportWidth: 1062, viewportHeight: 640, frame: { videoWidth: 1792, videoHeight: 1080 },
  pane: { hostWidth: 255, hostHeight: 450, ratio: Math.min(1.25, 2) }, column: { left: 115, width: 312 }, tabsBottom: 53, textLeft: 180 };
const CROP = { "0.7.21": { left: 180, top: 54, width: 229, height: 586 }, "0.7.24": { left: 115, top: 54, width: 312, height: 586 },
  "0.7.25": { left: 180, top: 54, width: 239, height: 586 }, "0.7.26": { left: 180, top: 54, width: 229, height: 586 } };

/* the bridge's crop rule, run on a stand-in of the iMac's X window: the DOM exactly as the rule reads it */
function cropRuleAt(P) {
  const trim = bridge.match(/^\s*const STATION_CROP_RIGHT_TRIM_PX = (\d+);/m);
  assert.ok(trim, "the right trim is a named number");
  const box = (left, top, width, height) => ({ left, top, width, height, right: left + width, bottom: top + height });
  const node = (rect, children = {}) => ({ getBoundingClientRect: () => rect, querySelector: (sel) => children[sel] || null,
    querySelectorAll: (sel) => (children[sel] ? [].concat(children[sel]) : []) });
  const posts = [0, 1, 2, 3].map((i) => node(box(P.column.left, P.tabsBottom + 1 + i * 150, P.column.width, 150),
    { '[data-testid="tweetText"]': node(box(P.textLeft, P.tabsBottom + 31 + i * 150, P.column.left + P.column.width - 16 - P.textLeft, 60)) }));
  const column = node(box(P.column.left, 0, P.column.width, P.viewportHeight),
    { '[role="tablist"]': node(box(P.column.left, 0, P.column.width, P.tabsBottom)), '[data-testid="tweet"]': posts });
  const world = { session: { settings: { hideFeedTabs: true } }, Math, Number, Array, elementLabel: () => "",
    document: { documentElement: { clientWidth: P.viewportWidth, clientHeight: P.viewportHeight }, querySelector: (sel) => (sel === '[data-testid="primaryColumn"]' ? column : null) },
    window: { innerWidth: P.viewportWidth, innerHeight: P.viewportHeight, location: { pathname: "/home" } } };
  vm.createContext(world);
  vm.runInContext(["const STATION_CROP_RIGHT_TRIM_PX = " + trim[1] + ";", fnSource(bridge, "findPrimaryColumn"), fnSource(bridge, "findFeedTabsBottom"),
    fnSource(bridge, "findInnerContentLeft"), fnSource(bridge, "calculateCropRect")].join("\n"), world);
  return vm.runInContext("calculateCropRect()", world);
}

/* the pane's side: the crop onto the capture (stationSourceRegion), and the capture onto the pane (stationPaintPlan) */
function paneWorld() {
  const world = { Math, Number, STATION_SCROLL_OFFSET_MAX_PX: 4, STATION_CODE_MAX_STEPS: 24, stationFrameCode: null, stationCodeStats: { used: 0, ahead: 0 } };
  vm.createContext(world);
  vm.runInContext([fnSource(pane, "stationCaptureFit"), fnSource(pane, "stationCodedOffset"), fnSource(pane, "stationScrollOffset"),
    fnSource(pane, "stationSourceRegion"), fnSource(pane, "stationPaintPlan")].join("\n"), world);
  return world;
}
/* "the text size": pane CSS px per source CSS px. Today (0.7.21's crop on the live pane, which kept a 4 px margin
   of its own on each side of a 255 px pane): 247 / 229. */
const TODAY_TEXT_SCALE = (255 - 2 * Math.max(4, Math.min(8, 255 * .015))) / CROP["0.7.21"].width;
function painted(world, crop, P = IMAC, { expanded = false, profile = "auto" } = {}) {
  const region = world.stationSourceRegion(P.frame, { rect: crop, viewport: { width: P.viewportWidth, height: P.viewportHeight } });
  const plan = world.stationPaintPlan({ ...P.pane, region, expanded, profile });
  const fit = world.stationCaptureFit(P.frame.videoWidth, P.frame.videoHeight, P.viewportWidth, P.viewportHeight);
  return { region, plan, fit, textChange: (plan.dw / P.pane.ratio) / crop.width / TODAY_TEXT_SCALE - 1,
    firstSourceCssX: (plan.sourceX - fit.offsetX) / fit.scale };
}

test("X1 · the picture rule at the iMac's parameters: the text from 0.7.21's left edge, edge to edge, no blank pixel, 1% smaller", () => {
  const rule = cropRuleAt(IMAC);
  /* X2 (13 Oct): the bridge on this branch is 0.7.26 and sends exactly the crop of 0.7.21, because Alan's page stays as deployed; X1's 239 waits for his eye */
  assert.deepEqual({ left: rule.left, top: rule.top, width: rule.width, height: rule.height }, CROP["0.7.26"], "the bridge's crop: 180, 54, 229 × 586");
  assert.deepEqual(CROP["0.7.26"], CROP["0.7.21"]);
  assert.equal(rule.left, CROP["0.7.21"].left, "the same left edge as 0.7.21: the avatar rail (black on a black X) stays out");
  assert.equal(rule.left + rule.width, IMAC.column.left + IMAC.column.width - 18, "the right edge 18 px short of the column's border, as 0.7.21");
  assert.equal(rule.width - CROP["0.7.21"].width, 0, "not one pixel wider than 0.7.21");
  const w = paneWorld(), now = painted(w, rule);
  assert.equal(now.region.usable, true, "the crop lands on the 1792 × 1080 picture");
  assert.ok(Math.abs(now.firstSourceCssX - 180) < 0.01, "the first source pixel drawn is the text's left edge (180)");
  assert.equal(now.plan.blank, 0, "no part of the pane is blank or dark padding");
  assert.deepEqual([now.plan.dx, now.plan.dw], [0, now.plan.tw], "the crop fills the pane's width");
  assert.ok(Math.abs(now.plan.dh - now.plan.th) < 0.5, "and its height");
  assert.ok(Math.abs(now.textChange) <= 0.08, "the text within 8% of today's size: " + (now.textChange * 100).toFixed(1) + "%");
  assert.ok(now.textChange > 0.02 && now.textChange < 0.04, "on this pane (no margin) 3% larger; on the deployed pane it is the picture he has: " + (now.textChange * 100).toFixed(1) + "%");
  /* the same pane fed by the bridge the iMac runs today (0.7.21): still edge to edge, the text 3% larger (the margin is gone) */
  const old = painted(w, CROP["0.7.21"]);
  assert.equal(old.plan.blank, 0);
  assert.ok(Math.abs(old.firstSourceCssX - 180) < 0.01);
  assert.ok(old.textChange > 0.02 && old.textChange < 0.04, "with 0.7.21: +" + (old.textChange * 100).toFixed(1) + "%");
  /* what Alan rejected, in the same numbers: 0.7.24's crop made everything 27% smaller and began 65 px into the black rail */
  const rejectedToday = (255 - 2 * 4) / CROP["0.7.24"].width / TODAY_TEXT_SCALE - 1;
  assert.ok(rejectedToday < -0.25, "0.7.24 on the pane he had: " + (rejectedToday * 100).toFixed(1) + "%");
  const rejected = painted(w, CROP["0.7.24"]);
  assert.ok(rejected.textChange < -0.2, "0.7.24 on this pane would still be " + (rejected.textChange * 100).toFixed(1) + "%");
  assert.ok(Math.abs(rejected.firstSourceCssX - 115) < 0.01, "0.7.24 drew from the column's border: 65 px of rail before the text");
  /* an expanded pane keeps its readable cap and centring, as before (the X box across the lower row is not this brief) */
  const wide = painted(w, rule, { ...IMAC, pane: { hostWidth: 1200, hostHeight: 450, ratio: 1.25 } }, { expanded: true });
  assert.equal(wide.plan.dw, Math.round(540 * 1.25), "a 1200 px expanded pane still draws the feed 540 CSS px wide");
  assert.ok(wide.plan.dx > 0 && Math.abs(wide.plan.dx - (wide.plan.tw - wide.plan.dw) / 2) <= 1, "centred");
});

test("X1 · the pace behind the ⋯: 1× 2× 4× 8× = 3 6 12 24 px/s, 1× the default, shown only when the source reports its pace", () => {
  const ctx = vm.createContext({ Number });
  vm.runInContext(constLine(pane, "X_SPEED_CHOICES") + "\n" + fnSource(pane, "xSpeedChoice"), ctx);
  assert.deepEqual([3, 6, 12, 24, "24", 5, 0, 48, "fast"].map((v) => ctx.xSpeedChoice(v)), [3, 6, 12, 24, 24, null, null, null, null]);
  for (const [v, label] of [[3, "1×"], [6, "2×"], [12, "4×"], [24, "8×"]])
    assert.match(pane, new RegExp('<button class="btn xs xs-row" type="button" data-v="' + v + '" title="[^"]*' + v + ' pixels a second" hidden>' + label + "</button>"), label);
  assert.match(bridge, /speedPxPerSecond: 3,/, "the default pace is unchanged: Alan picks the faster one");
  assert.match(bridge, /saveSettings\(\{ speedPxPerSecond: Math\.max\(0\.5, Math\.min\(30, speed\)\) \}\);/, "24 px/s is inside the bridge's own bound");
  assert.match(fnSource(pane, "setXSpeed"), /if \(speed === null \|\| REMOTE_MODE\) return;/, "the iPad mirror never asks");
});

test("X1 · the refresh: 5 / 15 / 30 min / off, 15 min by default; a saved 30 / 60 / 90 reads as 15 min; off asks for nothing; the S13 rules stay", () => {
  const api = vm.runInNewContext(constLine(pane, "X_REFRESH_CHOICES") + "\n" + fnSource(pane, "xRefreshChoice") + fnSource(pane, "xRefreshPlan") +
    fnSource(pane, "xRefreshLabel") + fnSource(pane, "xRefreshWords") + "\n({ X_REFRESH_CHOICES, X_REFRESH_DEFAULT, xRefreshChoice, xRefreshPlan, xRefreshLabel, xRefreshWords })", { Number, Math });
  assert.deepEqual([...api.X_REFRESH_CHOICES], [300, 900, 1800, 0]);
  assert.equal(api.X_REFRESH_DEFAULT, 900);
  for (const [saved, want] of [[null, 900], [undefined, 900], ["", 900], ["30", 900], ["60", 900], ["90", 900], [60, 900], ["45", 900], ["300", 300], [300, 300], ["900", 900], ["1800", 1800], ["0", 0], [0, 0], ["off", 900]])
    assert.equal(api.xRefreshChoice(saved), want, "a saved " + JSON.stringify(saved));
  assert.deepEqual([300, 900, 1800, 0].map(api.xRefreshLabel), ["5m", "15m", "30m", "off"], "beside ↻");
  assert.deepEqual([300, 900, 1800, 0].map(api.xRefreshWords), ["5 minutes", "15 minutes", "30 minutes", "off"], "in the tooltips");
  const due = { live: true, remote: false, visible: true, owner: true, now: 1_000_000, lastAt: 100_000, seconds: 900, hover: false, panel: false };
  const plan = (patch) => api.xRefreshPlan(Object.assign({}, due, patch));
  assert.equal(plan({}).fire, true, "15 minutes after the last refresh it asks for a page up");
  assert.equal(plan({ lastAt: 100_001 }).fire, false, "not a millisecond early");
  assert.equal(plan({ seconds: 1800 }).fire, false, "30 min means 30 min");
  assert.equal(plan({ seconds: 300, lastAt: 700_000 }).fire, true, "5 min means 5 min");
  assert.deepEqual([plan({ seconds: 0 }).fire, plan({ seconds: 0 }).wait], [false, false], "off: it never asks and never waits");
  assert.equal(plan({ seconds: 0, lastAt: 0, now: 9e9 }).fire, false, "off stays off however long it has been");
  assert.deepEqual([plan({ hover: true }).fire, plan({ hover: true }).wait], [false, true], "the pointer on the feed: it waits, it is not dropped");
  assert.deepEqual([plan({ panel: true }).fire, plan({ panel: true }).wait], [false, true], "the ⋯ panel open: it waits");
  assert.equal(plan({ visible: false }).fire, false, "a hidden pane asks for nothing");
  assert.equal(plan({ owner: false }).fire, false, "a second mirror does not ask");
  assert.equal(plan({ remote: true }).fire, false, "the iPad never asks");
  assert.equal(plan({ live: false }).fire, false, "no source, no refresh");
  /* the chips, the bar, ↻ by hand */
  for (const [s, words, label] of [[300, "5 minutes", "5 min"], [900, "15 minutes", "15 min"], [1800, "30 minutes", "30 min"]])
    assert.match(pane, new RegExp('<button class="btn xr" type="button" data-s="' + s + '" title="refresh every ' + words + '">' + label + "</button>"), label);
  assert.match(pane, /<button class="btn xr" type="button" data-s="0" title="never by itself — only when ↻ is pressed">off<\/button>/);
  assert.doesNotMatch(pane, /data-s="(30|60|90)"/, "the old chips are gone");
  assert.match(fnSource(pane, "paintXRefresh"), /el\("xfEvery"\)\.textContent = xRefreshLabel\(xRefreshSeconds\);/, "the bar shows 15m beside ↻");
  assert.match(pane, /el\("bXRefresh"\)\.addEventListener\("click", \(\) => postXFloat\("refresh"\)\);/, "↻ by hand is unchanged: an immediate refresh");
  assert.match(pane, /postXFloat\("refresh", \{ pageUp:true, every:xRefreshSeconds \}\);/, "the timed one is still a page up");
  assert.match(pane, /for \(const id of \["bXRefresh", "bXList", "bXNotify"\]\) el\(id\)\.addEventListener\("click", \(\) => \{ xRefreshAt = Date\.now\(\);/, "↻ by hand or a change of view starts the count again");
  assert.match(pane, /if \(on\) \{ xRefreshAt = Date\.now\(\); paintXRefresh\(\); \}/, "the first page-up is one cadence after the feed attaches");
  assert.match(pane, /const XF_HOVER_PAUSE = false;/, "the hover rule of 6 Oct is untouched");
});

test("X1 · the bridge is 0.7.25, the health page expects it, and the pane behaves with 0.7.21 and 0.7.25 alike", () => {
  assert.match(read("station-x-bridge-draft/manifest.json"), /"version": "0\.7\.26"/);
  assert.match(read("x-health/index.html"), /const TARGET = "0\.7\.26";/);
  assert.match(read("x-health/index.html"), /Target version: <b id="target">0\.7\.26<\/b>/);
  assert.match(read("station-x-bridge-draft/README.md"), /## 0\.7\.25 \(X1, 12 Oct 2026\)/);
  /* the pane asks nothing of the bridge that 0.7.21 cannot do: the crop message is read the same way, the pace row
     stays hidden until a source reports its pace, the page-up is a request the old bridge answers with a plain refresh */
  assert.match(pane, /paintXSpeed\(xfloatCrop\?\.speedPxPerSecond\);/);
  assert.match(fnSource(pane, "paintXSpeed"), /for \(const node of document\.querySelectorAll\("#xMore \.xs-row"\)\) node\.hidden = known === null;/);
  assert.match(pane, /api\.note\(undefined, 1200\)|an older bridge says nothing: the hold simply runs out|noteXPageUp\(xfloatCrop\?\.pageUp\)/, "a crop without a page-up report is fine");
  assert.match(fnSource(pane, "paintXPicture"), /ctx\.drawImage\(picture, plan\.sourceX, plan\.sy, plan\.sourceWidth, plan\.sh, plan\.dx, plan\.dy, plan\.dw, plan\.dh\);/, "one draw, from the plan");
  /* nothing was added to the health row: the table has fixed columns */
  assert.doesNotMatch(fnSource(pane, "stationHealthRow"), /stationPaintLast|plan/);
});
