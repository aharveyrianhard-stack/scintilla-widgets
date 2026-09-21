import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { runInNewContext } from 'node:vm'

const root = new URL('../', import.meta.url)
const read = path => readFileSync(new URL(path, root), 'utf8')
const deck = read('deck/index.html')
const chart = read('chart/index.html')
const vercel = JSON.parse(read('vercel.json'))
// the deployed bytes this candidate is based on, straight from git
const baseDeck = execFileSync('git', ['show', '29cf240:deck/index.html'], { encoding: 'utf8', maxBuffer: 64e6 })

// ── ITEM 3: the dock keeps every control ──────────────────────────────────────────────────────
const ids = html => [...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1])
const ariaControls = html => [...html.matchAll(/aria-label="([^"]+)"/g)].map(m => m[1])

test('the dock loses no control, no id and no accessible name', () => {
  const before = new Set(ids(baseDeck))
  const after = new Set(ids(deck))
  const missing = [...before].filter(id => !after.has(id))
  assert.deepEqual(missing, [], 'every id from the deployed Station still exists')
  const namesBefore = new Set(ariaControls(baseDeck))
  const namesAfter = new Set(ariaControls(deck))
  assert.deepEqual([...namesBefore].filter(n => !namesAfter.has(n)), [],
    'every accessible name survives the consolidation')
  const selectsBefore = (baseDeck.match(/<select/g) || []).length
  const buttonsBefore = (baseDeck.match(/<button/g) || []).length
  assert.equal((deck.match(/<select/g) || []).length, selectsBefore)
  assert.equal((deck.match(/<button/g) || []).length, buttonsBefore)
})

