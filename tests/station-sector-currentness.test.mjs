import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

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
  assert.match(page, /const completedSession=lastBar\?String\(lastBar\)\.slice\(0,10\):'unknown'/)
  assert.match(page, /'session '\+completedSession/)
  assert.match(page, /v\.timeLabel\?' · '\+v\.timeLabel/)
})
