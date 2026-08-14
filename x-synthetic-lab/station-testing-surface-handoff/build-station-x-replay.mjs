import assert from "node:assert/strict";

const replayCss = `
body.test-replay #bar{ padding-right:38px; }
body.test-replay #xfState{ display:inline; color:var(--vol); font-size:7.5px; letter-spacing:.1em; }
body.test-replay #testReplayBadge{ position:absolute; z-index:4; top:10px; left:10px; display:flex; flex-direction:column;
  gap:3px; padding:7px 9px; border:1px solid rgba(255,138,0,.72); background:rgba(0,0,0,.86);
  pointer-events:none; box-shadow:0 6px 20px rgba(0,0,0,.42); }
body.test-replay #testReplayBadge b{ color:var(--vol); font-size:10px; letter-spacing:.18em; }
body.test-replay #testReplayBadge span{ color:var(--ink3); font-size:7px; letter-spacing:.08em; }
body.test-replay #testReplayTelemetry{ position:absolute; z-index:4; left:8px; right:8px; bottom:8px; display:grid;
  grid-template-columns:auto auto; gap:4px 12px; padding:7px 9px; border:1px solid rgba(0,212,255,.42);
  background:rgba(0,0,0,.88); color:var(--ink3); font-size:7.5px; letter-spacing:.05em; pointer-events:none; }
body.test-replay #testReplayTelemetry span:nth-child(even){ text-align:right; }
body.test-replay #testReplayTelemetry b{ grid-column:1/-1; color:var(--vol); letter-spacing:.14em; }
body.test-replay #testReplayTelemetry b.pass{ color:var(--bull); }
body.test-replay #testReplayTelemetry b.check{ color:var(--vol); }
body.test-replay #bXList.on,body.test-replay #bXNotify.on{ color:var(--bull); border-color:var(--bull); background:rgba(0,255,163,.1); }
`;

const offlineCard = `<div id="card">
    <div class="n">TEST REPLAY IS LOADING</div>
    <div class="d">The Station testing twin uses one local, read-only fixture. No live X source or transport is available.</div>
    <div id="err"></div>
  </div>`;

export const testingSurfaceFiles = Object.freeze([
  "pane-x/index.html",
  "pane-x/pane-x-presentation-core.js",
  "pane-x/fixtures/x-crop-motion.js",
  "pane-x/pane-x-test-replay.js",
  "pane-x/fixtures/x-feed-static.svg"
]);

export function buildStationXReplayIndex(stableIndex) {
  assert.equal((stableIndex.match(/<script>\n"use strict";/g) || []).length, 1,
    "expected one stable pane runtime anchor");
  let output = stableIndex.replace(
    "<title>SCINTILLA · X pane</title>",
    "<title>SCINTILLA · X pane · TEST REPLAY</title>"
  );
  assert.notEqual(output, stableIndex, "title anchor missing");

  const commentStart = output.indexOf("<!-- ============================================================================");
  const commentEnd = output.indexOf("-->", commentStart);
  assert.ok(commentStart >= 0 && commentEnd > commentStart, "stable implementation note boundary missing");
  output = output.slice(0, commentStart) +
    "<!-- STATION TESTING TWIN: local static replay only; no production runtime or external authority. -->" +
    output.slice(commentEnd + 3);

  output = output.replace("\n</style>", `${replayCss}\n</style>`);
  assert.match(output, /#testReplayBadge/);

  const cardStart = output.indexOf('<div id="card">');
  const pairAnchor = '\n</div>\n<div id="pairInfo"';
  const cardEnd = output.indexOf(pairAnchor, cardStart);
  assert.ok(cardStart >= 0 && cardEnd > cardStart, "offline-card boundary missing");
  output = output.slice(0, cardStart) + offlineCard + output.slice(cardEnd);

  const runtimeStart = output.indexOf('<script>\n"use strict";');
  const runtimeEnd = output.lastIndexOf("</script>");
  assert.ok(runtimeStart >= 0 && runtimeEnd > runtimeStart, "stable runtime boundary missing");
  output = output.slice(0, runtimeStart) +
    '<script src="./pane-x-presentation-core.js"></script>\n' +
    '<script src="./fixtures/x-crop-motion.js"></script>\n' +
    '<script src="./pane-x-test-replay.js"></script>' +
    output.slice(runtimeEnd + "</script>".length);

  return output;
}