test('the three stacked rows become one strip without moving their children', () => {
  assert.match(deck, /<div id="dock" role="toolbar" aria-label="Station controls">/)
  assert.match(deck, /#dock > #bar, #dock > #tfbar, #dock > #panebar\{ display:contents; \}/)
  // the rows still exist in the same order, with the same inner markup
  const order = ['<div id="dock"', '<div id="bar">', '<div id="tfbar">', '<div id="panebar">', '</div><!-- /#dock -->']
  let at = -1
  for (const token of order) {
    const next = deck.indexOf(token, at + 1)
    assert.ok(next > at, `${token} is in dock order`)
    at = next
  }
})

test('group labels recede but stay readable by hover, focus and small screens', () => {
  assert.match(deck, /#dock \.control-group:focus-within \.control-label/)
  assert.match(deck, /@media \(max-width: 720px\)[\s\S]*?max-width:12ch; opacity:1/)
  assert.match(deck, /#dock \.btn:focus-visible/, 'a dock needs a visible focus ring')
  assert.match(deck, /prefers-reduced-motion/)
})

// ── ITEM 1: first paint ───────────────────────────────────────────────────────────────────────
test('the remembered structure paints BEFORE the 300 KB of libraries', () => {
  const skeleton = deck.indexOf('FIRST PAINT (structure only')
  const supabase = deck.indexOf('supabase-js-2.112.3-umd.min.js')
  const provider = deck.indexOf('/_provider/provider.js')
  assert.ok(skeleton > 0 && supabase > 0 && provider > 0)
  assert.ok(skeleton < supabase && skeleton < provider,
    'the skeleton must run before the blocking library scripts, not after them')
})

test('the skeleton shows structure only and never a value', () => {
  const block = deck.slice(deck.indexOf('FIRST PAINT (structure only'), deck.indexOf('})();') + 5)
  assert.match(block, /skeleton-pane/)
  assert.match(block, /DATA \\u00b7 loading/, 'it says loading in words')
  assert.doesNotMatch(block, /fetch\(|XMLHttpRequest|SC_PROVIDER/, 'it reads no data')
  assert.doesNotMatch(block, /price|quote|\bchange\b/i, 'it prints no market value')
  assert.match(block, /aria-hidden="true"/, 'the placeholder is not announced as content')
  // and the real mount clears it
  assert.match(deck, /const grid = el\("grid"\); grid\.innerHTML = "";/)
})

test('vendor code is cacheable; pages still are not', () => {
  const vendorRule = vercel.headers.find(h => h.source === '/_vendor/(.*)')
  const everything = vercel.headers.find(h => h.source === '/(.*)')
  assert.ok(vendorRule, 'the 212 KB vendored library has its own rule')
  assert.equal(vendorRule.headers.find(h => h.key === 'Cache-Control').value,
    'public, max-age=31536000, immutable')
  assert.equal(everything.headers.find(h => h.key === 'Cache-Control').value,
    'no-store, max-age=0, must-revalidate', 'HTML freshness is unchanged')
  assert.ok(vercel.headers.indexOf(vendorRule) > vercel.headers.indexOf(everything),
    'Vercel applies every matching rule in order and the last match wins, so the vendor override ' +
    'must come AFTER the catch-all - and the catch-all stays first, which the route inventory pins')
  // the vendored file is version-pinned and integrity-pinned, which is what makes caching safe
  assert.match(deck, /supabase-js-2\.112\.3-umd\.min\.js" integrity="sha384-/)
})

// ── ITEM 5: dates, not arithmetic ─────────────────────────────────────────────────────────────
const lift = name => {
  const start = chart.indexOf(`function ${name}(`)
  assert.notEqual(start, -1, `chart/index.html declares ${name}`)
  let depth = 0
  let i = chart.indexOf('{', start)
  for (; i < chart.length; i++) {
    if (chart[i] === '{') depth++
    else if (chart[i] === '}') { depth--; if (depth === 0) break }
  }
  return chart.slice(start, i + 1)
}
const labels = runInNewContext(
  `${lift('chartStartDate')}\n${lift('chartWindowLabel')}\n${lift('chartReferenceCloseLabel')}\n` +
  `({ chartStartDate, chartWindowLabel, chartReferenceCloseLabel })`, { Date })

const pt = iso => ({ d: iso })
test('the window label states the dates on screen', () => {
  const span = labels.chartWindowLabel([pt('2026-07-23T13:30:00Z'), pt('2026-09-18T20:00:00Z')])
  assert.equal(span, 'Jul 23 – Sep 18')
  assert.doesNotMatch(span, /trading days|since|Prev/)
  const oneDay = labels.chartWindowLabel([pt('2026-09-18T13:30:00Z'), pt('2026-09-18T20:00:00Z')])
  assert.equal(oneDay, 'Sep 18', 'a single session says the one date once')
  assert.equal(labels.chartWindowLabel([]), 'history loading')
  const today = new Date().toISOString().slice(0, 10)
  assert.match(labels.chartWindowLabel([pt('2026-07-23T13:30:00Z'), pt(`${today}T18:00:00Z`)]),
    / – today$/, 'a window that reaches today says today')
})

test('the reference close names its session, or admits it cannot', () => {
  const host = { _series: [pt('2026-09-17T13:30:00Z'), pt('2026-09-18T13:30:00Z'), pt('2026-09-18T20:00:00Z')] }
  assert.equal(labels.chartReferenceCloseLabel(host), 'Sep 17 close')
  assert.equal(labels.chartReferenceCloseLabel({ _series: [pt('2026-09-18T13:30:00Z')] }), 'last close',
    'one session on screen cannot name a previous session, so it claims no date')
  assert.equal(labels.chartReferenceCloseLabel({ _series: [] }), 'last close')
})

test('no user-visible "Previous" or "trading days" phrasing remains in the pane label', () => {
  const paint = chart.slice(chart.indexOf('function paintChartHistoryWindow'),
    chart.indexOf('function acquireChartLoadPermit'))
  assert.doesNotMatch(paint.replace(/\/\*[\s\S]*?\*\//g, ''), /trading days/,
    'the count moved to the tooltip, not the label')
  assert.match(paint, /label\.title =/, 'the count is still available on hover')
  assert.doesNotMatch(chart, /"Prev " \+ chPx/, 'the bare "Prev" label is gone')
})

// ── ITEM 7: expansion rebalances instead of letterboxing ─────────────────────────────────────
test('an expanded media pane takes its aspect ratio and hands the rest to its pair', () => {
  assert.match(deck, /#rowTop\{ --sc-media-aspect: 16 \/ 9; \}/)
  assert.match(deck, /#rowTop\.media-expanded\{ display:grid; grid-template-columns:minmax\(0, auto\) minmax\(220px, 1fr\); \}/)
  assert.match(deck, /#rowTop\.media-expanded > \.pane\.expanded\{ grid-column:auto; aspect-ratio:var\(--sc-media-aspect\)/)
  assert.match(deck, /@media \(max-width: 900px\), \(orientation: portrait\)/, 'portrait falls back to stacking')
  assert.match(deck, /row\.classList\.toggle\("media-expanded", mediaExpanded\)/)
  assert.match(deck, /\/\^\(video\|youtube\|x\)\$\/i/, 'only media panes rebalance; a chart expansion is untouched')
})

test('the base behaviour for a chart-pane expansion is unchanged', () => {
  assert.match(deck, /body\.solo #rowTop > \.pane\.expanded\{ grid-column:1 \/ -1; \}/,
    'the original full-row rule still applies when the row is not media-expanded')
})
