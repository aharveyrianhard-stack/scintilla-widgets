import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'

// /youtube-connect: the one page where a YouTube channel is connected to the sweep. It reads state,
// runs Google's own device sign-in through yt-oauth, and never touches yt-act or a credential.
const page = readFileSync(new URL('../youtube-connect/index.html', import.meta.url), 'utf8')
// Executable code only: the script block with its comments removed. Prose on the page may NAME yt-act
// (to say it is never called); the script must never reach it.
const code = page.slice(page.indexOf('<script>'), page.indexOf('</script>')).replace(/\/\*[\s\S]*?\*\//g, '')

test('every channel Alan named is on the page, with the personal and SCINTILLA identities', () => {
  for (const key of ['personal', 'scintilla', 'soundscapes', 'golf', 'ai_research', 'fitness']) {
    assert.match(page, new RegExp(`key: "${key}"`), `${key} is listed`)
  }
})

test('it only ever talks to yt-oauth by GET and to one feed count; never yt-act, never a write', () => {
  assert.doesNotMatch(code, /functions\/v1\/yt-act|ytAct\(/, 'yt-act is never called from the script')
  assert.doesNotMatch(code, /method:\s*["'](POST|PATCH|PUT|DELETE)["']/, 'no mutating request')
  assert.doesNotMatch(code, /fetch\((?![^\n]*(functions\/v1\/yt-oauth|rest\/v1\/youtube_feed|\bu\b))/, 'every fetch is one of the two named reads')
  assert.match(code, /functions\/v1\/yt-oauth/)
  for (const step of ['status', 'start', 'poll', 'sweep']) assert.match(code, new RegExp(`oauth\\("${step}"`), `uses step=${step}`)
  assert.match(code, /rest\/v1\/youtube_feed\?select=video_id&subscription_accounts=cs\./, 'the count is a containment filter read')
})

test('no credential: only the public browser key the shells already carry, no JWT, nothing stored', () => {
  assert.doesNotMatch(page, /eyJ[A-Za-z0-9_-]{20,}/, 'no JWT anywhere on the page')
  assert.doesNotMatch(code, /localStorage|sessionStorage|document\.cookie/, 'stores nothing in the browser')
  assert.match(page, /const PUBLIC = "sb_publishable_/)
  assert.doesNotMatch(code, /refresh_token|client_secret/, 'tokens and secrets never reach the page')
})

test('monochrome: the Station tokens only, no white and no near-white', () => {
  const css = page.slice(page.indexOf('<style>'), page.indexOf('</style>'))
  assert.doesNotMatch(css, /\bwhite\b(?!-space)/i, 'no named white (white-space is a layout property, not a colour)')
  // Near-white = every channel at or above E0. Orange (#FF8A00) and cyan (#00D4FF) are accents, not white.
  const nearWhite = [...css.matchAll(/#([0-9a-f]{6}|[0-9a-f]{3})\b/gi)].map((m) => m[1]).filter((h) => {
    const v = h.length === 3 ? h.split('').map((c) => parseInt(c + c, 16)) : [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16))
    return v.every((n) => n >= 0xE0)
  })
  assert.deepEqual(nearWhite, [], 'no white or near-white colour token')
  assert.doesNotMatch(css, /--ink:/, 'the brightest Station token is not even declared here')
  assert.match(css, /--bg:#0A0A0F/)
  assert.match(css, /--crk:#00D4FF/)
})

test('the one step is written in plain words for a channel that is not connected', () => {
  const src = code.slice(code.indexOf('function stateText'), code.indexOf('function rowsText'))
  const stateText = runInNewContext(`${src}; stateText`, { STATUS: { accounts: { golf: { connected: false } } }, STATUS_ERROR: '', esc: (s) => String(s) })
  const text = stateText({ key: 'golf', label: 'GOLF', who: 'the GOLF channel' })
  assert.match(text, /not connected/)
  assert.match(text, /press connect, enter the code at google\.com\/device/)
  assert.match(text, /choose <b>the GOLF channel<\/b>/, 'says which account to pick when Google asks')
})

test('a channel the live collector does not know yet says so, and names who deploys what', () => {
  const src = code.slice(code.indexOf('function stateText'), code.indexOf('function rowsText'))
  const stateText = runInNewContext(`${src}; stateText`, { STATUS: { accounts: { personal: { connected: true } } }, STATUS_ERROR: '', esc: (s) => String(s) })
  const text = stateText({ key: 'soundscapes', label: 'SOUNDSCAPES', who: 'the SOUNDSCAPES channel' })
  assert.match(text, /does not know this channel yet/)
  assert.match(text, /yt-oauth<\/b>, <b>yt-rss-sweep<\/b> and <b>yt-act<\/b>/, 'the three functions root deploys are named')
})

test('a connected channel names the channel Google returned, so a wrong account pick is visible', () => {
  const src = code.slice(code.indexOf('function stateText'), code.indexOf('function rowsText'))
  const stateText = runInNewContext(`${src}; stateText`, { STATUS: { accounts: { personal: { connected: true, channel_title: 'Alan Harvey' } } }, STATUS_ERROR: '', esc: (s) => String(s) })
  assert.match(stateText({ key: 'personal', label: 'PERSONAL', who: 'your main YouTube account' }), /connected<\/span> as <b>Alan Harvey<\/b>/)
})

test('the pane links here with the channel preselected', () => {
  const shell = readFileSync(new URL('../station-shells/personal-video-v1/index.html', import.meta.url), 'utf8')
  assert.match(shell, /const CONNECT_PAGE = "\/youtube-connect\/";/)
  assert.match(page, /QS\.get\("account"\)/, 'the page reads ?account= to highlight that channel')
})
