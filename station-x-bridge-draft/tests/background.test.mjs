import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

async function harness(sessionSeed = {}) {
  const runtimeListeners = [];
  const actionListeners = [];
  const removedListeners = [];
  const sent = [];
  const captures = [];
  const tabUpdates = [];
  const windowUpdates = [];
  const runtimeSent = [];
  const offscreenDocuments = [];
  let offscreenReady = false;
  const sessionData = structuredClone(sessionSeed);

  const chrome = {
    action: {
      onClicked: { addListener(fn) { actionListeners.push(fn); } },
      setBadgeBackgroundColor() {},
      setBadgeText() {}
    },
    runtime: {
      lastError: null,
      getURL(path) { return `chrome-extension://fixture/${path}`; },
      async getContexts() { return offscreenReady ? [{ contextType: "OFFSCREEN_DOCUMENT" }] : []; },
      async sendMessage(message) {
        runtimeSent.push(message);
        if (message.type === "XFF_OFFSCREEN_START" || message.type === "XFF_OFFSCREEN_STOP") {
          return { ok: true };
        }
        if (message.type === "XFF_OFFSCREEN_OFFER") {
          return { ok: true, answer: { type: "answer", sdp: "fixture-answer" } };
        }
        return { ok: true };
      },
      onMessage: { addListener(fn) { runtimeListeners.push(fn); } }
    },
    offscreen: {
      async hasDocument() { return offscreenReady; },
      async createDocument(options) {
        offscreenDocuments.push(options);
        offscreenReady = true;
      }
    },
    storage: {
      session: {
        async get(key) { return { [key]: sessionData[key] }; },
        async set(value) { Object.assign(sessionData, structuredClone(value)); }
      }
    },
    scripting: { async executeScript() {} },
    tabCapture: {
      getMediaStreamId(options, callback) {
        captures.push(options);
        callback("fixture-stream-id");
      }
    },
    tabs: {
      onRemoved: { addListener(fn) { removedListeners.push(fn); } },
      async sendMessage(tabId, message, options) {
        sent.push({ tabId, message, options });
        return { ok: true };
      },
      async update(tabId, options) {
        tabUpdates.push({ tabId, options });
        return { id: tabId, windowId: 2 };
      },
      async query() { return []; },
      async create() { return { id: 99, windowId: 2, url: "https://x.com/home" }; },
      getZoom(_tabId, callback) { callback(1); },
      setZoom(_tabId, _zoom, callback) { callback(); }
    },
    windows: {
      async update(windowId, options) {
        windowUpdates.push({ windowId, options });
        return { id: windowId };
      }
    }
  };

  const source = await readFile(new URL("../background.js", import.meta.url), "utf8");
  vm.runInNewContext(source, {
    chrome, console, URL, Set, Map, Date, Promise, Error, setTimeout, clearTimeout
  });
  return {
    runtimeListeners, actionListeners, removedListeners, sent, captures,
    tabUpdates, windowUpdates, runtimeSent, offscreenDocuments, sessionData
  };
}

function dispatchRuntime(listeners, message, sender) {
  return new Promise((resolve, reject) => {
    let asyncResponse = false;
    for (const listener of listeners) {
      const result = listener(message, sender, (value) => resolve(value));
      asyncResponse ||= result === true;
    }
    if (!asyncResponse) queueMicrotask(() => resolve(undefined));
    setTimeout(() => reject(new Error(`No response for ${message.type}`)), 500);
  });
}

test("one X action binds the exact source tab to the ready Station frame", async () => {
  const h = await harness();
  await dispatchRuntime(h.runtimeListeners, {
    type: "XFF_STATION_READY", width: 430, height: 260
  }, {
    tab: { id: 11, windowId: 2, url: "http://127.0.0.1:4179/deck/" },
    frameId: 5,
    url: "http://127.0.0.1:4179/pane-x"
  });

  assert.equal(h.actionListeners.length, 1);
  await h.actionListeners[0]({ id: 7, windowId: 1, url: "https://x.com/home" });

  assert.deepEqual(
    JSON.parse(JSON.stringify(h.captures)),
    [{ targetTabId: 7 }]
  );
  assert.equal(h.offscreenDocuments.length, 1);
  assert.ok(h.runtimeSent.some(({ type }) => type === "XFF_OFFSCREEN_START"));
  assert.ok(h.sent.some(({ tabId, message }) =>
    tabId === 7 && message.type === "XFF_START_STATION_SOURCE"));
  assert.ok(h.sent.some(({ tabId, message, options }) =>
    tabId === 11 && message.type === "XFF_STATION_WEBRTC_START" && options.frameId === 5));
  assert.ok(h.tabUpdates.some(({ tabId, options }) => tabId === 11 && options.active));
  assert.ok(h.windowUpdates.some(({ windowId, options }) => windowId === 2 && options.focused));
});

test("Station controls relay to the active X source", async () => {
  const h = await harness();
  await dispatchRuntime(h.runtimeListeners, {
    type: "XFF_STATION_READY", width: 430, height: 260
  }, { tab: { id: 11, windowId: 2 }, frameId: 5 });
  await h.actionListeners[0]({ id: 7, windowId: 1, url: "https://x.com/home" });
  await dispatchRuntime(h.runtimeListeners, {
    type: "XFF_STATION_CONTROL", action: "rewind"
  }, { tab: { id: 11, windowId: 2 }, frameId: 5 });
  assert.ok(h.sent.some(({ tabId, message }) =>
    tabId === 7 && message.type === "XFF_STATION_CONTROL" && message.action === "rewind"));
});

