"use strict";

let captureStream = null;
let peer = null;

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
  if (peer) peer.close();
  peer = null;
  if (captureStream) {
    for (const track of captureStream.getTracks()) track.stop();
  }
  captureStream = null;
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
        maxWidth: 2560,
        maxHeight: 1440,
        minFrameRate: 10,
        maxFrameRate: 60
      }
    },
    audio: false
  });
  return { ok: true };
}

async function answerOffer(offer) {
  if (!captureStream) throw new Error("The Station X capture is not running.");
  if (peer) peer.close();
  peer = new RTCPeerConnection();
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
    answerOffer(message.offer)
      .then(sendResponse)
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message.type === "XFF_OFFSCREEN_STOP") {
    stopCapture();
    sendResponse({ ok: true });
  }
});
