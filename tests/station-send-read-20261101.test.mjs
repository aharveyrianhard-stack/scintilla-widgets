/* 1 Nov 2026 — pushing a story with a note, and the reads saying where they sit against the report.
   Alan: "I see a story and I push it", "Send to Scintilla", "manually send some video for a transcript analysis. Maybe with some notes of mine",
   "the tone of that is important to track ... the tracking of things that support certain scenarios", and of the chapter lists "just a raw extraction". */
import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
const read = (p) => fs.readFileSync(new URL("../notify/" + p, import.meta.url), "utf8");
test("the send page takes a link, a title and a note, and queues them through brain_keep", () => {
  const s = read("send.html");
  assert.match(s, /Q\.get\("u"\)/); assert.match(s, /Q\.get\("t"\)/);
  assert.match(s, /rpc\/brain_keep/);
  assert.match(s, /p_note: el\("n"\)\.value\.trim\(\) \|\| null/);
  assert.match(s, /send\.html\?popup=1&u=/, "the Mac's bookmark button opens it in a small window");
  assert.match(s, /send-to-scintilla\.shortcut/, "the iPhone's share button");
});
test("the share button is a signed shortcut", () => {
  const b = fs.readFileSync(new URL("../notify/send-to-scintilla.shortcut", import.meta.url));
  assert.equal(b.subarray(0, 4).toString(), "AEA1", "Apple's signed container");
});
test("the list's keep box carries a note", () => {
  const s = read("index.html");
  assert.match(s, /id="keepNote"/);
  assert.match(s, /p_note: note \|\| null/);
});
test("a read says where it sits against the report; a light read shows its one line and the note", () => {
  const s = read("read.html");
  assert.match(s, /x\.scenario \?/); assert.match(s, /x\.vs_report \?/); assert.match(s, /x\.note \?/);
  assert.match(s, /light \? \(x\.takeaway \?/);
});
test("a phone that already said yes is told to the database with no tap (the 401 left it signed up with Apple and unknown to us)", () => {
  const s = read("index.html");
  assert.match(s, /async function storeSub\(sub\)/);
  assert.match(s, /Notification\.permission === "granted" && sub\) \{\n\s+if \(HEALED\) return setup\(""\);/);
  assert.match(s, /if \(await storeSub\(sub\)\) await reg\.showNotification/, "a new row says so on the phone");
  assert.match(s, /await storeSub\(sub\); HEALED = true;/, "the button uses the same door");
  assert.doesNotMatch(s, /resolution=ignore-duplicates/);
});
test("an iPad gets the alerts button: its Safari says it is a Mac, only the touch screen gives it away", () => {
  const s = read("index.html");
  assert.match(s, /navigator\.platform === "MacIntel" && navigator\.maxTouchPoints > 1/);
  assert.match(s, /IOS = \/iPhone\|iPod\/\.test\(navigator\.userAgent\) \|\| IS_IPAD/);
  assert.match(s, /IS_IPAD \? "iPad"/);
});
test("a tapped phone alert opens its own card and goes straight to the story; the list shows every card by default", () => {
  const c = read("card.html"), sw = read("push-sw.js"), i = read("index.html");
  assert.match(c, /rpc\/notify_card/); assert.match(c, /location\.assign\(x\.url\)/); assert.doesNotMatch(c, /location\.replace\(x\.url\)/); assert.match(c, /history\.replaceState\(null, "", "\/notify\/"\)/); assert.match(c, /Open the story/);
  assert.match(sw, /c\.navigate\(url\)/); assert.match(sw, /clients\.openWindow\(url\)/);
  assert.match(i, /remembered\("notify\.scope"\) === "mine" \? "mine" : "all"/);
  const key = (s) => s.match(/ANON = "([^"]+)"/)[1]; assert.equal(key(c), key(read("read.html")));
  assert.match(read("read.html"), /navigator\.standalone === true/);   // a read is our own page: the iPhone gives it no X, so it has its own, back to the list
});
