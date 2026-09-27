/* A read-only static server for ONE tree (this worktree, or the untouched c8deb69 export used for the
   "before" pictures), plus the disclosed chart-API proxy. The chart API answers only the origin
   https://scintillahub.ai, so a headless page's GET to scintilla-massive-chart-api.fly.dev is re-issued by
   node with that Origin header and handed back unchanged. Every other off-machine request is refused
   (no Supabase, no fonts, no TradingView): the deck falls back to its built-in TARGETS list. */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const MIME = { ".html":"text/html; charset=utf-8", ".js":"text/javascript; charset=utf-8", ".mjs":"text/javascript; charset=utf-8",
  ".css":"text/css", ".json":"application/json", ".png":"image/png", ".jpg":"image/jpeg", ".svg":"image/svg+xml", ".ico":"image/x-icon",
  ".webmanifest":"application/manifest+json" };

export async function serve(root) {
  const ROOT = path.resolve(root);
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, "http://localhost");
    const rel = decodeURIComponent(url.pathname);
    let file = path.join(ROOT, rel);
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, "index.html");
    else if (!fs.existsSync(file) && fs.existsSync(file + "/index.html")) file = file + "/index.html";
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404, { "content-type": "text/plain" }); res.end("not found: " + rel); return;
    }
    res.writeHead(200, { "content-type": MIME[path.extname(file)] || "application/octet-stream", "cache-control": "no-store" });
    res.end(fs.readFileSync(file));
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  return { server, base: `http://127.0.0.1:${server.address().port}` };
}
export function proxyApi(ctx, tally) {
  return ctx.route("**://scintilla-massive-chart-api.fly.dev/**", async (route) => {
    const req = route.request();
    if (req.method() !== "GET") { tally.refused++; return route.abort(); }
    const u = new URL(req.url());
    tally.calls++;
    const tf = u.searchParams.get("tf");
    if (u.pathname.endsWith("/candles")) tally.byTf[tf] = (tally.byTf[tf] || 0) + 1;
    try {
      const r = await fetch(req.url(), { headers: { Origin: "https://scintillahub.ai", Accept: "application/json" } });
      const body = Buffer.from(await r.arrayBuffer());
      await route.fulfill({ status: r.status, body, headers: { "content-type": r.headers.get("content-type") || "application/json", "access-control-allow-origin": "*" } });
    } catch (err) { tally.failed++; await route.abort(); }
  });
}
export function refuseOutside(ctx, base) {
  return ctx.route((url) => { const s = String(url); return !s.startsWith(base) && !s.includes("scintilla-massive-chart-api.fly.dev"); }, (route) => route.abort());
}
export const newTally = () => ({ calls: 0, failed: 0, refused: 0, byTf: {} });
