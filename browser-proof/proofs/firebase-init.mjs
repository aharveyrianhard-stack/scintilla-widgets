/* The Firebase client initialises in a real browser, and says so — or says why not.
   ================================================================================
   Run: PW_MODULE_DIR=<dir-with-playwright-core> node browser-proof/proofs/firebase-init.mjs

   The SDK is VENDORED same-origin (npm-verified bytes), so the REAL Firebase library loads
   and executes here — nothing is stubbed. The harness page is fulfilled at a same-origin path
   that is NOT a file in the repository, so proving this costs the deploy no new surface; the
   three script tags it carries are exactly the tags a Station page would add, integrity
   attributes included, which is how the sha384 digests in STATION_ROUTES.md get checked by a
   browser rather than merely asserted by us.

     1  THE VENDORED SDK IS BLOCKED — the module must name the absence and break nothing.
     1b ONLY THE APP HALF IS BLOCKED — an upstream load-order hazard this proof found by being
        run: the analytics compat file throws on its own when the app file is missing.
     2  AUTO-START OFF, CONFIG OVERRIDDEN — an app, no analytics, and the override honoured.
     3  THE DEFAULT PATH — app up, analytics gated through the real isSupported(), and a
        SECOND load of the module adopts the first app instead of throwing duplicate-app.
*/
import assert from "node:assert/strict";
import { launch, shoot, record, nowStamp } from "../rig.mjs";

const SRI_APP       = "sha384-3dQMr5IYbX54CRsE04108MMs7jeEV/IWSMASoZPvju7G87xGB1a2oHweoRc6Fc4z";
const SRI_ANALYTICS = "sha384-kUH8WiblLuoHu8Q7A38bqP509miN1JPL7POAEdCDdIMMZa+rDORFIcalkpmluB6l";
const HARNESS = "/__firebase-init-harness";

/* Scintilla ground and accent, per DESIGN.md — a fixture still renders into the world it
   belongs to, and a receipt is only worth shooting if the state is legible in it. */
