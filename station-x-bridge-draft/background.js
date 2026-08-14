const SUPPORTED_HOSTS = new Set(["x.com", "www.x.com", "twitter.com", "www.twitter.com"]);
const stationConsumers = new Map();
const remoteViewerGenerations = new Map();
let stationSourceTabId = null;
let stationActiveConsumerKey = null;
let stationLastTickForwardedAt = 0;
let stationLastCaptureFrameGeneration = 0;
let stationPendingCaptureGeneration = 0;
/* The elected visible pane owns the motion clock.  Keep duplicate-window
   suppression below one display frame so it never converts a 60Hz source
   crawl back into visible 30/10Hz steps. */
const STATION_TICK_MIN_INTERVAL_MS = 12;
const STATION_SESSION_KEY = "stationXSessionV1";

function stationConsumerKey(consumer) {
  if (!consumer) return "";
  return [consumer.tabId, consumer.frameId, String(consumer.instanceId || "")].join(":");
}

async function restoreStationSession() {
  try {
    const box = await chrome.storage.session.get(STATION_SESSION_KEY);
    const saved = box?.[STATION_SESSION_KEY];
    if (!saved) return;
    if (Number.isInteger(saved.sourceTabId)) {
      try {
        await chrome.tabs.get(saved.sourceTabId);
        stationSourceTabId = saved.sourceTabId;
      } catch {
        stationSourceTabId = null;
      }
    }
    if (typeof saved.activeConsumerKey === "string") {
      stationActiveConsumerKey = saved.activeConsumerKey;
    }
    for (const entry of saved.consumers || []) {
      if (Number.isInteger(entry?.tabId) && Number.isInteger(entry?.frameId)) {
        try {
          await chrome.tabs.get(entry.tabId);
          stationConsumers.set(entry.tabId, entry);
        } catch {}
      }
    }
    if (![...stationConsumers.values()].some((entry) =>
      stationConsumerKey(entry) === stationActiveConsumerKey)) {
      stationActiveConsumerKey = null;
    }
    await chrome.storage.session.set({
      [STATION_SESSION_KEY]: {
        sourceTabId: Number.isInteger(stationSourceTabId) ? stationSourceTabId : null,
        activeConsumerKey: stationActiveConsumerKey,
        consumers: [...stationConsumers.values()]
      }
    });
  } catch {}
}

async function persistStationSession() {
  try {
    await chrome.storage.session.set({
      [STATION_SESSION_KEY]: {
        sourceTabId: Number.isInteger(stationSourceTabId) ? stationSourceTabId : null,
        activeConsumerKey: stationActiveConsumerKey,
        consumers: [...stationConsumers.values()]
      }
    });
  } catch {}
}

function isMissingTabError(error) {
  return /No tab with id/i.test(String(error?.message || error || ""));
}

async function discardStationConsumer(consumer) {
  if (!consumer) return false;
  const current = stationConsumers.get(consumer.tabId);
  // A new pane may already have reannounced in the same tab.  Never remove it
  // because an old frame's asynchronous send completed late.
  if (stationConsumerKey(current) !== stationConsumerKey(consumer)) return false;
  dropStationPeer(consumer);
  stationConsumers.delete(consumer.tabId);
  if (stationConsumerKey(consumer) === stationActiveConsumerKey) {
    stationActiveConsumerKey = null;
  }
  await persistStationSession();
  return true;
}

async function pruneClosedStationConsumers() {
  let changed = false;
  for (const consumer of [...stationConsumers.values()]) {
    try {
      await chrome.tabs.get(consumer.tabId);
    } catch (error) {
      if (isMissingTabError(error)) {
        changed = (await discardStationConsumer(consumer)) || changed;
      }
    }
  }
  return changed;
}

async function reannounceOpenStationPanes() {
  const stationTabs = await chrome.tabs.query({
    url: ["https://station.scintillahub.ai/*"]
  });
  await Promise.allSettled(stationTabs.map((tab) =>
    chrome.scripting.executeScript({
      target: { tabId: tab.id, allFrames: true },
      files: ["station-bridge.js"]
    })
  ));
  // station-bridge.js immediately sends READY.  Yield one short task so this
  // user-gesture click can reuse the current Station pane instead of a closed
  // session-restored tab.
  await new Promise((resolve) => setTimeout(resolve, 120));
}

