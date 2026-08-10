const SUPPORTED_HOSTS = new Set(["x.com", "www.x.com", "twitter.com", "www.twitter.com"]);
const stationConsumers = new Map();
let stationSourceTabId = null;

function freshestStationConsumer() {
  return [...stationConsumers.values()]
    .filter((entry) => Date.now() - entry.lastSeen < 10 * 60 * 1000)
    .sort((a, b) => b.lastSeen - a.lastSeen)[0] || null;
}

function sendToStation(consumer, message) {
  if (!consumer) return Promise.resolve();
  return chrome.tabs.sendMessage(consumer.tabId, message, {
    frameId: consumer.frameId
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
  const consumer = freshestStationConsumer();
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
    chrome.action.setBadgeText({ tabId: stationSourceTabId, text: "" });
  }
  try {
    await sendToStation(consumer, {
      type: "XFF_STATION_STATUS",
      status: "stopped",
      detail
    });
  } catch {}
  stationSourceTabId = null;
}

async function startStationCapture(sourceTab, consumer) {
  if (!sourceTab?.id || !consumer) return false;
  if (stationSourceTabId === sourceTab.id) {
    await stopStationCapture("Station X disconnected.");
    return true;
  }

  await stopStationCapture("Switching X source…");
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

  await ensureContentScript(sourceTab.id);
  await chrome.tabs.sendMessage(sourceTab.id, {
    type: "XFF_START_STATION_SOURCE",
    consumer: {
      width: consumer.width,
      height: consumer.height
    }
  });
  await sendToStation(consumer, {
    type: "XFF_STATION_WEBRTC_START",
    sourceTabId: sourceTab.id
  });
  await sendToStation(consumer, {
    type: "XFF_STATION_STATUS",
    status: "connecting",
    detail: "Station X owns the crop and scroll."
  });

  chrome.action.setBadgeBackgroundColor({ tabId: sourceTab.id, color: "#00d4ff" });
  chrome.action.setBadgeText({ tabId: sourceTab.id, text: "STN" });
  await chrome.tabs.update(consumer.tabId, { active: true });
  await chrome.windows.update(consumer.windowId, { state: "normal", focused: true });
  return true;
}

function isSupportedUrl(url) {
  try {
    return SUPPORTED_HOSTS.has(new URL(url).hostname);
  } catch {
    return false;
  }
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
    if (!isSupportedUrl(tab?.url)) {
      // Chrome requires the capture/PiP gesture on the actual X tab. The first
      // click brings the most recent X tab forward; the next click opens PiP.
      await focusOrOpenX();
      return;
    }
    const station = freshestStationConsumer();
    if (station) {
      await startStationCapture(tab, station);
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
    stationConsumers.set(tabId, {
      tabId,
      windowId: sender.tab.windowId,
      frameId: sender.frameId || 0,
      width: Math.max(1, Number(message.width) || 1),
      height: Math.max(1, Number(message.height) || 1),
      lastSeen: Date.now()
    });
    sendResponse({ ok: true, connected: Boolean(stationSourceTabId) });
    return;
  }

  if (message?.type === "XFF_STATION_NOT_READY") {
    const tabId = sender.tab?.id;
    const current = stationConsumers.get(tabId);
    if (current && current.frameId === (sender.frameId || 0)) {
      stationConsumers.delete(tabId);
      if (stationSourceTabId) {
        stopStationCapture("The Station pane closed.").catch(() => {});
      }
    }
    sendResponse({ ok: true });
    return;
  }

  if (message?.type === "XFF_STATION_CROP") {
    if (sender.tab?.id !== stationSourceTabId) return;
    sendToStation(freshestStationConsumer(), {
      type: "XFF_STATION_CROP",
      crop: message.crop
    }).catch(() => {});
    return;
  }

  if (message?.type === "XFF_STATION_CONTROL") {
    if (!stationSourceTabId) {
      sendResponse({ ok: false, error: "Station X is not connected." });
      return;
    }
    chrome.tabs.sendMessage(stationSourceTabId, {
      type: "XFF_STATION_CONTROL",
      action: message.action,
      value: message.value
    }).then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === "XFF_STATION_OFFER") {
    const consumer = freshestStationConsumer();
    if (!consumer || sender.tab?.id !== consumer.tabId ||
        (sender.frameId || 0) !== consumer.frameId) {
      sendResponse({ ok: false, error: "The Station pane was not recognized." });
      return;
    }
    chrome.runtime.sendMessage({
      target: "station-x-offscreen",
      type: "XFF_OFFSCREEN_OFFER",
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

  if (message?.type === "XFF_STATION_STOP") {
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
  stationConsumers.delete(tabId);
  if (tabId === stationSourceTabId) {
    stopStationCapture("The X source tab closed.").catch(() => {});
  }
});
