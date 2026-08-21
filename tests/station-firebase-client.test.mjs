/* The Firebase client initialises once, gates analytics, and names every absence.
   =============================================================================
   /_firebase/firebase.js is a classic script for a tree with no build step, so the things
   that would break it are not the things a bundled app worries about. Each is pinned here.

     `process` DOES NOT EXIST IN A BROWSER. The integration guide this came from reads
     process.env.NEXT_PUBLIC_* bare. Bare, the first such read throws ReferenceError and takes
     the whole file with it — every page loading it would get no config AND no module. These
     suites run the real source inside a vm context that has NO `process` binding, which is the
     browser's situation exactly, and assert it loads and resolves the config anyway.

     `import.meta` IS A SYNTAX ERROR IN A CLASSIC SCRIPT — naming it at all would break the
     file before a line ran. The source is asserted never to mention it.

     A SECOND SCRIPT TAG MUST NOT THROW. Firebase refuses a duplicate initializeApp with
     app/duplicate-app. The module asks the SDK's own singleton question first; a second load
     must return the first app, not a second one and not an exception.

   The vendored bytes are pinned by sha384 — the same digest the integrity attribute carries —
   so a swapped SDK is a failing test rather than a silent supply-chain change.
*/
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const SOURCE = fs.readFileSync(new URL("../_firebase/firebase.js", import.meta.url), "utf8");

/* ---- a compat SDK stub with the shape the real one exposes ---- */
function stubFirebase(opts = {}) {
  const { isSupported = true, initThrows = false, analyticsThrows = false } = opts;
  const apps = [];
  const analytics = function () {
    if (analyticsThrows) throw new Error("analytics refused");
    return { measurementId: "stub" };
  };
  analytics.isSupported = () => Promise.resolve(isSupported);
  return {
    apps,
    initializeApp(cfg) {
      if (initThrows) throw new Error("Invalid API key");
      /* The real SDK throws app/duplicate-app here; the module must never reach it twice. */
      if (apps.length) throw new Error("Firebase: Firebase App named '[DEFAULT]' already exists (app/duplicate-app).");
      const app = { name: "[DEFAULT]", options: cfg };
      apps.push(app);
      return app;
    },
    app() {
      if (!apps.length) throw new Error("Firebase: No Firebase App '[DEFAULT]' has been created (app/no-app).");
      return apps[0];
    },
    analytics,
  };
}

/* Runs the REAL source in a context with no `process` and no `window` beyond what is set —
   i.e. the environment the file actually ships into. */
function load(sandbox = {}) {
  const ctx = vm.createContext(sandbox);
  vm.runInContext(SOURCE, ctx, { filename: "_firebase/firebase.js" });
  return ctx;
}

test("the module loads where `process` does not exist, and still resolves a config", () => {
  const ctx = load({ firebase: stubFirebase() });
  assert.equal(typeof ctx.process, "undefined", "the context has no process — this is the browser's case");
  assert.equal(ctx.SC_FIREBASE.config.projectId, "scintilla-834af");
  assert.equal(ctx.SC_FIREBASE.config.apiKey, "AIzaSyChoC_ROiuZKLXuhl6csE6mLvmBDNu8N6M");
  assert.equal(ctx.SC_FIREBASE.config.authDomain, "scintilla-834af.firebaseapp.com");
  assert.equal(ctx.SC_FIREBASE.config.storageBucket, "scintilla-834af.firebasestorage.app");
  assert.equal(ctx.SC_FIREBASE.config.messagingSenderId, "359855978927");
  assert.equal(ctx.SC_FIREBASE.config.appId, "1:359855978927:web:96dd6f70f4f025a847575a");
  assert.equal(ctx.SC_FIREBASE.config.measurementId, "G-SGMX1HVCYT");
});

/* The header explains at length why import.meta is avoided, so the check has to judge the CODE
   rather than the prose about the code — otherwise documenting the hazard would trip the test
   that guards it, and the obvious fix would be to delete the explanation. */