async function currentStationSourceTab() {
  if (!Number.isInteger(stationSourceTabId)) return null;
  try {
    return await chrome.tabs.get(stationSourceTabId);
  } catch (error) {
    if (isMissingTabError(error)) {
      stationSourceTabId = null;
      await persistStationSession();
      return null;
    }
    throw error;
  }
}

const stationRestore = restoreStationSession();

function activeStationConsumer() {
  return [...stationConsumers.values()].find((entry) =>
    stationConsumerKey(entry) === stationActiveConsumerKey &&
    Date.now() - entry.lastSeen < 10 * 60 * 1000
  ) || null;
}

function freshestStationConsumer() {
  const fresh = freshStationConsumers();
  const active = activeStationConsumer();
  if (active) return active;
  const fallback = fresh[0] || null;
  stationActiveConsumerKey = stationConsumerKey(fallback) || null;
  return fallback;
}

function freshStationConsumers() {
  return [...stationConsumers.values()]
    .filter((entry) => Date.now() - entry.lastSeen < 10 * 60 * 1000)
    .sort((a, b) => b.lastSeen - a.lastSeen);
}

async function activateStationConsumer(consumer) {
  if (!consumer) return;
  const nextKey = stationConsumerKey(consumer);
  if (nextKey === stationActiveConsumerKey) return;
  const previous = activeStationConsumer();
  stationActiveConsumerKey = nextKey;
  await persistStationSession();
  if (previous && stationConsumerKey(previous) !== nextKey) {
    try {
      await sendToStation(previous, {
        type: "XFF_STATION_STATUS",
        status: "standby",
        detail: "Mirroring the active Station display."
      });
    } catch {}
  }
}

async function broadcastToStations(message) {
  const targets = [...stationConsumers.values()].filter((entry) =>
    Date.now() - entry.lastSeen < 10 * 60 * 1000
  );
  await Promise.allSettled(targets.map((consumer) => sendToStation(consumer, message)));
}

function dropStationPeer(consumer) {
  const peerId = stationConsumerKey(consumer);
  if (!peerId) return;
  chrome.runtime.sendMessage({
    target: "station-x-offscreen",
    type: "XFF_OFFSCREEN_DROP",
    peerId
  }).catch(() => {});
}

function sendToStation(consumer, message) {
  if (!consumer) return Promise.resolve();
  return chrome.tabs.sendMessage(consumer.tabId, message, {
    frameId: consumer.frameId
  }).catch(async (error) => {
    if (isMissingTabError(error)) {
      await discardStationConsumer(consumer);
      return { ok: false, stale: true };
    }
    throw error;
  });
}

async function ensureOffscreenDocument() {
  const documentUrl = chrome.runtime.getURL("offscreen.html");
  const contexts = chrome.runtime.getContexts
    ? await chrome.runtime.getContexts({
        contextTypes: ["OFFSCREEN_DOCUMENT"],
        documentUrls: [documentUrl]
      })
    : [];
  if (contexts.length) return;
  if (chrome.offscreen.hasDocument && await chrome.offscreen.hasDocument()) return;
  await chrome.offscreen.createDocument({
    url: "offscreen.html",
    reasons: ["USER_MEDIA"],
    justification: "Consume the user-invoked X tab capture for the Station X pane."
  });
}

async function hasLiveStationCapture() {
  try {
    const documentUrl = chrome.runtime.getURL("offscreen.html");
    const contexts = chrome.runtime.getContexts
      ? await chrome.runtime.getContexts({
          contextTypes: ["OFFSCREEN_DOCUMENT"],
          documentUrls: [documentUrl]
        })
      : [];
    if (contexts.length) return true;
    if (chrome.offscreen.hasDocument) return await chrome.offscreen.hasDocument();
  } catch {}
  return false;
}

function captureStreamId(sourceTabId) {
  return new Promise((resolve, reject) => {
    chrome.tabCapture.getMediaStreamId(
      { targetTabId: sourceTabId },
      (streamId) => {
        const error = chrome.runtime.lastError;
        if (error || !streamId) {
          reject(new Error(error?.message || "Chrome did not return a Station stream."));
          return;
        }
        resolve(streamId);
      }
    );
  });
}

