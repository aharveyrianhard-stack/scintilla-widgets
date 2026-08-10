(() => {
  "use strict";

  if (window.__XFF_STATION_BRIDGE_V077__) return;
  window.__XFF_STATION_BRIDGE_V077__ = true;

  const ORIGIN = window.location.origin;
  const isPane = /\/pane-x\/?$/.test(window.location.pathname);
  if (!isPane) return;
  const INSTANCE_ID = crypto.randomUUID();

  function runtimeMessage(message) {
    try {
      if (!chrome.runtime?.id) return Promise.resolve({ ok: false });
      return chrome.runtime.sendMessage(message).catch(() => ({ ok: false }));
    } catch (_) {
      return Promise.resolve({ ok: false });
    }
  }

  function dimensions() {
    return {
      width: Math.max(1, window.innerWidth),
      height: Math.max(1, window.innerHeight)
    };
  }

  function ready() {
    window.postMessage({ type: "XFF_STATION_BRIDGE_READY" }, ORIGIN);
    runtimeMessage({
      type: "XFF_STATION_READY",
      instanceId: INSTANCE_ID,
      ...dimensions()
    }).then((result) => {
      if (result?.ok && result.active === false) {
        window.postMessage({
          type: "XFF_STATION_STATUS",
          status: "standby",
          detail: "Mirroring the active Station display."
        }, ORIGIN);
      }
    });
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
      runtimeMessage({
        type: "XFF_STATION_CONTROL",
        instanceId: INSTANCE_ID,
        action: event.data.action,
        value: event.data.value
      }).catch(() => {});
    }
    if (event.data?.type === "XFF_STATION_STOP") {
      runtimeMessage({ type: "XFF_STATION_STOP" });
    }
    if (event.data?.type === "XFF_STATION_OFFER") {
      runtimeMessage({
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
    resizeTimer = setTimeout(() => {
      runtimeMessage({
        type: "XFF_STATION_RESIZE",
        instanceId: INSTANCE_ID,
        ...dimensions()
      }).catch(() => {});
    }, 120);
  });
  window.addEventListener("pagehide", () => {
    clearInterval(heartbeat);
    runtimeMessage({
      type: "XFF_STATION_NOT_READY",
      instanceId: INSTANCE_ID
    }).catch(() => {});
  });

  ready();
})();
