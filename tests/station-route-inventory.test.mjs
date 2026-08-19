/* H1 — the canonical inventory of Station surfaces, kept honest by regeneration.
   ============================================================================
   A written inventory decays the moment someone adds a directory. This suite rebuilds the
   list from the filesystem on every run and fails if STATION_ROUTES.md disagrees, so the
   document is a derived artefact rather than a claim.

   It also pins the part of H1 that actually matters operationally: charts, each YouTube
   feed and X stay independently deployable shells, and /deck mounts them by those pinned
   paths rather than embedding the surfaces directly.
*/
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
/* Only what git and npm keep out of the deploy. station-x-bridge-draft was skipped here
   because it is a Chrome extension draft rather than a Station surface - but Vercel
   serves the whole repository, so its page is deployed whatever we call it. Skipping it
   in the walk is how an inventory ends up claiming a completeness it does not have. */
const SKIP = new Set([".git", "node_modules"]);

/* EVERY DEPLOYED HTML FILE, NOT EVERY DIRECTORY.
   The first version of this walk only recorded directories containing index.html, and called
   the result "every route this repository serves". Vercel serves standalone .html files at
   their own paths too - status-snapshot.html, eight templates, and the bridge draft's
   offscreen page - all of which answer 200 on the preview. An inventory that cannot see them
   is not a completeness gate; it is a directory listing wearing one's name. */
function discoverRoutes(dir = ROOT, prefix = "") {
  const found = [];
  const entries = fs.readdirSync(dir, { withFileTypes:true });
  for (const entry of entries) {
    if (entry.isFile() && entry.name.endsWith(".html")) {
      if (entry.name === "index.html") found.push(prefix === "" ? "/" : prefix);
      else found.push(prefix + "/" + entry.name);
      continue;
    }
    if (!entry.isDirectory() || SKIP.has(entry.name)) continue;
    found.push(...discoverRoutes(path.join(dir, entry.name), prefix + "/" + entry.name));
  }
  return found.sort();
}

const routes = discoverRoutes();
const standalone = routes.filter((r) => r.endsWith(".html"));
const inventory = fs.readFileSync(new URL("../STATION_ROUTES.md", import.meta.url), "utf8");
const deck = fs.readFileSync(new URL("../deck/index.html", import.meta.url), "utf8");

/* ONE SET, USED IN BOTH DIRECTIONS.
   Forward detection (served but undocumented) read the generated list; reverse detection
   (documented but retired) re-parsed the document with a pattern that could not express a dot,
   so no `.html` entry was ever a candidate for staleness. A standalone page could therefore be
   deleted from the repository and its row would sit in the inventory forever with the
   bidirectional test green. Both directions now compare the SAME generated set against the
   same parse, and the parse admits every character a served path can contain. */
const DOCUMENTED = new Set(
  Array.from(inventory.matchAll(/`(\/[A-Za-z0-9._\-]*(?:\/[A-Za-z0-9._\-]+)*)`/g), (m) => m[1]));
/* /status is a vercel.json rewrite, not a file on disk, and is called out as such. */
const NOT_ON_DISK = new Set(["/status"]);

test("every served surface appears in the inventory", () => {
  const missing = routes.filter((route) => !DOCUMENTED.has(route));
  assert.deepEqual(missing, [], "these surfaces exist on disk but are not documented");
});

test("the inventory does not list a surface that no longer exists", () => {
  const onDisk = new Set(routes);
  const stale = Array.from(DOCUMENTED).filter((route) => !onDisk.has(route) && !NOT_ON_DISK.has(route));
  assert.deepEqual(stale, [], "these surfaces are documented but do not exist");
});

test("reverse detection can actually see a retired standalone page", () => {
  /* The hole this closes: the old reverse parse could not express a dot, so a `.html` entry was
     never even a candidate for staleness. Simulate retiring a standalone file — its
     documentation row must be caught, not tolerated. */
  const retired = "/templates/sector-rotation-older.html";
  assert.ok(DOCUMENTED.has(retired), "the page is documented today");
  assert.ok(routes.includes(retired), "and exists today");

  const onDiskWithout = new Set(routes.filter((r) => r !== retired));
  const stale = Array.from(DOCUMENTED).filter((r) => !onDiskWithout.has(r) && !NOT_ON_DISK.has(r));
  assert.deepEqual(stale, [retired],
    "removing a standalone file must make its inventory row detectably stale");

  /* And the parse must reach every dotted path, not just this one. */
  for (const page of standalone)
    assert.ok(DOCUMENTED.has(page), `${page} must be visible to the reverse parse`);
});

test("the inventory states the count it was generated against", () => {
  assert.match(inventory, new RegExp(`${routes.length} deployed HTML surfaces`),
    `the inventory must say "${routes.length} deployed HTML surfaces"`);
});

test("the standalone HTML files Vercel serves are inventoried too", () => {
  /* These are not directory routes, so the first version of this walk could not see them —
     and the inventory claimed completeness anyway. */
  assert.ok(standalone.length >= 10, `expected the standalone pages, saw ${standalone.length}`);
  for (const page of ["/status-snapshot.html", "/templates/fundamentals.html",
                      "/templates/sector-rotation.html", "/templates/sector-rotation-older.html"])
    assert.ok(standalone.includes(page), `${page} is served and must be inventoried`);
  const missing = standalone.filter((page) => !inventory.includes("`" + page + "`"));
  assert.deepEqual(missing, [], "these standalone pages are served but undocumented");
});

test("charts, each YouTube feed, and X remain independently deployable shells", () => {
  const MOUNTED = {
    chart: "/station-shells/chart-v1",
    personalVideo: "/station-shells/personal-video-v1",
    scintillaVideo: "/station-shells/scintilla-video-v1",
    x: "/station-shells/x-v2",
  };
  for (const [pane, shell] of Object.entries(MOUNTED)) {
    assert.ok(routes.includes(shell), `${shell} must exist as a route`);
    assert.match(deck, new RegExp(`${pane}: "${shell}"`), `/deck mounts ${pane} by its pinned shell`);
    assert.match(inventory, new RegExp("`" + shell + "`"), `${shell} is documented`);
  }
  /* Retained previous versions stay on disk so a rollback is a pointer change, and stay
     UNMOUNTED so nothing depends on them by accident. */
  for (const retired of ["/station-shells/video-v1", "/station-shells/x-v1"]) {
    assert.ok(routes.includes(retired), `${retired} is retained for rollback`);
    assert.doesNotMatch(deck, new RegExp(`: "${retired}"`), `${retired} must not be mounted`);
  }
});

test("the iPad companion page cannot move under the Station it frames", () => {
  /* H3: the wall inside the frame already refuses overscroll, but the OUTER document is the
     one iPadOS rubber-bands, and it had no containment at all. */
  const ipad = fs.readFileSync(new URL("../station-ipad/index.html", import.meta.url), "utf8");
  assert.match(ipad, /html\{[^}]*overflow:hidden/, "the document cannot scroll");
  assert.match(ipad, /html\{[^}]*overscroll-behavior:none/, "and cannot chain a bounce out of the frame");
  assert.match(ipad, /body\{[^}]*position:fixed/, "the body is pinned so the header cannot travel");
  assert.match(ipad, /body\{[^}]*overscroll-behavior:none/);
  /* The frame owns its own touch handling; the wrapper must not take it away. */
  assert.doesNotMatch(ipad, /body\{[^}]*touch-action/,
    "the wrapper must not claim touch-action, or chart gestures inside the frame die");
});
