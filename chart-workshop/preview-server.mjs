/** Local-only read-only preview. No arbitrary proxy URL, production write, or stale-data fallback. */
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import quoteHandler from '../api/cloud-workshop-quote.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const UPSTREAM = 'https://scintilla-massive-chart-api.fly.dev/candles';
const TIMEFRAMES = new Set(['1m', '5m', '15', '30', '60', '120', '180', '240', '6h', '8h', '12h', 'D', '2D', '3D', 'W', '2W', 'M']);
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff2': 'font/woff2' };

/** Pure request validator exported for tests. Only known endpoint fields are admitted. */
export function validateDataQuery(searchParams) {
  for (const key of searchParams.keys()) {
    if (!['symbol', 'tf', 'limit'].includes(key) || searchParams.getAll(key).length !== 1)
      throw new RangeError(`Unsupported or repeated parameter: ${key}`);
  }
  const symbol = searchParams.get('symbol') || 'TSLA';
  const tf = searchParams.get('tf') || 'D';
  const limitText = searchParams.get('limit') || '1200';
  if (!/^[A-Z][A-Z0-9.-]{0,9}$/.test(symbol)) throw new RangeError('Invalid provider symbol');
  if (!TIMEFRAMES.has(tf)) throw new RangeError('Unsupported timeframe');
  if (!/^\d{1,4}$/.test(limitText)) throw new RangeError('Limit must be a positive integer');
  const limit = Number(limitText);
  if (limit < 1 || limit > 2000) throw new RangeError('Limit must be between 1 and 2000');
  return { symbol, tf, limit };
}

export function upstreamURL(query) {
  const { symbol, tf, limit } = validateDataQuery(new URLSearchParams(query));
  const url = new URL(UPSTREAM);
  url.search = new URLSearchParams({ symbol, tf, authority: 'provider', limit: String(limit) }).toString();
  return url;
}

function json(res, status, value) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' });
  res.end(JSON.stringify(value));
}

export function createPreviewServer({ root = ROOT, fetchImpl = fetch } = {}) {
  let activeReads = 0;
  return http.createServer(async (req, res) => {
    const controller = new AbortController();
    let timer;
    try {
      if (req.method !== 'GET' && req.method !== 'HEAD') return json(res, 405, { error: 'Read-only preview: GET or HEAD only' });
      const url = new URL(req.url, 'http://127.0.0.1');
      if (url.pathname === '/api/cloud-workshop-quote') return quoteHandler(req,res);
      if (url.pathname === '/workshop-data') {
        const query = validateDataQuery(url.searchParams);
        if (activeReads >= 6) return json(res, 429, { error: 'Preview read limit reached; retry shortly' });
        activeReads++;
        try {
          const upstream = upstreamURL(query);
          timer = setTimeout(() => controller.abort(), 25_000);
          const response = await fetchImpl(upstream, { method: 'GET', signal: controller.signal, redirect: 'error', headers: { accept: 'application/json' } });
          const length = Number(response.headers.get('content-length'));
          if (Number.isFinite(length) && length > 8_000_000) throw new Error('Upstream response exceeds preview byte limit');
          if (!response.ok) return json(res, 502, { error: `Provider HTTP ${response.status}`, upstream_status: response.status, stale_substitution: false });
          let body = '';
          if (response.body) {
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let bytes = 0;
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              bytes += value.byteLength;
              if (bytes > 8_000_000) { await reader.cancel(); throw new Error('Upstream response exceeds preview byte limit'); }
              body += decoder.decode(value, { stream: true });
            }
            body += decoder.decode();
          }
          const payload = JSON.parse(body);
          if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('Provider returned invalid envelope');
          if (payload.symbol !== query.symbol || payload.tf !== query.tf) throw new Error('Provider response identity does not match requested symbol/timeframe');
          return json(res, 200, { ...payload, _workshop: { fetched_at: new Date().toISOString(), upstream_url: upstream.href,
            live: true, source: 'READ_ONLY_PROVIDER_RESPONSE', stale_substitution: false } });
        } finally { clearTimeout(timer); activeReads--; }
      }
      let pathname;
      try { pathname = decodeURIComponent(url.pathname); } catch { return json(res, 400, { error: 'Malformed path' }); }
      if (pathname.includes('\0') || pathname.includes('\\') || pathname.split('/').some(part => part.startsWith('.')))
        return json(res, 403, { error: 'Path not allowed' });
      const realRoot = await fs.realpath(root);
      let file = path.resolve(realRoot, '.' + pathname);
      if (file !== realRoot && !file.startsWith(realRoot + path.sep)) return json(res, 403, { error: 'Outside preview root' });
      let stat = await fs.stat(file);
      if (stat.isDirectory()) { file = path.join(file, 'index.html'); stat = await fs.stat(file); }
      const realFile = await fs.realpath(file);
      if (!realFile.startsWith(realRoot + path.sep) || !stat.isFile()) return json(res, 403, { error: 'Outside preview root' });
      const type = MIME[path.extname(realFile)];
      if (!type) return json(res, 403, { error: 'File type not served by preview' });
      res.writeHead(200, { 'content-type': type, 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' });
      res.end(req.method === 'HEAD' ? undefined : await fs.readFile(realFile));
    } catch (error) {
      if (!res.headersSent) json(res, error instanceof RangeError ? 400 : error.code === 'ENOENT' ? 404 : 502,
        { error: error.name === 'AbortError' ? 'Provider read timed out' : error.message, stale_substitution: false });
      else res.end();
    } finally { clearTimeout(timer); }
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const server = createPreviewServer();
  server.listen(8776, '127.0.0.1', () => process.stdout.write('Chart workshop preview: http://127.0.0.1:8776/chart-workshop/\n'));
  server.on('error', error => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
}
