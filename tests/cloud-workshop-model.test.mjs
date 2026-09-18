import assert from 'node:assert/strict';
import test from 'node:test';
import { once } from 'node:events';
import { computeAverages, normalizeEnvelope, subtractRange, cloudBands, specs, palette, COMPUTATION_CONTRACT } from '../chart-workshop/model.mjs';
import { validateDataQuery, upstreamURL, createPreviewServer } from '../chart-workshop/preview-server.mjs';

const start = Date.UTC(2020, 0, 1);
const bar = (c, i) => ({ t: start + i * 86_400_000, o: c, h: c + 1, l: c - 1, c, v: 100 });
const series = (count, fn = i => i + 10) => Array.from({ length: count }, (_, i) => bar(fn(i), i));

test('EMA first-close seed is explicit, provisional and not presented as database validation', () => {
  const rows = computeAverages([bar(100, 0), bar(114, 1)]);
  assert.equal(rows[0].e13, 100);
  assert.equal(rows[1].e13, 102);
  assert.equal(rows[1].e21, 100 + 14 * 2 / 22);
  assert.equal(rows[1].time, start + 86_400_000);
  assert.match(COMPUTATION_CONTRACT.emaBootstrap, /PROVISIONAL/);
  assert.match(COMPUTATION_CONTRACT.validation, /NOT_DATABASE_OR_TRADINGVIEW_VALIDATED/);
  assert.equal(rows[0].m, null);
  assert.equal(rows[0].o, null);
});

test('SMA windows remain null until complete, then slide over native daily closes', () => {
  const rows = computeAverages(series(205));
  for (const n of [50, 100, 200]) {
    assert.equal(rows[n - 2][`s${n}`], null);
    assert.equal(rows[n - 1][`s${n}`], 10 + (n - 1) / 2);
    assert.equal(rows[204][`s${n}`], (214 + (215 - n)) / 2);
  }
  assert.equal(rows[204].f, true);
  assert.equal(rows[204].m, true);
  assert.equal(rows[204].o, true);
});

test('EMA recurrence is causal, deterministic, and leaves supplied bars untouched', () => {
  const input = series(205, i => 100 + Math.sin(i) * 10);
  const original = structuredClone(input);
  const full = computeAverages(input);
  assert.deepEqual(computeAverages(input.slice(0, 30)), full.slice(0, 30));
  assert.deepEqual(input, original);
  assert.deepEqual(computeAverages([]), []);
});

test('subtractRange exactly retains the Pine four-boundary clipping form', () => {
  assert.deepEqual(subtractRange(10, 20, 13, 17), [10, 13, 17, 20]);
  assert.deepEqual(subtractRange(10, 20, 0, 30), [10, 10, 20, 20]);
  assert.deepEqual(subtractRange(10, 20, 20, 30), [10, 20, 20, 20]);
  assert.deepEqual(subtractRange(10, 20, 13, 17, false), [10, 20, 20, 20]);
  assert.deepEqual(subtractRange(10, 20, null, null), [10, 20, 20, 20]);
  assert.deepEqual(subtractRange(null, 20, 13, 17), [null, null, null, null]);
});

test('approved fastest cloud owns overlap; resulting bands never overlap in every ordering', () => {
  const perms = a => a.length ? a.flatMap((v, i) => perms(a.filter((_, j) => j !== i)).map(p => [v, ...p])) : [[]];
  for (const [e13, e21, s50, s200] of perms([10, 20, 30, 40])) {
    const row = { e13, e21, s50, s200, f: e13 >= e21, m: e21 >= s50, o: s50 >= s200 };
    const bands = cloudBands(row);
    for (let i = 0; i < bands.length; i++) for (let j = i + 1; j < bands.length; j++)
      assert.ok(Math.min(bands[i].hi, bands[j].hi) <= Math.max(bands[i].lo, bands[j].lo));
    assert.equal(bands.reduce((s, b) => s + b.hi - b.lo, 0), 30);
    assert.deepEqual(cloudBands({ ...row, s100: 99999 }), bands);
    assert.equal(bands.at(-1).layer, 'fast');
  }
  assert.deepEqual(cloudBands({ e13: 10, e21: 10, s50: null, s200: null, f: true, m: null, o: null }), []);
});

