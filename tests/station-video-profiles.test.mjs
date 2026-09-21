import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'

const pane = readFileSync(new URL('../pane-video/index.html', import.meta.url), 'utf8')
const lift = name => {
  const start = pane.indexOf(`function ${name}(`)
  assert.notEqual(start, -1, `pane-video declares ${name}`)
  let depth = 0, i = pane.indexOf('{', start)
  for (; i < pane.length; i++) {
    if (pane[i] === '{') depth++
    else if (pane[i] === '}') { depth--; if (depth === 0) break }
  }
  return pane.slice(start, i + 1)
}
const registrySrc = pane.slice(pane.indexOf('const FEED_PROFILES = ['), pane.indexOf('const FEED_PROFILE_KEYS'))
const api = runInNewContext(
  `${registrySrc}\n${lift('feedProfileCoverage')}\n${lift('feedCoverageText')}\n${lift('profileIsAvailable')}\n` +
  `({ FEED_PROFILES, feedProfileCoverage, feedCoverageText, profileIsAvailable })`, {})

const row = accounts => ({ subscription_accounts: accounts })
// the shape actually measured on 2026-09-21: 30 personal, 34 scintilla, 136 unscoped, 0 shared
const sample = [
  ...Array.from({ length: 30 }, () => row(['personal'])),
  ...Array.from({ length: 34 }, () => row(['scintilla'])),
  ...Array.from({ length: 136 }, () => row([]))
]

test('every channel Alan named has a declared profile, including the golf slot', () => {
  const keys = api.FEED_PROFILES.map(p => p.key)
  for (const expected of ['personal', 'scintilla', 'soundscapes', 'golf']) {
    assert.ok(keys.includes(expected), `${expected} is declared`)
  }
  const golf = api.FEED_PROFILES.find(p => p.key === 'golf')
  assert.match(golf.note, /awaiting/, 'the golf slot says what it waits for')
  assert.equal(golf.account, 'golf', 'its account key is wired in advance')
})

test('a profile is only offered once the data proves its account exists', () => {
  assert.equal(api.profileIsAvailable('personal', sample), true)
  assert.equal(api.profileIsAvailable('scintilla', sample), true)
  assert.equal(api.profileIsAvailable('soundscapes', sample), false,
    'no soundscapes row exists today, so the profile is not offered as if it worked')
  assert.equal(api.profileIsAvailable('golf', sample), false)
  assert.equal(api.profileIsAvailable('soundscapes', [...sample, row(['soundscapes'])]), true,
    'and it becomes available the moment a real row carries the account')
})

test('unscoped rows are reported, never counted as the profile’s own', () => {
  const coverage = api.feedProfileCoverage(sample, 'personal')
  assert.equal(coverage.total, 200)
  assert.equal(coverage.scoped, 30)
  assert.equal(coverage.unscoped, 136)
  assert.equal(coverage.shared, 0)
  assert.notEqual(coverage.scoped + coverage.unscoped, coverage.total,
    'the arithmetic must not imply the feed is all one profile')
  const text = api.feedCoverageText(coverage)
  assert.match(text, /30 of 200 carry this account/)
  assert.match(text, /136 carry no account/)
})

test('a row shared by two accounts is counted once and named as shared', () => {
  const coverage = api.feedProfileCoverage([row(['personal', 'scintilla'])], 'personal')
  assert.equal(coverage.scoped, 1)
  assert.equal(coverage.shared, 1)
  assert.match(api.feedCoverageText(coverage), /shared with another account/)
})

test('provenance is read, never written: the pane never PATCHes subscription_accounts', () => {
  // The column is the truth about which account a video belongs to. This pane must only filter and
  // read it. Any write would be the pane deciding provenance for itself.
  const code = pane.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')
  const mutations = code.match(/method:\s*["'](POST|PATCH|PUT|DELETE)["'][\s\S]{0,400}?subscription_accounts/g) || []
  assert.deepEqual(mutations, [], 'no mutating request carries the provenance column')
  const assignments = code.match(/subscription_accounts\s*=(?![=c])/g) || []
  assert.deepEqual(assignments, [], 'the column is never assigned in this pane')
  assert.ok(/subscription_accounts=cs\./.test(code), 'it is used as a containment FILTER')
  assert.ok(/\.subscription_accounts/.test(code), 'and read from returned rows')
})

test('the owner can actually switch profile, and a profile without data says why', () => {
  // Root's finding: a registry nobody can reach is prepared plumbing, not the requested switch.
  assert.match(pane, /<select id="feedProfile"[\s\S]{0,160}aria-label="Channel profile"/)
  assert.match(pane, /function paintFeedProfileSelector\(rows\)/)
  assert.match(pane, /url\.searchParams\.set\("feed", next\)/, 'switching reloads this pane on the chosen feed')
  assert.match(pane, /\(ready \? "" : " disabled"\)/, 'a profile the data cannot support is disabled')
  assert.match(pane, /profile\.label \+ " \(awaiting\)"/, 'and says it is awaiting, rather than looking broken')
  assert.match(pane, /title="' \+ \(profile\.note \|\| profile\.label\)/, 'the reason is on the option itself')
})

test('the selector is painted immediately and repainted from the rows that actually land', () => {
  const start = lift('start')
  const load = lift('load')
  assert.match(start, /paintFeedProfileSelector\(\[\]\)/,
    'the hidden selector is exposed immediately with known profiles and honest awaiting states')
  assert.match(load, /rows = await pg\(q\)[\s\S]{0,180}paintFeedProfileSelector\(Array\.isArray\(rows\) \? rows : \[\]\)/,
    'the options are repainted from the actual returned account evidence')
  assert.ok(load.indexOf('paintFeedProfileSelector') < load.indexOf('const nextRows'),
    'availability sees the returned provenance before the active profile filters its display rows')
})
