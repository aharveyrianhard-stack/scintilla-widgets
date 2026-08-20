/* The Hub entry, inspected in a real browser: the live path's exact failure, and the deck
   booting AT the hub origin under vercel.json's own rules.
   ========================================================================================
   Run: PW_MODULE_DIR=<dir-with-playwright-core> node browser-proof/proofs/hub-entry.mjs

   1. LIVE: Chromium is pointed at https://station.scintillahub.ai/ THROUGH the work
      environment's proxy — the navigation's exact failure is recorded and photographed.
      (The proxy refuses the CONNECT before TLS starts; nothing is bypassed or faked. This
      documents what this container can and cannot see of the live path.)
   2. CONFIG-EMULATED: the same URL is served by applying vercel.json's PARSED rewrite
      rules over the rig — the host-conditioned root rewrite to /deck/, every other path
      served directly by path, the no-store headers attached — and the Station must BOOT
      at the hub origin: title, scene machinery, shim, panes. A single relative asset path
      in /deck would 404 under the root rewrite and fail this proof; absolute paths are
      asserted by outcome, not by grep.
*/
import assert from "node:assert/strict";
import fs from "node:fs";
import { launch, shoot, record, nowStamp } from "../rig.mjs";

const cfg = JSON.parse(fs.readFileSync(new URL("../../vercel.json", import.meta.url), "utf8"));
const HUB = cfg.rewrites[0].has[0].value;
const DEST = cfg.rewrites[0].destination;
const CACHE = Object.fromEntries(cfg.headers[0].headers.map((h) => [h.key, h.value]));

const { context, origin, close, browser } = await launch();

/* ---- 1: the LIVE hub URL through the environment proxy — exact failure, photographed ---- */
const proxy = process.env.HTTPS_PROXY || process.env.https_proxy;
assert.ok(proxy, "the environment's proxy must be declared — the live attempt goes through it");
const liveCtx = await browser.newContext({ proxy: { server: proxy }, viewport: { width: 1200, height: 700 } });
const live = await liveCtx.newPage();
let liveError = null;
try { await live.goto("https://" + HUB + "/", { timeout: 15000, waitUntil: "domcontentloaded" }); }
catch (e) { liveError = String(e && e.message || e).split("\n")[0]; }
assert.ok(liveError, "the live path is expected unreachable from this container — a success here would be NEWS");
assert.match(liveError, /ERR_TUNNEL_CONNECTION_FAILED|ERR_PROXY_CONNECTION_FAILED|ERR_CONNECTION/,
  "the failure is the proxy refusing the tunnel, recorded verbatim: " + liveError);
const shotLive = await shoot(live, "hub-entry-live-path-refused");
/* The PREVIEW host gets the same live measurement — it is the branch's own deploy and the
   named target of the live-acceptance blocker, so its refusal is recorded verbatim too. */
const PREVIEW = "scintilla-widgets-git-cla-070619-aharveyrianhard-8432s-projects.vercel.app";
let prevError = null;
try { await live.goto("https://" + PREVIEW + "/deck/", { timeout: 15000, waitUntil: "domcontentloaded" }); }
catch (e) { prevError = String(e && e.message || e).split("\n")[0]; }
assert.ok(prevError, "the preview is expected unreachable from this container — a success here would be NEWS");
assert.match(prevError, /ERR_TUNNEL_CONNECTION_FAILED|ERR_PROXY_CONNECTION_FAILED|ERR_CONNECTION/,
  "the preview refusal, recorded verbatim: " + prevError);
await live.waitForTimeout(400);
const shotPrev = await shoot(live, "hub-entry-preview-refused");
await liveCtx.close();

/* ---- 2: the hub origin served by the deploy config's own rules over the rig ---- */
const page = await context.newPage();
const errors = []; page.on("pageerror", (e) => errors.push(String(e)));
const misses = [];
await context.route("https://" + HUB + "/**", async (route) => {
  const u = new URL(route.request().url());
  /* vercel.json, applied: the host-conditioned root rewrite, then serve by path. */
  const mapped = u.pathname === cfg.rewrites[0].source ? DEST : u.pathname;
  const local = await route.fetch({ url: origin + mapped + u.search });
  if (local.status() === 404) misses.push(u.pathname);
  return route.fulfill({ response: local, headers: { ...local.headers(), "cache-control": CACHE["Cache-Control"] } });
});
await page.goto("https://" + HUB + "/", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(5000);

assert.equal(await page.title(), "SCINTILLA · The Station", "the Station is what the hub root serves");
assert.equal(await page.evaluate(() => location.host), HUB, "…AT the hub origin, not a redirect");
const boot = await page.evaluate(() => ({
  scenes: typeof StationScenes === "object" && Array.isArray(StationScenes.IDS),
  shim: typeof scInstallProviderShim === "function",
  axis: typeof SC_COHORT_AXIS === "object",
  panes: document.querySelectorAll("iframe").length,
  note: (document.getElementById("symbolNote") || {}).textContent || "",
}));
assert.ok(boot.scenes, "/deck/scenes.js loaded across the rewrite (absolute path survives the root URL)");
assert.ok(boot.shim, "/_provider/provider.js loaded across the rewrite");
assert.ok(boot.axis, "/_cohorts/cohort-axis.js loaded across the rewrite");
assert.ok(boot.panes >= 1, "the wall mounts its shells at the hub origin");
assert.deepEqual(misses, [], "no asset 404s — a relative path would have broken here, none did");
const cc = await page.evaluate(() => fetch("/deck/scenes.js").then((r) => r.headers.get("cache-control")));
assert.equal(cc, CACHE["Cache-Control"], "the no-store rule rides every response, as the config orders");
const shotHub = await shoot(page, "hub-entry-deck-boots-at-hub-origin");
assert.deepEqual(errors, [], "no page errors booting at the hub origin");
await page.close();

console.log("hub-entry proof PASSED");

record(`## ${nowStamp()} — the Hub entry: the live path's exact refusal, and the deck booting AT the hub origin

Command: \`PW_MODULE_DIR=… node browser-proof/proofs/hub-entry.mjs\` (rules parsed from vercel.json itself; asserts inline)

- **Live path, measured in the browser** (${shotLive}): Chromium pointed at https://${HUB}/ through the environment's proxy fails with \`${liveError}\` — the CONNECT is refused before TLS begins, so nothing was bypassed and nothing live was reached or faked. The PREVIEW host gets the same measurement (${shotPrev}): \`${prevError}\` — the branch's own deploy is equally unreachable from here, which is exactly the live-acceptance blocker the handoff carries. This is the browser-level twin of round 7's curl measurement: live acceptance still requires a browser outside this container.
- **The deck boots at the hub origin under the config's own rules** (${shotHub}): navigating to https://${HUB}/ with vercel.json's parsed rewrites applied over the rig serves the Station AT the hub host — title, StationScenes, the provider shim, the cohort axis and the mounted panes all up, location.host still the hub. ZERO asset 404s: every /deck dependency is absolute-pathed, so the root rewrite (source "/" only) breaks nothing — proven by outcome in a real browser, not by grep. The no-store cache rule rides every response, as pinned from the config.
- The config itself is pinned in tests/station-route-inventory.test.mjs: exactly two rewrites (hub root → /deck/, /status → orgstatus), no-store at all three cache layers.

This is stubbed-data page proof at the true hub ORIGIN — it verifies the entry path and the deck's behavior under the rewrite, not the live owners' data. Rollback: revert the single commit carrying this unit — proof, pin and receipts only; no served file changed.
`);

await close();
