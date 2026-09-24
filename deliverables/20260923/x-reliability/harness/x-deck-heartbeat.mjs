/* Does the X pane's liveness actually reach the deck across the iframe?
 *
 * The main rig runs the pane top-level, where parent === window and the
 * heartbeat is a no-op, so the deck-side fix would have gone unproven. This
 * mounts the real shell in a real iframe on the same origin, with the real
 * bridge and a real capture, and records what the host receives - including
 * what happens when the capture goes black under it.
 *
 * usage: node x-deck-heartbeat.mjs [--shell <index.html>]
 */
import playwright from "/Users/alanharvey/SCINTILLA 0.5/visual-supervisor/node_modules/playwright-core/index.js";
const { chromium } = playwright;
import http from "node:http";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const args = new Map();
for (let i = 2; i < process.argv.length; i += 2) args.set(process.argv[i].replace(/^--/, ""), process.argv[i + 1]);
const REPO = path.resolve(fileURLToPath(new URL("../../../..", import.meta.url)));
const SHELL = args.get("shell") || path.join(REPO, "station-shells/x-v2/index.html");
const HERE = path.dirname(fileURLToPath(import.meta.url));
const SCRATCH = process.env.SCRATCH || "/private/tmp/claude-501/x-reliability";
const BRIDGE = path.join(SCRATCH, "bridge-heartbeat");
await fsp.rm(BRIDGE, { recursive: true, force: true });
await fsp.cp("/Users/alanharvey/Scintilla/SCINTILLA X Bridge", BRIDGE, { recursive: true });

const HOST = `<!doctype html><meta charset="utf-8"><title>deck stand-in</title>
<style>html,body{margin:0;background:#05060C;height:100%}iframe{border:0;width:520px;height:760px}</style>
<pre id="log" style="color:#9A9AB6;font:12px monospace"></pre>
<iframe id="x" src="/pane-x/"></iframe>
<script>
/* Exactly what the deck does with the message, and nothing else. */
window.BEATS = [];
window.addEventListener("message", (event) => {
  if (event.origin !== location.origin || event.data?.type !== "SCINTILLA_X_LIVE") return;
  window.BEATS.push({ live: !!event.data.live, picture: !!event.data.picture, at: Date.now() });
  document.getElementById("log").textContent = "beats " + window.BEATS.length +
    " · last " + JSON.stringify(window.BEATS[window.BEATS.length - 1]);
});
<\/script>`;

const server = http.createServer(async (req, res) => {
  const file = decodeURIComponent(new URL(req.url, "http://127.0.0.1").pathname);
  if (/^\/(?:pane-x|station-shells\/x-v2)\/?$/.test(file)) {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
    res.end(await fsp.readFile(SHELL)); return;
  }
  if (file === "/host/") { res.writeHead(200, { "content-type": "text/html; charset=utf-8" }); res.end(HOST); return; }
  res.writeHead(404).end("no");
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const BASE = `http://127.0.0.1:${server.address().port}`;

const context = await chromium.launchPersistentContext(path.join(SCRATCH, "profile-heartbeat-" + Date.now()), {
  headless: false,
  args: [`--disable-extensions-except=${BRIDGE}`, `--load-extension=${BRIDGE}`, "--no-first-run",
    "--no-default-browser-check", "--auto-select-tab-capture-source-by-title=Home / X",
    "--auto-accept-this-tab-capture", "--window-size=900,820", "--window-position=1250,40"],
  viewport: null,
});
const sw = context.serviceWorkers()[0] || await context.waitForEvent("serviceworker", { timeout: 20000 });
const FIXTURE = await fsp.readFile(path.join(HERE, "x-source-fixture.html"), "utf8");
await context.route("https://x.com/**", (route) =>
  route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: FIXTURE }));

const xPage = await context.newPage();
await xPage.goto("https://x.com/home", { waitUntil: "domcontentloaded" });
await xPage.waitForTimeout(2500);

const host = await context.newPage();
await host.addInitScript(() => {
  const bus = new BroadcastChannel("scintilla.x-harness.capture.v1");
  bus.addEventListener("message", (event) => {
    if (event.data?.type === "answer") {
      for (const frame of [window, ...Array.from(document.querySelectorAll("iframe")).map((f) => f.contentWindow)]) {
        try { frame.postMessage({ type: "XFF_STATION_ANSWER", answer: event.data.answer }, location.origin); } catch (_) {}
      }
    }
  });
  window.addEventListener("message", (event) => {
    if (event.data?.type !== "XFF_STATION_OFFER") return;
    event.stopImmediatePropagation();
    new BroadcastChannel("scintilla.x-harness.capture.v1").postMessage({ type: "offer", id: "frame", offer: event.data.offer });
  }, true);
});
await host.goto(`${BASE}/host/`, { waitUntil: "domcontentloaded" });

const holder = await context.newPage();
await holder.goto(`${BASE}/pane-x/`, { waitUntil: "domcontentloaded" }).catch(() => {});
await holder.setContent(await fsp.readFile(path.join(HERE, "x-capture-holder.html"), "utf8"));
await holder.click("#go");
await holder.waitForTimeout(2000);
const captured = await holder.evaluate(() => window.__HOLDER || { ok: false });

const xTabId = await sw.evaluate(async () => (await chrome.tabs.query({ url: "https://x.com/*" }))[0]?.id ?? null);
await sw.evaluate(async (tabId) => {
  stationSourceTabId = tabId;
  await persistStationSession();
  await reconnectStationConsumers({ controlSource: true });
}, xTabId);
await host.waitForTimeout(8000);
const live = await host.evaluate(() => window.BEATS.slice(-3));

await xPage.evaluate(() => { document.documentElement.style.filter = "brightness(0)"; });
await host.waitForTimeout(6000);
const dark = await host.evaluate(() => window.BEATS.slice(-3));
await host.screenshot({ path: path.join(REPO, "deliverables/20260923/x-reliability/shots/heartbeat-host.png") });

const result = {
  capture: captured.ok ? `${captured.width}x${captured.height}` : captured,
  beats: await host.evaluate(() => window.BEATS.length),
  whileShowing: live, whileBlack: dark,
  crossesTheFrame: live.some((b) => b.live && b.picture),
  reportsBlackHonestly: dark.length > 0 && dark.every((b) => b.live) && dark.some((b) => !b.picture),
};
console.log(JSON.stringify(result, null, 1));
await fsp.writeFile(path.join(REPO, "deliverables/20260923/x-reliability/shots/heartbeat-log.json"), JSON.stringify(result, null, 1));
await context.close();
server.close();
