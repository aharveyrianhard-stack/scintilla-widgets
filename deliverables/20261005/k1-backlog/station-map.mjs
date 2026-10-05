/* K1 (5 Oct 2026) — the Station map sheet, rebuilt from the deck's own page list (deck/scenes.js) so it cannot drift:
   every page, in the order the rail shows it, with its timeframe, its charts and whether the rotation visits it.
     node station-map.mjs   →  STATION-MAP.html + station-map.json beside this file */
import fs from "node:fs"; import path from "node:path"; import vm from "node:vm"; import { fileURLToPath } from "node:url";
const here = path.dirname(fileURLToPath(import.meta.url)), root = path.resolve(here, "../../..");
const ctx = {}; vm.createContext(ctx); vm.runInContext(fs.readFileSync(path.join(root, "deck/scenes.js"), "utf8"), ctx);
const M = ctx.StationScenes, esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const rot = new Set(M.ROTATION_SCENES);
const rows = M.SCREENS.map((s, i) => {
  const wf = M.WORKFLOW_PAGES[s.id] || null, pre = M.PRESETS[s.id] || null, fam = M.FAMILIES[s.id] || null;
  const tickers = (M.pageTickers(s.id) || []).slice();
  const rotating = wf && wf.rotate ? wf.rotate.list.slice() : [];
  const groups = fam ? fam.map((g) => ({ label: g.label, tickers: g.tickers.slice(), range: g.range })) : null;
  const range = (wf && wf.range) || (pre && pre.range) || (groups ? [...new Set(groups.map((g) => g.range))].join(" / ") : "");
  const study = (wf && wf.study) || (pre && pre.study) || "";
  const kind = s.id === "todo" ? "TO-DO" : s.id === "scratch" ? "SCRATCH" : s.id === "scintillas" ? "filled by the day's scintillas" : wf && wf.targets ? "Alan's targets list" : groups ? "one group at a time" : "";
  return { n: i + 1, id: s.id, label: s.label, rail: s.short || s.label, rotation: rot.has(s.id), range, study, tickers, rotating, groups, kind,
           todo: s.id === "todo" ? M.TODO_CHARTS.map((t) => ({ ticker: t.ticker, note: t.note })) : null };
});
const out = { built: new Date().toISOString(), source: "deck/scenes.js", pages: rows.length, inRotation: rows.filter((r) => r.rotation).length, rows };
fs.writeFileSync(path.join(here, "station-map.json"), JSON.stringify(out, null, 1));
const names = (r) => r.groups ? r.groups.map((g) => `<div><b>${esc(g.label)}</b> <i>${esc(g.range)}</i> · ${g.tickers.map(esc).join(" ")}</div>`).join("")
  : r.todo ? r.todo.map((t) => `<div><b>${esc(t.ticker)}</b> <i>${esc(t.note)}</i></div>`).join("")
  : (r.tickers.length ? r.tickers.map(esc).join(" ") : `<i>${esc(r.kind || "—")}</i>`) + (r.rotating.length ? ` <i>· then two at a time: ${r.rotating.map(esc).join(" ")}</i>` : "") + (r.kind && r.tickers.length ? ` <i>· ${esc(r.kind)}</i>` : "");
const tr = (r) => `<tr class="${r.rotation ? "" : "menu"}"><td class="n">${r.n}</td><td><b>${esc(r.label)}</b>${r.rail !== r.label ? `<i> rail: ${esc(r.rail)}</i>` : ""}</td><td>${r.rotation ? "yes" : "menu only"}</td><td>${esc(r.range)}${r.study ? ` <i>+ ${esc(r.study)} fan</i>` : ""}</td><td class="c">${r.groups ? r.groups.reduce((a, g) => a + g.tickers.length, 0) : r.todo ? r.todo.length : r.tickers.length || "—"}</td><td>${names(r)}</td></tr>`;
const internals = rows.find((r) => r.id === "internalsFast"), ai = rows.find((r) => r.id === "themeFamilies");
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>SCINTILLA · Station map</title>
<style>
body{margin:0;background:#0c0c10;color:#c8c8cc;font:13px/1.55 Menlo,ui-monospace,monospace;padding:22px 16px 60px}
main{max-width:1180px;margin:0 auto} h1{font-size:17px;letter-spacing:.14em;color:#d2d2d2;margin:0 0 4px} p{margin:6px 0 14px;color:#a8a8ae;max-width:900px}
.tw{overflow-x:auto} table{border-collapse:collapse;width:100%;min-width:760px} th{font-size:11px;letter-spacing:.14em;color:#8a8a90;text-align:left;font-weight:400;padding:6px 8px;border-bottom:1px solid #2b2b31}
td{padding:6px 8px;border-bottom:1px solid #1c1c22;vertical-align:top} td.n,td.c{color:#8a8a90;text-align:right;width:28px} td b{color:#d2d2d2;font-weight:600} i{font-style:normal;color:#8a8a90}
tr.menu td{color:#a0a0a6} .k{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px;margin:14px 0 18px} .k div{border:1px solid #2b2b31;padding:10px 12px} .k b{display:block;color:#d2d2d2;font-size:20px}
details{margin-top:22px;border-top:1px solid #2b2b31;padding-top:8px;color:#8a8a90} summary{cursor:pointer;letter-spacing:.2em;font-size:11px;color:#a8a8ae}
</style></head><body><main>
<h1>STATION MAP</h1>
<p>Every page of the Station, in the order the rail shows it. Built from the Station's own page list on ${esc(new Date().toISOString().slice(0, 10))}, so it says what the Station does today.</p>
<div class="k"><div><b>${out.pages}</b>pages on the rail</div><div><b>${out.inRotation}</b>pages the rotation visits</div><div><b>${esc(internals.tickers.join(" + "))}</b>INTERNALS today (${esc(internals.range)}, RSI fan)</div><div><b>${ai.groups.length} groups</b>${ai.groups.map((g) => esc(g.label)).join(" · ")}</div></div>
<div class="tw"><table><thead><tr><th>#</th><th>PAGE</th><th>ROTATION</th><th>TIMEFRAME</th><th>CHARTS</th><th>NAMES</th></tr></thead><tbody>${rows.map(tr).join("")}</tbody></table></div>
<details class="sc-pagespecs"><summary>PAGE SPECS</summary>
<p>Source: deck/scenes.js on the Station's live code line. "Rotation: yes" = the automatic rotation visits the page; "menu only" = reachable from the rail, the menu and the arrows, never rotated. Which rotation pages show at a given hour depends on the session (intraday pages only between 04:00 and 18:00 New York; weekly pages always).
INTERNALS has been VIX and the put/call ratio only since 24 Sep: the four market-breadth pictures (advance/decline, tick, TRIN …) wait on TO-DO until we serve them ourselves. The AI groups are THEME FAMILIES: one group of six on screen at a time.
This sheet replaces the 23 Sep sheet (deliverables/20260923/station-scenes), which listed the pages copied from the TradingView layouts before the workflow pages existed. Rebuild it with: node deliverables/20261005/k1-backlog/station-map.mjs</p></details>
</main></body></html>`;
fs.writeFileSync(path.join(here, "STATION-MAP.html"), html);
console.log("pages", out.pages, "in rotation", out.inRotation, "| INTERNALS", internals.tickers.join(" "), "| AI", ai.groups.map((g) => g.label + ": " + g.tickers.join(" ")).join(" | "));
