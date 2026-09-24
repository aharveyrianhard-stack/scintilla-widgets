import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

/* 24 Sep: the two Brave Station rows, number for number, from public.station_x_health. */
const xShell = fs.readFileSync(new URL("../station-shells/x-v2/index.html", import.meta.url), "utf8");
const grab = (re) => { const m = xShell.match(re); assert.ok(m, "missing " + re); return m[0]; };
const src = [
  grab(/function stationCaptureFit\(videoWidth, videoHeight, viewportWidth, viewportHeight\) \{[\s\S]*?\n\}\n/),
  grab(/const STATION_SCROLL_OFFSET_MAX_PX = \d+;\nfunction stationScrollOffset\(crop\) \{[\s\S]*?\n\}\n/),
  grab(/function stationSourceRegion\(video, crop\) \{[\s\S]*?\n\}\n/)
].join("\n");
const { stationSourceRegion, stationScrollOffset } =
  new Function(src + "return { stationSourceRegion, stationScrollOffset };")();

const imacBrave = { video: { videoWidth: 1792, videoHeight: 1080 },
  crop: { viewport: { width: 1062, height: 640 }, rect: { left: 180, top: 54, width: 457, height: 586 } } };
const macbookBrave = { video: { videoWidth: 1616, videoHeight: 1080 },
  crop: { viewport: { width: 970, height: 648 }, rect: { left: 247, top: 54, width: 457, height: 594 } } };

test("a runaway scroll offset no longer throws the crop off the picture", () => {
  for (const row of [imacBrave, macbookBrave]) {
    const r = stationSourceRegion(row.video, { ...row.crop, fractionalScrollOffset: 600 });
    assert.equal(r.usable, true, "the column is shown, not the whole X window");
    assert.ok(r.shAvailable > 900, "and nearly the full height of it");
    assert.ok(Math.abs(r.sy - 54 * r.fit.scale - r.fit.offsetY) < 0.01, "at the column's real top");
  }
});

test("a real fractional offset is still honoured", () => {
  const r = stationSourceRegion(imacBrave.video, { ...imacBrave.crop, fractionalScrollOffset: 0.4 });
  assert.ok(Math.abs(r.sy - (54.4 * r.fit.scale + r.fit.offsetY)) < 0.01);
  assert.equal(stationScrollOffset({ fractionalScrollOffset: 3.9 }), 3.9, "a settling move is a few pixels");
  assert.equal(stationScrollOffset({ fractionalScrollOffset: 4.5 }), 0);
  assert.equal(stationScrollOffset({ fractionalScrollOffset: -1 }), 0);
  assert.equal(stationScrollOffset({}), 0);
});

test("the health row carries the raw offset so a runaway is visible", () => {
  assert.match(xShell, /scroll_offset: r1\(crop\?\.fractionalScrollOffset\),/);
});

test("the health row carries the bridge's own counters for the two 0.7.21 safety nets", () => {
  assert.match(xShell, /ack_fallbacks: Number\.isFinite\(Number\(crop\?\.sourceMetrics\?\.captureAckFallbacks\)\)/);
  assert.match(xShell, /runaway_resets: Number\.isFinite\(Number\(crop\?\.sourceMetrics\?\.runawayOffsetResets\)\)/);
});