async function stopStationCapture(detail = "stopped") {
  try {
    await chrome.runtime.sendMessage({
      target: "station-x-offscreen",
      type: "XFF_OFFSCREEN_STOP"
    });
  } catch {}
  if (stationSourceTabId) {
    try {
      await chrome.tabs.sendMessage(stationSourceTabId, {
        type: "XFF_STOP_STATION_SOURCE"
      });
    } catch {}
    try {
      await chrome.action.setBadgeText({ tabId: stationSourceTabId, text: "" });
    } catch {}
  }
  await broadcastToStations({
    type: "XFF_STATION_STATUS",
    status: "stopped",
    detail
  });
  stationSourceTabId = null;
  remoteViewerGenerations.clear();
  stationLastTickForwardedAt = 0;
  stationLastCaptureFrameGeneration = 0;
  stationPendingCaptureGeneration = 0;
  await persistStationSession();
}

async function reconnectStationConsumer(consumer, { controlSource = false } = {}) {
  if (!consumer) return false;
  const sourceTab = await currentStationSourceTab();
  if (!sourceTab) return false;
  const sourceTabId = sourceTab.id;
  if (controlSource) {
    await ensureContentScript(sourceTabId);
    await chrome.tabs.sendMessage(sourceTabId, {
      type: "XFF_START_STATION_SOURCE",
      consumer: { width: consumer.width, height: consumer.height }
    });
  }
  await sendToStation(consumer, {
    type: "XFF_STATION_WEBRTC_START",
    sourceTabId
  });
  await sendToStation(consumer, {
    type: "XFF_STATION_STATUS",
    status: "connecting",
    detail: controlSource
      ? "Station X reattached after reload."
      : "Station X mirror attached."
  });
  return true;
}

async function reconnectStationConsumers({ controlSource = false } = {}) {
  const sourceTab = await currentStationSourceTab();
  const consumers = freshStationConsumers();
  if (!sourceTab || !consumers.length) return false;

  // One receiver supplies the shared source geometry, but every fresh Station
  // pane is a peer display. Starting or reconnecting the source must never
  // choose one display by focusing it or leave the other open displays offline.
  const controller = activeStationConsumer() || consumers[0];
  if (controlSource) {
    await ensureContentScript(sourceTab.id);
    await chrome.tabs.sendMessage(sourceTab.id, {
      type: "XFF_START_STATION_SOURCE",
      consumer: { width: controller.width, height: controller.height }
    });
  }

  await Promise.allSettled(consumers.flatMap((entry) => [
    sendToStation(entry, {
      type: "XFF_STATION_WEBRTC_START",
      sourceTabId: sourceTab.id
    }),
    sendToStation(entry, {
      type: "XFF_STATION_STATUS",
      status: "connecting",
      detail: "Shared X source attached."
    })
  ]));
  return true;
}

async function startStationCapture(sourceTab, consumer, { forceNewCapture = false } = {}) {
  if (!sourceTab?.id || !consumer) return false;
  await activateStationConsumer(consumer);
  const replacingCurrentSource = stationSourceTabId === sourceTab.id;
  if (replacingCurrentSource) {
    if (!forceNewCapture && await hasLiveStationCapture()) {
      await reconnectStationConsumers({ controlSource: true });
      return true;
    }
  }

  // An explicit toolbar click on the already-selected X tab is a recovery
  // gesture.  The offscreen document can still exist while Chrome has left
  // its tab-capture video black; a fresh user-authorized capture is the one
  // reliable way to replace that dead decoder without opening another X tab.
  // This is deliberately one stop/restart sequence, including after a full
  // Bridge reload where the saved tab id survives but its capture does not.
  const captureRecoveryDetail = replacingCurrentSource && forceNewCapture
    ? "Station capture refreshed from the existing X tab."
    : replacingCurrentSource
      ? "Station capture restored after Bridge reload."
      : "Switching X source…";
  await stopStationCapture(captureRecoveryDetail);
  await ensureOffscreenDocument();
  const streamId = await captureStreamId(sourceTab.id);
  const capture = await chrome.runtime.sendMessage({
    target: "station-x-offscreen",
    type: "XFF_OFFSCREEN_START",
    streamId
  });
  if (!capture?.ok) {
    throw new Error(capture?.error || "The Station X capture could not start.");
  }
  stationSourceTabId = sourceTab.id;
  await persistStationSession();
  await reconnectStationConsumers({ controlSource: true });

  chrome.action.setBadgeBackgroundColor({ tabId: sourceTab.id, color: "#00d4ff" });
  chrome.action.setBadgeText({ tabId: sourceTab.id, text: "STN" });
  return true;
}

