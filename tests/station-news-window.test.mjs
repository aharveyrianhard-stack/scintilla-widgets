// NEWS-WINDOW (Station /news) - review regression. The dated wire reads the last 7 days first and falls back to the ORIGINAL
// read when the page comes back short; ?undated=1 is untouched. Offline: the page's whole script runs against a stub
// document and a simulated PostgREST news table (fetch is a stub; nothing leaves the process).
// SC_PAGE=<path to a copy of news/index.html> overrides the page under test.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const html = fs.readFileSync(process.env.SC_PAGE || new URL("../news/index.html", import.meta.url), "utf8");
const CODE = html.slice(html.lastIndexOf("<script>") + 8, html.lastIndexOf("</script>"));
const NOW_S = 1789750000, NOW_MS = NOW_S * 1000;
const WINDOW_TAG = "published_ts=gte.";

function serve(table, path) {
  const [res, qs] = path.split("?");
  if (res !== "news") return [];
  let rows = table.slice(), limit = Infinity, offset = 0, order = null;
  for (const part of qs.split("&")) {
    const i = part.indexOf("="); const k = part.slice(0, i), v = decodeURIComponent(part.slice(i + 1));
    if (k === "select") continue;
    if (k === "limit") { limit = +v; continue; }
    if (k === "offset") { offset = +v; continue; }
    if (k === "order") { order = v; continue; }
    const [op, ...rest] = v.split("."); const arg = rest.join(".");
    if (op === "eq") rows = rows.filter((r) => String(r[k]) === arg);
    else if (op === "gte") rows = rows.filter((r) => r[k] != null && r[k] >= +arg);
    else if (op === "is" && arg === "null") rows = rows.filter((r) => r[k] == null);
    else throw new Error("simulator: unsupported " + part);
  }
  if (order === "published_ts.desc.nullslast")
    rows = rows.map((r, i) => [r, i]).sort((x, y) => (x[0].published_ts == null) - (y[0].published_ts == null) ||
      (y[0].published_ts ?? 0) - (x[0].published_ts ?? 0) || x[1] - y[1]).map((x) => x[0]);
  else if (order === "ticker.asc,url.asc") rows.sort((a, b) => (a.ticker < b.ticker ? -1 : a.ticker > b.ticker ? 1 : a.url < b.url ? -1 : a.url > b.url ? 1 : 0));
  else if (order) throw new Error("simulator: unsupported order " + order);
  return rows.slice(offset, offset + limit);
}
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
function table(seed, n) {
  const r = rng(seed), out = [];
  for (let i = 0; i < n; i++) {
    const x = r(); let ts;
    if (x < 0.06) ts = null; else if (x < 0.08) ts = NOW_S + Math.floor(r() * 3600);
    else if (x < 0.5) ts = NOW_S - Math.floor(r() * 7 * 86400); else ts = NOW_S - 8 * 86400 - Math.floor(r() * 300 * 86400);
    if (x > 0.97 && out.length) ts = out[out.length - 1].published_ts;
    out.push({ ticker: ["KVUE", "NVDA", "AMD"][Math.floor(r() * 3)], url: "https://x.example/" + i, published_ts: ts, title: "h" + i,
      site: "s", snippet: "", feed: "google", cohort: ["MEGACAP", "ASIA"][Math.floor(r() * 2)], updated_ts: NOW_S - 60 });
  }
  return out;
}
class FixedDate extends Date { constructor(...a) { super(...(a.length ? a : [NOW_MS])); } static now() { return NOW_MS; } }

async function station({ tbl, search = "", fail = () => false }) {
  const els = {}; const el = (id) => (els[id] = els[id] || { innerHTML: "", textContent: "" });
  const reads = []; let interval = null;
  const fetch = async (u, init = {}) => {
    const path = String(u).split("/rest/v1/")[1]; const method = init.method || "GET";
    if (method === "HEAD") return { ok: true, status: 200, headers: { get: () => "0-0/" + tbl.filter((r) => r.published_ts == null).length } };
    const windowed = path.includes(WINDOW_TAG);
    if (path.startsWith("news?")) { reads.push({ path, windowed }); if (fail(path, windowed, reads.filter((c) => c.windowed === windowed).length)) return { ok: false, status: 500, json: async () => ({}) }; }
    return { ok: true, status: 200, json: async () => serve(tbl, path), headers: { get: () => null } };
  };
  new Function("document", "location", "fetch", "setInterval", "setTimeout", "Date", CODE)(
    { getElementById: el, body: { classList: { add() {} } } }, { search, pathname: "/news" }, fetch,
    (fn) => { interval = fn; return 1; }, (fn) => { fn(); return 0; }, FixedDate);
  const settle = async () => { for (let i = 0; i < 80; i++) await new Promise((r) => setImmediate(r)); };
  await settle();
  return { reads, els, rendered: () => [...els.list.innerHTML.matchAll(/class="row" href="([^"]*)"/g)].map((m) => m[1]),
    tick: async () => { interval(); await settle(); } };
}
const originalUrls = (tbl, filterFn, limit = 60) => serve(tbl.filter(filterFn), "news?order=published_ts.desc.nullslast&limit=" + limit).map((r) => r.url);

