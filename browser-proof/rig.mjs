/* The browser-verification rig: real Chromium, real pages, intercepted owners.
   ===========================================================================
   Serves this repository the way the deploy does (directory → index.html, standalone
   .html at its own path), launches the preinstalled Chromium through playwright-core,
   and answers every request bound for Supabase or the provider from ./fixtures.mjs.
   All other external hosts are refused, so a page's failure handling is exercised
   honestly rather than hidden behind a quiet CDN.

   playwright-core deliberately lives OUT OF TREE — this repository has no package.json
   and its deploy inventory counts every file. Point PW_MODULE_DIR at any directory
   whose node_modules contains playwright-core:
       mkdir -p /tmp/pw && cd /tmp/pw && npm init -y && npm i playwright-core
       PW_MODULE_DIR=/tmp/pw node browser-proof/proofs/<name>.mjs
   The Chromium binary comes from PLAYWRIGHT_CHROMIUM (default /opt/pw-browsers/chromium). */

import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { supabaseRows, providerJson } from "./fixtures.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const RECEIPTS = path.join(ROOT, "browser-proof", "receipts");

const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".mjs": "text/javascript",
  ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png",
  ".md": "text/plain; charset=utf-8", ".yaml": "text/plain; charset=utf-8" };

export function startServer(port = 0) {
  const server = http.createServer((req, res) => {
    const clean = decodeURIComponent(new URL(req.url, "http://x").pathname);
    let file = path.normalize(path.join(ROOT, clean));
    if (!file.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, "index.html");
    if (!fs.existsSync(file) && !path.extname(file)) file = file + "/index.html";
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); res.end("not found"); return; }
    res.writeHead(200, { "content-type": MIME[path.extname(file)] || "application/octet-stream" });
    res.end(fs.readFileSync(file));
  });
  return new Promise((resolve) => server.listen(port, "127.0.0.1", () =>
    resolve({ server, origin: "http://127.0.0.1:" + server.address().port })));
}

function playwright() {
  const dir = process.env.PW_MODULE_DIR;
  if (!dir) throw new Error("Set PW_MODULE_DIR to a directory whose node_modules has playwright-core (see rig.mjs header).");
  return createRequire(path.join(dir, "package.json"))("playwright-core");
}

export async function launch() {
  const { server, origin } = await startServer();
  const { chromium } = playwright();
  const browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_CHROMIUM || "/opt/pw-browsers/chromium",
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const unmatched = [];
  await context.route("**/*", async (route) => {
    const url = route.request().url();
    const host = new URL(url).host;
    if (host.startsWith("127.0.0.1")) return route.fallback();
    if (host === "wadinxqplrggagkvrdag.supabase.co") {
      if (url.includes("/rest/v1/")) {
        const rows = supabaseRows(url);
        return route.fulfill({ status: 200, contentType: "application/json",
          headers: { "content-range": "0-" + Math.max(0, rows.length - 1) + "/" + rows.length },
          body: JSON.stringify(rows) });
      }
      return route.fulfill({ status: 404, contentType: "application/json", body: "{}" });
    }
    if (host === "scintilla-massive-chart-api.fly.dev") {
      const body = providerJson(url);
      if (body != null) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
      return route.fulfill({ status: 404, contentType: "application/json", body: "{}" });
    }
    /* Everything else is refused, and remembered, so a proof can assert what the page
       tried to reach. */
    unmatched.push(url);
    return route.abort("connectionrefused");
  });
  return { browser, context, origin, unmatched,
    close: async () => { await browser.close(); server.close(); } };
}

/* ---- receipts ----------------------------------------------------------------------- */

export async function shoot(page, name) {
  fs.mkdirSync(RECEIPTS, { recursive: true });
  const file = path.join(RECEIPTS, name + ".png");
  await page.screenshot({ path: file, fullPage: false });
  return path.relative(ROOT, file);
}

export function record(entry) {
  fs.mkdirSync(RECEIPTS, { recursive: true });
  const file = path.join(RECEIPTS, "RECEIPTS.md");
  if (!fs.existsSync(file)) fs.writeFileSync(file,
    "# Browser-proof receipts\n\nReal Chromium (playwright-core) over the served repository " +
    "with Supabase/provider answered from fixtures — outbound HTTPS to the real owners is " +
    "blocked in this environment, so these receipts prove PAGE behavior under controlled " +
    "data, not the owners' data. Regenerate any entry with the command it names.\n");
  fs.appendFileSync(file, "\n---\n\n" + entry.trim() + "\n");
}

export const nowStamp = () => new Date().toISOString().replace(/\.\d+Z$/, "Z");
