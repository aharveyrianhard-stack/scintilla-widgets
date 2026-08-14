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
    return runtimeMessage({
      type: "XFF_STATION_READY",
      instanceId: INSTANCE_ID,
      ...dimensions()
    }).then((result) => {
      if (!result?.ok) return result;
      window.postMessage({
        type: "XFF_STATION_BRIDGE_READY",
        instanceId: INSTANCE_ID
      }, ORIGIN);
      if (result.active === false) {
        window.postMessage({
          type: "XFF_STATION_STATUS",
          status: "standby",
          detail: "Mirroring the active Station display."
        }, ORIGIN);
      }
      return result;
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
      if (String(message.instanceId || "") !== INSTANCE_ID) return;
      window.postMessage({
        type: "XFF_STATION_REMOTE_ANSWER",
        instanceId: INSTANCE_ID,
        pairId: message.pairId,
        viewerId: message.viewerId,
        receiverGeneration: message.receiverGeneration,
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
    if (event.data?.type === "XFF_STATION_REMOTE_OFFER" ||
        event.data?.type === "XFF_STATION_REMOTE_DROP") {
      /* A V079 listener can still exist in the already-open page after the
         extension reload, but its runtime belongs to the retired worker.
         Claim generation-bound remote signaling in capture phase so that
         stale listener cannot emit a false error or duplicate the offer. */
      event.stopImmediatePropagation();
    }
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
    if (event.data?.type === "XFF_STATION_RECONNECT_VIEWER") {
      runtimeMessage({
        type: "XFF_STATION_RECONNECT_VIEWER",
        instanceId: INSTANCE_ID
      }).then((result) => {
        if (result?.ok === false) {
          window.postMessage({
            type: "XFF_STATION_STATUS",
            status: "error",
            detail: result.error || "Station X could not reconnect."
          }, ORIGIN);
        }
      }).catch(() => {});
    }
    if (event.data?.type === "XFF_STATION_REMOTE_OFFER") {
      runtimeMessage({
        type: "XFF_STATION_REMOTE_OFFER",
        instanceId: INSTANCE_ID,
        pairId: event.data.pairId,
        viewerId: event.data.viewerId,
        receiverGeneration: event.data.receiverGeneration,
        offer: event.data.offer
      }).then((result) => {
        if (result?.ok) {
          window.postMessage({
            type: "XFF_STATION_REMOTE_ACCEPTED",
            instanceId: INSTANCE_ID,
            pairId: event.data.pairId,
            viewerId: event.data.viewerId,
            receiverGeneration: event.data.receiverGeneration
          }, ORIGIN);
          return;
        }
        if (result?.retryable) {
          window.postMessage({
            type: "XFF_STATION_BRIDGE_REANNOUNCING",
            instanceId: INSTANCE_ID
          }, ORIGIN);
          ready().catch(() => {});
          return;
        }
        window.postMessage({
          type: "XFF_STATION_STATUS",
          status: "error",
          detail: result?.error || "The iPad viewer could not connect."
        }, ORIGIN);
      }).catch(() => {});
    }
    if (event.data?.type === "XFF_STATION_REMOTE_DROP") {
      runtimeMessage({
        type: "XFF_STATION_REMOTE_DROP",
        instanceId: INSTANCE_ID,
        pairId: event.data.pairId,
        viewerId: event.data.viewerId,
        receiverGeneration: event.data.receiverGeneration
      }).then((result) => {
        if (!result?.retryable) return;
        window.postMessage({
          type: "XFF_STATION_BRIDGE_REANNOUNCING",
          instanceId: INSTANCE_ID
        }, ORIGIN);
        ready().catch(() => {});
      }).catch(() => {});
    }
  }, true);

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
