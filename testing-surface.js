(function () {
  "use strict";

  const STABLE_HOST = "station.scintillahub.ai";
  const NAMESPACE = "scintilla.testing.station.v1.";
  const active = location.hostname !== STABLE_HOST;
  const api = Object.freeze({
    active,
    stableHost: STABLE_HOST,
    namespace: NAMESPACE,
    key: (scope, key) => NAMESPACE + scope + "." + String(key || ""),
  });
  window.ScintillaTestingSurface = api;
  if (!active) return;

  document.documentElement.dataset.testing = "1";
  document.title = "TESTING SURFACE · NOT STABLE — " + document.title;

  const storage = window.Storage && window.Storage.prototype;
  if (storage && !storage.__scintillaTestingNamespaced) {
    const nativeGetItem = storage.getItem;
    const nativeSetItem = storage.setItem;
    const nativeRemoveItem = storage.removeItem;
    const nativeClear = storage.clear;
    const nativeKey = storage.key;
    const prefixFor = (target) => {
      try {
        return target === window.sessionStorage ? NAMESPACE + "session." : NAMESPACE + "local.";
      } catch (_) {
        return NAMESPACE + "local.";
      }
    };
    const scopedKey = (target, key) => prefixFor(target) + String(key || "");

    storage.getItem = function (key) {
      return nativeGetItem.call(this, scopedKey(this, key));
    };
    storage.setItem = function (key, value) {
      return nativeSetItem.call(this, scopedKey(this, key), value);
    };
    storage.removeItem = function (key) {
      return nativeRemoveItem.call(this, scopedKey(this, key));
    };
    storage.clear = function () {
      const prefix = prefixFor(this);
      const doomed = [];
      for (let index = 0; index < this.length; index += 1) {
        const key = nativeKey.call(this, index);
        if (key && key.startsWith(prefix)) doomed.push(key);
      }
      for (const key of doomed) nativeRemoveItem.call(this, key);
    };
    Object.defineProperty(storage, "__scintillaTestingNamespaced", { value: true });
  }

  if (typeof window.BroadcastChannel === "function") {
    const NativeBroadcastChannel = window.BroadcastChannel;
    function TestingBroadcastChannel(name) {
      return new NativeBroadcastChannel(NAMESPACE + "channel." + String(name || ""));
    }
    TestingBroadcastChannel.prototype = NativeBroadcastChannel.prototype;
    Object.setPrototypeOf(TestingBroadcastChannel, NativeBroadcastChannel);
    window.BroadcastChannel = TestingBroadcastChannel;
  }

  const nativeFetch = window.fetch.bind(window);
  window.fetch = function (input, init) {
    const method = String((init && init.method) || (input && input.method) || "GET").toUpperCase();
    const url = String((input && input.url) || input || "");
    const productionDataTarget = /^https:\/\/wadinxqplrggagkvrdag\.supabase\.co\//.test(url);
    if (productionDataTarget && method !== "GET" && method !== "HEAD" && method !== "OPTIONS") {
      return Promise.reject(new Error("TESTING SURFACE blocked a production data write"));
    }
    return nativeFetch(input, init);
  };
})();
