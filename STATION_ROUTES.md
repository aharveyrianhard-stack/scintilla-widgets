# Station route inventory — H1

Every HTML surface this repository deploys, taken from the tree rather than from memory.
Two kinds are served: a directory containing `index.html`, served at the directory path; and a
standalone `.html` file, served at its own path. The first version of this document counted
only the first kind and called it complete — `tests/station-route-inventory.test.mjs` now
regenerates both from the filesystem and fails if this document disagrees, so a new surface
cannot arrive undocumented and a retired one cannot linger here.

Generated against `main` + the visible-truth closure branch. 63 deployed HTML surfaces.

**This is an inventory, not a deployment allow-list.** It records what the repository would
serve. Whether a given surface *should* be reachable in production is a separate ruling; where
one is not wanted, exclude it in the deployment config rather than by leaving it out here.

## Where the wall is assembled

`/deck` is the Station itself. It mounts nothing directly: every pane is an **independently
versioned shell** under `/station-shells/`, pinned by `STATION_SHELL` in `deck/index.html`
and held to an exact copy of its reviewed source by the mirror tests. That pinning is the
whole point of H1 — charts, each YouTube feed and X stay separately deployable, so one can
be rolled forward or back without touching the others.

| Pane | Shell mounted by `/deck` | Reviewed source it mirrors |
| --- | --- | --- |
| chart | `/station-shells/chart-v1` | `/chart` |
| personal video | `/station-shells/personal-video-v1` | `/youtube` (personal feed) |
| scintilla video | `/station-shells/scintilla-video-v1` | `/youtube` (scintilla feed) |
| X | `/station-shells/x-v2` | `/pane-x` |

`/station-shells/video-v1` and `/station-shells/x-v1` are retained previous versions. They are
not mounted by `/deck`; they exist so a rollback is a pointer change rather than a rebuild.

## Entry points

| Route | Title | Note |
| --- | --- | --- |
| `/` | SCINTILLA · scene widgets | scene-module directory |
| `/deck` | SCINTILLA · The Station | the Station wall; `station.scintillahub.ai/` rewrites here |
| `/station` | SCINTILLA STATION | PWA identity (`manifest.json`, `icon.svg`) |
| `/station-ipad` | SCINTILLA · Station iPad | iPad companion wrapper; frames `/deck` with the paired link |
| `/station-viewer` | SCINTILLA · Station iPad companion | companion viewer |
| `/registry` | SCINTILLA | repo/surface registry |

## Market surfaces

| Route | Title |
| --- | --- |
| `/analytics` | SCINTILLA · analytics — market regime |
| `/chart` | SCINTILLA · chart |
| `/cohort` | SCINTILLA · cohort geiger |
| `/cohorts` | SCINTILLA · cohort strip |
| `/compare` | SCINTILLA · cohort compare |
| `/econ` | SCINTILLA · economic |
| `/events` | SCINTILLA · events |
| `/geiger` | SCINTILLA · cohort geiger |
| `/geigerwall` | SCINTILLA · geiger wall |
| `/heat` | SCINTILLA · heat |
| `/news` | SCINTILLA · news |
| `/parity` | PIVOT PARITY — MU |
| `/pulse` | SCINTILLA · pulse |
| `/ranks` | SCINTILLA · ranks |
| `/ticker` | SCINTILLA · ticker tape |
| `/wall` | SCINTILLA · chart wall |

## Media surfaces

| Route | Title |
| --- | --- |
| `/youtube` | SCINTILLA · youtube feed |
| `/feed-a` | SCINTILLA · feed A — market |
| `/feed-b` | SCINTILLA · feed B — personal |
| `/pane-video` | SCINTILLA · video pane |
| `/pane-x` | SCINTILLA · X pane |
| `/tv` | SCINTILLA · tv |
| `/tvwall` | SCINTILLA · tv wall — recommendation |

## Operations surfaces

| Route | Title |
| --- | --- |
| `/health` | SCINTILLA · data health |
| `/alerts` | SCINTILLA · alerts |
| `/handoff` | SCINTILLA · hammerspoon handoff |
| `/reflow` | SCINTILLA · reflow |
| `/scenes` | SCINTILLA · scenes |
| `/components` | SCINTILLA · components — proposal |
| `/templates` | THE TEMPLATES — source files, found |