function isSupportedUrl(url) {
  try {
    return SUPPORTED_HOSTS.has(new URL(url).hostname);
  } catch {
    return false;
  }
}

// Protected previews are intentionally not permanent extension hosts. An
// explicit toolbar click grants activeTab for the exact review tab only, which
// is enough to inject the Station pane bridge without widening permissions.
function isStationPageUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" &&
      (parsed.hostname === "station.scintillahub.ai" || parsed.hostname.endsWith(".vercel.app"));
  } catch {
    return false;
  }
}

function remoteViewerPeerId(pairId, viewerId) {
  return "ipad:" + pairId + ":" + viewerId;
}

function receiverReannouncing() {
  return {
    retryable: true,
    code: "STATION_RECEIVER_REANNOUNCING",
    error: "The Station receiver is reannouncing."
  };
}

function exactStationGeneration(consumer, sender, message) {
  const instanceId = String(message?.instanceId || "");
  return Boolean(consumer && instanceId &&
    (sender.frameId || 0) === consumer.frameId &&
    instanceId === String(consumer.instanceId || ""));
}

async function ensureContentScript(tabId) {
  try {
    await chrome.tabs.sendMessage(tabId, { type: "XFF_PING" });
  } catch {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["content.js"]
    });
  }
}

async function sendToTab(tab, message) {
  if (!tab?.id || !isSupportedUrl(tab.url)) {
    return;
  }

  await ensureContentScript(tab.id);
  await chrome.tabs.sendMessage(tab.id, message);
}

async function triggerViewerFromUserGesture(tab) {
  if (!tab?.id || !isSupportedUrl(tab.url)) {
    return;
  }

  // Inject both files in one action-owned gesture. This repairs tabs that were
  // already open when the unpacked extension was reloaded, while preserving the
  // user activation Document PiP requires.
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ["content.js", "launch.js"]
  });
}

async function focusOrOpenX() {
  const matches = await chrome.tabs.query({
    url: [
      "https://x.com/*",
      "https://www.x.com/*",
      "https://twitter.com/*",
      "https://www.twitter.com/*"
    ]
  });
  const tab = matches.sort(
    (a, b) => Number(b.lastAccessed || 0) - Number(a.lastAccessed || 0)
  )[0] || await chrome.tabs.create({ url: "https://x.com/home" });

  await chrome.tabs.update(tab.id, { active: true });
  await chrome.windows.update(tab.windowId, { state: "normal", focused: true });
  chrome.action.setBadgeBackgroundColor({ tabId: tab.id, color: "#1d9bf0" });
  chrome.action.setBadgeText({ tabId: tab.id, text: "GO" });
  setTimeout(() => {
    chrome.action.setBadgeText({ tabId: tab.id, text: "" });
  }, 4500);
}

