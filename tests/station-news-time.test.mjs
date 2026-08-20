/* STATION-003 — /news dated every current item at roughly 20,684 days old.
   =====================================================================
   20,684 days is not a parsing curiosity. It is Date.now() expressed in days: the age of
   the Unix epoch. The path there was three steps, none of which could notice:

     order=published_ts.desc  ->  Postgres DESC is NULLS FIRST
     news rows with published_ts NULL  ->  all 60 rows of the default page
     num(null) * 1000  ->  0  ->  ago(0)  ->  "20684d"

   Measured on the live table: 312,664 rows, 1,246 of them with a NULL published_ts, and all
   60 rows of `order by published_ts desc limit 60` were NULLs.

   The required cases are covered below: current, seconds, milliseconds, ISO, invalid, and
   missing. The contract is that a missing or unusable time is NAMED, never computed.
*/
import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const news = fs.readFileSync(new URL("../news/index.html", import.meta.url), "utf8");

function fnFrom(name, bindings = {}) {
  const start = news.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} must exist`);
  let depth = 0, end = -1;
  for (let i = news.indexOf("{", start); i < news.length; i += 1) {
    if (news[i] === "{") depth += 1;
    if (news[i] === "}") depth -= 1;
    if (depth === 0) { end = i + 1; break; }
  }
  return vm.runInNewContext(`(${news.slice(start, end)})`, bindings);
}

const BASE = { NEWS_MS_THRESHOLD:1e12, NEWS_NUMERIC:/^\s*-?\d+(?:\.\d+)?\s*$/, Number, isFinite, Date, String };
/* Extracted lazily so the string-level contract tests below still run — and still fail
   individually — against a tree where newsInstant does not exist yet. */
const parser = () => fnFrom("newsInstant", { ...BASE });

/* A fixed instant so the expectations are arithmetic, not wall-clock. */
const NOW_S = 1787123463;            // the live table's newest published_ts
const NOW_MS = NOW_S * 1000;

test("a current item keeps its own time", () => {
  const instant = parser();
  const r = instant(NOW_S);
  assert.equal(r.known, true);
  assert.equal(r.ms, NOW_MS);
  assert.equal(r.unit, "s");
  assert.equal(new Date(r.ms).getUTCFullYear(), 2026);
});

test("epoch seconds are read as seconds", () => {
  const instant = parser();
  for (const seconds of [988700400, 1600000000, NOW_S]) {
    const r = instant(seconds);
    assert.equal(r.known, true);
    assert.equal(r.unit, "s");
    assert.equal(r.ms, seconds * 1000);
  }
  /* PostgREST can hand a bigint back as a string; that must not change the reading. */
  const asText = instant(String(NOW_S));
  assert.equal(asText.known, true);
  assert.equal(asText.ms, NOW_MS);
});

test("epoch milliseconds are read as milliseconds, not multiplied again", () => {
  const instant = parser();
  const r = instant(NOW_MS);
  assert.equal(r.known, true);
  assert.equal(r.unit, "ms");
  assert.equal(r.ms, NOW_MS, "a writer switching units cannot move every headline by 1000x");
  assert.equal(new Date(r.ms).getUTCFullYear(), 2026);
  /* The dividing line is unambiguous for every value this column can hold. */
  assert.equal(instant(1e12 - 1).unit, "s");
  assert.equal(instant(1e12).unit, "ms");
});

test("an ISO string is read as an instant", () => {
  const instant = parser();
  const iso = new Date(NOW_MS).toISOString();
  const r = instant(iso);
  assert.equal(r.known, true);
  assert.equal(r.unit, "iso");
  assert.equal(r.ms, NOW_MS);
  assert.equal(instant("2026-08-19T00:00:00Z").ms, Date.parse("2026-08-19T00:00:00Z"));
});

test("an invalid value is named invalid and never becomes a number", () => {
  const instant = parser();
  for (const bad of ["not a date", "NaN", {}, [], true, false, -1, 0, "0", "-17"]) {
    const r = instant(bad);
    assert.equal(r.known, false, `${JSON.stringify(bad)} must not read as a known time`);
    assert.equal(r.ms, null, `${JSON.stringify(bad)} must not carry a number`);
    assert.equal(r.reason, "INVALID");
  }
});

test("a missing value is named missing — this is the 20,684-day defect itself", () => {
  const instant = parser();
  for (const empty of [null, undefined, ""]) {
    const r = instant(empty);
    assert.equal(r.known, false);
    assert.equal(r.ms, null);
    assert.equal(r.reason, "MISSING");
  }
  /* The exact arithmetic the old page performed. It must no longer be reachable. */
  const num = (x) => (x == null ? null : Number(x));
  assert.equal(num(null) * 1000, 0, "null*1000 is 0 — the bug's whole mechanism");
  assert.equal(instant(null).ms, null, "and nothing here produces that 0");
});

test("an unknown time is labelled, not rendered as an age", () => {
  const label = fnFrom("newsAgeLabel", { ...BASE, newsInstant:parser(), NEWS_UNKNOWN_AGE:"no date",
    ago:(ms) => "AGE:" + ms });
  assert.equal(label(NOW_S), "AGE:" + NOW_MS);
  assert.equal(label(null), "no date");
  assert.equal(label("not a date"), "no date");
  assert.equal(label(""), "no date");
  /* No branch anywhere may hand a non-instant to the age formatter. */
  assert.doesNotMatch(news, /ago\(num\(/);
  assert.doesNotMatch(news, /num\(r\.published_ts\) \* 1000/);
  assert.doesNotMatch(news, /num\(rows\[0\]\.published_ts\) \* 1000/);
});

test("the header reports the newest DATED item and counts the undated ones", () => {
  const newest = fnFrom("newestKnownInstant", { ...BASE, newsInstant:parser() });

  const mixed = newest([
    { published_ts:null }, { published_ts:NOW_S - 3600 }, { published_ts:NOW_S }, { published_ts:"" },
  ]);
  assert.equal(mixed.ms, NOW_MS, "an undated row cannot become the newest item");
  assert.equal(mixed.undated, 2);
  assert.equal(mixed.total, 4);

  /* The page that produced the defect: every row undated. It must say so. */
  const allUndated = newest(Array.from({ length:60 }, () => ({ published_ts:null })));
  assert.equal(allUndated.ms, null);
  assert.equal(allUndated.undated, 60);
  assert.match(news, /NO DATED ITEMS/);

  assert.deepEqual({ ...newest([]) }, { ms:null, undated:0, total:0 });
});

test("the query asks for dated items first", () => {
  /* Postgres DESC is NULLS FIRST; without this the 1,246 undated rows own every page. */
  assert.match(news, /order=published_ts\.desc\.nullslast/);
  assert.doesNotMatch(news, /order=published_ts\.desc&/);
});

test("an undated item is still listed, and is visibly not an age", () => {
  assert.match(news, /data-undated="1"/, "the undated marker reaches the row");
  assert.match(news, /\.ago\[data-undated\]\{/, "and it is styled so it cannot read as a number");
  assert.match(news, /title="published time not recorded"/);
  /* Dropping the row would be a different lie: the item exists, its time does not. */
  assert.doesNotMatch(news, /rows\s*=\s*rows\.filter\([^)]*published_ts/);
});

test("the undated list is paged under the table's own primary key", () => {
  /* Putting the dated wire first made the 1,246 undated rows unreachable by scrolling, so they
     got their own door — and a single capped page reached 200 of them and left the rest exactly
     as unreachable, which is a narrower promise wearing the same words.

     The order is the table's PRIMARY KEY, (ticker, url), verified against pg_constraint. That
     matters because `url` ALONE is not unique here — 1,240 distinct urls across 1,246 undated
     rows — so ordering by url would let a row appear on two pages or on none. Offset paging is
     only paging under a total order. */
  assert.match(news, /const UNDATED_ORDER = "ticker\.asc,url\.asc";/);
  assert.match(news, /published_ts=is\.null&order=" \+ UNDATED_ORDER \+ "&offset=" \+ offset/);
  assert.match(news, /const PAGE = Math\.max\(1, Math\.min\(9999, \+\(QS\.get\("page"\) \|\| 1\)\)\);/);
  assert.doesNotMatch(news, /published_ts=is\.null&order=url\.asc/, "url alone is not unique");
});

test("page 2 and the final page are reachable, with no duplicate and no omission", () => {
  const paging = (() => {
    const start = news.indexOf("function undatedPaging(");
    let depth = 0, end = -1;
    for (let i = news.indexOf("{", start); i < news.length; i += 1) {
      if (news[i] === "{") depth += 1;
      if (news[i] === "}") depth -= 1;
      if (depth === 0) { end = i + 1; break; }
    }
    return vm.runInNewContext(`(${news.slice(start, end)})`, { Math });
  })();

  /* The live shape: 1246 undated rows at the page size the route caps to. */
  const TOTAL = 1246, LIMIT = 200;
  const pages = Math.ceil(TOTAL / LIMIT);
  assert.equal(pages, 7, "1246 undated rows need seven pages, not one");

  const first = paging(TOTAL, 1, LIMIT, LIMIT);
  assert.deepEqual({ from:first.from, to:first.to, hasPrevious:first.hasPrevious, hasNext:first.hasNext },
    { from:1, to:200, hasPrevious:false, hasNext:true });

  const second = paging(TOTAL, 2, LIMIT, LIMIT);
  assert.deepEqual({ from:second.from, to:second.to, hasPrevious:second.hasPrevious, hasNext:second.hasNext },
    { from:201, to:400, hasPrevious:true, hasNext:true }, "page 2 is reachable and knows both neighbours");

  const last = paging(TOTAL, pages, LIMIT, TOTAL - (pages - 1) * LIMIT);
  assert.deepEqual({ from:last.from, to:last.to, hasPrevious:last.hasPrevious, hasNext:last.hasNext },
    { from:1201, to:1246, hasPrevious:true, hasNext:false }, "the final page ends exactly on the total");

  /* Every row is covered exactly once across the whole walk. */
  const seen = new Set();
  for (let page = 1; page <= pages; page += 1) {
    const rowsOnPage = Math.min(LIMIT, TOTAL - (page - 1) * LIMIT);
    const p = paging(TOTAL, page, LIMIT, rowsOnPage);
    for (let i = p.from; i <= p.to; i += 1) {
      assert.equal(seen.has(i), false, `row ${i} appears on more than one page`);
      seen.add(i);
    }
  }
  assert.equal(seen.size, TOTAL, "every undated row is reachable exactly once");

  /* The reader is told where they are and what is either side. */
  assert.match(news, /p\.from \+ "–" \+ p\.to \+ " of " \+ \(p\.total == null \? "\?" : p\.total\) \+ " undated"/);
  assert.match(news, /‹ prev/);
  assert.match(news, /next ›/);
  /* And no epoch age can appear on that list. */
  assert.match(news, /NEWS_UNKNOWN_AGE = "no date"/);
});
