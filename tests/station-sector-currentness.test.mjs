import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

const page = readFileSync(new URL('../templates/sector-rotation.html', import.meta.url), 'utf8')

test('Sector Rotation retires the frozen internal regime signal from the current surface', () => {
  assert.doesNotMatch(page, /\/rest\/v1\/regime_state\?/)
  assert.doesNotMatch(page, /function refreshRegimeLive\s*\(/)
  assert.doesNotMatch(page, /DB Regime State <span/)
  assert.match(page, /stale internal <code>regime_state<\/code> engine[^<]*not called/)
  assert.match(page, /current sector-regime result is the provider-bar RRG breadth calculation/)
})

test('the sector roster checks current home taxonomy instead of a nonexistent MACRO membership', () => {
  assert.match(page, /\/rest\/v1\/tickers\?select=ticker,cohort&ticker=in\.\(/)
  assert.doesNotMatch(page, /\/rest\/v1\/ticker_cohorts\?select=ticker,cohort&cohort=eq\.MACRO/)
  assert.match(page, /t===BENCH\?have\.get\(t\)!=='INDEXES':have\.get\(t\)!=='MACRO'/)
  assert.match(page, /spineSet\('tickers · home taxonomy'/)
})

test('completed daily bars display their provider session, not a misleading wall-clock age', () => {
  const helper = page.match(/function providerSessionDate\(ts\)\{[\s\S]*?\n\}/)?.[0]
  assert.ok(helper, 'providerSessionDate helper must remain present')
  const context = {}
  vm.runInNewContext(`${helper}; result=[
    providerSessionDate(1787198400),
    providerSessionDate('2026-08-20T04:00:00.000Z'),
    providerSessionDate(null)
  ]`, context)
  assert.equal(context.result.join('|'), '2026-08-20|2026-08-20|unknown')
  assert.match(page, /const completedSession=providerSessionDate\(lastBar\)/)
  assert.match(page, /'session '\+completedSession/)
  assert.match(page, /v\.timeLabel\?' · '\+v\.timeLabel/)
})
