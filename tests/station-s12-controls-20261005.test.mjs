/* S12 (5 Oct 2026): the X feed's right edge, the X bar, and the YouTube control row — pinned.
   1. The X Bridge crops the WHOLE timeline column (border to border): no avatar-rail trim on the left, no 18 px trim on the
      right, so nothing of a post is lost; the X shell draws the full crop at the pane's width (measured on a stand-in).
   2. The X bar never piles its labels over its buttons; the secondary controls sit behind one ⋯.
   3. The YouTube bar keeps the critical controls (channel ▾ · ↻ · the chip naming the filters · ⛶); the filters open under
      the bar, over the grid, never over the player; measured: nothing cut, nothing squeezed, one line at 403 / 461 / 614. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const read = (p) => fs.readFileSync(new URL(p, import.meta.url), "utf8");
const bridge = read("../station-x-bridge-draft/content.js"), xshell = read("../station-shells/x-v2/index.html");
const shell = read("../station-shells/personal-video-v1/index.html"), twin = read("../station-shells/scintilla-video-v1/index.html");
const measured = JSON.parse(read("../deliverables/20261005/station-controls/harness/s12-after.json"));
const SCREENS = ["1680x1050", "1920x1080", "2560x1440"];

test("S12 · the bridge crops the whole timeline column, and the health page expects the bridge that does", () => {
  const fn = bridge.match(/function calculateCropRect\(\) \{[\s\S]*?\n  \}/)[0];
  assert.match(fn, /left: baseLeft,/, "the crop starts at the column's left border — the avatar rail is in");
  assert.match(fn, /width: Math\.min\(baseWidth, viewportWidth - baseLeft\),/, "and runs the column's full width — the ··· menu is in");
  assert.doesNotMatch(fn, /rightTrim|detectedContentLeft|minimumContentWidth/, "no trim on either side");
  assert.match(read("../station-x-bridge-draft/manifest.json"), /"version": "0\.7\.22"/);
  assert.match(read("../x-health/index.html"), /const TARGET = "0\.7\.22";/, "the health page says 0.7.21 needs the reload");
});

test("S12 · the X bar: labels keep their size, the secondary controls fold behind ⋯", () => {
  assert.match(xshell, /#xfState, #xfSource, #bar > \.btn, #bar > \.k\{ flex:none; \}/, "nothing in the bar shrinks under a neighbour");
  assert.match(xshell, /#xfSource\{ flex:0 1 auto; min-width:0; overflow:hidden; text-overflow:ellipsis; max-width:38%; \}/, "the source name shortens, never overlaps");
  assert.match(xshell, /body:not\(\.x-more\) \.x-sec\{ display:none !important; \}/);
  for (const id of ["bXBack", "bPair", "bPip", "xfSource"]) assert.match(xshell, new RegExp('id="' + id + '"[^>]*class="[^"]*x-sec|class="[^"]*x-sec[^"]*"[^>]*id="' + id + '"'), id + " is secondary");
  assert.match(xshell, /for \(const id of \["bXList", "bXNotify", "bXBack", "bXRefresh", "bXMore"\]\)/, "⋯ appears with the live controls");
  assert.match(xshell, /if \(event\.key === "Escape" && document\.body\.classList\.contains\("x-more"\)\) setXMore\(false\);/);
});

test("S12 · the YouTube bar: channel ▾ · ↻ · the filters chip · ⛶ on the bar; the filter row under it, over the grid only", () => {
  assert.equal(shell, twin, "personal-video-v1 and scintilla-video-v1 stay byte-identical");
  assert.match(shell, /<button class="btn" id="bRefresh" type="button" title="refresh this list now"/);
  assert.match(shell, /<button class="btn" id="bFilters" type="button"[^>]*aria-controls="filters"/);
  assert.match(shell, /<div id="filters" role="group" aria-label="grid filters" hidden><span id="chips"><\/span><\/div>\n<div id="grid">/, "the chips live in the row under the bar");
  assert.match(shell, /#filters\{ position:absolute; z-index:5; left:0; right:0; top:calc\(27px \+ env\(safe-area-inset-top\)\);/, "the row hangs under the bar and takes no height from the picture");
  assert.match(shell, /body\.playing #bFilters, body\.playing #bRefresh\{ display:none; \}/, "the player keeps its own bar");
  assert.match(shell, /return mode \+ \(list \? " · " \+ list : ""\);/, "the chip names the filters in force");
  assert.match(shell, /b\.addEventListener\("click", \(\) => \{ setMode\(id\); setFiltersOpen\(false\); \}\);/, "a choice folds the row");
  assert.match(shell, /try \{ await load\(LIST === "watch"\); \} finally \{ b\.classList\.remove\("busy"\); \}/, "↻ reads the list again, now");
  assert.match(shell, /if \(!el\("filters"\)\.hidden\) \{ setFiltersOpen\(false\); return; \}/, "Esc folds the row first");
  const added = shell.slice(shell.indexOf("S12 (5 Oct 2026): CRITICAL CONTROLS"), shell.indexOf("#q{"));
  assert.doesNotMatch(added, /#fff\b|#ffffff|\bwhite(?!-space)|rgb\(255/i, "no white added");
});

test("S12 · measured on the real deck: the full column shown, nothing cut or squeezed in either bar, at 403 / 461 / 614", () => {
  for (const k of SCREENS) {
    const r = measured[k]; assert.ok(r, k + " was measured");
    assert.equal(r.x.wholeFrame, false, k + ": the pane drew the crop, not the whole window");
    assert.deepEqual(r.x.post.cut, { avatarRail: 0, textLeft: 0, textRight: 0, dots: 0, share: 0 }, k + ": nothing of the post is cut");
    assert.ok(r.x.shown.sourceCssWidth >= r.x.post.column.width - 1, k + ": the whole column is shown");
    assert.deepEqual(r.xBar.cut, [], k + ": the X bar cuts nothing"); assert.deepEqual(r.xBar.squeezed, [], k + ": and squeezes nothing"); assert.deepEqual(r.xBar.overlaps, [], k + ": nothing overlaps");
    for (const row of [r.rowPersonal, r.rowScintilla]) { assert.deepEqual(row.cut, [], k + ": the YouTube bar cuts nothing"); assert.deepEqual(row.squeezed, []); assert.equal(row.oneLine, true, k + ": one line"); assert.doesNotMatch(row.body, /bar-scroll/, k + ": no scrolling row"); }
    assert.ok(r.menuOpen && r.menuOpen.inside, k + ": the filter row opens inside the pane");
    assert.equal(r.rest.share.chartsArea, 76, k + ": the floor plan is untouched"); assert.equal(r.rest.px.black, 0);
  }
});
