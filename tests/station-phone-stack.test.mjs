import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const deck = readFileSync(new URL('../deck/index.html', import.meta.url), 'utf8')
const css = [...deck.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(m => m[1]).join('\n')
const rules = [...css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)]
  .map(m => ({ sel: m[1].trim(), body: m[2] }))
// specificity of a simple selector list entry: [ids, classes+pseudo-classes, elements]
const spec = sel => {
  const s = sel.replace(/:not\(([^)]*)\)/g, ' $1')
  return [(s.match(/#[\w-]+/g) || []).length,
    (s.match(/\.[\w-]+|:(?!:)[\w-]+|\[[^\]]+\]/g) || []).length,
    (s.replace(/#[\w-]+|\.[\w-]+|:[\w-]+|\[[^\]]+\]/g, ' ').match(/\b[a-z][\w-]*\b/g) || []).length]
}
const gt = (a, b) => a[0] !== b[0] ? a[0] > b[0] : a[1] !== b[1] ? a[1] > b[1] : a[2] > b[2]

test('the top chart row is a grid on desk, so a phone rule must out-rank it', () => {
  const grid = rules.find(r => r.sel === '#rowTop' && /display:\s*grid/.test(r.body))
  assert.ok(grid, '#rowTop is still the desk grid')
  const stack = rules.filter(r => /body\.stack/.test(r.sel) && /#rowTop/.test(r.sel) &&
    /display:\s*flex/.test(r.body) && /flex-direction:\s*column/.test(r.body))
  assert.ok(stack.length, 'a body.stack rule stacks #rowTop as a column')
  for (const r of stack) assert.ok(gt(spec(r.sel), spec(grid.sel)), `${r.sel} out-ranks ${grid.sel}`)
  assert.ok(stack.some(r => /flex:\s*none/.test(r.body)), 'the stacked chart row keeps its content height (flex:none), it is never squeezed to 0 px')
})

test('the generic stack rule alone could not win (the bug this repairs)', () => {
  const generic = rules.find(r => r.sel === 'body.stack .deckrow')
  assert.ok(generic, 'generic stack rule present')
  assert.ok(!gt(spec(generic.sel), spec('#rowTop')), 'body.stack .deckrow loses to #rowTop, hence the dedicated rule')
})

test('the expanded-media phone layout keeps its own grid', () => {
  const stack = rules.find(r => /body\.stack #rowTop/.test(r.sel))
  assert.match(stack.sel, /:not\(\.media-expanded\)/, 'the stack rule leaves #rowTop.media-expanded alone')
})
