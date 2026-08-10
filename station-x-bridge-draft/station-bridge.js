(() => {
  "use strict";

  if (window.__XFF_STATION_BRIDGE_V074__) return;
  window.__XFF_STATION_BRIDGE_V074__ = true;

  const ORIGIN = window.location.origin;
  const isPane = /\/pane-x\/?$/.test(window.location.pathname);
  if (!isPane) return;

  function dimensions() {
    return {
      width: Math.max(1, window.innerWidth),
      height: Math.max(1, window.innerHeight)
    };
  }

  function ready() {
    window.postMessage({ type: "XFF_STATION_BRIDGE_READY" }, ORIGIN);
    chrome.runtime.sendMessage({
      type: "XFF_STATION_READY",
      ...dimensions()
    }).catch(() => {});
  }

  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type === "XFF_STATION_STREAM") {
      window.postMessage({
        type: "XFF_STATION_STREAM",
        streamId: message.streamId,
        sourceTabId: message.sourceTabId
      }, ORIGIN);
    }

    if (message?.type === "XFF_STATION_WEBRTC_START") {
      window.postMessage({ type: "XFF_STATION_WEBRTC_START" }, ORIGIN);
    }

    if (message?.type === "XFF_STATION_ANSWER") {
      window.postMessage({
        type: "XFF_STATION_ANSWER",
        answer: message.answer
      }, ORIGIN);
    }

    if (message?.type === "XFF_STATION_CROP") {
      window.postMessage({
        type: "XFF_STATION_CROP",
        crop: message.crop
      }, ORIGIN);
    }

    if (message?.type === "XFF_STATION_STATUS") {
      window.postMessage({
        type: "XFF_STATION_STATUS",
        status: message.status,
        detail: message.detail || ""
      }, ORIGIN);
    }
  });

  window.addEventListener("message", (event) => {
    if (event.source !== window || event.origin !== ORIGIN) return;
    if (event.data?.type === "XFF_STATION_CONTROL") {
      chrome.runtime.sendMessage({
        type: "XFF_STATION_CONTROL",
        action: event.data.action,
        value: event.data.value
      }).catch(() => {});
    }
    if (event.data?.type === "XFF_STATION_STOP") {
      chrome.runtime.sendMessage({ type: "XFF_STATION_STOP" }).catch(() => {});
    }
    if (event.data?.type === "XFF_STATION_OFFER") {
      chrome.runtime.sendMessage({
        type: "XFF_STATION_OFFER",
        offer: event.data.offer
      }).then((result) => {
        if (result?.ok === false) {
          window.postMessage({
            type: "XFF_STATION_STATUS",
            status: "error",
            detail: result.error || "Station X could not connect."
          }, ORIGIN);
        }
      }).catch(() => {});
    }
  });

  let resizeTimer = 0;
  const heartbeat = setInterval(ready, 30000);
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(ready, 120);
  });
  window.addEventListener("pagehide", () => {
    clearInterval(heartbeat);
    chrome.runtime.sendMessage({ type: "XFF_STATION_NOT_READY" }).catch(() => {});
  });

  ready();
})();
