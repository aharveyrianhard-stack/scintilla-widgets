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
