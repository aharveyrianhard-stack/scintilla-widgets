'use strict';

// Preview-only read path. No credentials, alternate upstreams, writes, or stale-data fallback.
// CommonJS handler works with the existing static Vercel project (Node.js 24).
const UPSTREAM = 'https://scintilla-massive-chart-api.fly.dev/candles';
const TIMEFRAMES = new Set(['1m', '5m', '15', '30', '60', '120', '180', '240', '6h', '8h', '12h', 'D', '2D', '3D', 'W', '2W', 'M']);
const MAX_BYTES = 3_000_000;

function validateQuery(params) {
  for (const key of params.keys()) {
    if (!['symbol', 'tf', 'limit'].includes(key) || params.getAll(key).length !== 1)
      throw new RangeError(`Unsupported or repeated parameter: ${key}`);
  }
  const symbol = params.get('symbol') || 'TSLA';
  const tf = params.get('tf') || 'D';
  const limitText = params.get('limit') || '1200';
  if (!/^[A-Z][A-Z0-9.-]{0,9}$/.test(symbol)) throw new RangeError('Invalid provider symbol');
  if (!TIMEFRAMES.has(tf)) throw new RangeError('Unsupported timeframe');
  if (!/^\d{1,4}$/.test(limitText)) throw new RangeError('Limit must be a positive integer');
  const limit = Number(limitText);
  if (limit < 1 || limit > 2000) throw new RangeError('Limit must be between 1 and 2000');
  return { symbol, tf, limit };
}

function reply(res, status, payload, head = false) {
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.setHeader('x-content-type-options', 'nosniff');
  res.statusCode = status;
  res.end(head ? undefined : JSON.stringify(payload));
}

function createHandler(fetchImpl = globalThis.fetch) {
  let active = 0;
  return async function cloudWorkshopCandles(req, res) {
    if (req.method !== 'GET' && req.method !== 'HEAD') return reply(res, 405, { error: 'Read-only endpoint: GET or HEAD only' });
    const head = req.method === 'HEAD';
    const controller = new AbortController();
    let timer, entered = false;
    try {
      const query = validateQuery(new URL(req.url, 'https://preview.invalid').searchParams);
      if (active >= 6) return reply(res, 429, { error: 'Preview read limit reached; retry shortly' }, head);
      active++; entered = true;
      const url = new URL(UPSTREAM);
      url.search = new URLSearchParams({ symbol: query.symbol, tf: query.tf, authority: 'provider', limit: String(query.limit) }).toString();
      timer = setTimeout(() => controller.abort(), 25_000);
      const response = await fetchImpl(url, { method: 'GET', signal: controller.signal, redirect: 'error', headers: { accept: 'application/json' } });
      if (!response.ok) return reply(res, 502, { error: `Provider HTTP ${response.status}`, upstream_status: response.status, stale_substitution: false }, head);
      const length = Number(response.headers.get('content-length'));
      if (Number.isFinite(length) && length > MAX_BYTES) throw new Error('Provider response exceeds preview byte limit');
      if (!response.body) throw new Error('Provider returned no response body');
      const reader = response.body.getReader(), decoder = new TextDecoder();
      let bytes = 0, body = '';
      while (true) {
        const part = await reader.read();
        if (part.done) break;
        bytes += part.value.byteLength;
        if (bytes > MAX_BYTES) { await reader.cancel(); throw new Error('Provider response exceeds preview byte limit'); }
        body += decoder.decode(part.value, { stream: true });
      }
      body += decoder.decode();
      const payload = JSON.parse(body);
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('Provider returned invalid envelope');
      if (payload.symbol !== query.symbol || payload.tf !== query.tf) throw new Error('Provider response identity does not match request');
      return reply(res, 200, { ...payload, _workshop: { fetched_at: new Date().toISOString(), upstream_url: url.href,
        live: true, source: 'READ_ONLY_PROVIDER_RESPONSE', stale_substitution: false } }, head);
    } catch (error) {
      return reply(res, error instanceof RangeError ? 400 : 502,
        { error: error.name === 'AbortError' ? 'Provider read timed out' : error.message, stale_substitution: false }, head);
    } finally {
      clearTimeout(timer);
      if (entered) active--;
    }
  };
}

module.exports = createHandler();
module.exports.createHandler = createHandler;
module.exports.validateQuery = validateQuery;
