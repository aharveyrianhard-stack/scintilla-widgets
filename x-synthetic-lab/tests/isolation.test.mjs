import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const html = await readFile(new URL("index.html", root), "utf8");
const vercel = JSON.parse(await readFile(new URL("vercel.json", root), "utf8"));

test("lab identity is unambiguous", () => {
  assert.match(html, /SCINTILLA X LAB/);
  assert.match(html, /Not production · Synthetic only/);
  assert.match(html, /SAFE MODE · REPLAY DATA/);
  assert.match(html, /LOCAL FIXTURE/);
});

test("lab exposes live replay telemetry on screen", () => {
  for (const id of [
    "telemetryState",
    "telemetryFrame",
    "telemetryScroll",
    "telemetryProgress",
    "telemetryCadence",
    "telemetryLoops",
    "telemetryFixture"
  ]) assert.match(html, new RegExp(`id=["']${id}["']`));

  assert.match(html, /aria-label="Replay telemetry"/);
  assert.match(html, /aria-live="off"/);
  assert.match(html, /renderState\("replaying"\)/);
});

test("deployable shell contains no live-source, pairing, or browser-control capability", () => {
  const forbidden = [
    "getDisplayMedia",
    "getUserMedia",
    "tabCapture",
    "RTCPeerConnection",
    "WebSocket",
    "BroadcastChannel",
    "chrome.",
    "x.com",
    "twitter.com",
    "station-ipad",
    "pair=",
    "<video",
    "<iframe"
  ];

  for (const token of forbidden) assert.equal(html.includes(token), false, `forbidden capability present: ${token}`);
});

test("preview is explicitly non-indexable and separately identified", () => {
  const headers = vercel.headers.flatMap(rule => rule.headers);
  assert.deepEqual(headers.find(header => header.key === "X-Robots-Tag"), {
    key: "X-Robots-Tag",
    value: "noindex, nofollow, noarchive"
  });
  assert.deepEqual(headers.find(header => header.key === "X-SCINTILLA-Surface"), {
    key: "X-SCINTILLA-Surface",
    value: "x-synthetic-lab"
  });
  assert.match(headers.find(header => header.key === "Content-Security-Policy").value, /connect-src 'none'/);
  assert.match(headers.find(header => header.key === "Content-Security-Policy").value, /media-src 'none'/);
  assert.match(headers.find(header => header.key === "Permissions-Policy").value, /display-capture=\(\)/);
});