`/status` is not a route in this repository. `vercel.json` rewrites it to the `orgstatus`
Supabase function.

## Visuals lab

`/visuals` and its ten sub-routes — `/visuals/archive`, `/visuals/bench`, `/visuals/gallery`,
`/visuals/geiger-live`, `/visuals/geiger-motion`, `/visuals/images`, `/visuals/menu`,
`/visuals/open`, `/visuals/template`, `/visuals/theme`. These are the look lab, not Station
surfaces; they are inventoried so the count is honest, not because the Station mounts them.

## Standalone pages served at their own path

These are not directory routes. They answer 200 on the preview and are part of the deployed
surface whether or not anything links to them.

| Path | What |
| --- | --- |
| `/status-snapshot.html` | a captured org-status snapshot |
| `/templates/allocation-module.html` | allocation module |
| `/templates/company-full.html` | company sheet |
| `/templates/dcf.html` | DCF app |
| `/templates/dcf-methodology.html` | DCF method write-up |
| `/templates/fundamentals.html` | fundamentals sheet |
| `/templates/fundamentals-spec.html` | fundamentals spec |
| `/templates/sector-rotation.html` | sector rotation (current) |
| `/templates/sector-rotation-older.html` | sector rotation (earlier) |
| `/station-x-bridge-draft/offscreen.html` | X bridge draft, offscreen document — a Chrome extension file, not a Station surface, but deployed all the same |

`/templates/sector-rotation.html` and `/templates/sector-rotation-older.html` carry an **open
F1 item** — see the receipt. Their canonical home is the separate `scintilla-sector` project;
what is in this repository is a copy, and closing F1 needs that project's own deploy and CORS,
not this branch.

## Served dependencies — the non-HTML files in the same deploy

The surfaces above are not the whole deploy. Vercel serves every file in the repository, and
the pages depend on some of them by absolute path — a missing one is a broken page, which is
exactly how `/analytics` ran without the authority shim. Regenerated and enforced by
`tests/station-route-inventory.test.mjs`, the same way as the surfaces: **92 non-HTML files.**

### Load-bearing page dependencies

| Path | Loaded by |
| --- | --- |
| `/_provider/provider.js` | 20 pages by script tag — the provider authority shim; every equity read on those pages flows through it. (`/health` mentions it in prose but fetches the provider directly.) |
| `/_cohorts/cohort-axis.js` | 10 pages by script tag — the shared paged cohort-membership reader |
| `/deck/scenes.js` | `/deck` — the curated scene presets |
| `/station/manifest.json` | `/deck`, `/station` — PWA identity |
| `/station/icon.svg` · `/station/icon.png` · `/station/icon-512.png` | PWA icons |
| `/station-ipad/icon.svg` · `/station-ipad/icon.png` | iPad companion icons |
| `/tokens.css` | **nothing** — served, referenced by no page. A retained orphan; retire it or wire it, but do not mistake it for load-bearing |

### Everything else in the deploy tree, by class

Every non-HTML file is either in the table above or in exactly one class below; the counts
are regenerated by the test, so a new file cannot arrive uncounted.

| Class | Count | What |
| --- | --- | --- |
| Browser proof rig and receipts | 24 | the real-Chromium verification rig, its fixtures, proof scripts, screenshots and receipt log — see `browser-proof/receipts/RECEIPTS.md` |
| Documentation (`*.md`) | 8 | the root docs, receipt and handoff, plus the bridge draft's README — served as text |
| Test suites (`*.test.mjs`) | 28 | the tests directory and the bridge draft's — served as text; they are the review evidence |
| X-bridge extension draft | 11 | manifest, five scripts, five icons — Chrome extension files, deployed all the same |
| Supabase sources | 6 | edge-function and migration sources — served as text, never executed by the deploy |
| Root data / config | 4 | `/MANIFEST.yaml` · `/vercel.json` (deploy config — Vercel may withhold it from serving; not probed from this session) · `/.links.yaml` · `/.gitignore` (dotfiles — serving not probed) |
| Proof captures | 1 | `/station-x-visible-crop-proof.png` |

## Testing rule that goes with this inventory

H1's other half: test on clean `main` or on a preview built from a pushed branch. A dirty
local checkout is not evidence, because the thing under test is what the deploy will serve,
not what one working tree happens to contain.
