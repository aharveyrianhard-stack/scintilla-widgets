// REGRESSION PROOF: a live quote can never change a completed provider candle, and can never be
// persisted into the cached series.
//
// The defect this locks out: chApplyLivePoint() did `last.p = +quote.price` on the caller's array,
// and fetchChartSeries() then wrote that same mutated array into chartCache and localStorage for
// up to 24 hours. A live tick rewrote a settled bar and the rewrite outlived the session.
//
// The function is extracted from the SHIPPED files so this cannot pass against a copy that has
// drifted from what is deployed.
import { readFileSync } from 'node:fs'

const FILES = ['chart/index.html', 'station-shells/chart-v1/index.html']
let pass = 0, fail = 0
const ok = (n, c, d = '') => { c ? pass++ : fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (d ? '  ' + d : '')) }

function extract (file) {
  const src = readFileSync(file, 'utf8')
  const i = src.indexOf('function chApplyLivePoint')
  if (i < 0) throw new Error('chApplyLivePoint not found in ' + file)
  // take the function body up to its closing brace at column 0
  const end = src.indexOf('\n}', i)
  const fn = src.slice(i, end + 2)
  // chApplyLivePoint now asks quoteInstant whether the quote has a real observation time at
  // all, so the helper travels with it. A quote with no time appends nothing, because there is
  // nowhere honest on the axis to put it.
  const qi = src.indexOf('function quoteInstant(')
  const qiEnd = src.indexOf('\n}', qi)
  const helper = src.slice(qi, qiEnd + 2)
  const factory = new Function('futureSet', 'cryptoSet', 'window',
    helper + '\n' + fn + '\nreturn chApplyLivePoint;')
  return factory
}

for (const file of FILES) {
  console.log('\n=== ' + file + ' ===')
  const factory = extract(file)
  const futureSet = new Set(['ESUSD']), cryptoSet = new Set(['BTCUSD'])

  // A provider-owned equity: nothing may be substituted at all.
  const winEquity = { SC_PROVIDER_SHIM: { isProviderOwned: s => s === 'AAPL' } }
  const f1 = factory(futureSet, cryptoSet, winEquity)
  const cached = [{ d: '2026-08-18T20:00:00.000Z', p: 100 }, { d: '2026-08-18T21:00:00.000Z', p: 101 }]
  const snapshot = JSON.stringify(cached)
  const out1 = f1('AAPL', cached, { price: 999, updated_ts: '2026-08-18T21:30:00.000Z' })
  ok('equity: cached array not mutated', JSON.stringify(cached) === snapshot, 'cache=' + JSON.stringify(cached))
  ok('equity: completed close unchanged', out1[out1.length - 1].p === 101, 'last=' + out1[out1.length - 1].p)

  // Same-day non-equity: still must not rewrite the completed bar.
  const winOther = { SC_PROVIDER_SHIM: { isProviderOwned: () => false } }
  const f2 = factory(futureSet, cryptoSet, winOther)
  const c2 = [{ d: '2026-08-18T21:00:00.000Z', p: 101 }]
  const snap2 = JSON.stringify(c2)
  const out2 = f2('BTCUSD', c2, { price: 777, updated_ts: '2026-08-18T21:30:00.000Z' })
  ok('non-equity same day: input not mutated', JSON.stringify(c2) === snap2)
  ok('non-equity same day: bar NOT rewritten', out2[out2.length - 1].p === 101, 'last=' + out2[out2.length - 1].p)

  // Next-day non-equity: a transient point may be APPENDED, flagged, and never touches the input.
  const c3 = [{ d: '2026-08-18T21:00:00.000Z', p: 101 }]
  const snap3 = JSON.stringify(c3)
  const out3 = f2('BTCUSD', c3, { price: 777, updated_ts: '2026-08-19T14:00:00.000Z' })
  ok('non-equity next day: input not mutated', JSON.stringify(c3) === snap3)
  ok('non-equity next day: appended point flagged live', out3.length === 2 && out3[1].live === true)

  // Repeated live ticks can never accumulate into the cached array.
  const c4 = [{ d: '2026-08-18T21:00:00.000Z', p: 101 }]
  for (let i = 0; i < 50; i++) f2('BTCUSD', c4, { price: 500 + i, updated_ts: '2026-08-19T14:00:00.000Z' })
  ok('50 live ticks leave the cached series length 1', c4.length === 1 && c4[0].p === 101, 'len=' + c4.length)

  // The shipped source must no longer contain the mutating assignment.
  // Scan CODE only - block comments are stripped first, since this file documents the old defect
  // verbatim and would otherwise match its own explanation.
  const src = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  ok('shipped CODE has no `last.p = +quote.price`', !/last\.p\s*=\s*\+quote\.price/.test(src))
  ok('shipped CODE never persists a live-flagged point', !/cacheSet\([^)]*live/.test(src))
}
console.log(`\n=== CHART CANDLE IMMUTABILITY: ${pass} passed, ${fail} failed ===`)
process.exit(fail ? 1 : 0)