test('palette, widths and opacity are the approved Pine defaults', () => {
  assert.deepEqual(palette, { blue: '#0C3299', pink: '#E6007E' });
  assert.deepEqual(specs.map(x => x.width), [1, 2, 3, 3, 4]);
  assert.deepEqual(specs.map(x => x.blueOpacity), [26, 32, 38, 41, 44]);
  assert.deepEqual(specs.map(x => x.pinkOpacity), [10, 13, 16, 18.5, 21]);
  assert.equal(specs.find(x => x.key === 's100').stateKey, 'price');
  assert.equal(specs.find(x => x.key === 's100').disabledByDefault, true);
  const bands = cloudBands({ e13: 40, e21: 30, s50: 20, s200: 10, f: true, m: true, o: true });
  assert.deepEqual(bands.map(x => x.opacity), [26, 36, 44]);
});

test('normalization preserves source metadata and optional raw fields without coercing truth', () => {
  const input = { symbol: 'TSLA', tf: 'D', price_basis: 'SPLIT_ADJUSTED', session_anchor: 'PROVIDER_ET',
    current_session: { forming_last_candle: false }, _workshop: { fetched_at: '2026-09-18T22:00:00Z' }, series: series(2) };
  const result = normalizeEnvelope(input);
  assert.deepEqual(result.series, input.series);
  assert.notEqual(result.series[0], input.series[0]);
  assert.equal(result.provenance.price_basis, 'SPLIT_ADJUSTED');
  assert.deepEqual(result.provenance.current_session, { forming_last_candle: false });
  assert.equal(result.provenance._workshop.fetched_at, input._workshop.fetched_at);
});

test('malformed, duplicate, reversed, seconds-unit and impossible OHLC rows fail closed', () => {
  const invalid = [null, {}, { series: [] }, { series: [bar(10, 0), bar(10, 0)] },
    { series: [bar(10, 1), bar(10, 0)] }, { series: [{ ...bar(10, 0), t: start / 1000 }] },
    { series: [{ ...bar(10, 0), c: '10' }] }, { series: [{ ...bar(10, 0), h: 9 }] },
    { series: [{ ...bar(10, 0), v: -1 }] }, { series: [{ ...bar(10, 0), c: NaN }] },
    { error: 'NOT_OBSERVED', series: series(1) }];
  for (const input of invalid) assert.throws(() => normalizeEnvelope(input));
});

test('proxy query is bounded and cannot redirect arbitrary reads', () => {
  assert.deepEqual(validateDataQuery(new URLSearchParams()), { symbol: 'TSLA', tf: 'D', limit: 1200 });
  const url = upstreamURL({ symbol: 'BRK.B', tf: 'D', limit: 1200 });
  assert.equal(url.origin, 'https://scintilla-massive-chart-api.fly.dev');
  assert.equal(url.pathname, '/candles');
  assert.equal(url.searchParams.get('authority'), 'provider');
  for (const query of ['url=https://evil.invalid', 'symbol=../secret', 'symbol=TSLA&symbol=AAPL',
    'symbol=tsla', 'tf=whatever', 'limit=2001', 'limit=1.5', 'limit=0', 'limit=-1', 'authority=audit'])
    assert.throws(() => validateDataQuery(new URLSearchParams(query)));
});

test('local server preserves raw envelope, timestamps fetch and refuses writes or stale substitution', async () => {
  let fail = false, calls = 0;
  const server = createPreviewServer({ fetchImpl: async () => {
    calls++;
    if (fail) return new Response('failure', { status: 503 });
    return new Response(JSON.stringify({ symbol: 'TSLA', tf: 'D', provider: 'MASSIVE', series: series(2), session_anchor: 'PROVIDER_ET' }));
  } });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const response = await fetch(base + '/workshop-data?symbol=TSLA&tf=D&limit=2');
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    const payload = await response.json();
    assert.deepEqual(payload.series, series(2));
    assert.equal(payload._workshop.live, true);
    assert.ok(Number.isFinite(Date.parse(payload._workshop.fetched_at)));
    fail = true;
    const failed = await fetch(base + '/workshop-data?symbol=TSLA&tf=D&limit=2');
    assert.equal(failed.status, 502);
    assert.equal((await failed.json()).stale_substitution, false);
    assert.equal(calls, 2);
    assert.equal((await fetch(base + '/workshop-data?url=bad')).status, 400);
    assert.equal((await fetch(base + '/workshop-data', { method: 'POST' })).status, 405);
    assert.equal((await fetch(base + '/.git/config')).status, 403);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
