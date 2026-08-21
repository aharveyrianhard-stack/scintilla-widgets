import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const read = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8')
const provider = read('../_provider/provider.js')
const geiger = read('../geiger/index.html')
const ranks = read('../ranks/index.html')

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

test('FMP daily values visibly carry provider date and forming-settled provenance', () => {
  assert.match(geiger, /SC_PROVIDER\.fmpDailyIndicators\(\[t\]\)/)
  assert.match(geiger, /indicatorSourceDate: d1\.source_date/)
  assert.match(geiger, /indicatorSessionState: d1\.session_state/)
  assert.match(geiger, /raw FMP provider" \+ \(indStamp/)
  assert.match(ranks, /RSI " \+ rsiAsOf \+ " " \+ rsiState/)
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
  assert.match(ranks, /provider_indicators_current/)
})
