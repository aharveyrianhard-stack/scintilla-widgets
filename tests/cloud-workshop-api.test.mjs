import assert from 'node:assert/strict';
import test from 'node:test';
import api from '../api/cloud-workshop-candles.js';
import { validateDataQuery } from '../chart-workshop/preview-server.mjs';

function responseCapture() {
  return { headers: {}, statusCode: 0, body: undefined,
    setHeader(key, value) { this.headers[key] = value; }, end(value) { this.body = value; } };
}
const request = (query = '', method = 'GET') => ({ method, url: '/api/cloud-workshop-candles' + (query ? '?' + query : '') });
const fixture = { symbol: 'TSLA', tf: 'D', provider: 'MASSIVE', price_basis: 'SPLIT_ADJUSTED', series: [{ t: 1789704000000, o: 369, h: 370.9, l: 360.751, c: 364.27, v: 100 }] };

test('remote and local proxy validation have exactly the same supported requests', () => {
  for (const query of ['', 'symbol=TSLA&tf=D&limit=1200', 'symbol=BRK.B&tf=60&limit=2000', 'symbol=BTCUSD&tf=W&limit=1'])
    assert.deepEqual(api.validateQuery(new URLSearchParams(query)), validateDataQuery(new URLSearchParams(query)));
  for (const query of ['url=https://evil.invalid', 'symbol=TSLA&symbol=AAPL', 'symbol=../file', 'limit=2001', 'limit=0', 'tf=bogus', 'authority=audit'])
    assert.throws(() => api.validateQuery(new URLSearchParams(query)));
});

test('remote handler fetches only the exact provider, preserves envelope and adds fetch provenance', async () => {
  let seen;
  const handler = api.createHandler(async (url, options) => {
    seen = { url, options }; return new Response(JSON.stringify(fixture));
  });
  const res = responseCapture();
  await handler(request('symbol=TSLA&tf=D&limit=1200'), res);
  assert.equal(res.statusCode, 200);
  const out = JSON.parse(res.body);
  assert.deepEqual(out.series, fixture.series);
  assert.equal(out.price_basis, fixture.price_basis);
  assert.equal(out._workshop.source, 'READ_ONLY_PROVIDER_RESPONSE');
  assert.ok(Number.isFinite(Date.parse(out._workshop.fetched_at)));
  assert.equal(seen.url.origin, 'https://scintilla-massive-chart-api.fly.dev');
  assert.equal(seen.url.pathname, '/candles');
  assert.equal(seen.url.searchParams.get('authority'), 'provider');
  assert.equal(seen.options.redirect, 'error');
  assert.equal(seen.options.method, 'GET');
  assert.equal(res.headers['cache-control'], 'no-store');
  assert.equal(res.headers['access-control-allow-origin'], undefined, 'no CORS setting is changed');
});

test('remote handler rejects writes, arbitrary URL parameters, and duplicate query fields before fetching', async () => {
  let calls = 0;
  const handler = api.createHandler(async () => { calls++; throw new Error('must not fetch'); });
  for (const [req, status] of [[request('', 'POST'), 405], [request('url=https://evil.invalid'), 400], [request('symbol=TSLA&symbol=AAPL'), 400]]) {
    const res = responseCapture(); await handler(req, res); assert.equal(res.statusCode, status);
  }
  assert.equal(calls, 0);
});

test('remote errors never return a successful cached or wrong-identity candle', async () => {
  for (const makeResponse of [
    () => new Response('failure', { status: 503 }),
    () => new Response(JSON.stringify({ ...fixture, symbol: 'AAPL' })),
    () => new Response('not JSON'),
    () => new Response(JSON.stringify(fixture), { headers: { 'content-length': '3000001' } }),
  ]) {
    const res = responseCapture(); await api.createHandler(async () => makeResponse())(request(), res);
    assert.equal(res.statusCode, 502);
    const out = JSON.parse(res.body);
    assert.equal(out.stale_substitution, false);
    assert.equal(out.series, undefined);
  }
});

test('remote handler bounds concurrent reads and releases slots after completion', async () => {
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  const handler = api.createHandler(async () => { await pending; return new Response(JSON.stringify(fixture)); });
  const responses = Array.from({ length: 6 }, () => responseCapture());
  const works = responses.map(res => handler(request(), res));
  const blocked = responseCapture(); await handler(request(), blocked);
  assert.equal(blocked.statusCode, 429);
  release(); await Promise.all(works);
  assert.ok(responses.every(res => res.statusCode === 200));
  const after = responseCapture(); await handler(request(), after); assert.equal(after.statusCode, 200);
});

test('HEAD keeps read metadata and headers but sends no body', async () => {
  const res = responseCapture();
  await api.createHandler(async () => new Response(JSON.stringify(fixture)))(request('', 'HEAD'), res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body, undefined);
});
