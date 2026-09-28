"use strict";

let captureStream = null;
let captureVideo = null;
let pendingCaptureGeneration = 0;
let captureFrameWaitScheduled = false;
const peers = new Map();

function waitForIceComplete(connection) {
  if (connection.iceGatheringState === "complete") return Promise.resolve();
  return new Promise((resolve) => {
    const onState = () => {
      if (connection.iceGatheringState !== "complete") return;
      connection.removeEventListener("icegatheringstatechange", onState);
      resolve();
    };
    connection.addEventListener("icegatheringstatechange", onState);
  });
}

function stopCapture() {
  for (const peer of peers.values()) peer.close();
  peers.clear();
  if (captureStream) {
    for (const track of captureStream.getTracks()) track.stop();
  }
  captureStream = null;
  pendingCaptureGeneration = 0;
  captureFrameWaitScheduled = false;
  if (captureVideo) {
    captureVideo.pause();
    captureVideo.srcObject = null;
    captureVideo.remove();
    captureVideo = null;
  }
}

function dropPeer(peerId) {
  const peer = peers.get(peerId);
  if (peer) peer.close();
  peers.delete(peerId);
}

async function startCapture(streamId) {
  stopCapture();
  captureStream = await navigator.mediaDevices.getUserMedia({
    video: {
      mandatory: {
        chromeMediaSource: "tab",
        chromeMediaSourceId: streamId,
        minWidth: 240,
        minHeight: 240,
        /* 24 Sep: this path asked for at most 1920x1080 while the in-tab path
           asked for 2560x1440, so the same X window arrived at two different
           sizes depending on which path fed the pane - Alan's "some mismatch".
           One request for both paths. The cap's 16:9 shape is also why a
           resized X window arrives letterboxed; the viewer's mapping now
           accounts for that instead of assuming it away. */
        /* 24 Sep (0.7.21): 1920x1080 at up to 15 frames a second. The Station
           pane paints 12.5 times a second (VIEWER_PAINT_INTERVAL_MS = 80), so a
           60fps relay encoded, sent and decoded about four frames for every one
           drawn, in each browser, on an iMac measured at 4.9 GB of swap and a
           15-minute load of 42. At Alan's X window sizes the timeline column
           arrives 760-770 captured pixels wide under this cap, which is the size
           the pane draws it at, so nothing he reads gets softer. */
        maxWidth: 1920,
        maxHeight: 1080,
        minFrameRate: 10,
        maxFrameRate: 15
      }
    },
    audio: false
  });
  /* This hidden decoder is intentionally not a second capture or renderer.
     requestVideoFrameCallback is the only reliable proof that the tab-capture
     stream—not merely the source page rAF—has crossed a scroll boundary. */
  captureVideo = document.createElement("video");
  captureVideo.muted = true;
  captureVideo.playsInline = true;
  captureVideo.srcObject = captureStream;
  await captureVideo.play();
  return { ok: true };
}

/* 24 Sep (0.7.21): on both Brave Stations no scroll step was ever acknowledged,
   and the source's crop offset grew past 580 px until every viewer's crop missed
   the picture. This hidden decoder is the only place a frame is proven, so a
   frame is now acknowledged on its callback OR after two frames at the capped
   rate, whichever comes first; the acknowledgement says which, so the Station's
   health register shows whether the fallback is doing the work. */
const CAPTURE_FRAME_FALLBACK_MS = 150;
function acknowledgeCapturedFrame(generation) {
  pendingCaptureGeneration = Math.max(pendingCaptureGeneration, Number(generation) || 0);
  if (!captureVideo || captureFrameWaitScheduled || !pendingCaptureGeneration) return;
  captureFrameWaitScheduled = true;
  let settled = false, fallbackTimer = 0;
  const afterFrame = (viaFallback) => {
    if (settled) return;
    settled = true;
    clearTimeout(fallbackTimer);
    captureFrameWaitScheduled = false;
    const confirmedGeneration = pendingCaptureGeneration;
    pendingCaptureGeneration = 0;
    chrome.runtime.sendMessage({
      type: "XFF_STATION_CAPTURE_FRAME",
      generation: confirmedGeneration,
      fallback: viaFallback === true
    }).catch(() => {});
  };
  if (typeof captureVideo.requestVideoFrameCallback === "function") {
    captureVideo.requestVideoFrameCallback(() => afterFrame(false));
  }
  fallbackTimer = setTimeout(() => afterFrame(true), CAPTURE_FRAME_FALLBACK_MS);
}

async function answerOffer(peerId, offer) {
  if (!captureStream) throw new Error("The Station X capture is not running.");
  if (!peerId) throw new Error("The Station X receiver was not identified.");
  const previous = peers.get(peerId);
  if (previous) previous.close();
  const peer = new RTCPeerConnection();
  peers.set(peerId, peer);
  for (const track of captureStream.getTracks()) peer.addTrack(track, captureStream);
  await peer.setRemoteDescription(offer);
  await peer.setLocalDescription(await peer.createAnswer());
  await waitForIceComplete(peer);
  return { ok: true, answer: peer.localDescription.toJSON() };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.target !== "station-x-offscreen") return;

  if (message.type === "XFF_OFFSCREEN_START") {
    startCapture(message.streamId)
      .then(sendResponse)
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message.type === "XFF_OFFSCREEN_OFFER") {
    answerOffer(message.peerId, message.offer)
      .then(sendResponse)
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message.type === "XFF_OFFSCREEN_STOP") {
    stopCapture();
    sendResponse({ ok: true });
  }

  if (message.type === "XFF_OFFSCREEN_DROP") {
    dropPeer(message.peerId);
    sendResponse({ ok: true });
  }

  if (message.type === "XFF_OFFSCREEN_WAIT_CAPTURE_FRAME") {
    acknowledgeCapturedFrame(message.generation);
    sendResponse({ ok: true });
  }
});
