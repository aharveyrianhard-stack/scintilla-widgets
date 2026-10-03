/* S11b (3 Oct 2026): the floor plan's two loose ends, pinned.
   1. The video's expand is ONE step, the theatre: the video takes the chart area (the 76% right of the column) at the
      largest 16:9 that fits, centred, the charts covered, X keeping the whole column; a second press, BACK or Esc puts
      it home. No step grows the video inside the column (S11's did: black above and below a column-wide picture).
   2. The YouTube control row fits the column on one line at 403 / 461 / 614 px: the select is as wide as the profile it
      shows, the chips go compact if they must, and only then does the row scroll (with a fade). */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
const deck = fs.readFileSync(new URL("../deck/index.html", import.meta.url), "utf8");
const shell = fs.readFileSync(new URL("../station-shells/personal-video-v1/index.html", import.meta.url), "utf8");
const twin = fs.readFileSync(new URL("../station-shells/scintilla-video-v1/index.html", import.meta.url), "utf8");
const grab = (re, what) => { const m = deck.match(re); assert.ok(m, what + " must exist in the deck"); return m[0]; };
const src = [
  grab(/const VIDEO_CHROME_FALLBACK_PX = \d+;/, "the video bar fallback"),
  grab(/const FLOOR_COLUMN_SHARE = [\d.]+;/, "the column share"),
  grab(/const FLOOR_SEAM_PX = \d+;/, "the seam"),
  grab(/const FLOOR_COUNTS = \[[^\]]*\];/, "the counts"),
  grab(/function floorGrid\(count, width, height\) \{[\s\S]*?\n\}/, "floorGrid"),
  grab(/function floorPlan\(wallWidth, wallHeight, chromePx\) \{[\s\S]*?\n\}/, "floorPlan"),
  grab(/function floorTheatre\(areaWidth, areaHeight, chromePx\) \{[\s\S]*?\n\}/, "floorTheatre"),
].join("\n");
const ctx = {}; vm.runInNewContext(src + "\nglobalThis.out = { floorPlan, floorTheatre };", ctx);
const { floorPlan, floorTheatre } = ctx.out;
const plain = (o) => JSON.parse(JSON.stringify(o));
const SCREENS = [[1680, 1050, { w: 1276, h: 718 }], [1920, 1080, { w: 1458, h: 820 }], [2560, 1440, { w: 1945, h: 1094 }]];

test("S11b · the theatre: the largest 16:9 picture that fits the chart area, centred, the shell's bar above it", () => {
  for (const [w, h, want] of SCREENS) {
    const p = floorPlan(w, h, 28), t = floorTheatre(p.charts.w, p.charts.h, 28);
    assert.deepEqual(plain(t.picture), want, `${w}: picture ${want.w} × ${want.h}`);
    assert.ok(Math.abs(t.picture.w / t.picture.h - 16 / 9) < 0.002, `${w}: 16:9`);
    assert.equal(t.pane.w, t.picture.w, "the pane is exactly the picture's width: no bars beside it");
    assert.equal(t.pane.h, t.picture.h + 28, "and the picture plus the bar: no bars above or below it");
    assert.ok(t.pane.w <= p.charts.w && t.pane.h <= p.charts.h, "it fits the chart area");
    assert.ok(t.pane.w === p.charts.w || t.pane.h >= p.charts.h - 1, "and is the largest that does (one side touches)");
    assert.ok(Math.abs(t.left * 2 + t.pane.w - p.charts.w) <= 1 && Math.abs(t.top * 2 + t.pane.h - p.charts.h) <= 1, "centred");
  }
  /* a very wide chart area: the height decides, the picture is centred left to right */
  const wide = floorTheatre(3000, 1000, 28);
  assert.deepEqual(plain(wide.picture), { w: 1728, h: 972 });
  assert.equal(wide.top, 0); assert.equal(wide.left, 636);
});

test("S11b · the deck: one step in the floor plan, X keeps its column, BACK / Esc come home, the phone keeps its ladder", () => {
  assert.match(deck, /const theatre = !!plan && MEDIA_STAGE > 0;/, "the theatre is the floor plan's stage, never the phone's");
  assert.match(deck, /const t = floorTheatre\(plan\.charts\.w, plan\.charts\.h, o\.chromePx\);/);
  assert.match(deck, /o\.node\.style\.left = \(plan\.col \+ FLOOR_SEAM_PX \+ t\.left\) \+ "px"/, "placed over the chart area, right of the column");
  assert.match(deck, /body\.media-theatre:not\(\.stack\) #grid > #rowBot > \.pane\.theatre\{ position:absolute; z-index:24; flex:none; \}/,
    "the pane leaves the column's flow without leaving the document (its iframe never reloads)");
  assert.match(deck, /body\.media-theatre:not\(\.stack\) #grid > #rowTop::after\{ content:""; position:absolute; inset:0; z-index:23; background:var\(--bg\); \}/,
    "the charts are covered, not unloaded");
  assert.match(deck, /MEDIA_STAGE = STACKED \? 2 : 1;/, "covering X is the phone's second step only");
  assert.match(deck, /canCoverX: o\.def\.key === MEDIA_TARGET && MEDIA_STAGE === 1 && STACKED,/, "the floor plan never offers cover X");
  assert.match(deck, /theatre: o\.def\.key === MEDIA_TARGET && MEDIA_STAGE > 0 && !STACKED/, "the shell is told it is in the theatre");
  assert.match(deck, /event\.data\?\.type === "SCINTILLA_DECK_MEDIA_BACK"[\s\S]{0,200}mediaBack\(\)/, "the shell's Esc is BACK");
  assert.match(deck, /if \(event\.key === "Escape" && mediaBack\(\)\)/, "the deck's Esc is BACK");
  assert.match(deck, /if \(on && MEDIA_STAGE\) resetMediaStage\(\);/, "charts only brings the video home before it hides the column");
  /* toggleMediaStage: stage one → home, so a second press is BACK */
  assert.match(deck, /else if \(MEDIA_STAGE === 1\) resetMediaStage\(\);/);
});

