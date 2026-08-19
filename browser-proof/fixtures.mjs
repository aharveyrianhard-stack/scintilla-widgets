/* Deterministic stand-ins for the two data owners, served to a REAL browser.
   =========================================================================
   Outbound HTTPS to Supabase and the provider is blocked in the verification
   environment (CONNECT 403 at the proxy), so these proofs run the actual pages in a real
   Chromium against intercepted network: every request the page would send to an owner is
   answered here, from one consistent fixture universe. That verifies the PAGES' behavior
   — routing, replacement, labels, repaint — not the owners' data. The receipts say so.

   One universe, used by every fixture, so the shim's ownership identity check passes the
   same way it does live: /geiger's symbols and the canonical tickers query answer with the
   SAME set, under the accepted equalizer digest. */

export const EQUALIZER = "f6cf97b57cf26a37aeb8393dec676f1776b02da282dffcce95786e5762697ad1";

export const EQUITIES = ["AAPL","ADBE","AMD","AMZN","AVGO","CRM","GOOGL","IWM","META","MSFT",
  "MU","NBIS","NOW","NVDA","ORCL","PLTR","QQQ","RSP","SNDK","SNOW","SPY","TSLA"];

export const COHORTS = {
  AI_SOFTWARE: ["ADBE","CRM","MSFT","NOW","ORCL","PLTR","SNOW"],
  MEGACAP:     ["AAPL","AMZN","GOOGL","META","MSFT","NVDA","TSLA"],
  AI_HARDWARE: ["AMD","AVGO","MU","NVDA","SNDK"],
  GROWTH:      ["NBIS","PLTR","SNOW","TSLA"],
};

export const FAVORITES = ["MU","NBIS","SNDK"];

const HOME = {};
for (const [cohort, members] of Object.entries(COHORTS))
  for (const t of members) if (!HOME[t]) HOME[t] = cohort;

const price = (sym) => 50 + (Array.from(sym).reduce((a, c) => a + c.charCodeAt(0), 0) % 400);

/* ---- Supabase PostgREST ------------------------------------------------------------- */

function parseQuery(url) {
  const u = new URL(url);
  const table = u.pathname.replace(/^\/rest\/v1\//, "").replace(/^\/+/, "");
  return { table, q: u.searchParams };
}

const membershipRows = Object.entries(COHORTS)
  .flatMap(([cohort, members]) => members.map((ticker) => ({ ticker, cohort })))
  .sort((a, b) => a.ticker.localeCompare(b.ticker) || a.cohort.localeCompare(b.cohort));

export function supabaseRows(url) {
  const { table, q } = parseQuery(url);
  const limit = q.get("limit") != null ? Number(q.get("limit")) : null;
  const offset = Number(q.get("offset") || 0);
  const page = (rows) => rows.slice(offset, limit == null ? undefined : offset + limit);

  if (table === "ticker_cohorts") return page(membershipRows);
  if (table === "hub_favorites")
    return page(FAVORITES.map((ticker, i) => ({ ticker, added_at: "2026-08-0" + (i + 1) + "T00:00:00Z" })));
  if (table === "tickers") {
    const rows = EQUITIES.map((ticker) => ({ ticker, type: null, cohort: HOME[ticker] || null, active: true }));
    return page(rows);
  }
  if (table === "composite_staged")
    return page(EQUITIES.map((ticker, i) => ({ ticker, tf: "D",
      trend: ((i % 5) - 2) / 4, momentum: ((i % 3) - 1) / 3,
      composite: (((i % 5) - 2) / 4 + ((i % 3) - 1) / 3) / 2,
      structure: 0, conviction: 0, updated_ts: Math.floor(Date.now() / 1000) - 60 })));
  if (table === "live_quotes") {
    let rows = EQUITIES.map((ticker) => ({ ticker, price: price(ticker),
      prev_close: price(ticker) - 1, chg_pct: 0.5, volume: 1e6,
      updated_ts: new Date(Date.now() - 30000).toISOString() }));
    const filter = q.get("ticker") || "";
    const wanted = filter.startsWith("in.(") ? filter.slice(4, -1).split(",")
      : filter.startsWith("eq.") ? [filter.slice(3)] : null;
    if (wanted) rows = rows.filter((r) => wanted.includes(r.ticker));
    return page(rows);
  }
  if (table === "ohlcv_history") {
    /* Non-provider symbols keep their legacy owner; serve deterministic bars so a
       passthrough history read succeeds the way the live table would. */
    const filter = q.get("ticker") || "";
    const sym = filter.startsWith("eq.") ? filter.slice(3) : null;
    if (!sym) return [];
    const base = price(sym);
    const now = Math.floor(Date.now() / 1000);
    const n = limit == null ? 200 : Math.min(limit, 400);
    return Array.from({ length: n }, (_, i) => {
      const t = now - i * 3600;
      const c = base + Math.sin(i / 7) * base * 0.02;
      return { ticker: sym, timestamp: t, open: c - 0.4, high: c + 0.8, low: c - 0.9, close: c, volume: 1e5 + i };
    });
  }
  if (table === "news") return [];
  if (table === "spine_events" || table === "feed_alerts" || table === "youtube_feed") return [];
  return [];
}

/* ---- Provider (Fly) ----------------------------------------------------------------- */

export function providerJson(url) {
  const u = new URL(url);
  if (u.pathname === "/geiger") {
    const symbols = {};
    for (const [i, sym] of EQUITIES.entries())
      symbols[sym] = { composite: (((i % 5) - 2) / 4 + ((i % 3) - 1) / 3) / 2,
        trend: ((i % 5) - 2) / 4, momentum: ((i % 3) - 1) / 3 };
    return { symbols, equalizer_receipt_sha256: EQUALIZER,
      computed_utc: new Date(Date.now() - 45000).toISOString() };
  }
  if (u.pathname === "/quotes") {
    const wanted = (u.searchParams.get("symbols") || "").split(",").filter(Boolean);
    const quotes = {};
    for (const sym of wanted) if (EQUITIES.includes(sym))
      quotes[sym] = { state: "OK", price: price(sym), previous_close: price(sym) - 1,
        price_observation_utc: new Date(Date.now() - 20000).toISOString() };
    return { quotes };
  }
  if (u.pathname === "/candles") {
    const sym = u.searchParams.get("symbol");
    const lim = Math.min(400, Number(u.searchParams.get("limit") || 200));
    if (!EQUITIES.includes(sym)) return { series: [], absence: "NOT_OBSERVED_BY_STREAM" };
    const base = price(sym);
    const now = Date.now();
    const series = Array.from({ length: lim }, (_, i) => {
      const t = now - i * 3600_000;
      const c = base + Math.sin(i / 7) * base * 0.02;
      return { t, o: c - 0.4, h: c + 0.8, l: c - 0.9, c, v: 1e5 + i };
    });
    return { series };
  }
  if (u.pathname === "/health" || u.pathname === "/quotes/health") return { ok: true };
  return null;
}
