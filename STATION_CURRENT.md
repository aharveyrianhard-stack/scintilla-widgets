# SCINTILLA Station — SCENES V2 exact-placement preview current state

Updated: 2026-08-11 (America/New_York)

This file is the delivery record for OS-admitted preview job:
**SCINTILLA-STATION-SCENES-V2-EXACT-PLACEMENT-001**.

## Scope (preview-only)
- Scope: complete Scene V2 navigation redesign in the Station deck only.
- Forbidden for this job: clean-root/routing changes, production promotion, Hub edits, Station Bridge/X Feed Float changes, DB/schema/data/API work, iMac/iPad/TV workflows, trading/indicators, credentials/billing/scheduled-job work.
- Source allowed only inside station scene configuration and tests: `deck/scenes.js`, `deck/index.html`, `tests/station-scenes.test.mjs`, and this file.

## Exact source / PR / deployment
- Production base: `5b59353e9ccad8221886e59d15611c9816c72c53` (scintilla-widgets `main`).
- Branch: `agent/station-scenes-v2-nav-primitives`
- Worktree head: `973d83460b82f265e843de6108bcc360792775cb`
- Review PR: https://github.com/aharveyrianhard-stack/scintilla-widgets/pull/7 (open)
- Latest branch deployment observed in GitHub: deployment id `5853616151` (Preview, sha `973d834`)
- Preview host used for verification: https://scintilla-widgets-git-age-7e75b4-aharveyrianhard-8432s-projects.vercel.app

## Completed Scene V2 model
Implemented complete curated chooser in one pass:
1. LIVE
2. INDEX NOW
3. INDEX LEADERSHIP
4. COMPANY LEADERSHIP
5. FOCUS 2
6. MACRO CROSS-ASSET
7. INTERNALS FAST
8. INTERNALS SLOW
9. SECTOR FAMILIES
10. THEME FAMILIES
11. CUSTOM

Mandatory behavior:
- `INDEX NOW` is session-aware in New York time:
  - 08:00–17:59 → `SPY`, `QQQ`, manual `FLEX3`
  - 18:00–07:59 → `ESUSD`, `NQUSD`, manual `FLEX3`
- `FLEX3` remains manual and device-local (remembered).
- No `?scene` URL mutation is used to persist local UI scene state.
- Chart-count geometry stays bounded to `{1,2,3,4,6}`.
- Paging is lossless on larger grids (`2/3/4/6`) with no blank/placeholder symbol entries.
- Index leadership is exact: `SPY, QQQ, IWM, MAGS, SMH, DIA`.
- Sector/theme dropdowns expose only curated, reviewed families and real members.
- Unresolved entries stay as explicit placeholders (no invented tickers).
- Live five-chart media + one dedicated X pane, visible-only chart/pane mounting/polling is preserved.

## Tests / checks
- Unit tests: `node --test tests/station-scenes.test.mjs` → **13/13 pass**.
- Scene invariants now include:
  - exact ordered scene IDs and presets,
  - America/New_York `INDEX NOW` boundary test,
  - legacy key normalization,
  - geometry enforcement,
  - curated family filtering and paging,
  - no `?scene` mutation,
  - no unintended routing/Vercel-scope changes in this job.

## Preview proof package pending verifier
- STATION_CURRENT and candidate file deltas are currently source-evidenced in this worktree.
- Preview route is the gated Vercel PR deployment for SHA `973d834`.
- No production merge/push/promotion has been done in this job.