const CODE = SOURCE.replace(/\/\*[\s\S]*?\*\//g, " ");

test("the source never names import.meta, which a classic script cannot parse", () => {
  assert.doesNotMatch(CODE, /import\s*\.\s*meta/, "import.meta would be a SyntaxError here");
  /* Not "a guard exists somewhere" — EVERY process.env read must sit on a guarded line.
     One unguarded read anywhere in the file is the whole failure mode. */
  const reads = CODE.split("\n").filter((line) => line.includes("process.env"));
  assert.equal(reads.length, 1, "there should be exactly one process.env read to guard");
  assert.match(reads[0], /typeof process !== "undefined"/,
    "the only process.env read must be on the same line as its typeof guard");
});

test("a build-time env var wins over the built-in default when one actually exists", () => {
  const ctx = load({
    firebase: stubFirebase(),
    process: { env: { NEXT_PUBLIC_FIREBASE_PROJECT_ID: "from-next", VITE_FIREBASE_API_KEY: "from-vite" } },
  });
  assert.equal(ctx.SC_FIREBASE.config.projectId, "from-next");
  assert.equal(ctx.SC_FIREBASE.config.apiKey, "from-vite", "either prefix is read, so a migration needs no rewrite");
  assert.equal(ctx.SC_FIREBASE.config.appId, "1:359855978927:web:96dd6f70f4f025a847575a",
    "keys the env does not carry keep their default");
});

test("the runtime override wins over everything, per key", () => {
  const ctx = load({
    firebase: stubFirebase(),
    __FIREBASE_CONFIG__: { projectId: "override-project" },
    process: { env: { NEXT_PUBLIC_FIREBASE_PROJECT_ID: "from-next" } },
  });
  assert.equal(ctx.SC_FIREBASE.config.projectId, "override-project");
  assert.equal(ctx.SC_FIREBASE.config.measurementId, "G-SGMX1HVCYT",
    "overriding one key does not oblige the caller to restate the other six");
});

test("an empty or absent override value does not blank the config", () => {
  const ctx = load({ firebase: stubFirebase(), __FIREBASE_CONFIG__: { projectId: "", apiKey: null } });
  assert.equal(ctx.SC_FIREBASE.config.projectId, "scintilla-834af");
  assert.equal(ctx.SC_FIREBASE.config.apiKey, "AIzaSyChoC_ROiuZKLXuhl6csE6mLvmBDNu8N6M");
});

test("the app is initialised exactly once, however many times it is asked for", () => {
  const fb = stubFirebase();
  const ctx = load({ firebase: fb, __FIREBASE_ANALYTICS_AUTO__: false });
  const a = ctx.SC_FIREBASE.app();
  const b = ctx.SC_FIREBASE.app();
  assert.ok(a, "an app exists");
  assert.equal(a, b, "the same instance comes back");
  assert.equal(fb.apps.length, 1, "initializeApp ran once");
  assert.equal(ctx.SC_FIREBASE.state().app, true);
  assert.match(ctx.SC_FIREBASE.state().reason, /initialised for project scintilla-834af/);
});

test("a second load against an SDK that already holds an app adopts it instead of throwing", () => {
  /* Two script tags, or a surface loaded twice into one document. The stub throws
     app/duplicate-app exactly as the real SDK does, so adopting is the only way through. */
  const fb = stubFirebase();
  const first = load({ firebase: fb, __FIREBASE_ANALYTICS_AUTO__: false });
  first.SC_FIREBASE.app();
  assert.equal(fb.apps.length, 1);

  const second = load({ firebase: fb, __FIREBASE_ANALYTICS_AUTO__: false });
  const adopted = second.SC_FIREBASE.app();
  assert.equal(adopted, fb.apps[0], "the existing app is adopted");
  assert.equal(fb.apps.length, 1, "and no second app was created");
});

test("no SDK on the page is a named absence, not a thrown page", () => {
  const ctx = load({ __FIREBASE_ANALYTICS_AUTO__: false });   /* no `firebase` global at all */
  assert.equal(ctx.SC_FIREBASE.app(), null, "no app, and no exception reaching the page");
  const s = ctx.SC_FIREBASE.state();
  assert.equal(s.app, false);
  assert.match(s.reason, /firebase-app compat SDK \(vendored same-origin\) did not load/,
    "the reason says which file is missing, in words a surface can print");
});

test("a config the SDK refuses is reported, not swallowed", () => {
  const ctx = load({ firebase: stubFirebase({ initThrows: true }), __FIREBASE_ANALYTICS_AUTO__: false });
  assert.equal(ctx.SC_FIREBASE.app(), null);
  assert.match(ctx.SC_FIREBASE.state().reason, /initializeApp refused the config: Invalid API key/);
});

test("analytics starts only where the environment supports it", async () => {
  const ctx = load({ firebase: stubFirebase({ isSupported: true }), window: {} });
  const state = await ctx.SC_FIREBASE.ready;
  assert.equal(state.app, true, "the app is up");
  assert.equal(state.analytics, true, "and analytics started");
  assert.match(state.analyticsReason, /active for G-SGMX1HVCYT/);
});

test("an unsupported environment gets an app and no analytics, and says which", async () => {
  const ctx = load({ firebase: stubFirebase({ isSupported: false }), window: {} });
  const state = await ctx.SC_FIREBASE.ready;
  assert.equal(state.app, true, "analytics is optional; the app is not");
  assert.equal(state.analytics, false);
  assert.match(state.analyticsReason, /does not support Firebase Analytics/);
});

test("off the window, analytics is never attempted", async () => {
  const ctx = load({ firebase: stubFirebase({ isSupported: true }) });   /* no `window` */
  const state = await ctx.SC_FIREBASE.ready;
  assert.equal(state.analytics, false);
  assert.match(state.analyticsReason, /not a browser/);
});

test("analytics that refuses to start leaves the app standing", async () => {
  const ctx = load({ firebase: stubFirebase({ analyticsThrows: true }), window: {} });
  const state = await ctx.SC_FIREBASE.ready;
  assert.equal(state.app, true);
  assert.equal(state.analytics, false);
  assert.match(state.analyticsReason, /analytics refused to start: analytics refused/);
});

test("auto-start can be switched off, and then nothing emits", async () => {
  const fb = stubFirebase({ isSupported: true });
  let asked = false;
  fb.analytics.isSupported = () => { asked = true; return Promise.resolve(true); };
  const ctx = load({ firebase: fb, window: {}, __FIREBASE_ANALYTICS_AUTO__: false });
  const state = await ctx.SC_FIREBASE.ready;
  assert.equal(asked, false, "support was never even asked — nothing reached out");
  assert.equal(state.app, true, "the app is still initialised");
  assert.equal(state.analytics, false);
  assert.match(state.analyticsReason, /auto-start disabled by __FIREBASE_ANALYTICS_AUTO__/);

  /* And an explicit call still works after the switch. */
  const an = await ctx.SC_FIREBASE.analytics();
  assert.ok(an, "opting in explicitly still starts it");
  assert.equal(asked, true);
});

test("the exported surface is frozen, so a page cannot quietly reshape it", () => {
  const ctx = load({ firebase: stubFirebase(), __FIREBASE_ANALYTICS_AUTO__: false });
  assert.ok(Object.isFrozen(ctx.SC_FIREBASE));
  assert.ok(Object.isFrozen(ctx.SC_FIREBASE.config));
  assert.equal(ctx.SC_FIREBASE.VERSION, "12.18.0");
});

/* ---- the vendored bytes ---- */

const VENDORED = {
  "../_vendor/firebase-app-12.18.0-compat.js":
    "sha384-3dQMr5IYbX54CRsE04108MMs7jeEV/IWSMASoZPvju7G87xGB1a2oHweoRc6Fc4z",
  "../_vendor/firebase-analytics-12.18.0-compat.js":
    "sha384-kUH8WiblLuoHu8Q7A38bqP509miN1JPL7POAEdCDdIMMZa+rDORFIcalkpmluB6l",
};

test("the vendored SDK is the byte sequence its integrity attribute claims", () => {
  for (const [rel, want] of Object.entries(VENDORED)) {
    const bytes = fs.readFileSync(new URL(rel, import.meta.url));
    const got = "sha384-" + crypto.createHash("sha384").update(bytes).digest("base64");
    assert.equal(got, want, rel + " no longer matches the pinned digest");
  }
});

test("the vendored SDK reaches no external host of its own", () => {
  /* This is why the compat build is vendored and the modular ESM one is not:
     firebase-analytics.js hard-codes `import ... from "https://www.gstatic.com/..."`, which
     would leave the page fetching the SDK's other half off-origin whatever we served. */
  for (const rel of Object.keys(VENDORED)) {
    const src = fs.readFileSync(new URL(rel, import.meta.url), "utf8");
    assert.doesNotMatch(src, /gstatic\.com/, rel + " must not reach gstatic");
    assert.doesNotMatch(src, /^import[\s{]/m, rel + " must be a classic script, not an ES module");
  }
});
