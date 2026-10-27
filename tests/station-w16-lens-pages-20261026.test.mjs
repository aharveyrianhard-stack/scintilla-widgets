/* W16 (26 Oct 2026, coordinator) — THE LENS PAGES, a proposal behind ?pages=1 (not on the wall until Alan says so). Alan: "I'm wondering if
   we do something like where it's not like a tape and it's more like a rotation, like the trading view … half of the space and half of the
   space." MACRO on top, RADAR below; each row stands still and shows as many whole lenses as it holds, turning a page every 20 s, the rows
   10 s apart so one half turns at a time. */
import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const read = (rel) => fs.readFileSync(new URL(rel, import.meta.url), "utf8");
const lens = read("../station-shells/lens-v1/index.html");
function fnFromSource(source, name, bindings = {}) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} must exist`);
  let depth = 0, end = -1;
  for (let i = source.indexOf("{", start); i < source.length; i += 1) {
    if (source[i] === "{") depth += 1;
    else if (source[i] === "}") { depth -= 1; if (depth === 0) { end = i + 1; break; } }
  }
  return vm.runInNewContext(`(${source.slice(start, end)})`, bindings);
}
const perPageOf = fnFromSource(lens, "perPageOf"), pageAt = fnFromSource(lens, "pageAt");
const pagesOrder = fnFromSource(lens, "pagesOrder"), pageLabel = fnFromSource(lens, "pageLabel");

test("W16 · whole lenses only: the wall's lens row (1051 px) holds four at the 250 px ask; a narrow row still one", () => {
  assert.equal(perPageOf(1051, 250, 6), 4);
  assert.equal(perPageOf(1300, 250, 6), 5);
  assert.equal(perPageOf(120, 250, 6), 1, "never zero");
  assert.equal(perPageOf(0, 250, 6), 1);
});

test("W16 · the page comes from the clock: every 20 s, the second row 10 s after the first, a one-page row never turns", () => {
  const T = 1_800_000_000_000 - (1_800_000_000_000 % 60000);   /* a whole minute: both rows on a page boundary of their own */
  assert.equal(pageAt(T, 0, 2, 3, 20000), pageAt(T + 19999, 0, 2, 3, 20000), "the top row holds its page 20 s");
  assert.equal(pageAt(T + 20000, 0, 2, 3, 20000), (pageAt(T, 0, 2, 3, 20000) + 1) % 3, "then turns once");
  const turnsAt = (row) => { const out = []; for (let s = 1; s <= 40; s++) if (pageAt(T + s * 1000, row, 2, 6, 20000) !== pageAt(T + (s - 1) * 1000, row, 2, 6, 20000)) out.push(s % 20); return out; };
  assert.notDeepEqual(turnsAt(0), turnsAt(1), "the rows turn at different moments");
  assert.equal(Math.abs(turnsAt(0)[0] - turnsAt(1)[0]), 10, "10 s apart");
  assert.equal(pageAt(T + 12345, 0, 2, 1, 20000), 0); assert.equal(pageAt(T, 1, 2, 0, 20000), 0);
});

test("W16 · MACRO on top, then RADAR, then MINE; the label says the set and a dot per page, the page shown filled", () => {
  assert.deepEqual(pagesOrder([{ s:"radar" }, { s:"macro" }, { s:"mine" }]).map((g) => g.s), ["macro", "radar", "mine"]);
  assert.equal(pageLabel("radar", 1, 6), "radar  ○ ● ○ ○ ○ ○");
  assert.equal(pageLabel("macro", 0, 1), "macro", "no dots when it never turns");
});

test("W16 · behind ?pages=1 only: the tape stays the default; the pages' row is never re-laid for the same page (no jump)", () => {
  assert.match(lens, /const PAGES = TAPE && QS\.get\("pages"\) === "1", PAGE_MS = 20000, PAGE_GAP_PX = 6;/);
  assert.match(lens, /function runTape\(\) \{\n  if \(PAGES\) return runPages\(\);/);
  const run = lens.slice(lens.indexOf("function runPages()"), lens.indexOf("function runPages()") + 1400);
  assert.match(run, /if \(win\.dataset\.page === mark\) return;/, "the same page is left alone");
  assert.match(run, /d\.hidden = Math\.floor\(i \/ k\) !== p;/, "one page shown");
  assert.match(lens, /if \(PAGES\) setInterval\(\(\) => \{ if \(!document\.hidden && !el\("set"\)\.matches\(":hover"\)\) runPages\(\); \}, 1000\);/, "the pointer holds the page");
  assert.match(lens, /body\.tape\.pages \.lens\[hidden\]\{ display:none; \}/);
});