function page(preamble = "") {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<title>SCINTILLA · Firebase client</title>
<style>
  html,body{margin:0;background:#0e1116;color:#c7d0da;font:13px/1.55 ui-monospace,SFMono-Regular,Menlo,monospace}
  main{padding:26px 30px}
  h1{margin:0 0 4px;font-size:15px;letter-spacing:.09em;text-transform:uppercase;color:#5b9dd9}
  p.sub{margin:0 0 18px;color:#6d7a88}
  pre{margin:0;padding:16px 18px;background:#141920;border:1px solid #232b35;border-radius:6px;white-space:pre-wrap}
  b{color:#e6edf5}
</style></head><body><main>
<h1>Firebase client — settled state</h1>
<p class="sub">/_firebase/firebase.js over the vendored same-origin SDK</p>
<pre id="out">waiting for the lifecycle to settle…</pre>
<p class="sub" style="margin:16px 0 6px">uncaught page errors</p>
<pre id="errs">none</pre>
</main>
<script>
  /* Registered before any SDK tag, so a throw DURING a vendored script is captured and
     RENDERED. Without this the 1b receipt was byte-identical to 1's: the hazard lives in the
     console, and a screenshot of the DOM could not see the one thing that scenario exists to
     show. A receipt that cannot show its own claim is decoration. */
  window.__ERRS__ = [];
  window.addEventListener("error", function (e) {
    window.__ERRS__.push(String((e && e.error && e.error.message) || (e && e.message) || e));
    var box = document.getElementById("errs");
    if (box) box.textContent = window.__ERRS__.join("\\n");
  });
</script>
<script>${preamble}</script>
<script src="/_vendor/firebase-app-12.18.0-compat.js" integrity="${SRI_APP}"></script>
<script src="/_vendor/firebase-analytics-12.18.0-compat.js" integrity="${SRI_ANALYTICS}"></script>
<script src="/_firebase/firebase.js"></script>
<script>
  (function () {
    var have = typeof SC_FIREBASE !== "undefined";
    var settle = have ? SC_FIREBASE.ready : Promise.resolve(null);
    settle.then(function (s) {
      var state = s || (have ? SC_FIREBASE.state() : { reason: "/_firebase/firebase.js did not load" });
      window.__STATE__ = state;
      window.__SDK__ = { app: typeof window.firebase !== "undefined",
                         analytics: typeof window.firebase !== "undefined" && typeof window.firebase.analytics === "function",
                         apps: (window.firebase && window.firebase.apps || []).length };
      document.getElementById("out").textContent = JSON.stringify(state, null, 2);
      document.body.dataset.settled = "1";
    });
  })();
</script></body></html>`;
}

const { context, origin, unmatched, close } = await launch();

async function open(preamble = "", block = []) {
  const p = await context.newPage();
  const errs = []; p.on("pageerror", (e) => errs.push(String(e)));
  for (const pattern of [].concat(block))
    await p.route(pattern, (route) => route.abort("connectionrefused"));
  await p.route("**" + HARNESS, (route) =>
    route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: page(preamble) }));
  await p.goto(origin + HARNESS, { waitUntil: "domcontentloaded" });
  await p.waitForSelector("body[data-settled='1']", { timeout: 15000 });
  return { p, errs, state: await p.evaluate(() => window.__STATE__), sdk: await p.evaluate(() => window.__SDK__) };
}

/* ---- 1: the vendored SDK does not load ---- */
const s1 = await open("", ["**/_vendor/firebase-app-*", "**/_vendor/firebase-analytics-*"]);
assert.equal(s1.sdk.app, false, "the app SDK really is absent from the page");
assert.equal(s1.state.app, false, "so there is no app");
assert.match(s1.state.reason, /firebase-app compat SDK \(vendored same-origin\) did not load/,
  "and the reason names the file, in words a surface can print");
assert.equal(s1.state.analytics, false);
assert.match(s1.state.analyticsReason, /firebase-analytics compat SDK \(vendored same-origin\) did not load/);
assert.equal(s1.state.projectId, "scintilla-834af", "the config still resolved — the absence is the SDK's, not the config's");
const shot1 = await shoot(s1.p, "firebase-sdk-absent-named");
assert.deepEqual(s1.errs, [], "a missing SDK breaks nothing on the page");
await s1.p.close();

/* ---- 1b: ONLY the app half is blocked — an upstream hazard, found by running this ----
   firebase-analytics-compat.js reaches for the app SDK's INTERNAL registry at its own top
   level, so if the app tag fails and the analytics tag succeeds, the VENDORED FILE throws
   before a line of ours runs. Nothing in /_firebase/firebase.js can prevent that — it is the
   SDK's own load-order contract. It is proven and named here rather than hidden by blocking
   both tags, because the operational consequence is real: a page must carry the analytics tag
   only ALONGSIDE the app tag, never without it. What is ours still holds — the module names
   the absence, and the page still settles into a coherent, printable state. */
const s1b = await open("", "**/_vendor/firebase-app-*");
assert.equal(s1b.state.app, false, "still no app");
assert.match(s1b.state.reason, /firebase-app compat SDK \(vendored same-origin\) did not load/);
assert.equal(s1b.state.analytics, false, "and no analytics");
assert.equal(s1b.errs.length, 1, "exactly one error, and it is the SDK's own: " + JSON.stringify(s1b.errs));
assert.match(s1b.errs[0], /INTERNAL/,
  "the throw comes from firebase-analytics-compat reaching for the absent app registry");
/* The receipt must SHOW the hazard, not merely be taken while it happened. */
const shownErr = await s1b.p.textContent("#errs");
assert.match(shownErr, /INTERNAL/, "the throw is rendered into the page the receipt photographs");
const shot1b = await shoot(s1b.p, "firebase-analytics-without-app-upstream-throw");
await s1b.p.close();

/* ---- 2: auto-start off, and one config key overridden ---- */
const s2 = await open(
  'window.__FIREBASE_ANALYTICS_AUTO__ = false; window.__FIREBASE_CONFIG__ = { projectId: "scintilla-proof-override" };');
assert.equal(s2.sdk.app, true, "the VENDORED library executes — this is the real SDK, not a stub");
assert.equal(s2.state.app, true, "the app is up");
assert.equal(s2.state.projectId, "scintilla-proof-override", "the runtime override won, per key");
assert.equal(s2.sdk.apps, 1, "exactly one Firebase app exists");
assert.equal(s2.state.analytics, false, "and nothing analytics-shaped started");
assert.match(s2.state.analyticsReason, /auto-start disabled by __FIREBASE_ANALYTICS_AUTO__/);
const shot2 = await shoot(s2.p, "firebase-app-up-analytics-off");
assert.deepEqual(s2.errs, [], "zero page errors");
await s2.p.close();

/* ---- 3: the default path, then a second load of the same module ---- */
const before = unmatched.length;
const s3 = await open("");
assert.equal(s3.state.app, true, "the app is up on the default path");
assert.equal(s3.state.projectId, "scintilla-834af", "with the project this repository was given");
assert.equal(s3.state.version, "12.18.0");

/* isSupported() is the real one here, so the honest outcome is asserted either way — but it
   must be a DECIDED outcome with a reason, never an unsettled or silent one. */
if (s3.state.analytics) {
  assert.match(s3.state.analyticsReason, /active for G-SGMX1HVCYT/);
  /* Analytics genuinely reached for its tag — and the rig refused it, which is the proof
     that the lifecycle ran rather than being short-circuited by a missing measurement id. */
  const reached = unmatched.slice(before).filter((u) => /googletagmanager|google-analytics/.test(u));
  assert.ok(reached.length > 0, "analytics started, so it tried its tag host: " + JSON.stringify(unmatched.slice(before)));
} else {
  assert.match(s3.state.analyticsReason, /does not support Firebase Analytics|isSupported\(\) failed|refused to start/,
    "an unsupported environment is NAMED: " + s3.state.analyticsReason);
}

/* A SECOND script tag for the same module — the duplicate-app case. */
const twice = await s3.p.evaluate(async () => {
  await new Promise((res, rej) => {
    const el = document.createElement("script");
    el.src = "/_firebase/firebase.js?second=1"; el.onload = res; el.onerror = rej;
    document.head.appendChild(el);
  });
  await SC_FIREBASE.ready;
  return { apps: window.firebase.apps.length, app: SC_FIREBASE.state().app,
           same: SC_FIREBASE.app() === window.firebase.app() };
});
assert.equal(twice.apps, 1, "a second load did NOT create a second app");
assert.equal(twice.app, true, "and the app is still up");
assert.equal(twice.same, true, "the module hands back the SDK's own default app");
const shot3 = await shoot(s3.p, "firebase-default-path-settled");
assert.deepEqual(s3.errs, [], "zero page errors, including across the second load");
await s3.p.close();

record(`## ${nowStamp()} — the Firebase client initialises once, gates analytics, and names every absence

Command: \`PW_MODULE_DIR=… node browser-proof/proofs/firebase-init.mjs\` (harness page fulfilled at a same-origin path that is not a repository file; asserts inline)

The Firebase SDK is **vendored same-origin** into \`/_vendor\` from the npm registry's own sha512-verified tarball, byte-identical to it, and loaded by script tag with a sha384 integrity attribute — the same shape supabase-js and lightweight-charts already have here. The compat (UMD) build is the one vendored because the modular ESM \`firebase-analytics.js\` hard-codes an \`import\` from \`gstatic.com\`: the ESM pair cannot be served same-origin without editing vendored bytes, and this rig refuses every external host. **The real library executes in all three scenarios below** — nothing is stubbed, and the integrity attributes are checked by Chromium rather than merely asserted by a test.

- **The vendored SDK blocked** (${shot1}): no app, and the state says which file is missing — "firebase-app compat SDK (vendored same-origin) did not load" — in words a surface can print instead of drawing a confident empty. The config still resolves, so the absence is correctly attributed to the SDK and not to the configuration. Zero page errors: a missing SDK breaks nothing.
- **Only the app half blocked — an upstream load-order hazard, found by running this** (${shot1b}): \`firebase-analytics-compat.js\` reaches for the app SDK's \`INTERNAL\` registry at its own top level, so with the app tag failing and the analytics tag succeeding, **the vendored file throws \`TypeError: Cannot read properties of undefined (reading 'INTERNAL')\` before a line of ours runs**. Nothing in \`/_firebase/firebase.js\` can prevent it; it is the SDK's own contract. Named here rather than hidden by blocking both tags, because the consequence is operational: **a page must carry the analytics tag only alongside the app tag, never without it.** What is ours still holds — the module names the absence and the page still settles into a coherent, printable state.
- **Auto-start off, one key overridden** (${shot2}): exactly one Firebase app exists, \`__FIREBASE_CONFIG__ = { projectId: … }\` wins for that key alone while the other six keep their values, and analytics never starts — reason: "auto-start disabled by __FIREBASE_ANALYTICS_AUTO__". This is the switch a surface that must not emit uses. Per-key override is this build-stepless tree's stand-in for an env var: \`process\` does not exist in a browser and nothing here substitutes it at build time, so the guide's bare \`process.env.NEXT_PUBLIC_*\` reads would have thrown ReferenceError and taken the module with them. The read is guarded, inert here, and starts working by itself if this tree is ever built as \`apps/web\`.
- **The default path, loaded twice** (${shot3}): the app initialises for project \`scintilla-834af\` on SDK ${"12.18.0"}, analytics resolves through the real \`isSupported()\` to a decided, named outcome, and a **second script tag for the same module adopts the first app rather than throwing \`app/duplicate-app\`** — \`firebase.apps.length\` stays 1 and \`SC_FIREBASE.app()\` is the SDK's own default app. Analytics reaching for its tag host is refused by the rig, which is itself the evidence the lifecycle ran rather than being short-circuited.

No Station surface loads this module yet — it is served and inert until a tag is added, and STATION_ROUTES.md says so rather than implying a wiring that does not exist. Zero page errors in every scenario. Rollback: revert the single commit — two vendored files, one client module, its suites and this proof; no existing page, data lane, authority or methodology changed.`);

await close();
console.log("firebase-init: OK —", [shot1, shot2, shot3].join(" · "));
