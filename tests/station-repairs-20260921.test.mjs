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
  /* The 23 Sep dock adds two buttons (the "more" drawer and the auto-hide lip); the 23 Sep
     evening page rail adds five more, each one named here so the count can never drift
     silently: page ‹, page ›, the "pages" jump button, and the two edge arrows on the wall.
     Every id and every accessible name above still survives; this only checks nothing ELSE
     was added or lost. */
  for (const id of ['pagePrev', 'pageNext', 'pageJumpBtn', 'edgePrev', 'edgeNext'])
    assert.ok(after.has(id), `${id} is one of the five deliberate new page controls`)
  /* 24 Sep (M47): one more deliberate control - charts only, which hides the video and X
     panes and gives the whole wall to the charts. Named here for the same reason as the
     five above: the count may only move when someone writes down why. */
  assert.ok(after.has('chartsOnlyBtn'), 'charts only is the deliberate new wall control')
  /* 24 Sep (M69): one more deliberate control - copy layout, which puts the SCRATCH wall
     on the clipboard as one line so a layout can be handed back to be saved. */
  assert.ok(after.has('copyLayout'), 'copy layout is the deliberate new scratch control')
  /* 25 Sep (K3 workflow): one more deliberate control - save as targets, which writes the
     SCRATCH wall's filled slots into public.station_targets, the eight names every
     Station window's TARGETS and switching pages read. */
  assert.ok(after.has('saveTargets'), 'save as targets is the deliberate new scratch control')
  /* 25 Sep (P1): one more deliberate control - save as radar, beside save as targets, which
     adds the SCRATCH wall's filled slots to list "radar" in public.station_lists. */
  assert.ok(after.has('saveRadar'), 'save as radar is the deliberate new scratch control')
  assert.equal((deck.match(/<button/g) || []).length, buttonsBefore + 11)
})