test("S11b · the shell: BACK in the theatre, Esc sends BACK, and the control row fits the column", () => {
  assert.equal(shell, twin, "personal-video-v1 and scintilla-video-v1 stay byte-identical");
  assert.match(shell, /el\("bFull"\)\.textContent = theatre \? "↙ back"/);
  assert.match(shell, /if \(DECK_STAGE > 0\) parent\.postMessage\(\{ type: "SCINTILLA_DECK_MEDIA_BACK" \}, location\.origin\);/);
  assert.match(shell, /function fitBar\(\) \{[\s\S]*?fitProfileSelect\(\);[\s\S]*?bar-tight[\s\S]*?bar-scroll/, "select first, then compact, then scroll");
  assert.match(shell, /function relayout\(\) \{\n  fitBar\(\);/, "every resize refits the row");
  assert.match(shell, /#feedProfile\{ max-width:132px; text-overflow:ellipsis; \}/);
  assert.match(shell, /pick\.style\.width = Math\.ceil\(text \+/, "the select is as wide as the profile it shows, not its longest option");
  const added = shell.slice(shell.indexOf("S11b (3 Oct): THE CONTROL ROW"), shell.indexOf("#q{"));
  assert.doesNotMatch(added, /#fff\b|#ffffff|#f2f2f8|#c6c8de|\bwhite(?!-space)|rgb\(255/i, "no white added");
  assert.doesNotMatch(added, /font-size/, "compact means tighter padding and tracking, never smaller type");
});

test("S11b · measured on the real page: theatre size, 0 px black, BACK and Esc, the rows on one line, rest unchanged", () => {
  const m = JSON.parse(fs.readFileSync(new URL("../deliverables/20261003/station-floorplan-build/harness/theatre.json", import.meta.url), "utf8"));
  for (const [w, h, want] of SCREENS) {
    const k = `${w}x${h}`, r = m[k]; assert.ok(r, k + " was measured");
    /* at rest: S11's numbers */
    for (const rest of [r.rest, r.backByButton]) {
      assert.equal(rest.px.black, 0, k + ": no black at rest");
      assert.equal(rest.share.chartsArea, 76.0, k + ": charts 76.0%");
      assert.equal(+rest.widthShare.column.toFixed(1), 24.0, k + ": column 24.0%");
      assert.ok(Math.abs(rest.picture.w / rest.picture.h - 16 / 9) < 0.01, k + ": column picture 16:9");
    }
    assert.equal(r.chartsDrawn, 9, k + ": every chart drew");
    const t = r.theatre;
    assert.ok(t.playing, k + ": a video was playing");
    assert.deepEqual(t.picture, want, k + ": theatre picture");
    assert.deepEqual(t.picture, t.largestThatFits, k + ": the largest 16:9 that fits");
    assert.equal(t.pictureBlack, 0, k + ": no black bars on the picture");
    assert.equal(t.columnBlack, 0, k + ": 0 px black inside the column - X fills it");
    assert.ok(t.inChartArea && Math.abs(t.centred.dx) <= 1 && Math.abs(t.centred.dy) <= 1, k + ": centred in the chart area");
    assert.ok(t.chartsCovered, k + ": the charts are covered");
    assert.equal(t.buttonSays, "↙ back");
    assert.equal(r.backByButton.stage, 0, k + ": the second press is BACK");
    assert.deepEqual(r.backByEsc.fromShell, [1, 0], k + ": Esc in the shell is BACK");
    assert.deepEqual(r.backByEsc.fromDeck, [1, 0], k + ": Esc in the deck is BACK");
    for (const row of [r.rowPersonal, r.rowScintilla]) {
      assert.deepEqual(row.cut, [], `${k} ${row.feed}: nothing cut`);
      assert.ok(row.oneLine, `${k} ${row.feed}: one line`);
      assert.notEqual(row.mode, "scrolling", `${k} ${row.feed}: fits without scrolling`);
    }
    assert.equal(r.errs.length, 0, k + ": no page errors");
  }
  assert.equal(m.phone.theatre, false, "the phone has no theatre");
  assert.equal(m.phone.stage, 1); assert.deepEqual(m.phone.coverX, { stage: 2, xHidden: true }, "the phone keeps its two-step ladder");
});
