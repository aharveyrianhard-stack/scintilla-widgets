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

test("every served route appears in the inventory", () => {
  const missing = routes.filter((route) => !inventory.includes("`" + route + "`"));
  assert.deepEqual(missing, [], "these routes exist on disk but are not documented");
});

test("the inventory does not list a route that no longer exists", () => {
  const listed = Array.from(inventory.matchAll(/`(\/[a-z0-9\-]+(?:\/[a-z0-9\-]+)*)`/g), (m) => m[1]);
  const known = new Set(routes);
  /* /status is a vercel.json rewrite, not a directory, and is called out as such. */
  known.add("/status");
  const stale = Array.from(new Set(listed)).filter((route) => !known.has(route));
  assert.deepEqual(stale, [], "these routes are documented but do not exist");
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
