import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'

const read = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8')
const provider = read('../_provider/provider.js')
const geiger = read('../geiger/index.html')
const ranks = read('../ranks/index.html')

function fnBefore(source, name, nextName, bindings = {}) {
  const start = source.indexOf(`function ${name}(`)
  const end = source.indexOf(`function ${nextName}(`, start)
  assert.notEqual(start, -1, `${name} must exist`)
  assert.notEqual(end, -1, `${nextName} must follow ${name}`)
  return vm.runInNewContext(`(${source.slice(start, end).trim()})`, bindings)
}

test('localStorage Geiger first paint has a hard freshness boundary', () => {
  const now = Date.parse('2026-09-06T12:00:00Z')
  let stored = null
  const cacheGet = fnBefore(geiger, 'cacheGet', 'cacheSet', {
    lsGet: () => stored,
    GEIGER_CACHE_FIRST_PAINT_MAX_AGE_MS: 15 * 60 * 1000,
    JSON,
    Date: { now: () => now },
    Number,
    Object,
    Math,
  })

  stored = JSON.stringify({ ts: now - 14 * 60 * 1000, data:{ t:'AAPL' } })
  const fresh = cacheGet('sc_geiger_current_v2_AAPL')
  assert.equal(fresh.data.t, 'AAPL')
  assert.equal(fresh.ageMs, 14 * 60 * 1000)

  stored = JSON.stringify({ ts: now - (15 * 60 * 1000 + 1), data:{ t:'AAPL' } })
  assert.equal(cacheGet('sc_geiger_current_v2_AAPL'), null, 'an older browser value cannot first-paint')

  stored = JSON.stringify({ ts: now + 60001, data:{ t:'AAPL' } })
  assert.equal(cacheGet('sc_geiger_current_v2_AAPL'), null, 'a materially future-dated value cannot first-paint')

  stored = JSON.stringify({ data:{ t:'AAPL' } })
  assert.equal(cacheGet('sc_geiger_current_v2_AAPL'), null, 'an undated value cannot first-paint')
  assert.match(geiger, /BROWSER CACHE · .* · REFRESHING/)
  assert.match(geiger, /PROVIDER READ · COMPUTED/)
  assert.doesNotMatch(geiger, /cacheGet\([^\n]*staleOk/)
})

test('provider references expose availability and age without entering the score', () => {
  const now = Date.parse('2026-09-06T00:00:00Z')
  const summarize = fnBefore(geiger, 'gsReferenceSummary', 'gsContractMeta', {
    Array,
    String,
    Number,
    Math,
    Date,
  })
  const full = Array.from({ length:16 }, () => ({ state:'AVAILABLE' }))
  const available = summarize('FMP', 'AVAILABLE', full, '2026-09-04', 16, now)
  assert.equal(available.availability, 'AVAILABLE')
  assert.equal(available.available, 16)
  assert.equal(available.age, 'AGE 2D')
  assert.match(available.label, /FMP REFERENCE AVAILABLE 16\/16 · AGE 2D · NOT SCORED/)

  const partial = full.map((row, index) => index < 10 ? row : ({ state:'NAMED_UNAVAILABLE' }))
  const partialSummary = summarize('FMP', 'AVAILABLE', partial, '2026-09-04', 16, now)
  assert.equal(partialSummary.availability, 'PARTIAL')
  assert.equal(partialSummary.available, 10)

  const failed = summarize('MASSIVE', 'TRANSPORT_ERROR', [], null, 11, now)
  assert.equal(failed.availability, 'TRANSPORT_ERROR')
  assert.equal(failed.age, 'AGE UNKNOWN')
  assert.match(failed.label, /NOT SCORED/)

  assert.match(geiger, /const fmpRef = gsReferenceSummary/)
  assert.match(geiger, /const massiveRef = gsReferenceSummary/)
  assert.doesNotMatch(geiger, /composite\s*=\s*(?:fmpRef|massiveRef)/)
})

test('the explicit Geiger client preserves every rung instead of flattening currentness', () => {
  assert.match(provider, /function geigerDetail/)
  assert.match(provider, /detail=1/)
  assert.match(provider, /var detail = !!options\.detail && equities\.length === 1/)
  assert.match(provider, /detail \? geigerDetail\(equities\[0\]/)
  assert.match(provider, /rungs: value\.rungs \|\| \{\}/)
  assert.match(geiger, /SC_PROVIDER\.equityGeiger\(\[t\], \{ detail:true \}\)/)
  assert.match(geiger, /geigerRungs: c\.rungs \|\| \{\}/)
  assert.match(geiger, /BAR AS-OF/)
  assert.match(geiger, /r\.availability === "ABSENT" \? "ABSENT"/)
})

test('the Geiger detail pane keeps FMP reference provenance while Ranks uses current Geiger RSI', () => {
  assert.match(geiger, /SC_PROVIDER\.fmpDailyIndicators\(\[t\]\)/)
  assert.match(geiger, /indicatorSourceDate: d1\.source_date/)
  assert.match(geiger, /indicatorSessionState: d1\.session_state/)
  assert.match(geiger, /raw FMP provider" \+ \(indStamp/)
  assert.match(provider, /rsi14: value\.daily_rsi14/)
  assert.match(ranks, /Geiger daily bar " \+ rsiAsOf \+ " " \+ rsiState/)
  assert.doesNotMatch(ranks, /SC_PROVIDER\.fmpDailyIndicators/)
})

test('Massive MACD and the unapproved Structure lane explain their actual authority', () => {
  assert.match(geiger, /SC_PROVIDER\.massiveMinuteIndicators\(t\)/)
  assert.match(geiger, /MACD 12\/26\/9 · MINUTE/)
  assert.match(geiger, /comparison only · not scored/)
  assert.match(geiger, /Structure · not scored/)
  assert.match(geiger, /historical evidence: HH\/LL · current formula unapproved/)
  assert.match(geiger, /d\.structure == null \? "UNAVAILABLE"/)
  assert.doesNotMatch(geiger, /RSI → MOM/)
})

test('all accepted provider-native indicators have separate visible catalogs and no score claim', () => {
  assert.match(geiger, /FMP · 16 daily contracts/)
  assert.match(geiger, /Massive · 11 minute contracts/)
  assert.match(geiger, /sources stay separate · no local substitute/)
  assert.match(geiger, /these values do not change the accepted Geiger score/)
  assert.match(geiger, /gsContractGrid\(q\("fmpcontracts"\), d\.fmpContracts, "FMP"/)
  assert.match(geiger, /gsContractGrid\(q\("massivecontracts"\), d\.massiveContracts, "MASSIVE"/)
})

test('Ranks names current upstream contracts and their own as-of clocks', () => {
  assert.match(ranks, /provider \/geiger/)
  assert.match(ranks, /GEIGER " \+ \(geigerAsOf/)
  assert.match(ranks, /current Geiger daily RSI/)
})
