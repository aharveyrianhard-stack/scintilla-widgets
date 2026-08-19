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

/* The retained non-equity roster, mirroring the measured live facts: these DO have rows in
   the legacy tables. The unsupported internals (ADD PCC CUMTICK TICK TRIN) deliberately do
   NOT — zero rows anywhere is their real, measured state, and /health's internals lane
   exists to keep that visible. */
export const NON_EQUITY = ["BTCUSD","ESUSD","NQUSD","CLUSD","GCUSD","SIUSD","DXUSD","US10Y","VIX"];
const SERVED = new Set([...EQUITIES, ...NON_EQUITY]);

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

/* PostgREST-ish filters the pages actually use: ticker eq./in., period eq., fiscal_date
   gt. Anything else passes through unfiltered — fixtures only need to be as smart as the
   questions asked of them. */
function applyFilters(rows, q) {
  let out = rows;
  const t = q.get("ticker") || "";
  if (t.startsWith("eq.")) out = out.filter((r) => r.ticker === t.slice(3));
  else if (t.startsWith("in.(")) { const want = t.slice(4, -1).split(","); out = out.filter((r) => want.includes(r.ticker)); }
  const period = q.get("period") || "";
  if (period.startsWith("eq.")) out = out.filter((r) => r.period === period.slice(3));
  const fd = q.get("fiscal_date") || "";
  if (fd.startsWith("gt.")) out = out.filter((r) => r.fiscal_date > fd.slice(3));
  return out;
}

export function supabaseRows(url) {
  const { table, q } = parseQuery(url);
  const limit = q.get("limit") != null ? Number(q.get("limit")) : null;
  const offset = Number(q.get("offset") || 0);
  const page = (rows) => applyFilters(rows, q).slice(offset, limit == null ? undefined : offset + limit);

  if (table === "ticker_cohorts") return page(membershipRows);
  if (table === "hub_favorites")
    return page(FAVORITES.map((ticker, i) => ({ ticker, added_at: "2026-08-0" + (i + 1) + "T00:00:00Z" })));
  if (table === "tickers") {
    const rows = EQUITIES.map((ticker) => ({ ticker, type: null, cohort: HOME[ticker] || null, active: true }));
    return page(rows);
  }
  if (table === "composite_staged")
    return page([...EQUITIES, ...NON_EQUITY].map((ticker, i) => ({ ticker, tf: "D",
      trend: ((i % 5) - 2) / 4, momentum: ((i % 3) - 1) / 3,
      composite: (((i % 5) - 2) / 4 + ((i % 3) - 1) / 3) / 2,
      structure: 0, conviction: 0, updated_ts: Math.floor(Date.now() / 1000) - 60 })));
  if (table === "live_quotes")
    return page([...EQUITIES, ...NON_EQUITY].map((ticker) => ({ ticker, price: price(ticker),
      prev_close: price(ticker) - 1, chg_pct: 0.5, volume: 1e6,
      updated_ts: new Date(Date.now() - 30000).toISOString() })));
  /* ---- the fundamentals/DCF spine — deterministic rows derived from price(sym) ---- */
  if (table === "fundamentals")
    return page(EQUITIES.map((ticker) => ({ ticker, revenue_ttm: price(ticker) * 1e9,
      market_cap: price(ticker) * 2e9, trailing_pe: 30, eps_ttm: price(ticker) / 30,
      price: price(ticker) - 5, updated_ts: new Date(Date.now() - 3600e3).toISOString() })));
  if (table === "balance_history")
    /* The FY fiscal_date matches fundamentals_history's latest FY — the live tables carry
       matching FY dates per ticker (measured 2026-08-19), and the DCF baseline derivation
       refuses ratios across mismatched dates, so the fixture must be as consistent as the
       real data or it would test the refusal instead of the arithmetic. net_debt is a real
       live column, consistent here with total_debt − cash_and_equiv. */
    return page(EQUITIES.map((ticker) => ({ ticker, fiscal_date: "2026-01-31", period: "FY",
      total_debt: price(ticker) * 2e8, cash_and_equiv: price(ticker) * 1e8,
      net_debt: price(ticker) * 1e8,
      current_assets: price(ticker) * 4e8, current_liabilities: price(ticker) * 2.5e8,
      total_equity: price(ticker) * 9e8, updated_ts: new Date(Date.now() - 3600e3).toISOString() })));
  if (table === "fundamentals_history") {
    const rows = [];
    for (const ticker of EQUITIES) {
      const rev = price(ticker) * 1e9;
      for (let i = 0; i < 4; i++) rows.push({ ticker, fiscal_date: "2026-0" + (6 - i) + "-30",
        period: "Q" + (4 - i), revenue: rev / 4, ebitda: rev / 4 * 0.42, operating_income: rev / 4 * 0.36,
        net_income: rev / 4 * 0.25, gross_profit: rev / 4 * 0.6, shares_dil: 2.4e9 });
      for (let i = 0; i < 4; i++) rows.push({ ticker, fiscal_date: (2026 - i) + "-01-31",
        period: "FY", revenue: rev * Math.pow(0.8, i), ebitda: rev * 0.42 * Math.pow(0.8, i),
        operating_income: rev * 0.36 * Math.pow(0.8, i), net_income: rev * 0.25 * Math.pow(0.8, i),
        gross_profit: rev * 0.6 * Math.pow(0.8, i), shares_dil: 2.4e9 });
    }
    return page(rows);
  }
  if (table === "cashflow_history") {
    const rows = [];
    for (const ticker of EQUITIES) {
      const rev = price(ticker) * 1e9;
      for (let i = 0; i < 4; i++) rows.push({ ticker, fiscal_date: "2026-0" + (6 - i) + "-30",
        period: "Q" + (4 - i), capex: -(rev / 4) * 0.06 });
      rows.push({ ticker, fiscal_date: "2026-01-31", period: "FY", capex: -rev * 0.06 });
    }
    return page(rows);
  }
  if (table === "analyst_estimates") {
    const rows = [];
    for (const ticker of EQUITIES) {
      const rev = price(ticker) * 1e9;
      for (let i = 1; i <= 5; i++) rows.push({ ticker, fiscal_date: (2026 + i) + "-01-31",
        period: "annual", est_revenue_avg: rev * Math.pow(1.15, i), est_eps_avg: (price(ticker) / 30) * Math.pow(1.15, i) });
    }
    return page(rows);
  }
  if (table === "ratios_history")
    return page(EQUITIES.map((ticker) => ({ ticker, fiscal_date: "2026-06-30",
      dividend_yield: 0.004, pe: 30 })));
  if (table === "treasury_rates")
    return page([{ date: new Date().toISOString().slice(0, 10), y10: 4.28,
      updated_ts: new Date(Date.now() - 3600e3).toISOString() }]);
  if (table === "vix_term")
    return page([{ date: new Date().toISOString().slice(0, 10), vix: 18.5, vix3m: 20.1,
      ratio: 0.92, updated_ts: new Date(Date.now() - 3600e3).toISOString() }]);
  if (table === "ohlcv_history") {
    /* Non-provider symbols keep their legacy owner; serve deterministic bars so a
       passthrough history read succeeds the way the live table would — but only for
       symbols the live table actually carries. The unsupported internals have zero rows
       anywhere, and a fixture that invents some would hide the exact state the /health
       internals lane exists to show. */
    const filter = q.get("ticker") || "";
    const sym = filter.startsWith("eq.") ? filter.slice(3) : null;
    if (!sym || !SERVED.has(sym)) return [];
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
