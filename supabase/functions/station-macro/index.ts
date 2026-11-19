// station-macro - 19 Nov 2026 (coordinator).
// Alan, 18:30 ET (relayed): "live data wired into the Station so we stop checking by hand: CME FedWatch odds (Dec/Jan/Mar), the Cleveland
// Fed inflation nowcast, 5y/10y breakevens (FRED T5YIE/T10YIE)."
// This function writes the two that need fetching into public.station_macro:
//   t5yie / t10yie - FRED's public CSV download (no key): the latest value and the one before it.
//   nowcast        - the Cleveland Fed's public chart files: the newest month's CPI / core CPI / PCE / core PCE, year-over-year and
//                    month-over-month.
// The Fed odds are not fetched here: CME has no free FedWatch feed, and our prediction_market_latest table already carries Polymarket's
// markets for each Fed meeting; the Station reads them directly and labels them "Polymarket".
// Called by pg_cron job 'station-macro' with the cron key (checked with push_cron_key_ok, the same as notify-push).
// Rollback: _archive/backend-fix-20260928/ROLLBACK-station-macro-20261119.txt

const SB = Deno.env.get("SUPABASE_URL")!, KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const H = { apikey: KEY, Authorization: "Bearer " + KEY, "content-type": "application/json" };
const CF = "https://www.clevelandfed.org/-/media/files/webcharts/inflationnowcasting/";

type Row = { key: string; label: string; value: number | null; prev: number | null; as_of: string; detail: Record<string, unknown> };

async function cronKeyOk(req: Request) {
  const b = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!b) return false;
  const r = await fetch(SB + "/rest/v1/rpc/push_cron_key_ok", { method: "POST", headers: H, body: JSON.stringify({ k: b }) });
  return r.ok && (await r.json()) === true;
}

async function fred(id: "T5YIE" | "T10YIE"): Promise<Row | null> {
  const since = new Date(Date.now() - 40 * 86400000).toISOString().slice(0, 10);
  const r = await fetch(`https://fred.stlouisfed.org/graph/fredgraph.csv?id=${id}&cosd=${since}`);
  if (!r.ok) throw new Error("FRED " + id + " " + r.status);
  const rows = (await r.text()).trim().split("\n").slice(1).map((l) => l.split(",")).filter((x) => x[1] && x[1] !== "." && !isNaN(+x[1]));
  const last = rows[rows.length - 1], prev = rows[rows.length - 2];
  if (!last) return null;
  return { key: id.toLowerCase(), label: id === "T5YIE" ? "5-year breakeven" : "10-year breakeven", value: +last[1], prev: prev ? +prev[1] : null, as_of: last[0], detail: { source: "FRED " + id } };
}

// deno-lint-ignore no-explicit-any
const lastChart = async (file: string): Promise<any> => {
  const r = await fetch(CF + file, { headers: { "user-agent": "Mozilla/5.0" } });
  if (!r.ok) throw new Error("Cleveland " + file + " " + r.status);
  const d = await r.json();
  return d[d.length - 1];
};
// deno-lint-ignore no-explicit-any
const pick = (c: any, name: string): number | null => {
  // deno-lint-ignore no-explicit-any
  const ds = (c?.dataset || []).find((x: any) => x.seriesname === name);
  // deno-lint-ignore no-explicit-any
  const v = (ds?.data || []).map((x: any) => x.value).filter((x: unknown) => x !== undefined && x !== null && x !== "");
  return v.length ? Math.round(+v[v.length - 1] * 1000) / 1000 : null;
};

async function cleveland(): Promise<Row | null> {
  const [yr, mo] = await Promise.all([lastChart("nowcast_year.json"), lastChart("nowcast_month.json")]);
  const month = String(yr?.chart?.subcaption || ""), asOf = String(yr?.chart?._comment || "").slice(0, 10);
  const detail = {
    source: "Cleveland Fed inflation nowcast", month,
    cpi_yoy: pick(yr, "CPI Inflation"), core_cpi_yoy: pick(yr, "Core CPI Inflation"),
    pce_yoy: pick(yr, "PCE Inflation"), core_pce_yoy: pick(yr, "Core PCE Inflation"),
    cpi_mom: pick(mo, "CPI Inflation"), core_cpi_mom: pick(mo, "Core CPI Inflation"),
  };
  if (detail.cpi_yoy == null) return null;
  return { key: "nowcast", label: "Inflation nowcast " + month, value: detail.cpi_yoy, prev: null, as_of: asOf, detail };
}

Deno.serve(async (req) => {
  if (!(await cronKeyOk(req))) return new Response(JSON.stringify({ error: "not allowed" }), { status: 401, headers: { "content-type": "application/json" } });
  const out: (Row & { updated_at: string })[] = [], errors: string[] = [];
  for (const job of [() => fred("T5YIE"), () => fred("T10YIE"), cleveland]) {
    try { const r = await job(); if (r) out.push({ ...r, updated_at: new Date().toISOString() }); } catch (e) { errors.push(String(e).slice(0, 160)); }
  }
  if (out.length) {
    const r = await fetch(SB + "/rest/v1/station_macro?on_conflict=key", { method: "POST", headers: { ...H, Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify(out) });
    if (!r.ok) errors.push("upsert " + r.status + " " + (await r.text()).slice(0, 160));
  }
  return new Response(JSON.stringify({ wrote: out.map((r) => r.key + "=" + r.value + " (" + r.as_of + ")"), errors }), { headers: { "content-type": "application/json" } });
});
