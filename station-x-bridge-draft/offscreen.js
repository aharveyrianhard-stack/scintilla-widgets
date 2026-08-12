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
        maxWidth: 1920,
        maxHeight: 1080,
        minFrameRate: 10,
        maxFrameRate: 30
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

function acknowledgeCapturedFrame(generation) {
  pendingCaptureGeneration = Math.max(pendingCaptureGeneration, Number(generation) || 0);
  if (!captureVideo || captureFrameWaitScheduled || !pendingCaptureGeneration) return;
  captureFrameWaitScheduled = true;
  const afterFrame = () => {
    captureFrameWaitScheduled = false;
    const confirmedGeneration = pendingCaptureGeneration;
    pendingCaptureGeneration = 0;
    chrome.runtime.sendMessage({
      type: "XFF_STATION_CAPTURE_FRAME",
      generation: confirmedGeneration
    }).catch(() => {});
  };
  if (typeof captureVideo.requestVideoFrameCallback === "function") {
    captureVideo.requestVideoFrameCallback(afterFrame);
  }
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