test("default page (busy): ONE news read, windowed; the rendered page is exactly the original page", async () => {
  const tbl = table(4, 600);
  const s = await station({ tbl });
  assert.equal(s.reads.length, 1); assert.ok(s.reads[0].windowed);
  assert.deepEqual(s.rendered(), originalUrls(tbl, () => true));
});

test("quiet ticker with undated rows: falls back to the original read and shows the undated rows it showed", async () => {
  const tbl = [
    ...Array.from({ length: 3 }, (_, i) => ({ ticker: "KVUE", url: "u/n" + i, published_ts: NOW_S - i * 3600, title: "n", updated_ts: NOW_S })),
    ...Array.from({ length: 20 }, (_, i) => ({ ticker: "KVUE", url: "u/o" + i, published_ts: NOW_S - 40 * 86400 - i, title: "o", updated_ts: NOW_S })),
    ...Array.from({ length: 2 }, (_, i) => ({ ticker: "KVUE", url: "u/u" + i, published_ts: null, title: "u", updated_ts: NOW_S })),
    ...table(8, 300).filter((r) => r.ticker !== "KVUE"),
  ];
  const s = await station({ tbl, search: "?t=KVUE" });
  assert.deepEqual(s.rendered(), originalUrls(tbl, (r) => r.ticker === "KVUE"));
  assert.equal((s.els.list.innerHTML.match(/data-undated="1"/g) || []).length, 2);
});

test("property: 150 random tables x 3 filters - the rendered page always equals the original page", async () => {
  for (let seed = 1; seed <= 150; seed++) {
    const tbl = table(seed, 40 + (seed * 13) % 400);
    for (const [search, f] of [["", () => true], ["?t=KVUE", (r) => r.ticker === "KVUE"], ["?cohort=ASIA", (r) => r.cohort === "ASIA"]]) {
      const s = await station({ tbl, search });
      assert.deepEqual(s.rendered(), originalUrls(tbl, f), "seed " + seed + " " + search);
    }
  }
});

test("a quiet page pays for ONE read per refresh after its first tick", async () => {
  const tbl = table(21, 200);
  const s = await station({ tbl, search: "?t=KVUE" });
  const first = s.reads.length;
  assert.equal(first, 2);
  await s.tick(); await s.tick();
  assert.equal(s.reads.length - first, 2, "two refreshes = two reads");
  assert.ok(s.reads.slice(first).every((c) => !c.windowed));
});

test("a failing window read falls back to the original read (never a failure where today's read works)", async () => {
  const tbl = table(6, 500);
  const s = await station({ tbl, fail: (p, w) => w });
  assert.deepEqual(s.rendered(), originalUrls(tbl, () => true));
  assert.doesNotMatch(s.els.list.innerHTML, /the news read failed/);
});

test("worst case per tick with pg()'s 3 tries: at most 6 news requests, the unbounded read at most 3 (= today); total failure is named", async () => {
  const tbl = table(2, 400);
  for (const fail of [() => true, (p, w) => !w]) {
    const s = await station({ tbl: fail.length ? tbl.slice(0, 30) : tbl, search: "?t=KVUE", fail });
    assert.ok(s.reads.length <= 6, s.reads.length + " requests");
    assert.ok(s.reads.filter((c) => !c.windowed).length <= 3);
    assert.match(s.els.list.innerHTML, /the news read failed/);
  }
});

test("?undated=1 is untouched: one read, no window, primary-key order", async () => {
  const s = await station({ tbl: table(3, 300), search: "?undated=1" });
  assert.equal(s.reads.length, 1);
  assert.ok(!s.reads[0].windowed);
  assert.match(s.reads[0].path, /published_ts=is\.null&order=ticker\.asc,url\.asc&offset=0/);
});
