/* A read-only static server for the worktree plus the disclosed API proxy, shared by shots.mjs and cpu.mjs.
   The chart API answers only the origin https://scintillahub.ai, so a headless page's requests to
   scintilla-massive-chart-api.fly.dev are re-issued by node with that Origin header and handed back.
   The URL, route and parameters are the page's own; only the origin header is supplied. GET only. */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(fileURLToPath(new URL("../../../..", import.meta.url)));
const MIME = { ".html":"text/html; charset=utf-8", ".js":"text/javascript; charset=utf-8", ".mjs":"text/javascript; charset=utf-8",
  ".css":"text/css", ".json":"application/json", ".png":"image/png", ".jpg":"image/jpeg", ".svg":"image/svg+xml", ".ico":"image/x-icon",
  ".webmanifest":"application/manifest+json" };

export async function serve() {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, "http://localhost");
    let rel = decodeURIComponent(url.pathname);
    let file = path.join(ROOT, rel);
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, "index.html");
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
    tally.calls++;
    try {
      const u = new URL(req.url());
      tally.symbols.add(u.searchParams.get("symbol") || u.pathname);
      const r = await fetch(req.url(), { headers: { Origin: "https://scintillahub.ai", Accept: "application/json" } });
      const body = Buffer.from(await r.arrayBuffer());
      await route.fulfill({ status: r.status, body, headers: { "content-type": r.headers.get("content-type") || "application/json", "access-control-allow-origin": "*" } });
    } catch (err) { tally.failed++; await route.abort(); }
  });
}
/* everything else off-machine is refused: no fonts, no analytics, no TradingView */
export function refuseOutside(ctx, base) {
  return ctx.route((url) => { const s = String(url); return !s.startsWith(base) && !s.includes("scintilla-massive-chart-api.fly.dev"); }, (route) => route.abort());
}
