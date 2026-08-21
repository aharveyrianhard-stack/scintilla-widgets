/* SCINTILLA STATION — THE FIREBASE CLIENT
   ======================================
   One initialised Firebase app for the scintilla-834af project, resolved once and shared, so
   that a surface which wants Firebase asks for it rather than standing up its own.

   THIS REPOSITORY HAS NO BUILD STEP, AND THAT DECIDES ALMOST EVERYTHING HERE.

     There is no package.json, no bundler and no framework. Vercel serves this tree as files.
     So the integration guide's three moving parts do not survive contact with it, and each
     is replaced by the thing that actually works:

       `npm install firebase`      -> nothing would consume the install. The SDK is VENDORED
                                      same-origin into /_vendor from the npm registry's own
                                      sha512-verified tarball and loaded by script tag with a
                                      sha384 integrity attribute, exactly as supabase-js and
                                      lightweight-charts already are.

       `process.env.NEXT_PUBLIC_*` -> `process` does not exist in a browser and nothing here
                                      substitutes it at build time. Written bare, the first
                                      such read throws ReferenceError and takes the whole
                                      script with it - the config would not be "abstracted",
                                      it would be absent, and every page loading this file
                                      would break at parse-adjacent runtime. The read below is
                                      GUARDED so it stays inert here and starts working by
                                      itself if this tree is ever built as `apps/web` (see
                                      MANIFEST.yaml). `import.meta.env` is deliberately NOT
                                      consulted: `import.meta` is a SyntaxError in a classic
                                      script, so merely naming it would break this file.

       `.env.local` committed here -> Vercel serves EVERY file in this repository. A committed
                                      .env.local answers 200 at its own path. Nothing secret
                                      may be written into this tree; see the note below on why
                                      nothing here is.

   NOTHING IN THIS CONFIG IS A SECRET, AND THAT IS NOT AN EXCUSE - IT IS THE DESIGN.
   A Firebase web config is a set of public identifiers. It ships to every browser that loads
   the app and is meant to; access is decided by Security Rules and App Check on the server
   side, never by the config's obscurity. That is the same standing as the Supabase anon key
   this repository already inlines. It is centralised here so it is ONE thing to change, not
   sixty - which is the part of "abstract the parameters" that actually pays.

   NAMED ABSENCE, NOT A SILENT NULL. If the vendored SDK did not load, `app()` returns null and
   `state().reason` says so in words. A surface can then say it is unavailable instead of
   drawing a confident empty.
*/
(function (root) {
  "use strict";

  var VERSION = "12.18.0";        /* pinned; the vendored filenames carry the same number */

  /* ---- config resolution: override, then build-time env if one ever exists, then default ---- */

  /* The runtime override is this tree's answer to an env var. A page - or anything injected
     ahead of this script - may set globalThis.__FIREBASE_CONFIG__ to a partial object and
     those keys win. Per-key, not all-or-nothing, so overriding one value does not oblige a
     caller to restate the other six correctly. */
  var OVERRIDE = (root.__FIREBASE_CONFIG__ && typeof root.__FIREBASE_CONFIG__ === "object")
    ? root.__FIREBASE_CONFIG__ : {};

  /* GUARDED, and it must stay guarded. `typeof process` is the only way to ask this question
     without throwing when the answer is no. */
  var ENV = (typeof process !== "undefined" && process && process.env) ? process.env : {};

  function pick(key, envNames, fallback) {
    if (Object.prototype.hasOwnProperty.call(OVERRIDE, key) &&
        OVERRIDE[key] != null && OVERRIDE[key] !== "") return OVERRIDE[key];
    for (var i = 0; i < envNames.length; i++) {
      var v = ENV[envNames[i]];
      if (v != null && v !== "") return v;
    }
    return fallback;
  }

  var config = Object.freeze({
    apiKey:            pick("apiKey",            ["NEXT_PUBLIC_FIREBASE_API_KEY",             "VITE_FIREBASE_API_KEY"],             "AIzaSyChoC_ROiuZKLXuhl6csE6mLvmBDNu8N6M"),
    authDomain:        pick("authDomain",        ["NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",         "VITE_FIREBASE_AUTH_DOMAIN"],         "scintilla-834af.firebaseapp.com"),
    projectId:         pick("projectId",         ["NEXT_PUBLIC_FIREBASE_PROJECT_ID",          "VITE_FIREBASE_PROJECT_ID"],          "scintilla-834af"),
    storageBucket:     pick("storageBucket",     ["NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",      "VITE_FIREBASE_STORAGE_BUCKET"],      "scintilla-834af.firebasestorage.app"),
    messagingSenderId: pick("messagingSenderId", ["NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID", "VITE_FIREBASE_MESSAGING_SENDER_ID"], "359855978927"),
    appId:             pick("appId",             ["NEXT_PUBLIC_FIREBASE_APP_ID",              "VITE_FIREBASE_APP_ID"],              "1:359855978927:web:96dd6f70f4f025a847575a"),
    measurementId:     pick("measurementId",     ["NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID",      "VITE_FIREBASE_MEASUREMENT_ID"],      "G-SGMX1HVCYT"),
  });

  /* ---- the app: initialised at most once, whoever asks and however often ---- */

  var _app = null;
  var _reason = "not initialised yet";

  /* The compat SDK's own singleton question. `firebase.apps.length ? firebase.app() : init()`
     is the compat spelling of the modular `getApps().length ? getApp() : initializeApp()`;
     both exist to survive a second script tag, a re-executed page, or two surfaces sharing a
     document without the second one throwing "app/duplicate-app" at the first. */
  function app() {
    if (_app) return _app;
    var fb = root.firebase;
    if (!fb || typeof fb.initializeApp !== "function") {
      _reason = "firebase-app compat SDK (vendored same-origin) did not load — no Firebase app exists on this page";
      return null;
    }
    try {
      _app = (fb.apps && fb.apps.length) ? fb.app() : fb.initializeApp(config);
      _reason = "initialised for project " + config.projectId;
    } catch (err) {
      _app = null;
      _reason = "initializeApp refused the config: " + (err && err.message ? err.message : String(err));
    }
    return _app;
  }

  /* ---- analytics: only where the browser actually supports it ---- */

  var _analytics = null;
  var _analyticsReason = "not attempted";

  /* isSupported() is asynchronous because the real answer depends on cookies, IndexedDB and
     whether this is a browser at all. Calling getAnalytics() without waiting for it is the
     documented way to throw in a webview, a server render or a private-mode tab. */
  function analytics() {
    if (_analytics) return Promise.resolve(_analytics);

    if (typeof window === "undefined") {
      _analyticsReason = "not a browser — analytics is not attempted off the window";
      return Promise.resolve(null);
    }
    var fb = root.firebase;
    if (!fb || typeof fb.analytics !== "function" || typeof fb.analytics.isSupported !== "function") {
      _analyticsReason = "firebase-analytics compat SDK (vendored same-origin) did not load — analytics is unavailable, the app is not";
      return Promise.resolve(null);
    }
    if (!app()) {
      _analyticsReason = "no Firebase app to attach analytics to — " + _reason;
      return Promise.resolve(null);
    }
    return fb.analytics.isSupported().then(function (supported) {
      if (!supported) {
        _analyticsReason = "this environment does not support Firebase Analytics";
        return null;
      }
      try {
        _analytics = fb.analytics();
        _analyticsReason = "active for " + config.measurementId;
      } catch (err) {
        _analytics = null;
        _analyticsReason = "analytics refused to start: " + (err && err.message ? err.message : String(err));
      }
      return _analytics;
    }, function (err) {
      _analyticsReason = "isSupported() failed: " + (err && err.message ? err.message : String(err));
      return null;
    });
  }

  /* AUTO-START IS THE DEFAULT AND IS SWITCHABLE.
     Loading this file starts analytics where the browser supports it, which is what an
     analytics integration is for. A page that must not emit - the browser-proof rig, which
     refuses every external host, or any surface that should stay silent - sets
     __FIREBASE_ANALYTICS_AUTO__ = false before this script and gets an app with no analytics.
     `ready` resolves either way, so a caller can await the settled state rather than guess. */
  var AUTO = root.__FIREBASE_ANALYTICS_AUTO__ !== false;
  var ready = AUTO
    ? analytics().then(state, state)
    : Promise.resolve().then(function () {
        _analyticsReason = "auto-start disabled by __FIREBASE_ANALYTICS_AUTO__";
        app();
        return state();
      });

  function state() {
    return {
      version:   VERSION,
      projectId: config.projectId,
      app:       !!_app,
      analytics: !!_analytics,
      reason:    _reason,
      analyticsReason: _analyticsReason,
    };
  }

  if (AUTO) app();   /* the app itself is local and cheap; only analytics waits on support */

  root.SC_FIREBASE = Object.freeze({
    VERSION: VERSION,
    config: config,
    app: app,
    analytics: analytics,
    ready: ready,
    state: state,
  });
})(typeof globalThis === "object" ? globalThis : window);
