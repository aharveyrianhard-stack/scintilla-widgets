import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const read = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8')
const provider = read('../_provider/provider.js')
const geiger = read('../geiger/index.html')
const ranks = read('../ranks/index.html')

test('the compatibility adapter preserves every Geiger rung instead of flattening currentness', () => {
  assert.match(provider, /function geigerDetail/)
  assert.match(provider, /detail=1/)
  assert.match(provider, /csT && csT\.length === 1 \? geigerDetail/)
  assert.match(provider, /rungs: v\.rungs \|\| \{\}/)
  assert.match(geiger, /geigerRungs: c\.rungs \|\| \{\}/)
  assert.match(geiger, /BAR AS-OF/)
  assert.match(geiger, /r\.availability === "ABSENT" \? "ABSENT"/)
})

test('FMP daily values visibly carry provider date and forming-settled provenance', () => {
  assert.match(geiger, /indicatorSourceDate: d1\.source_date/)
  assert.match(geiger, /indicatorSessionState: d1\.session_state/)
  assert.match(geiger, /raw FMP provider" \+ \(indStamp/)
  assert.match(ranks, /RSI " \+ rsiAsOf \+ " " \+ rsiState/)
})

test('MACD and the legacy Structure label explain their actual authority', () => {
  assert.match(geiger, /FMP stable API has no MACD/)
  assert.match(geiger, /Struct · legacy/)
  assert.match(geiger, /RSI → MOM/)
})

test('Ranks names current upstream contracts and their own as-of clocks', () => {
  assert.match(ranks, /provider \/geiger/)
  assert.match(ranks, /GEIGER " \+ \(geigerAsOf/)
  assert.match(ranks, /provider_indicators_current/)
})
