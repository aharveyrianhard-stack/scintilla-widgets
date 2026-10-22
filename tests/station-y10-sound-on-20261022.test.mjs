// Y10 (22 Oct 2026) - the Station's YouTube pane starts with its sound ON. Alan: "I don't want it muted."
// A browser that still refuses (a plain tab before any tap) pauses the video; the pane then plays it on, muted, and says so.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const SHELLS = ["station-shells/scintilla-video-v1/index.html", "station-shells/personal-video-v1/index.html"];
const plain = (x) => JSON.parse(JSON.stringify(x));
function soundApi(src, { muted = true, volume = 100, session = null, state = 1 } = {}) {
  const m = src.match(/const SOUND_KEY = "station\.sound";[\s\S]*?\nel\("bSound"\)\.addEventListener\("click", \(\) => \{[\s\S]*?\n\}\);/);
  assert.ok(m, "the sound block");
  const calls = [];
  const player = { _muted: muted, _volume: volume, _state: state,
    isMuted() { return this._muted; }, getVolume() { return this._volume; }, getPlayerState() { return this._state; },
    unMute() { calls.push(["unMute"]); this._muted = false; }, mute() { calls.push(["mute"]); this._muted = true; },
    setVolume(v) { calls.push(["setVolume", v]); this._volume = v; }, playVideo() { calls.push(["playVideo"]); this._state = 1; } };
  const store = new Map(); if (session) store.set("station.sound", JSON.stringify(session));
  const listeners = {};
  const ctx = { YT_PLAYER: player, YT_PLAYER_READY: true, CUR: { video_id: "x" }, calls, console, listeners, Date,
    sessionStorage: { getItem: (k) => store.has(k) ? store.get(k) : null, setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) },
    document: { body: { dataset: {} }, addEventListener: (t, f) => { listeners[t] = f; } },
    el: () => ({ addEventListener: (t, f) => { listeners["bSound:" + t] = f; } }),
    setTimeout: (f) => { f(); return 1; } };
  vm.runInNewContext(m[0] + "\nglobalThis.out = { soundOnPlaying, soundOnPlayerReady, state: () => ({ done: SOUND_DONE }) };", ctx);
  return Object.assign(ctx.out, { player, calls, store, body: ctx.document.body });
}
for (const f of SHELLS) {
  const src = fs.readFileSync(f, "utf8");
  test(`Y10 · ${f}: sound on by default; the user's own mute stands; a refusal keeps the video playing, muted`, () => {
    let S = soundApi(src, { muted: true, volume: 100, state: 1 });
    S.soundOnPlaying();
    assert.deepEqual(plain(S.calls), [["unMute"]], "a video that starts is unmuted at 100");
    assert.equal(S.body.dataset.muted, "false"); assert.equal(S.state().done, true, "and the sound is the user's from then on");
    S = soundApi(src, { muted: true, volume: 100, session: { volume: 37, muted: false }, state: 1 });
    S.soundOnPlaying(); assert.deepEqual(plain(S.calls), [["unMute"], ["setVolume", 37]], "at the session's volume");
    S = soundApi(src, { muted: true, volume: 50, session: { volume: 50, muted: true }, state: 1 });
    S.soundOnPlaying(); assert.deepEqual(S.calls, [], "a mute of the user's own stands");
    S = soundApi(src, { muted: true, volume: 100, state: 2 });
    S.soundOnPlaying(); assert.deepEqual(plain(S.calls), [["unMute"], ["mute"], ["playVideo"]], "the browser paused it: play on, muted");
    assert.equal(S.body.dataset.muted, "true", "and the bar says MUTED · TAP FOR SOUND");
    assert.match(src, /function soundOnPlaying\(\) \{ soundOnFirstTap\(\); soundOnByDefault\(\);/, "wired on playing");
    assert.match(src, /soundOnFirstTap\(\); soundOnByDefault\(\); paintSound\(\);\n\}/, "wired on ready");
  });
}
