/* M43 X-EVERYWHERE: the crop mapping, the announced fallback, the source badge
   and the self-updating bridge. Offline; no browser, no capture, no network. */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const shell = await readFile(new URL("../../station-shells/x-v2/index.html", import.meta.url), "utf8");
const pane = await readFile(new URL("../../pane-x/index.html", import.meta.url), "utf8");
const content = await readFile(new URL("../content.js", import.meta.url), "utf8");
const background = await readFile(new URL("../background.js", import.meta.url), "utf8");

function fromSource(source, name, context = {}) {
  let start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} must exist`);
  if (source.slice(Math.max(0, start - 6), start) === "async ") start -= 6;
  let depth = 0, end = -1;
  // Skip the parameter list: a destructured parameter carries braces of its own.
  let paren = source.indexOf("(", start), parens = 0, bodyAt = -1;
  for (let index = paren; index < source.length; index += 1) {
    if (source[index] === "(") parens += 1;
    if (source[index] === ")") { parens -= 1; if (parens === 0) { bodyAt = source.indexOf("{", index); break; } }
  }
  for (let index = bodyAt; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") depth -= 1;
    if (depth === 0) { end = index + 1; break; }
  }
  return vm.runInNewContext(`(${source.slice(start, end)})`, context);
}

const captureFit = fromSource(shell, "stationCaptureFit");
const sourceRegion = fromSource(shell, "stationSourceRegion", { stationCaptureFit: captureFit });

/* The mapping that shipped at 81e2ab7: one divide per axis, no bar offset. */
function legacyRegion(video, crop) {
  const viewport = crop.viewport, rect = crop.rect;
  const scaleX = video.videoWidth / Math.max(1, viewport.width);
  const scaleY = video.videoHeight / Math.max(1, viewport.height);
  const sx = Math.max(0, rect.left * scaleX);
  const sy = Math.max(0, (rect.top + (crop.fractionalScrollOffset || 0)) * scaleY);
  return { sx, sy, sw: Math.min(video.videoWidth - sx, rect.width * scaleX),
    shAvailable: Math.min(video.videoHeight - sy, rect.height * scaleY) };
}

/* What tab capture actually produces: the window scaled to FIT inside the cap,
   aspect kept, centred. This is the ground truth the pane has to hit. */
function captureFrame(cssW, cssH, dpr, capW, capH) {
  const deviceW = cssW * dpr, deviceH = cssH * dpr;
  const shrink = Math.min(1, capW / deviceW, capH / deviceH);
  if (shrink === 1) return { videoWidth: Math.round(deviceW), videoHeight: Math.round(deviceH) };
  return { videoWidth: capW, videoHeight: capH };
}
function trueColumnBox(frame, cssW, cssH, rect) {
  const scale = Math.min(frame.videoWidth / cssW, frame.videoHeight / cssH);
  return { sx: (frame.videoWidth - cssW * scale) / 2 + rect.left * scale,
    sy: (frame.videoHeight - cssH * scale) / 2 + rect.top * scale,
    sw: rect.width * scale, sh: rect.height * scale };
}

/* Alan's X window on the iMac: 2x screen, resized away from the cap's 16:9. */
const IMAC = { cssW: 1200, cssH: 1300, dpr: 2 };
const SOAK = { cssW: 1470, cssH: 830, dpr: 2 };          // the shape M29 soaked
const COLUMN = { left: 372, top: 96, width: 456, height: 1180 };

test("the crop lands on the column at the iMac's parameters (it did not before)", () => {
  const frame = captureFrame(IMAC.cssW, IMAC.cssH, IMAC.dpr, 2560, 1440);
  const crop = { rect: COLUMN, viewport: { width: IMAC.cssW, height: IMAC.cssH } };
  const truth = trueColumnBox(frame, IMAC.cssW, IMAC.cssH, COLUMN);
  const fixed = sourceRegion(frame, crop);
  const legacy = legacyRegion(frame, crop);
  assert.ok(Math.abs(fixed.sx - truth.sx) < 1, `fixed sx ${fixed.sx} vs ${truth.sx}`);
  assert.ok(Math.abs(fixed.sw - truth.sw) < 1, `fixed sw ${fixed.sw} vs ${truth.sw}`);
  // the shipped mapping missed the column by hundreds of captured pixels
  assert.ok(Math.abs(legacy.sx - truth.sx) > 100, `legacy sx off by ${Math.abs(legacy.sx - truth.sx)}`);
  assert.ok(legacy.sw > truth.sw * 1.1, "legacy also drew the column too wide");
});

test("the frame is letterboxed exactly where the old mapping assumed picture", () => {
  const frame = captureFrame(IMAC.cssW, IMAC.cssH, IMAC.dpr, 2560, 1440);
  const fit = captureFit(frame.videoWidth, frame.videoHeight, IMAC.cssW, IMAC.cssH);
  assert.equal(frame.videoWidth, 2560);
  assert.equal(frame.videoHeight, 1440);
  assert.ok(fit.offsetX > 600, `pillarbox of ${Math.round(fit.offsetX)}px each side`);
  assert.equal(Math.round(fit.offsetY), 0);
  assert.ok(Math.abs(fit.contentWidth + fit.offsetX * 2 - frame.videoWidth) < 1);
});

test("on the shape M29 soaked, the fix moves nothing Alan could see", () => {
  const frame = captureFrame(SOAK.cssW, SOAK.cssH, SOAK.dpr, 2560, 1440);
  const crop = { rect: COLUMN, viewport: { width: SOAK.cssW, height: SOAK.cssH } };
  const fixed = sourceRegion(frame, crop), legacy = legacyRegion(frame, crop);
  for (const key of ["sx", "sy", "sw", "shAvailable"]) {
    /* ~5px of pillarbox at this shape: a 2-3px difference, which is why the
       MacBook soak looked correct and the resized iMac window did not. */
    assert.ok(Math.abs(fixed[key] - legacy[key]) < 3, `${key}: ${fixed[key]} vs ${legacy[key]}`);
  }
});

test("a 1x screen small enough to escape the cap was never broken either", () => {
  const frame = captureFrame(1200, 1300, 1, 2560, 1440);   // no downscale, no bars
  const crop = { rect: COLUMN, viewport: { width: 1200, height: 1300 } };
  const fixed = sourceRegion(frame, crop), legacy = legacyRegion(frame, crop);
  assert.equal(Math.round(fixed.sx), Math.round(legacy.sx));
  assert.equal(Math.round(fixed.sw), Math.round(legacy.sw));
  // DPR 2 on the same window is what pushes it over the cap and breaks it
  const retina = captureFrame(1200, 1300, 2, 2560, 1440);
  assert.ok(captureFit(retina.videoWidth, retina.videoHeight, 1200, 1300).offsetX > 600);
});

test("browser zoom does not move the crop off the column", () => {
  // Zooming out enlarges the CSS viewport; rect and viewport travel together.
  const plain = { cssW: 1200, cssH: 1300, rect: COLUMN };
  const zoomed = { cssW: 1500, cssH: 1625, rect: { left: 465, top: 120, width: 570, height: 1475 } };
  const fractions = [plain, zoomed].map((shape) => {
    const frame = captureFrame(shape.cssW, shape.cssH, 2, 2560, 1440);
    const region = sourceRegion(frame, { rect: shape.rect, viewport: { width: shape.cssW, height: shape.cssH } });
    const fit = captureFit(frame.videoWidth, frame.videoHeight, shape.cssW, shape.cssH);
    return { left: (region.sx - fit.offsetX) / fit.contentWidth, width: region.sw / fit.contentWidth };
  });
  assert.ok(Math.abs(fractions[0].left - fractions[1].left) < 0.005, JSON.stringify(fractions));
  assert.ok(Math.abs(fractions[0].width - fractions[1].width) < 0.005, JSON.stringify(fractions));
});

test("the mapping never samples a black bar", () => {
  const frame = captureFrame(IMAC.cssW, IMAC.cssH, IMAC.dpr, 2560, 1440);
  const fit = captureFit(frame.videoWidth, frame.videoHeight, IMAC.cssW, IMAC.cssH);
  const edge = sourceRegion(frame, { rect: { left: 0, top: 0, width: IMAC.cssW + 400, height: IMAC.cssH + 400 },
    viewport: { width: IMAC.cssW, height: IMAC.cssH } });
  assert.ok(edge.sx >= fit.offsetX - 0.001, "left edge starts at the picture, not the bar");
  assert.ok(edge.sx + edge.sw <= fit.offsetX + fit.contentWidth + 0.001, "right edge stops at the picture");
  assert.ok(edge.sy + edge.shAvailable <= fit.offsetY + fit.contentHeight + 0.001);
});

test("a track cropped at the source is drawn whole, with no mapping at all", () => {
  const frame = { videoWidth: 456, videoHeight: 1180 };
  const region = sourceRegion(frame, { sourceCropped: true, rect: COLUMN,
    viewport: { width: IMAC.cssW, height: IMAC.cssH } });
  assert.deepEqual(
    { sx: region.sx, sy: region.sy, sw: region.sw, sh: region.shAvailable, usable: region.usable },
    { sx: 0, sy: 0, sw: 456, sh: 1180, usable: true });
  assert.equal(region.sourceCropped, true);
});

test("the same mapping is in the pane shell, so the two cannot drift apart", () => {
  const paneFit = fromSource(pane, "stationCaptureFit");
  const a = captureFit(2560, 1440, 1200, 1300), b = paneFit(2560, 1440, 1200, 1300);
  assert.equal(JSON.stringify({ ...b }), JSON.stringify({ ...a }));
});

test("the whole-window fallback says so, and stops saying so when the crop lands", () => {
  const said = [];
  const context = { stationWholeFrameWhy: "", stationWholeFrameSince: 0, Date,
    showStationState: (text, tone) => said.push([text, tone]) };
  const note = vm.runInNewContext(
    `${shell.slice(shell.indexOf("function noteStationWholeFrame("), shell.indexOf("/* Which Mac and which browser"))}; noteStationWholeFrame`,
    context);
  note("crop missed the picture");
  note("crop missed the picture");
  note("");
  assert.deepEqual(said, [["whole X window · crop missed the picture", "warn"], ["live", "on"]]);
});

test("the pane prints which machine and browser feeds it", () => {
  const label = fromSource(shell, "stationSourceLabel");
  assert.equal(label({ browser: "Brave", machine: "iMac 5K" }), "Brave · iMac 5K");
  assert.equal(label({ browser: "Chrome" }), "Chrome");
  assert.equal(label(null), "");
});

test("the bridge names its own browser, Brave included", () => {
  const name = fromSource(content, "bridgeBrowserName");
  assert.equal(name({ brave: { isBrave: () => true }, userAgent: "Mozilla/5.0 Chrome/153", userAgentData: { brands: [{ brand: "Google Chrome" }] } }), "Brave");
  assert.equal(name({ userAgent: "Mozilla/5.0 Chrome/153.0.0.0 Safari/537.36", userAgentData: { brands: [{ brand: "Google Chrome" }, { brand: "Chromium" }] } }), "Chrome");
  assert.equal(name({ userAgent: "Mozilla/5.0 Safari/605" }), "browser");
});

test("the bridge names its own machine, and an explicit name wins", () => {
  const machine = fromSource(content, "bridgeMachineName");
  assert.equal(machine({ width: 2560, height: 1440 }, null), "iMac 5K");
  assert.equal(machine({ width: 1728, height: 1117 }, null), "MacBook Pro");
  assert.equal(machine({ width: 1280, height: 800 }, null), "1280×800");
  assert.equal(machine({ width: 2560, height: 1440 }, { getItem: () => "iMac (desk)" }), "iMac (desk)");
});

test("a newer folder reloads the bridge; an equal or older one never does", () => {
  const compare = fromSource(background, "compareBridgeVersions");
  const decide = fromSource(background, "bridgeReloadDecision", { compareBridgeVersions: compare });
  assert.equal(decide({ loaded: "0.7.19", onDisk: "0.7.20", feeding: false }).reload, true);
  assert.equal(decide({ loaded: "0.7.19", onDisk: "0.7.19", feeding: false }).reload, false);
  assert.equal(decide({ loaded: "0.7.19", onDisk: "0.7.16", feeding: false }).reload, false);
  assert.equal(decide({ loaded: "0.7.9", onDisk: "0.7.10", feeding: false }).reload, true, "0.7.10 > 0.7.9");
  assert.equal(decide({ loaded: "0.7.19", onDisk: "", feeding: false }).reload, false);
});

test("a reload waits rather than killing a pane that is feeding", () => {
  const compare = fromSource(background, "compareBridgeVersions");
  const decide = fromSource(background, "bridgeReloadDecision", { compareBridgeVersions: compare });
  const busy = decide({ loaded: "0.7.19", onDisk: "0.7.20", feeding: true });
  assert.equal(busy.reload, false);
  assert.match(busy.reason, /idle/);
});

test("the version check reloads on a real bump and records what it saw", async () => {
  const compare = fromSource(background, "compareBridgeVersions");
  const decide = fromSource(background, "bridgeReloadDecision", { compareBridgeVersions: compare });
  const state = {};
  let reloads = 0;
  const chrome = {
    runtime: { getManifest: () => ({ version: "0.7.19" }), getURL: (p) => "chrome-extension://x/" + p,
      reload: () => { reloads += 1; } },
    storage: { session: { set: async (patch) => Object.assign(state, patch) } },
  };
  const context = { chrome, fetch: async () => ({ ok: true, json: async () => ({ version: "0.7.20" }) }),
    Date, BRIDGE_VERSION_STATE_KEY: "xffBridgeVersionCheck",
    bridgeReloadDecision: decide, stationSourceTabId: null };
  const folder = fromSource(background, "bridgeFolderVersion", context);
  context.bridgeFolderVersion = folder;
  const check = fromSource(background, "checkBridgeFolderVersion", context);
  const decision = await check();
  assert.equal(decision.reload, true);
  assert.equal(reloads, 1);
  assert.equal(state.xffBridgeVersionCheck.loaded, "0.7.19");
  assert.equal(state.xffBridgeVersionCheck.onDisk, "0.7.20");
});
