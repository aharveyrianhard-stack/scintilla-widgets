(() => {
  "use strict";

  /* A Chrome extension reload creates a new background worker but leaves the
     already-open Station frame alive.  V079 used one permanent page marker,
     so a reinjection after that reload returned before announcing the frame to
     the fresh worker.  Keep this receiver generation-specific: the first V080
     injection can recover a V079 page, while a second V080 injection merely
     reannounces the same receiver. */
  const existing = window.__XFF_STATION_BRIDGE_V080__;
  if (existing?.reannounce) {
    existing.reannounce();
    return;
  }

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

  window.__XFF_STATION_BRIDGE_V080__ = { reannounce: ready };

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

    if (message?.type === "XFF_STATION_REMOTE_ANSWER") {
      window.postMessage({
        type: "XFF_STATION_REMOTE_ANSWER",
        pairId: message.pairId,
        viewerId: message.viewerId,
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
    if (event.data?.type === "XFF_STATION_REMOTE_OFFER") {
      runtimeMessage({
        type: "XFF_STATION_REMOTE_OFFER",
        pairId: event.data.pairId,
        viewerId: event.data.viewerId,
        offer: event.data.offer
      }).then((result) => {
        if (result?.ok === false) window.postMessage({
          type: "XFF_STATION_STATUS",
          status: "error",
          detail: result.error || "The iPad viewer could not connect."
        }, ORIGIN);
      }).catch(() => {});
    }
    if (event.data?.type === "XFF_STATION_REMOTE_DROP") {
      runtimeMessage({
        type: "XFF_STATION_REMOTE_DROP",
        pairId: event.data.pairId,
        viewerId: event.data.viewerId
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