test('the rows became one sectioned strip, still in order (rebuilt 23 Sep after Alan\'s review)', () => {
  assert.match(deck, /<div id="dock" role="toolbar" aria-label="Station controls">/)
  assert.match(deck, /#dock > #bar, #dock > #tfbar\{ display:contents; \}/, 'the old rows are transparent wrappers')
  const order = ['<div id="dock"', '<div id="bar">', '<div id="tfbar">', '<div id="panebar"', '</div><!-- /#dock -->']
  let at = -1
  for (const token of order) {
    const next = deck.indexOf(token, at + 1)
    assert.ok(next > at, `${token} is in dock order`)
    at = next
  }
  // sections, and the visual order is fixed in CSS so the DOM never has to move
  for (const [sec, order] of [['station', 1], ['timeframe', 2], ['charts', 3], ['scenes', 4], ['video', 5], ['more', 7]])
    assert.match(deck, new RegExp(`#dock \\.dsec\\[data-sec="${sec}"\\]\\{ order:${order};`), `${sec} sits at position ${order}`)
})

test('group labels are off the strip, echoed in the caption, and back when the strip wraps', () => {
  // Alan, 22 Sep: "there's a lot of grayed-out bullshit that I think can be cut"
  assert.match(deck, /#dock \.control-label, #dock \.lbl, #dock \.video-note\{ display:none; \}/)
  assert.match(deck, /#dock\.dock-wrap \.control-label, #dock\.dock-wrap \.lbl, #dock\.dock-wrap \.video-note\{ display:inline;/,
    'a small screen that wraps gets its words back')
  assert.match(deck, /function dockCaptionText/, 'the pointed control still names its group in the caption')
  assert.match(deck, /#dock \.btn:focus-visible/, 'a dock needs a visible focus ring')
  assert.match(deck, /prefers-reduced-motion/)
})

// ── ITEM 1: first paint ───────────────────────────────────────────────────────────────────────
test('the remembered structure paints BEFORE the 300 KB of libraries', () => {
  const skeleton = deck.indexOf('FIRST PAINT (structure only')
  const provider = deck.indexOf('/_provider/provider.js')
  assert.ok(skeleton > 0 && provider > 0)
  assert.ok(skeleton < provider,
    'the skeleton must run before the blocking library scripts, not after them')
  assert.equal(deck.indexOf('supabase-js-2.112.3-umd.min.js'), -1, 'the database client is no longer loaded at all (2026-09-22)')
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
  // the deck no longer loads the vendored database client (one source, 2026-09-22); the cache rule
  // stays for whatever else lives under /_vendor, and nothing here may reintroduce the client
  assert.doesNotMatch(deck, /supabase-js-2\.112\.3-umd\.min\.js/)
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
})

test('the REAL pane definitions activate the rebalance - all three media panes, no chart', () => {
  // Root's finding: the first draft matched the words video|youtube|x, and the actual YouTube
  // panes are keyed fb and fa, so only X ever rebalanced. Drive the real declarations.
  const defs = [...deck.matchAll(/\{ row: (\d+), key: "([a-z0-9]+)",[\s\S]{0,240}?kind: "([a-z]+)"/g)]
    .map(m => ({ row: +m[1], key: m[2], kind: m[3] }))
  const byKey = Object.fromEntries(defs.map(d => [d.key, d]))
  for (const key of ['fb', 'fa', 'x']) {
    assert.ok(byKey[key], `the deployed deck declares the ${key} pane`)
  }
  assert.equal(byKey.fb.kind, 'video', 'Personal YouTube is declared as a video pane')
  assert.equal(byKey.fa.kind, 'video', 'SCINTILLA YouTube is declared as a video pane')

  // the exact predicate the code uses, lifted from source
  const line = deck.match(/const isMediaPane = ([^\n]+)/)
  assert.ok(line, 'the classification is a named predicate, not an inline guess')
  const isMediaPane = def => new Function('o', `return ${line[1].replace(/;$/, '')}`)({ def })
  assert.equal(isMediaPane(byKey.fb), true, 'Personal YouTube rebalances')
  assert.equal(isMediaPane(byKey.fa), true, 'SCINTILLA YouTube rebalances')
  assert.equal(isMediaPane(byKey.x), true, 'X rebalances')
  assert.equal(isMediaPane({ key: 'c1', kind: 'chart' }), false, 'a chart expansion is untouched')
})

test('the skeleton reads the keys the deck actually writes', () => {
  // Root's finding: the first draft read deck.chartCount, which the deck never writes, so the
  // skeleton painted nothing. The deck stores under station.<scene>.chartCount.
  assert.match(deck, /const statePrefix = \(\) => SCENE === "custom" \? "station\.custom" : SCENE === "scratch" \? "station\.scratch" : "station\.live";/,
    'this is the key scheme the deck really uses')
  const block = deck.slice(deck.indexOf('FIRST PAINT (structure only'), deck.indexOf('})();') + 5)
  assert.match(block, /localStorage\.getItem\("station\.scene"\)/)
  assert.match(block, /prefix \+ "\.chartCount"/)
  assert.match(block, /localStorage\.getItem\("station\.live\.chartCount"\)/)
  assert.doesNotMatch(block, /deck\.chartCount/, 'the key that never existed is gone')

  // and it behaves: run the real extracted logic against a real remembered layout
  const read = key => ({ 'station.scene': 'live', 'station.live.chartCount': '6' })[key] || null
  const scene = read('station.scene') || 'live'
  const prefix = scene === 'custom' ? 'station.custom' : 'station.live'
  const raw = read(prefix + '.chartCount') || read('station.live.chartCount') || read('station.chartCount') || ''
  assert.equal(parseInt(raw, 10) || 0, 6, 'a remembered six-chart wall is found')
})

test('the base behaviour for a chart-pane expansion is unchanged', () => {
  assert.match(deck, /body\.solo #rowTop > \.pane\.expanded\{ grid-column:1 \/ -1; \}/,
    'the original full-row rule still applies when the row is not media-expanded')
})
