# Station route inventory — H1

Every route this repository serves, taken from the tree rather than from memory. A route is
a directory containing `index.html`; Vercel serves it at that path. `tests/station-route-inventory.test.mjs`
regenerates this list from the filesystem and fails if the two disagree, so a new surface
cannot arrive undocumented and a retired one cannot linger here.

Generated against `main` + the visible-truth closure branch. 53 routes.

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

## Testing rule that goes with this inventory

H1's other half: test on clean `main` or on a preview built from a pushed branch. A dirty
local checkout is not evidence, because the thing under test is what the deploy will serve,
not what one working tree happens to contain.
