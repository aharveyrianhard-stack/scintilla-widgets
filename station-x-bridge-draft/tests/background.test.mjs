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
  const badgeTexts = [];
  const runtimeSent = [];
  const offscreenDocuments = [];
  const scriptInjections = [];
  let offscreenReady = false;
  const sessionData = structuredClone(sessionSeed);

  const chrome = {
    action: {
      onClicked: { addListener(fn) { actionListeners.push(fn); } },
      setBadgeBackgroundColor() {},
      setBadgeText(options) { badgeTexts.push(options); }
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
    scripting: { async executeScript(options) { scriptInjections.push(options); } },
    tabCapture: {
      getMediaStreamId(options, callback) {
        captures.push(options);
        callback("fixture-stream-id");
      }
    },
    tabs: {
      onRemoved: { addListener(fn) { removedListeners.push(fn); } },
      async get(tabId) {
        if ((sessionData.__missingTabIds || []).includes(tabId)) {
          throw new Error(`No tab with id: ${tabId}.`);
        }
        return { id: tabId, windowId: 2 };
      },
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
    tabUpdates, windowUpdates, badgeTexts, runtimeSent, offscreenDocuments, sessionData,
    scriptInjections
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

async function reinjectLegacyV079Pane(h, sender) {
  const source = await readFile(new URL("../station-bridge.js", import.meta.url), "utf8");
  const runtimeListeners = [];
  const messageListeners = [];
  const bridgeSent = [];
  const events = [];
  let readyResolve;
  const ready = new Promise((resolve) => { readyResolve = resolve; });
  const paneWindow = {
    __XFF_STATION_BRIDGE_V079__: true,
    location: { origin:"https://station.scintillahub.ai", pathname:"/pane-x" },
    innerWidth: 430,
    innerHeight: 260,
    postMessage(message) { events.push(message); },
    addEventListener(type, listener) {
      if (type === "message") messageListeners.push(listener);
    }
  };
  const chrome = {
    runtime: {
      id: "fixture",
      sendMessage(message) {
        bridgeSent.push(structuredClone(message));
        return dispatchRuntime(h.runtimeListeners, message, sender).then((response) => {
          if (message.type === "XFF_STATION_READY") readyResolve(response);
          return response;
        });
      },
      onMessage: { addListener(fn) { runtimeListeners.push(fn); } }
    }
  };
  const context = vm.createContext({
    window: paneWindow, chrome, crypto: { randomUUID: () => "v080-recovery" },
    Promise, setInterval: () => 1, clearInterval() {}
  });
  vm.runInContext(source, context);
  await ready;
  await new Promise((resolve) => setTimeout(resolve, 0));
  return {
    paneWindow,
    events,
    bridgeSent,
    runtimeListeners,
    async emitPageMessage(data) {
      context.pageMessageData = data;
      const event = vm.runInContext("({ source:window, origin:window.location.origin, data:pageMessageData, stopImmediatePropagation(){} })", context);
      for (const listener of messageListeners) {
        listener(event);
      }
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  };
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

test("Station resize updates the crop without restarting the live transport", async () => {
  const h = await harness();
  const sender = { tab: { id: 11, windowId: 2 }, frameId: 5 };
  await dispatchRuntime(h.runtimeListeners, {
    type: "XFF_STATION_READY", width: 430, height: 260
  }, sender);
  await h.actionListeners[0]({ id: 7, windowId: 1, url: "https://x.com/home" });
  const reconnects = h.sent.filter(({ message }) => message.type === "XFF_STATION_WEBRTC_START").length;

  const response = await dispatchRuntime(h.runtimeListeners, {
    type: "XFF_STATION_RESIZE", width: 900, height: 320
  }, sender);

  assert.deepEqual(JSON.parse(JSON.stringify(response)), { ok: true, connected: true });
  assert.equal(
    h.sent.filter(({ message }) => message.type === "XFF_STATION_WEBRTC_START").length,
    reconnects,
    "a resize must not replace the active peer connection"
  );
  assert.ok(h.sent.some(({ tabId, message }) =>
      tabId === 7 && message.type === "XFF_STATION_CONTROL" &&
      message.action === "resize" && message.value.width === 900 && message.value.height === 320));
});

test("same-frame READY heartbeat renews presence without restarting source or WebRTC", async () => {
  const h = await harness();
  const sender = { tab: { id: 11, windowId: 2 }, frameId: 5 };
  await dispatchRuntime(h.runtimeListeners, {
    type: "XFF_STATION_READY", width: 430, height: 260
  }, sender);
  await h.actionListeners[0]({ id: 7, windowId: 1, url: "https://x.com/home" });

  const sourceStarts = h.sent.filter(({ message }) =>
    message.type === "XFF_START_STATION_SOURCE").length;
  const webRtcStarts = h.sent.filter(({ message }) =>
    message.type === "XFF_STATION_WEBRTC_START").length;

  const response = await dispatchRuntime(h.runtimeListeners, {
    type: "XFF_STATION_READY", width: 430, height: 260
  }, sender);

  assert.deepEqual(JSON.parse(JSON.stringify(response)), { ok: true, connected: true, active: true });
  assert.equal(h.sent.filter(({ message }) =>
    message.type === "XFF_START_STATION_SOURCE").length, sourceStarts);
  assert.equal(h.sent.filter(({ message }) =>
    message.type === "XFF_STATION_WEBRTC_START").length, webRtcStarts);
});

test("a new pane instance reattaches even when Chrome reuses the same frame id", async () => {
  const h = await harness();
  const sender = { tab: { id: 11, windowId: 2 }, frameId: 5 };
  await dispatchRuntime(h.runtimeListeners, {
    type: "XFF_STATION_READY", instanceId: "pane-a", width: 430, height: 260
  }, sender);
  await h.actionListeners[0]({ id: 7, windowId: 1, url: "https://x.com/home" });
  const sourceStarts = h.sent.filter(({ message }) =>
    message.type === "XFF_START_STATION_SOURCE").length;

  await dispatchRuntime(h.runtimeListeners, {
    type: "XFF_STATION_READY", instanceId: "pane-b", width: 460, height: 280
  }, sender);

  assert.equal(h.sent.filter(({ message }) =>
    message.type === "XFF_START_STATION_SOURCE").length, sourceStarts + 1);
  assert.ok(h.sent.some(({ tabId, message, options }) =>
    tabId === 11 && message.type === "XFF_STATION_WEBRTC_START" && options.frameId === 5));
});

test("two Station tabs attach once each and later heartbeats do not compete", async () => {
  const h = await harness();
  const first = { tab: { id: 11, windowId: 2 }, frameId: 5 };
  const second = { tab: { id: 22, windowId: 4 }, frameId: 9 };
  await dispatchRuntime(h.runtimeListeners, {
    type: "XFF_STATION_READY", width: 430, height: 260
  }, first);
  await h.actionListeners[0]({ id: 7, windowId: 1, url: "https://x.com/home" });
  await dispatchRuntime(h.runtimeListeners, {
    type: "XFF_STATION_READY", width: 620, height: 360
  }, second);

  const sourceStarts = h.sent.filter(({ message }) =>
    message.type === "XFF_START_STATION_SOURCE").length;
  const webRtcStarts = h.sent.filter(({ message }) =>
    message.type === "XFF_STATION_WEBRTC_START").length;

  await dispatchRuntime(h.runtimeListeners, {
    type: "XFF_STATION_READY", width: 430, height: 260
  }, first);
  await dispatchRuntime(h.runtimeListeners, {
    type: "XFF_STATION_READY", width: 620, height: 360
  }, second);

  assert.equal(h.sent.filter(({ message }) =>
    message.type === "XFF_START_STATION_SOURCE").length, sourceStarts);
  assert.equal(h.sent.filter(({ message }) =>
    message.type === "XFF_STATION_WEBRTC_START").length, webRtcStarts);
  assert.ok(h.sent.some(({ tabId, message, options }) =>
    tabId === 11 && message.type === "XFF_STATION_STATUS" &&
    message.status === "standby" && options.frameId === 5),
  "the previous Station must keep mirroring when a new display takes control");
});

test("an old Station heartbeat cannot steal control but its mirror may negotiate", async () => {
  const h = await harness();
  const first = { tab: { id: 11, windowId: 2 }, frameId: 5 };
  const display = { tab: { id: 22, windowId: 4 }, frameId: 9 };
  await dispatchRuntime(h.runtimeListeners, {
    type: "XFF_STATION_READY", instanceId: "desk", width: 430, height: 260
  }, first);
  await h.actionListeners[0]({ id: 7, windowId: 1, url: "https://x.com/home" });
  await dispatchRuntime(h.runtimeListeners, {
    type: "XFF_STATION_READY", instanceId: "display", width: 900, height: 520
  }, display);

  await dispatchRuntime(h.runtimeListeners, {
    type: "XFF_STATION_READY", instanceId: "desk", width: 430, height: 260
  }, first);

  const oldOffer = await dispatchRuntime(h.runtimeListeners, {
    type: "XFF_STATION_OFFER", offer: { type: "offer", sdp: "old" }
  }, first);
  const displayOffer = await dispatchRuntime(h.runtimeListeners, {
    type: "XFF_STATION_OFFER", offer: { type: "offer", sdp: "display" }
  }, display);

  assert.deepEqual(JSON.parse(JSON.stringify(oldOffer)), { ok: true });
  assert.deepEqual(JSON.parse(JSON.stringify(displayOffer)), { ok: true });
  const offers = h.runtimeSent.filter(({ type }) => type === "XFF_OFFSCREEN_OFFER");
  assert.ok(offers.some(({ peerId }) => peerId === "11:5:desk"));
  assert.ok(offers.some(({ peerId }) => peerId === "22:9:display"));
});

test("standby Station contributes the clock and a click takes action control", async () => {
  const h = await harness();
  const desk = { tab: { id: 11, windowId: 2 }, frameId: 5 };
  const display = { tab: { id: 22, windowId: 4 }, frameId: 9 };
  await dispatchRuntime(h.runtimeListeners, {
    type: "XFF_STATION_READY", instanceId: "desk", width: 430, height: 260
  }, desk);
  await h.actionListeners[0]({ id: 7, windowId: 1, url: "https://x.com/home" });
  await dispatchRuntime(h.runtimeListeners, {
    type: "XFF_STATION_READY", instanceId: "display", width: 900, height: 520
  }, display);
  const controlsBefore = h.sent.filter(({ message }) =>
    message.type === "XFF_STATION_CONTROL").length;

  const tick = await dispatchRuntime(h.runtimeListeners, {
    type: "XFF_STATION_CONTROL", instanceId: "desk", action: "tick", value: { at: 1000 }
  }, desk);
  const control = await dispatchRuntime(h.runtimeListeners, {
    type: "XFF_STATION_CONTROL", instanceId: "desk", action: "refresh"
  }, desk);
  const resize = await dispatchRuntime(h.runtimeListeners, {
    type: "XFF_STATION_RESIZE", instanceId: "desk", width: 300, height: 200
  }, desk);

  assert.deepEqual(JSON.parse(JSON.stringify(tick)), { ok: true });
  assert.deepEqual(JSON.parse(JSON.stringify(control)), {
    ok: true, active: true
  });
  assert.deepEqual(JSON.parse(JSON.stringify(resize)), {
    ok: true, connected: true
  });
  const controlsAfter = h.sent.filter(({ message }) =>
    message.type === "XFF_STATION_CONTROL");
  assert.equal(controlsAfter.length, controlsBefore + 3);
  assert.deepEqual(
    controlsAfter.slice(-3).map(({ message }) => message.action),
    ["tick", "refresh", "resize"]
  );
  assert.equal(h.sessionData.stationXSessionV1.activeConsumerKey, "11:5:desk");
});

test("simultaneous Station clocks are deduplicated without slowing a surviving mirror", async () => {
  const h = await harness();
  const desk = { tab: { id: 11, windowId: 2 }, frameId: 5 };
  const display = { tab: { id: 22, windowId: 4 }, frameId: 9 };
  await dispatchRuntime(h.runtimeListeners, {
    type: "XFF_STATION_READY", instanceId: "desk", width: 430, height: 260
  }, desk);
  await h.actionListeners[0]({ id: 7, windowId: 1, url: "https://x.com/home" });
  await dispatchRuntime(h.runtimeListeners, {
    type: "XFF_STATION_READY", instanceId: "display", width: 900, height: 520
  }, display);
  const before = h.sent.filter(({ message }) =>
    message.type === "XFF_STATION_CONTROL" && message.action === "tick").length;

  const first = await dispatchRuntime(h.runtimeListeners, {
    type: "XFF_STATION_CONTROL", instanceId: "desk", action: "tick", value: { at: 1000 }
  }, desk);
  const duplicate = await dispatchRuntime(h.runtimeListeners, {
    type: "XFF_STATION_CONTROL", instanceId: "display", action: "tick", value: { at: 1010 }
  }, display);
  const next = await dispatchRuntime(h.runtimeListeners, {
    type: "XFF_STATION_CONTROL", instanceId: "desk", action: "tick", value: { at: 1017 }
  }, desk);

  assert.deepEqual(JSON.parse(JSON.stringify(first)), { ok: true });
  assert.deepEqual(JSON.parse(JSON.stringify(duplicate)), { ok: true, deduplicated: true });
  assert.deepEqual(JSON.parse(JSON.stringify(next)), { ok: true });
  const ticks = h.sent.filter(({ message }) =>
    message.type === "XFF_STATION_CONTROL" && message.action === "tick");
  assert.equal(ticks.length, before + 2);
  assert.deepEqual(ticks.slice(-2).map(({ message }) => message.value.at), [1000, 1017]);
});

test("a standby Station reattaches after the active display closes", async () => {
  const h = await harness();
  const desk = { tab: { id: 11, windowId: 2 }, frameId: 5 };
  const display = { tab: { id: 22, windowId: 4 }, frameId: 9 };
  await dispatchRuntime(h.runtimeListeners, {
    type: "XFF_STATION_READY", instanceId: "desk", width: 430, height: 260
  }, desk);
  await h.actionListeners[0]({ id: 7, windowId: 1, url: "https://x.com/home" });
  await dispatchRuntime(h.runtimeListeners, {
    type: "XFF_STATION_READY", instanceId: "display", width: 900, height: 520
  }, display);
  const starts = h.sent.filter(({ message }) =>
    message.type === "XFF_STATION_WEBRTC_START").length;

  await dispatchRuntime(h.runtimeListeners, {
    type: "XFF_STATION_NOT_READY", instanceId: "display"
  }, display);
  await dispatchRuntime(h.runtimeListeners, {
    type: "XFF_STATION_READY", instanceId: "desk", width: 430, height: 260
  }, desk);

  assert.equal(h.sent.filter(({ message }) =>
    message.type === "XFF_STATION_WEBRTC_START").length, starts + 1);
  assert.ok(h.sent.some(({ tabId, message, options }) =>
    tabId === 11 && message.type === "XFF_STATION_WEBRTC_START" && options.frameId === 5));
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
  assert.ok(h.runtimeSent.some(({ type, target, peerId }) =>
    type === "XFF_OFFSCREEN_OFFER" && target === "station-x-offscreen" &&
    peerId === "11:5:"));
  assert.ok(h.sent.some(({ tabId, message, options }) =>
    tabId === 11 && message.type === "XFF_STATION_ANSWER" &&
    message.answer.sdp === "fixture-answer" && options.frameId === 5));
});

test("one source crop is broadcast to every connected Station mirror", async () => {
  const h = await harness();
  const desk = { tab: { id: 11, windowId: 2 }, frameId: 5 };
  const display = { tab: { id: 22, windowId: 4 }, frameId: 9 };
  await dispatchRuntime(h.runtimeListeners, {
    type: "XFF_STATION_READY", instanceId: "desk", width: 430, height: 260
  }, desk);
  await h.actionListeners[0]({ id: 7, windowId: 1, url: "https://x.com/home" });
  await dispatchRuntime(h.runtimeListeners, {
    type: "XFF_STATION_READY", instanceId: "display", width: 900, height: 520
  }, display);

  await dispatchRuntime(h.runtimeListeners, {
    type: "XFF_STATION_CROP", crop: { activeView: "trading", rect: { width: 430 }, captureGeneration: 12, sequence: 44 }
  }, { tab: { id: 7, windowId: 1 }, frameId: 0 });
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.ok(h.sent.some(({ tabId, message }) =>
    tabId === 11 && message.type === "XFF_STATION_CROP"));
  assert.ok(h.sent.some(({ tabId, message }) =>
    tabId === 22 && message.type === "XFF_STATION_CROP"));
  const relayed = h.sent.find(({ tabId, message }) => tabId === 11 && message.type === "XFF_STATION_CROP");
  assert.equal(relayed.message.crop.captureGeneration, 12);
  assert.equal(relayed.message.crop.sequence, 44);
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

test("a V079 pane reinjected after a background reload reannounces before the next X action", async () => {
  const h = await harness({
    stationXSessionV1: { sourceTabId: 7, activeConsumerKey: null, consumers: [] }
  });
  const sender = {
    tab: { id: 11, windowId: 2, url: "https://station.scintillahub.ai/" },
    frameId: 5,
    url: "https://station.scintillahub.ai/pane-x"
  };
  const pane = await reinjectLegacyV079Pane(h, sender);

  assert.ok(pane.paneWindow.__XFF_STATION_BRIDGE_V080__, "the new receiver must recover a V079-marked page");
  assert.ok(pane.events.some(({ type }) => type === "XFF_STATION_BRIDGE_READY"));

  await h.actionListeners[0]({ id: 7, windowId: 1, url: "https://x.com/home" });

  assert.ok(h.sent.some(({ tabId, message }) =>
    tabId === 7 && message.type === "XFF_START_STATION_SOURCE"),
  "the next existing X action must reattach the source");
  assert.ok(!h.badgeTexts.some(({ text }) => text === "WAIT"),
  "a recovered receiver must prevent the offline WAIT path");
});

test("a stale pane generation requests reannounce without creating a remote peer", async () => {
  const h = await harness();
  const sender = { tab: { id: 11, windowId: 2 }, frameId: 5 };
  await dispatchRuntime(h.runtimeListeners, {
    type: "XFF_STATION_READY", instanceId: "pane-current", width: 430, height: 260
  }, sender);
  const offersBefore = h.runtimeSent.filter(({ type }) => type === "XFF_OFFSCREEN_OFFER").length;

  const response = await dispatchRuntime(h.runtimeListeners, {
    type: "XFF_STATION_REMOTE_OFFER",
    instanceId: "pane-stale",
    pairId: "a".repeat(32),
    viewerId: "b".repeat(24),
    receiverGeneration: "c".repeat(24),
    offer: { type: "offer", sdp: "stale-offer" }
  }, sender);

  assert.deepEqual(JSON.parse(JSON.stringify(response)), {
    retryable: true,
    code: "STATION_RECEIVER_REANNOUNCING",
    error: "The Station receiver is reannouncing."
  });
  assert.equal(h.runtimeSent.filter(({ type }) => type === "XFF_OFFSCREEN_OFFER").length, offersBefore);
});

test("V080 reannounce accepts the same Viewer A offer for exactly one generation", async () => {
  const h = await harness();
  const sender = {
    tab: { id: 11, windowId: 2, url: "https://station.scintillahub.ai/" },
    frameId: 5,
    url: "https://station.scintillahub.ai/pane-x"
  };
  const pane = await reinjectLegacyV079Pane(h, sender);
  const pairId = "a".repeat(32);
  const viewerId = "b".repeat(24);
  const receiverGeneration = "c".repeat(24);

  await pane.emitPageMessage({
    type: "XFF_STATION_REMOTE_OFFER",
    pairId,
    viewerId,
    receiverGeneration,
    offer: { type: "offer", sdp: "viewer-a-offer" }
  });

  const offers = h.runtimeSent.filter(({ type }) => type === "XFF_OFFSCREEN_OFFER");
  assert.equal(offers.length, 1);
  assert.equal(offers[0].peerId, "ipad:" + pairId + ":" + viewerId);
  const relayed = h.sent.find(({ message }) =>
    message.type === "XFF_STATION_REMOTE_ANSWER" && message.viewerId === viewerId);
  assert.equal(relayed.message.instanceId, "v080-recovery");
  assert.equal(relayed.message.receiverGeneration, receiverGeneration);

  for (const listener of pane.runtimeListeners) listener(relayed.message);
  assert.ok(pane.events.some((event) =>
    event.type === "XFF_STATION_REMOTE_ANSWER" &&
    event.instanceId === "v080-recovery" && event.viewerId === viewerId));
});

test("worker restore prunes closed source and consumer tabs", async () => {
  const h = await harness({
    __missingTabIds: [7, 22],
    stationXSessionV1: {
      sourceTabId: 7,
      activeConsumerKey: "22:9:closed",
      consumers: [
        { tabId: 11, windowId: 2, frameId: 5, instanceId: "open", width: 430, height: 260, lastSeen: Date.now() },
        { tabId: 22, windowId: 4, frameId: 9, instanceId: "closed", width: 900, height: 520, lastSeen: Date.now() }
      ]
    }
  });
  await new Promise((resolve) => setTimeout(resolve, 0));

  const saved = h.sessionData.stationXSessionV1;
  assert.equal(saved.sourceTabId, null);
  assert.equal(saved.activeConsumerKey, null);
  assert.deepEqual(saved.consumers.map(({ tabId }) => tabId), [11]);
});

test("one iPad pair fans out to distinct viewer peers without restarting X capture", async () => {
  const h = await harness();
  const station = { tab: { id: 11, windowId: 2 }, frameId: 5 };
  await dispatchRuntime(h.runtimeListeners, {
    type: "XFF_STATION_READY", instanceId: "pane", width: 430, height: 260
  }, station);
  await h.actionListeners[0]({ id: 7, windowId: 1, url: "https://x.com/home" });
  const captures = h.captures.length;
  const pairId = "a".repeat(32);
  const firstViewer = "b".repeat(24);
  const secondViewer = "c".repeat(24);

  for (const viewerId of [firstViewer, secondViewer, firstViewer]) {
    const response = await dispatchRuntime(h.runtimeListeners, {
      type: "XFF_STATION_REMOTE_OFFER",
      instanceId: "pane",
      pairId,
      viewerId,
      receiverGeneration: viewerId === firstViewer ? "d".repeat(24) : "e".repeat(24),
      offer: { type: "offer", sdp: "fixture-offer-" + viewerId }
    }, station);
    assert.deepEqual(JSON.parse(JSON.stringify(response)), { ok: true });
  }

  assert.equal(h.captures.length, captures, "fan-out must reuse the one approved X capture");
  const peers = h.runtimeSent
    .filter((message) => message.type === "XFF_OFFSCREEN_OFFER")
    .map((message) => message.peerId);
  assert.ok(peers.includes("ipad:" + pairId + ":" + firstViewer));
  assert.ok(peers.includes("ipad:" + pairId + ":" + secondViewer));
  assert.equal(new Set(peers).size, 2, "a viewer reload replaces only its own peer key");
  assert.ok(h.sent.filter(({ message }) => message.type === "XFF_STATION_REMOTE_ANSWER").every(({ message }) =>
    [firstViewer, secondViewer].includes(message.viewerId)));
});

test("Viewer A refresh renews its peer generation and a late old drop cannot evict it", async () => {
  const h = await harness();
  const station = { tab: { id: 11, windowId: 2 }, frameId: 5 };
  await dispatchRuntime(h.runtimeListeners, {
    type: "XFF_STATION_READY", instanceId: "pane", width: 430, height: 260
  }, station);
  const pairId = "a".repeat(32);
  const viewerA = "b".repeat(24);
  const viewerB = "c".repeat(24);

  const oldGeneration = "d".repeat(24);
  const newGeneration = "e".repeat(24);
  const viewerBGeneration = "f".repeat(24);
  for (const [viewerId, receiverGeneration] of [
    [viewerA, oldGeneration],
    [viewerB, viewerBGeneration],
    [viewerA, newGeneration]
  ]) {
    await dispatchRuntime(h.runtimeListeners, {
      type: "XFF_STATION_REMOTE_OFFER",
      instanceId: "pane",
      pairId,
      viewerId,
      receiverGeneration,
      offer: { type: "offer", sdp: "offer-" + viewerId }
    }, station);
  }
  const answers = h.sent.filter(({ message }) => message.type === "XFF_STATION_REMOTE_ANSWER");
  assert.equal(answers.at(-1).message.viewerId, viewerA);
  assert.equal(answers.at(-1).message.receiverGeneration, newGeneration,
    "the renewed offer must receive an answer for the refreshed receiver document");

  const oldDrop = await dispatchRuntime(h.runtimeListeners, {
    type: "XFF_STATION_REMOTE_DROP",
    instanceId: "pane",
    pairId,
    viewerId: viewerA,
    receiverGeneration: oldGeneration
  }, station);
  assert.deepEqual(JSON.parse(JSON.stringify(oldDrop)), { ok: true, stale: true });
  assert.equal(h.runtimeSent.filter(({ type }) => type === "XFF_OFFSCREEN_DROP").length, 0,
    "a pagehide from the old receiver must not drop the refreshed peer");

  const drop = await dispatchRuntime(h.runtimeListeners, {
    type: "XFF_STATION_REMOTE_DROP",
    instanceId: "pane",
    pairId,
    viewerId: viewerA,
    receiverGeneration: newGeneration
  }, station);

  assert.deepEqual(JSON.parse(JSON.stringify(drop)), { ok: true });
  const drops = h.runtimeSent.filter(({ type }) => type === "XFF_OFFSCREEN_DROP");
  assert.deepEqual(drops.map(({ peerId }) => peerId), ["ipad:" + pairId + ":" + viewerA]);
  assert.ok(h.runtimeSent.some(({ type, peerId }) =>
    type === "XFF_OFFSCREEN_OFFER" && peerId === "ipad:" + pairId + ":" + viewerB));
});

test("only a new offscreen capture frame releases the current source scroll generation", async () => {
  const h = await harness();
  const station = { tab: { id: 11, windowId: 2 }, frameId: 5 };
  await dispatchRuntime(h.runtimeListeners, {
    type: "XFF_STATION_READY", instanceId: "pane", width: 430, height: 260
  }, station);
  await h.actionListeners[0]({ id: 7, windowId: 1, url: "https://x.com/home" });
  const source = { tab: { id: 7, windowId: 1 }, frameId: 0 };

  await dispatchRuntime(h.runtimeListeners, {
    type: "XFF_STATION_SCROLL_GENERATION", generation: 12
  }, source);
  assert.ok(h.runtimeSent.some(({ type, generation }) =>
    type === "XFF_OFFSCREEN_WAIT_CAPTURE_FRAME" && generation === 12));

  await dispatchRuntime(h.runtimeListeners, {
    type: "XFF_STATION_CAPTURE_FRAME", generation: 11
  }, {});
  assert.equal(h.sent.filter(({ message }) => message.type === "XFF_STATION_CAPTURE_FRAME").length, 0,
    "an older decoded capture frame cannot release a newer crop offset");

  await dispatchRuntime(h.runtimeListeners, {
    type: "XFF_STATION_CAPTURE_FRAME", generation: 12
  }, {});
  const acknowledgements = h.sent.filter(({ tabId, message }) =>
    tabId === 7 && message.type === "XFF_STATION_CAPTURE_FRAME");
  assert.deepEqual(acknowledgements.map(({ message }) => message.generation), [12]);
});

test("an explicit preview click injects only the Station bridge into that preview tab", async () => {
  const h = await harness();
  await h.actionListeners[0]({
    id: 11,
    windowId: 2,
    url: "https://scintilla-widgets-git-review-aharveyrianhard-8432s-projects.vercel.app/deck/"
  });
  assert.deepEqual(JSON.parse(JSON.stringify(h.scriptInjections)), [{
    target: { tabId: 11, allFrames: true },
    files: ["station-bridge.js"]
  }]);
});
