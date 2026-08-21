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

`/deck` accepts scene addressing in the query string: `?scene=<id>` opens a scene by id
(`cohort`, `indexNow`, `sectorFamilies`, `themeFamilies`, the presets, or `custom`), and the
cohort scene takes two more — `?scene=cohort&cohort=<NAME>&page=<n>` opens that cohort's
rows at 1-based page `n` (e.g. `?scene=cohort&cohort=AI_SOFTWARE&page=2`). `cohort=FAV` is
the favorites entry the cohorts replace. Unknown cohort names fall back to the first
available entry once the membership read lands; the values are also remembered per browser,
so a bare `/deck` reopens the last scene/cohort/page.

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
exactly how `/analytics` once ran without its provider boundary. Regenerated and enforced by
`tests/station-route-inventory.test.mjs`, the same way as the surfaces: **179 non-HTML files.**

### Load-bearing page dependencies

| Path | Loaded by |
| --- | --- |
| `/_provider/provider.js` | 20 pages by script tag — the explicit provider-native client; equity reads call named quote, candle, Geiger, and indicator products through it. (`/health` mentions it in prose but fetches the provider directly.) |
| `/_cohorts/cohort-axis.js` | 10 pages by script tag — the shared paged cohort-membership reader |
| `/_vendor/supabase-js-2.112.3-umd.min.js` | `/deck`, `/chart` + its shell mirror, by script tag with a sha384 integrity attribute — the realtime SDK, VENDORED same-origin from the npm registry's own sha512-verified tarball (the old floating-@2 jsdelivr tag is gone) |
| `/_vendor/lightweight-charts-4.1.3.standalone.production.js` | `/templates/sector-rotation.html` by script tag with a sha384 integrity attribute — vendored the same way (the old unhashed unpkg tag is gone; the retained rollback copy still uses unpkg, by ruling) |
| `/_vendor/firebase-app-12.18.0-compat.js` | **no page in this repository yet** — the Firebase app SDK, VENDORED same-origin from the npm registry's own sha512-verified tarball and byte-identical to it, to be loaded by script tag with a sha384 integrity attribute exactly as the two vendored libraries above are. The compat (UMD global) build is vendored rather than the modular ESM one because `firebase-analytics.js` hard-codes an absolute `import` from `gstatic.com`: the ESM pair cannot be served same-origin without editing vendored bytes, and the proof rig refuses every external host. Mounted by adding the tag; until then it is served and inert |
| `/_vendor/firebase-analytics-12.18.0-compat.js` | **no page in this repository yet** — the Analytics SDK, vendored the same way. Optional: `/_firebase/firebase.js` gives an app without it and says so by name. **Never load this tag without the app tag above it**: this file reaches for the app SDK's `INTERNAL` registry at its own top level and throws `TypeError: … reading 'INTERNAL'` if the app half is missing — the SDK's own load-order contract, which no code of ours can guard. Proven in `browser-proof/proofs/firebase-init.mjs` |
| `/_firebase/firebase.js` | **no page in this repository yet** — the shared Firebase client for project `scintilla-834af`: one app initialised at most once, `isSupported()`-gated analytics, and a named reason whenever either is absent. The config is centralised here (a Firebase web config is public by design, the same standing as the inlined Supabase anon key) and is overridable per key at runtime via `__FIREBASE_CONFIG__`, which is this build-stepless tree's stand-in for an env var; a guarded `process.env` read stays inert here and starts working by itself if this tree is ever built as `apps/web` |
| `/deck/scenes.js` | `/deck` — the curated scene presets |
| `/station/manifest.json` | `/deck`, `/station` — PWA identity |
| `/station/icon.svg` · `/station/icon.png` · `/station/icon-512.png` | PWA icons |
| `/station-ipad/icon.svg` · `/station-ipad/icon.png` | iPad companion icons |
| `/tokens.css` | **nothing in this repository** — served, referenced by no page here. **OWNER RULING NEEDED**: an external consumer (the hub or another deploy hot-linking the served URL) cannot be ruled out from this repo alone, so deleting it from this branch could silently break a page this branch cannot see. It stays served and inventoried until the owner rules retire-or-wire; do not mistake it for load-bearing here |

### Everything else in the deploy tree, by class

Every non-HTML file is either in the table above or in exactly one class below; the counts
are regenerated by the test, so a new file cannot arrive uncounted.

| Class | Count | What |
| --- | --- | --- |
| Browser proof rig and receipts | 98 | the real-Chromium verification rig, its fixtures, proof scripts, screenshots and receipt log — see `browser-proof/receipts/RECEIPTS.md` |
| Control manifests | 1 | the frozen machine-readable provider-native refactor boundary; deploy-visible until repository-level control artifacts receive a separate exclusion rule |
| Documentation (`*.md`) | 8 | the root docs, receipt and handoff, plus the bridge draft's README — served as text |
| Test suites (`*.test.mjs`) | 33 | the tests directory and the bridge draft's — served as text; they are the review evidence |
| X-bridge extension draft | 11 | manifest, five scripts, five icons — Chrome extension files, deployed all the same |
| Supabase sources | 8 | edge-function and migration sources — served as text, never executed by the deploy |
| Root data / config | 4 | `/MANIFEST.yaml` · `/vercel.json` (deploy config — Vercel may withhold it from serving; not probed from this session) · `/.links.yaml` · `/.gitignore` (dotfiles — serving not probed) |
| Proof captures | 1 | `/station-x-visible-crop-proof.png` |

## Testing rule that goes with this inventory

H1's other half: test on clean `main` or on a preview built from a pushed branch. A dirty
local checkout is not evidence, because the thing under test is what the deploy will serve,
not what one working tree happens to contain.
