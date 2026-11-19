/* 19 Nov 2026 (coordinator). The Station's broadcast layout. Alan, 17:20 ET on his photo of the TV (relayed): "It's garbage... The
   proportions, these tapes, the relative volume, they stacked it... cropped... we have to have earnings, economic, scintillas, sigma moves,
   these bar alerts, the volume alerts... I don't use these charts... and these sliders" + a live AI read; 17:55: "the fonts are all
   inconsistent... Tapes in one place, other tapes in another. Inconsistent tapes." These tests hold the rules the page was built on. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const page = read("../broadcast/index.html");
const css = page.slice(page.indexOf("<style>"), page.indexOf("</style>"));

test("the app's start: a plain visit opens the broadcast layout; a query or a frame keeps the old wall", () => {
  const root = read("../index.html");
  assert.match(root, /location\.replace\(\(window\.top === window && !location\.search \? "\/broadcast\/" : "\/deck\/"\) \+ location\.search \+ location\.hash\)/);
});

test("one stage, 1920 x 1080, scaled whole to the window - the TV, the MacBook and the iMac show the same picture", () => {
  assert.match(css, /#stage\{[^}]*width:1920px; height:1080px;/);
  assert.match(page, /Math\.min\(innerWidth \/ STAGE_W, innerHeight \/ STAGE_H\)/);
});

test("one typeface and four sizes - no font size anywhere but the four", () => {
  assert.match(css, /--f:ui-monospace/);
  assert.equal((css.match(/font-family:/g) || []).length, 1, "the typeface is set once, on the page");
  assert.match(css, /--s1:22px; --s2:30px; --s3:36px; --s4:72px;/);
  const sizes = [...css.matchAll(/font-size:([^;}]+)/g)].map((m) => m[1].trim());
  for (const s of sizes) assert.match(s, /^var\(--s[1-4]\)$/, "font-size " + s);
  for (const m of page.matchAll(/font-size="(\d+)"/g)) assert.equal(m[1], "22", "chart text is the label size");
});

test("every tape in one stack, six identical rows, in his order", () => {
  assert.equal((page.match(/id="tapes"/g) || []).length, 1);
  const labels = [...page.matchAll(/\{ key: "(\w+)", label: "([^"]+)" \}/g)].map((m) => m[2]);
  assert.deepEqual(labels, ["AI read", "Economic", "Earnings", "Scintillas", "Big candles", "Volume alerts"]);
  assert.match(css, /#tapes\{[^}]*grid-template-rows:repeat\(6,70px\)/);
  assert.match(page, /const SPEED = 80;/, "every tape crawls at the same speed");
  assert.match(css, /mask-image:linear-gradient/, "words fade at the edges instead of being cut");
});

test("what he does not use is gone: no lens charts, no sliders, no FAVORITES strip, no X", () => {
  const code = page.replace(/<!--[\s\S]*?-->/g, "").replace(/\/\*[\s\S]*?\*\//g, "");   /* the notes may name them; the page may not use them */
  for (const gone of ["lens-v1", "x-v2", "tapes-v1", "FAVORITES", "rvol"]) assert.ok(!code.includes(gone), gone);
});

test("each tape reads its own source, read-only, with the public key", () => {
  for (const src of ["news_reads?", "econ_calendar?", "earnings_events?", "scintillas?", "rpc/\" + fn", "\"station_tape_alerts\"", "/api/heartbeat", "/api/ratios"]) assert.ok(page.includes(src), src);
  assert.doesNotMatch(page, /service_role|SERVICE_ROLE/);
});

test("the video part is the Station's own feed + player, and its feed tabs still switch", () => {
  assert.match(page, /\/station-shells\/scintilla-video-v1/); assert.match(page, /\/station-shells\/personal-video-v1/);
  assert.match(page, /e\.data\.sc === "video-feed"/);
  assert.match(page, /querySelector\("\[data-v\]"\)/, "the newest video is cued, so the player is never a black box");
});
