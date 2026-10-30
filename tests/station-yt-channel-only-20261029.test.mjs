/* 29 Oct 2026 — the Station's YouTube cards say who, not what.
   Alan: "the titles of the YouTube videos are too small, but I don't need the title of the videos, just like the
   channel. Just the channel is more than sufficient. But in bigger font."
   On the wall the grid is a column under 340 px, where the old rule hid the channel line and left the title at 9 px.
   The contract this file holds, for both mounted twins:
     1. a card carries no title: the channel and its age are its one line;
     2. that line shows in every slot, the narrow column included;
     3. it is bigger than the old title and in the title's old ink.
*/
import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const SHELLS = ["scintilla-video-v1", "personal-video-v1"];
const SRC = new Map(SHELLS.map((name) =>
  [name, fs.readFileSync(new URL(`../station-shells/${name}/index.html`, import.meta.url), "utf8")]));

function fnText(src, name) {
  const start = src.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} must exist`);
  let depth = 0;
  for (let i = src.indexOf("{", start); i < src.length; i += 1) {
    if (src[i] === "{") depth += 1;
    if (src[i] === "}") depth -= 1;
    if (depth === 0) return src.slice(start, i + 1);
  }
  throw new Error(`${name} has no end`);
}

test("the twins are one page", () => {
  assert.equal(SRC.get("scintilla-video-v1"), SRC.get("personal-video-v1"));
});

for (const [shell, src] of SRC) {
  test(`${shell}: a card is the channel and its age, never the title`, () => {
    const ctx = { CUR: null, esc: (s) => String(s == null ? "" : s), starHTML: () => "", videoBadgeHTML: () => "",
      videoAgeHTML: () => '<span class="age">2h ago</span>' };
    vm.runInNewContext(fnText(src, "cardHTML"), ctx);
    const html = ctx.cardHTML({ video_id: "abc", title: "No Spin News - October 29, 2026", channel: "Bill O'Reilly" });
    assert.doesNotMatch(html, /No Spin News/, "the title is not on the card");
    assert.doesNotMatch(html, /class="t"/, "nor a title line waiting for it");
    assert.match(html, /<div class="cap"><div class="s"><span class="ch">Bill O'Reilly<\/span><span class="age">2h ago<\/span><\/div><\/div>/);
  });

  test(`${shell}: the channel line shows in the narrow column, bigger than the old title, in its ink`, () => {
    assert.doesNotMatch(src, /body\.tiny \.cap \.s\{\s*display:none/, "the narrow column no longer drops the channel");
    assert.doesNotMatch(src, /\.cap \.t\{/, "no title rule is left behind");
    const line = src.match(/\n\.cap \.s\{[^}]*\}/)[0];
    assert.match(line, /font-size:14px/, "14 px against the old title's 9-9.5 px");
    assert.match(line, /color:var\(--ink2\)/, "the title's old ink");
    assert.match(src, /html\[data-view="desk"\] \.cap \.s\{ font-size:15px; \}/);
    assert.match(src, /root\.setProperty\("--ipad-caption-size", \(14 \* scale\)/, "the iPad scales the same line");
    assert.match(src, /\.cap \.s \.ch\{[^}]*text-overflow:ellipsis/, "a long channel name ends in … and keeps the age on the line");
  });
}