test("Station offer is answered by the private extension media context", async () => {
  const h = await harness();
  const sender = { tab: { id: 11, windowId: 2 }, frameId: 5 };
  await dispatchRuntime(h.runtimeListeners, {
    type: "XFF_STATION_READY", width: 430, height: 260
  }, sender);
  await h.actionListeners[0]({ id: 7, windowId: 1, url: "https://x.com/home" });
  const response = await dispatchRuntime(h.runtimeListeners, {
    type: "XFF_STATION_OFFER",
    offer: { type: "offer", sdp: "fixture-offer" }
  }, sender);

  assert.deepEqual(JSON.parse(JSON.stringify(response)), { ok: true });
  assert.ok(h.runtimeSent.some(({ type, target }) =>
    type === "XFF_OFFSCREEN_OFFER" && target === "station-x-offscreen"));
  assert.ok(h.sent.some(({ tabId, message, options }) =>
    tabId === 11 && message.type === "XFF_STATION_ANSWER" &&
    message.answer.sdp === "fixture-answer" && options.frameId === 5));
});

test("a Station reload reattaches the existing capture without a second user action", async () => {
  const h = await harness();
  const sender = { tab: { id: 11, windowId: 2 }, frameId: 5 };
  await dispatchRuntime(h.runtimeListeners, {
    type: "XFF_STATION_READY", width: 430, height: 260
  }, sender);
  await h.actionListeners[0]({ id: 7, windowId: 1, url: "https://x.com/home" });
  const captureCount = h.captures.length;
  await dispatchRuntime(h.runtimeListeners, {
    type: "XFF_STATION_NOT_READY"
  }, sender);
  await dispatchRuntime(h.runtimeListeners, {
    type: "XFF_STATION_READY", width: 460, height: 280
  }, sender);
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(h.captures.length, captureCount, "reload must not request a new capture gesture");
  assert.ok(h.sent.some(({ tabId, message }) =>
    tabId === 7 && message.type === "XFF_START_STATION_SOURCE" &&
    message.consumer.width === 460 && message.consumer.height === 280));
  assert.ok(h.sent.some(({ tabId, message, options }) =>
    tabId === 11 && message.type === "XFF_STATION_WEBRTC_START" && options.frameId === 5));
  assert.ok(!h.sent.some(({ tabId, message }) =>
    tabId === 7 && message.type === "XFF_STOP_STATION_SOURCE"));
});

test("the X source survives all Station tabs closing and attaches to a later display tab", async () => {
  const h = await harness();
  const first = { tab: { id: 11, windowId: 2 }, frameId: 5 };
  await dispatchRuntime(h.runtimeListeners, {
    type: "XFF_STATION_READY", width: 430, height: 260
  }, first);
  await h.actionListeners[0]({ id: 7, windowId: 1, url: "https://x.com/home" });
  const captureCount = h.captures.length;
  const stopCount = h.runtimeSent.filter(({ type }) => type === "XFF_OFFSCREEN_STOP").length;
  await dispatchRuntime(h.runtimeListeners, { type: "XFF_STATION_NOT_READY" }, first);
  await new Promise((resolve) => setTimeout(resolve, 10));

  assert.equal(h.runtimeSent.filter(({ type }) => type === "XFF_OFFSCREEN_STOP").length, stopCount,
    "closing the Station view must not stop the approved source capture");
  assert.ok(!h.sent.some(({ tabId, message }) =>
    tabId === 7 && message.type === "XFF_STOP_STATION_SOURCE"));

  const second = { tab: { id: 22, windowId: 4 }, frameId: 9 };
  await dispatchRuntime(h.runtimeListeners, {
    type: "XFF_STATION_READY", width: 620, height: 360
  }, second);
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(h.captures.length, captureCount, "a second Station tab must reuse the existing capture");
  assert.ok(h.sent.some(({ tabId, message, options }) =>
    tabId === 22 && message.type === "XFF_STATION_WEBRTC_START" && options.frameId === 9));
});

test("pressing the Station action again reconnects instead of accidentally toggling capture off", async () => {
  const h = await harness();
  await dispatchRuntime(h.runtimeListeners, {
    type: "XFF_STATION_READY", width: 430, height: 260
  }, { tab: { id: 11, windowId: 2 }, frameId: 5 });
  const xTab = { id: 7, windowId: 1, url: "https://x.com/home" };
  await h.actionListeners[0](xTab);
  const stopCount = h.runtimeSent.filter(({ type }) => type === "XFF_OFFSCREEN_STOP").length;
  await h.actionListeners[0](xTab);

  assert.equal(h.captures.length, 1, "reconnect must not request a new stream");
  assert.equal(h.runtimeSent.filter(({ type }) => type === "XFF_OFFSCREEN_STOP").length, stopCount);
  assert.ok(!h.sent.some(({ tabId, message }) =>
    tabId === 7 && message.type === "XFF_STOP_STATION_SOURCE"));
});

test("a restarted Chrome extension worker restores the approved source and Station frame", async () => {
  const h = await harness({
    stationXSessionV1: {
      sourceTabId: 7,
      consumers: [{
        tabId: 11, windowId: 2, frameId: 5,
        width: 430, height: 260, lastSeen: Date.now()
      }]
    }
  });
  await h.actionListeners[0]({ id: 7, windowId: 1, url: "https://x.com/home" });

  assert.equal(h.captures.length, 0, "worker restart must not request another capture gesture");
  assert.ok(h.sent.some(({ tabId, message, options }) =>
    tabId === 11 && message.type === "XFF_STATION_WEBRTC_START" && options.frameId === 5));
  assert.ok(h.tabUpdates.some(({ tabId, options }) => tabId === 11 && options.active));
});