chrome.action.onClicked.addListener(async (tab) => {
  try {
    await stationRestore;
    if (isStationPageUrl(tab?.url)) {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id, allFrames: true },
        files: ["station-bridge.js"]
      });
      return;
    }
    if (!isSupportedUrl(tab?.url)) {
      // Chrome requires the capture/PiP gesture on the actual X tab. The first
      // click brings the most recent X tab forward; the next click opens PiP.
      await focusOrOpenX();
      return;
    }
    await pruneClosedStationConsumers();
    let station = freshestStationConsumer();
    if (!station) {
      await reannounceOpenStationPanes();
      station = freshestStationConsumer();
    }
    if (station) {
      await startStationCapture(tab, station, { forceNewCapture: true });
      return;
    }
    chrome.action.setBadgeBackgroundColor({ tabId: tab.id, color: "#947e55" });
    chrome.action.setBadgeText({ tabId: tab.id, text: "WAIT" });
    setTimeout(() => {
      chrome.action.setBadgeText({ tabId: tab.id, text: "" });
    }, 4500);
  } catch (error) {
    console.error("SCINTILLA Station X Bridge could not connect:", error);
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "XFF_STATION_READY") {
    const tabId = sender.tab?.id;
    if (!Number.isInteger(tabId)) {
      sendResponse({ ok: false, error: "No Station tab was available." });
      return;
    }
    (async () => {
      await stationRestore;
      const frameId = sender.frameId || 0;
      const previous = stationConsumers.get(tabId);
      const activeBefore = activeStationConsumer();
      const instanceId = String(message.instanceId || "");
      const sameFrame = previous?.frameId === frameId &&
        String(previous?.instanceId || "") === instanceId;
      stationConsumers.set(tabId, {
        tabId,
        windowId: sender.tab.windowId,
        frameId,
        instanceId,
        width: Math.max(1, Number(message.width) || 1),
        height: Math.max(1, Number(message.height) || 1),
        lastSeen: Date.now()
      });
      const consumer = stationConsumers.get(tabId);
      if (!sameFrame || !activeBefore) {
        await activateStationConsumer(consumer);
      } else {
        await persistStationSession();
      }
      // READY is also the pane's 30-second liveness heartbeat. Reconnecting an
      // already-known frame restarted startStationSource(), which realigned the
      // X page and repeatedly pulled the feed back to the same post. Only a new
      // or reloaded frame needs the WebRTC/source reattachment path.
      if (stationSourceTabId && stationConsumerKey(consumer) === stationActiveConsumerKey &&
          (!sameFrame || !activeBefore)) {
        await reconnectStationConsumer(consumer, { controlSource: true });
      } else if (stationSourceTabId && !sameFrame) {
        await reconnectStationConsumer(consumer, { controlSource: false });
      }
      sendResponse({
        ok: true,
        connected: Boolean(stationSourceTabId),
        active: stationConsumerKey(consumer) === stationActiveConsumerKey
      });
    })().catch((error) => {
      sendResponse({ ok: false, error: error?.message || "Station X could not register this pane." });
    });
    return true;
  }

  if (message?.type === "XFF_STATION_NOT_READY") {
    const tabId = sender.tab?.id;
    const current = stationConsumers.get(tabId);
    const sameInstance = !message.instanceId ||
      String(current?.instanceId || "") === String(message.instanceId);
    if (current && current.frameId === (sender.frameId || 0) && sameInstance) {
      dropStationPeer(current);
      if (stationConsumerKey(current) === stationActiveConsumerKey) {
        stationActiveConsumerKey = null;
      }
      stationConsumers.delete(tabId);
      persistStationSession().catch(() => {});
    }
    sendResponse({ ok: true });
    return;
  }

  if (message?.type === "XFF_STATION_RESIZE") {
    const tabId = sender.tab?.id;
    const current = stationConsumers.get(tabId);
    const sameInstance = !message.instanceId ||
      String(current?.instanceId || "") === String(message.instanceId);
    if (!current || current.frameId !== (sender.frameId || 0) || !sameInstance) {
      sendResponse({ ok: false, error: "The Station pane was not recognized." });
      return;
    }
    current.width = Math.max(1, Number(message.width) || current.width || 1);
    current.height = Math.max(1, Number(message.height) || current.height || 1);
    current.lastSeen = Date.now();
    persistStationSession().catch(() => {});
    if (stationConsumerKey(current) !== stationActiveConsumerKey) {
      sendResponse({ ok: true, connected: Boolean(stationSourceTabId), standby: true });
      return;
    }
    if (!stationSourceTabId) {
      sendResponse({ ok: true, connected: false });
      return;
    }
    chrome.tabs.sendMessage(stationSourceTabId, {
      type: "XFF_STATION_CONTROL",
      action: "resize",
      value: { width: current.width, height: current.height }
    }).then(() => sendResponse({ ok: true, connected: true }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === "XFF_STATION_CROP") {
    if (sender.tab?.id !== stationSourceTabId) return;
    const crop = message.crop && typeof message.crop === "object"
      ? Object.assign({}, message.crop, {
        captureGeneration: Math.max(0, Number(message.crop.captureGeneration) || 0),
        sequence: Math.max(0, Number(message.crop.sequence) || 0)
      })
      : message.crop;
    broadcastToStations({
      type: "XFF_STATION_CROP",
      crop
    }).catch(() => {});
    return;
  }

  if (message?.type === "XFF_STATION_SCROLL_GENERATION") {
    if (sender.tab?.id !== stationSourceTabId) return;
    const generation = Math.max(0, Number(message.generation) || 0);
    if (!generation) return;
    stationPendingCaptureGeneration = Math.max(stationPendingCaptureGeneration, generation);
    chrome.runtime.sendMessage({
      target: "station-x-offscreen",
      type: "XFF_OFFSCREEN_WAIT_CAPTURE_FRAME",
      generation
    }).catch(() => {});
    return;
  }

  if (message?.type === "XFF_STATION_CAPTURE_FRAME") {
    const generation = Math.max(0, Number(message.generation) || 0);
    if (!stationSourceTabId || !generation || generation !== stationPendingCaptureGeneration ||
        generation <= stationLastCaptureFrameGeneration) return;
    stationLastCaptureFrameGeneration = generation;
    stationPendingCaptureGeneration = 0;
    chrome.tabs.sendMessage(stationSourceTabId, {
      type: "XFF_STATION_CAPTURE_FRAME", generation
    }).catch(() => {});
    return;
  }

  if (message?.type === "XFF_STATION_CONTROL") {
    const registered = stationConsumers.get(sender.tab?.id);
    const sameInstance = !message.instanceId ||
      String(registered?.instanceId || "") === String(message.instanceId);
    if (!registered || (sender.frameId || 0) !== registered.frameId || !sameInstance) {
      sendResponse({ ok: false, error: "The Station pane was not recognized." });
      return;
    }
    if (!stationSourceTabId) {
      sendResponse({ ok: false, error: "Station X is not connected." });
      return;
    }

    // Every visible Station mirror supplies the same wall-clock pulse. Chrome
    // may throttle any one background window; accepting pulses from all live
    // mirrors keeps the shared source moving. Deduplication here prevents two
    // visible windows from doubling the scroll rate.
    if (message.action === "tick") {
      const at = Number(message.value?.at) || Date.now();
      if (at - stationLastTickForwardedAt < STATION_TICK_MIN_INTERVAL_MS) {
        sendResponse({ ok: true, deduplicated: true });
        return;
      }
      stationLastTickForwardedAt = at;
      chrome.tabs.sendMessage(stationSourceTabId, {
        type: "XFF_STATION_CONTROL",
        action: "tick",
        value: { at }
      }).then(() => sendResponse({ ok: true }))
        .catch((error) => sendResponse({ ok: false, error: error.message }));
      return true;
    }

    // Controls follow interaction. A mirror is never a dead UI: clicking List,
    // Notifications, refresh, rewind, or pause makes that viewer the action
    // controller and applies the shared change to every receiver.
    (async () => {
      await activateStationConsumer(registered);
      await chrome.tabs.sendMessage(stationSourceTabId, {
        type: "XFF_STATION_CONTROL",
        action: message.action,
        value: message.value
      });
      sendResponse({ ok: true, active: true });
    })().catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === "XFF_STATION_OFFER") {
    const consumer = stationConsumers.get(sender.tab?.id);
    if (!consumer || (sender.frameId || 0) !== consumer.frameId) {
      sendResponse({ ok: false, error: "The Station pane was not recognized." });
      return;
    }
    chrome.runtime.sendMessage({
      target: "station-x-offscreen",
      type: "XFF_OFFSCREEN_OFFER",
      peerId: stationConsumerKey(consumer),
      offer: message.offer
    }).then(async (result) => {
      if (!result?.ok || !result.answer) {
        throw new Error(result?.error || "Station X could not answer the video connection.");
      }
      await sendToStation(consumer, {
        type: "XFF_STATION_ANSWER",
        answer: result.answer
      });
      sendResponse({ ok: true });
    }).catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === "XFF_STATION_REMOTE_OFFER") {
    const consumer = stationConsumers.get(sender.tab?.id);
    const pairId = String(message.pairId || "");
    const viewerId = String(message.viewerId || "");
    const receiverGeneration = String(message.receiverGeneration || "");
    if (!/^[A-Za-z0-9_-]{32,}$/.test(pairId) ||
        !/^[A-Za-z0-9_-]{16,}$/.test(viewerId) ||
        !/^[A-Za-z0-9_-]{16,}$/.test(receiverGeneration) || !message.offer) {
      sendResponse({ ok: false, error: "The iPad viewer was not recognized." });
      return;
    }
    if (!exactStationGeneration(consumer, sender, message)) {
      sendResponse(receiverReannouncing());
      return;
    }
    const peerId = remoteViewerPeerId(pairId, viewerId);
    remoteViewerGenerations.set(peerId, receiverGeneration);
    chrome.runtime.sendMessage({
      target: "station-x-offscreen",
      type: "XFF_OFFSCREEN_OFFER",
      peerId,
      offer: message.offer
    }).then(async (result) => {
      if (!result?.ok || !result.answer) {
        throw new Error(result?.error || "Station X could not answer the iPad viewer.");
      }
      const current = stationConsumers.get(consumer.tabId);
      if (stationConsumerKey(current) !== stationConsumerKey(consumer)) {
        await chrome.runtime.sendMessage({
          target: "station-x-offscreen",
          type: "XFF_OFFSCREEN_DROP",
          peerId
        }).catch(() => {});
        sendResponse(receiverReannouncing());
        return;
      }
      if (remoteViewerGenerations.get(peerId) !== receiverGeneration) {
        sendResponse({ ok: true, stale: true });
        return;
      }
      await sendToStation(consumer, {
        type: "XFF_STATION_REMOTE_ANSWER",
        instanceId: consumer.instanceId,
        pairId,
        viewerId,
        receiverGeneration,
        answer: result.answer
      });
      sendResponse({ ok: true });
    }).catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === "XFF_STATION_REMOTE_DROP") {
    const consumer = stationConsumers.get(sender.tab?.id);
    const pairId = String(message.pairId || "");
    const viewerId = String(message.viewerId || "");
    const receiverGeneration = String(message.receiverGeneration || ""), peerId = remoteViewerPeerId(pairId, viewerId);
    if (!/^[A-Za-z0-9_-]{32,}$/.test(pairId) || !/^[A-Za-z0-9_-]{16,}$/.test(viewerId) ||
        !/^[A-Za-z0-9_-]{16,}$/.test(receiverGeneration)) {
      sendResponse({ ok: false, error: "The iPad viewer was not recognized." });
      return;
    }
    if (!exactStationGeneration(consumer, sender, message)) {
      sendResponse(receiverReannouncing());
      return;
    }
    if (remoteViewerGenerations.get(peerId) !== receiverGeneration) {
      sendResponse({ ok: true, stale: true });
      return true;
    }
    remoteViewerGenerations.delete(peerId);
    chrome.runtime.sendMessage({
      target: "station-x-offscreen",
      type: "XFF_OFFSCREEN_DROP",
      peerId
    }).catch(() => {});
    sendResponse({ ok: true });
    return true;
  }

  if (message?.type === "XFF_STATION_STOP") {
    const consumer = freshestStationConsumer();
    if (!consumer || sender.tab?.id !== consumer.tabId ||
        (sender.frameId || 0) !== consumer.frameId) {
      sendResponse({ ok: false, error: "This Station pane is not the active display." });
      return;
    }
    stopStationCapture("Station closed the feed.")
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === "XFF_GET_TAB_ZOOM") {
    const tabId = sender.tab?.id;
    if (!tabId) {
      sendResponse({ ok: false, error: "No X tab was available." });
      return;
    }

    chrome.tabs.getZoom(tabId, (zoomFactor) => {
      const error = chrome.runtime.lastError;
      sendResponse(
        error
          ? { ok: false, error: error.message }
          : { ok: true, zoomFactor }
      );
    });
    return true;
  }

  if (message?.type === "XFF_SET_TAB_ZOOM") {
    const tabId = sender.tab?.id;
    const zoomFactor = Number(message.zoomFactor);
    if (!tabId || !Number.isFinite(zoomFactor)) {
      sendResponse({ ok: false, error: "The X zoom value was invalid." });
      return;
    }

    chrome.tabs.setZoom(tabId, Math.max(0.25, Math.min(1, zoomFactor)), () => {
      const setError = chrome.runtime.lastError;
      if (setError) {
        sendResponse({ ok: false, error: setError.message });
        return;
      }

      chrome.tabs.getZoom(tabId, (appliedZoomFactor) => {
        const getError = chrome.runtime.lastError;
        sendResponse(
          getError
            ? { ok: false, error: getError.message }
            : { ok: true, zoomFactor: appliedZoomFactor }
        );
      });
    });
    return true;
  }

  if (message?.type === "XFF_GET_STREAM_ID") {
    const tabId = sender.tab?.id;
    if (!tabId) {
      sendResponse({ ok: false, error: "No source tab was available." });
      return;
    }

    chrome.tabCapture.getMediaStreamId(
      {
        targetTabId: tabId,
        consumerTabId: tabId
      },
      (streamId) => {
        const error = chrome.runtime.lastError;
        if (error || !streamId) {
          sendResponse({
            ok: false,
            error: error?.message || "Chrome did not return a tab-capture stream."
          });
          return;
        }

        sendResponse({ ok: true, streamId });
      }
    );

    return true;
  }

  if (message?.type === "XFF_MINIMIZE_SOURCE_WINDOW") {
    const windowId = sender.tab?.windowId;
    if (!Number.isInteger(windowId)) {
      sendResponse({ ok: false, error: "No source Chrome window was available." });
      return;
    }

    chrome.windows.update(windowId, { state: "minimized" }, (updatedWindow) => {
      const error = chrome.runtime.lastError;
      if (!error) {
        // Document PiP and tab capture finish attaching asynchronously on macOS.
        // A couple of quiet retries prevent Chrome from immediately restoring
        // the source during that handoff.
        for (const delay of [220, 700]) {
          setTimeout(() => {
            chrome.windows.update(windowId, { state: "minimized" }, () => {
              void chrome.runtime.lastError;
            });
          }, delay);
        }
      }
      sendResponse(
        error
          ? { ok: false, error: error.message }
          : { ok: true, windowId: updatedWindow?.id ?? windowId }
      );
    });
    return true;
  }

  if (message?.type === "XFF_SHOW_SOURCE_WINDOW") {
    const tabId = sender.tab?.id;
    const windowId = sender.tab?.windowId;
    if (!Number.isInteger(tabId) || !Number.isInteger(windowId)) {
      sendResponse({ ok: false, error: "No source Chrome window was available." });
      return;
    }

    chrome.windows.update(
      windowId,
      { state: "normal", focused: true },
      () => {
        const windowError = chrome.runtime.lastError;
        if (windowError) {
          sendResponse({ ok: false, error: windowError.message });
          return;
        }
        chrome.tabs.update(tabId, { active: true }, () => {
          const tabError = chrome.runtime.lastError;
          sendResponse(
            tabError
              ? { ok: false, error: tabError.message }
              : { ok: true, tabId, windowId }
          );
        });
      }
    );
    return true;
  }

  if (message?.type === "XFF_BADGE") {
    const tabId = sender.tab?.id;
    if (!tabId) {
      return;
    }

    const active = Boolean(message.active);
    chrome.action.setBadgeBackgroundColor({
      tabId,
      color: active ? "#1d9bf0" : "#000000"
    });
    chrome.action.setBadgeText({
      tabId,
      text: active ? "ON" : ""
    });
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  const removed = stationConsumers.get(tabId);
  dropStationPeer(removed);
  if (stationConsumerKey(removed) === stationActiveConsumerKey) {
    stationActiveConsumerKey = null;
  }
  stationConsumers.delete(tabId);
  if (tabId === stationSourceTabId) {
    stopStationCapture("The X source tab closed.").catch(() => {});
  } else {
    persistStationSession().catch(() => {});
  }
});
