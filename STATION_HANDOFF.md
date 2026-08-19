# Station visible-truth closure — session handoff

Written at a committed checkpoint. Everything below was re-derived from the working tree at
head, not carried forward from an earlier note.

## Exact state

| | |
| --- | --- |
| Repo | `aharveyrianhard-stack/scintilla-widgets` |
| Branch | `claude/station-visible-truth-closure-8ipyru` |
| Head | `acfda76` — pushed, matches origin |
| PR | [#115](https://github.com/aharveyrianhard-stack/scintilla-widgets/pull/115) — **DRAFT, NO-MERGE** |
| Uncommitted | **none.** `git status` clean at handoff |
| Tests | `node --test "tests/*.test.mjs"` → **164 pass, 0 fail**, 13 files |
| Production | **untouched.** No deploy, no Vercel/Supabase/Fly/R2 mutation, no Hub edit |
| Preview | `https://scintilla-widgets-git-cla-070619-aharveyrianhard-8432s-projects.vercel.app` |

**Branch deviation, standing:** the task named `agent/station-visible-truth-closure-20260819`;
this environment designated `claude/station-visible-truth-closure-8ipyru` and forbade deviating.
The environment's designation won. Renaming is one command if preferred.

## Commits on the branch

`d54da89` chart-shell re-sync · `cae3a58` STATION-001 · `289082c` STATION-002 · `e8177e8`
STATION-003 · `fa163c5` STATION-004 · `9a20a85` cohort axis + provider transport + fabricated
stamps · `bfb2a42` home vs membership; partial answers · `27ea7f0` receipt · `8ebddae` live
ticks, per-symbol cache, lane isolation · `4f581b5` fabricated prices, unverified ownership,
bounds · `00a5d69` identity and digest binding · `876de8d` failed page read ≠ end of table ·
`acfda76` one price authority; canonical set not NULL-blind.

## Test files (13)

`chart-candle-immutability` · `chart-history-window` · `chart-input-boundary` ·
`chart-load-resilience` · `station-cohort-routes` · `station-equity-authority` ·
`station-h3-h4-backlog` · `station-named-absence` · `station-news-time` ·
`station-route-inventory` · `station-scenes` · `station-shared-state` ·
`station-transport-vs-absence`

There is no package.json, CI workflow or build step. The gate is: the suite, the inline-script
syntax check, `node --check` on the two JS modules, an exact `chart/index.html` ↔
`station-shells/chart-v1/index.html` mirror, and `git diff --check`.

## Open blockers — none of this is closed

| # | Item | State |
| --- | --- | --- |
| 1 | **F1 — sector rotation** | **ACTIVE/BLOCKED.** Canonical tool is the separate `scintilla-sector` project. `sectorrotation.scintillahub.ai/_provider/provider.js` is **404**; Fly CORS rejects that origin. This repo holds a copy. Needs a cross-project deploy + CORS proof. |
| 2 | **Scene internals** | **ACTIVE/BLOCKED.** `ADD` `PCC` `CUMTICK` `TICK` `TRIN` — zero rows in `ohlcv_history`, `live_quotes`, `composite_staged`; absent from `tickers`. No owner names them, so their panes must keep retrying. `/health` carries them in a lane that is BAD by construction. Needs an authoritative support-or-absence contract from their owner lane. |
| 3 | **H2 (X)** | Untouched, proof-gated by instruction. Needs a real signed-in isolated surface. |
| 4 | **H3 / H4** | Partial. Contracts asserted; gesture *feel* and fullscreen *geometry* need a human eye. |
| 5 | **Fly CORS vs preview origin** | The preview origin is not allowed by Fly CORS, so **no provider path can be proved end-to-end from the preview**. Preview green = static delivery only. |
| 6 | **Everything else** | Repaired, **pending independent re-audit**. Successive rounds have found real defects in work previously called complete, including two I introduced. |

## The rules this work is held to

Established across the review rounds; a new session should treat these as binding.

1. **A failed read is never data.** Transport failure, HTTP non-OK, timeout, an error-tagged
   empty array, or a shim bug must never become an empty result, a named absence, or a `0`.
2. **Only the owner may name an absence.** `NOT_OBSERVED_BY_STREAM` is the stream's answer.
   `TIMEFRAME_NOT_MAPPED` / `TICKER_FILTER_REQUIRED` say *this surface asked wrongly* and must
   propagate, not convert to a clean empty 200. Unnamed emptiness is retryable.
3. **A successful response must account for every requested symbol.** Short batches, stale cache
   rows and half-failed passthroughs fail the whole request.
4. **Emptiness is decided on the raw value.** `Number(null)`, `Number('')` and `Number(false)`
   are all `0`. Never coerce before testing for presence.
5. **Unknown time stays null.** Never `|| Date.now()`, never `new Date(null)`.
6. **Ownership is identity, not cardinality,** and fails closed. Canonical set = active tickers
   with `type` NULL **or** not in (crypto, future, index, rate) — the NULL branch is essential.
   Full equalizer digest `f6cf97b57cf26a37aeb8393dec676f1776b02da282dffcce95786e5762697ad1`
   required. No canonical set → unverified → retryable.
7. **Soft 4.5s reports; hard 20s settles.** Measured: five `/quotes` probes at 0.84s, **6.86s**,
   1.27s, 2.71s, 0.27s — a single 4.5s abort kills one valid read in five. A caller's own abort
   outranks both and is answered immediately, including when already aborted.
8. **One price authority.** The provider quote or nothing. Never `fundamentals.price`, never a
   cohort-feed price, never a static baseline, in any current-price arithmetic.
9. **Offset paging requires a total order,** and a paged read reports its own completeness — a
   row count is not evidence.
10. **A sample may only speak for itself.**

## Live facts, measured — do not re-derive by guess

- `ticker_cohorts` is a view (`DISTINCT ticker, group_key AS cohort FROM ticker_membership JOIN
  tickers ON active`); **1,283** memberships; no `is_primary`. Legacy base table is
  `ticker_cohorts_legacy`.
- `tickers.cohort` is the **home** cohort: 387/387 active populated, 16 homes. NVDA → `AI_HARDWARE`;
  its memberships are `AI_HARDWARE, MEGA_CAP, MEGACAP, SEMICONDUCTORS, TECH`.
- `cohorts` is `SELECT ticker, cohort FROM tickers` — a home relation, **not** a membership one.
- Equity universe: 387 active − 22 (crypto 9, future 6, index 5, rate 2) = **365**. 90 actives
  have NULL `type`, AAPL among them.
- `news`: 312,664 rows, **1,246** with NULL `published_ts`; PK is `(ticker, url)`; `url` alone is
  not unique (1,240 distinct across the 1,246).
- `composite_staged.updated_ts` is **bigint epoch seconds**; `live_quotes.updated_ts` is
  **timestamptz**.
- Unfiltered `ohlcv_history` order-by → Supabase **57014** statement timeout; roster-filtered with
  `tf=D` it is an index scan at ~1.5ms.
- Non-equity roster with real rows: `BTCUSD ESUSD NQUSD CLUSD GCUSD SIUSD DXUSD US10Y VIX`.
  On 2026-08-19 futures/crypto were minutes old; `US10Y` and `VIX` had not moved since 2026-08-14.

## Next READY units, in order

1. **F1 cross-project** — get `_provider/provider.js` deployed at the `sectorrotation` origin and
   that origin allowed by Fly CORS, then re-verify the D/W/5m/1m spine end to end. Until then F1
   stays ACTIVE/BLOCKED and must not be described as closed.
2. **Scene-internals contract** — obtain a support-or-absence ruling for `ADD PCC CUMTICK TICK
   TRIN` from their owner lane. If they are to be retired from the scenes, that is a scenes
   change; if supported, they need an owner that can name an absence. No shim fabrication.
3. **Preview acceptance pass** — with Fly CORS allowing the preview origin, walk the 12-step
   checklist in `STATION_VISIBLE_TRUTH_RECEIPT.md` with devtools open. This is the only route to
   visual acceptance; nothing in this branch claims it.
4. **Remaining `.catch(() => null)` sweep** — `ranks`, `reflow`, `events` (earnings reads) and
   `cohorts` (FAV count) still convert failures into empty panels. Same class as the defects
   already fixed; not yet swept.
5. **H3/H4 human verification** — two-finger gesture smoothness on iPad; fullscreen geometry (one
   video across both video panes with X in the remaining black).
6. **`MEGA_CAP` vs `MEGACAP`** — both exist as separate cohorts upstream and NVDA is in both.
   Outside this branch's boundary; worth a ruling.

## Locks and boundaries still in force

- Draft PR only. **Do not merge. Do not deploy production.** Do not change Vercel production
  settings, mutate Supabase/Fly/R2, edit the Hub repo, or change price / previous-close / Geiger
  authority or methodology.
- Supabase access used in this session was **read-only `SELECT`** for diagnosis. Keep it that way.
- The stable Station URL is untouched; all risk stays on this branch and its isolated preview.
- Do not claim visual acceptance without a browser and an allowed CORS origin.
- **Independent re-audit decides merge readiness, not the test count.**
