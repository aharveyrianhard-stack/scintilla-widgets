# Station visible-truth closure — session handoff

Written at a committed checkpoint by executor 3. Everything below was re-derived from the
working tree at head, not carried forward from an earlier note.

## Exact state

| | |
| --- | --- |
| Repo | `aharveyrianhard-stack/scintilla-widgets` |
| Branch | `claude/station-visible-truth-closure-8ipyru` |
| Head | the docs commit carrying this handoff; last code commit `d4eca89` — pushed |
| PR | [#115](https://github.com/aharveyrianhard-stack/scintilla-widgets/pull/115) — **DRAFT, NO-MERGE** |
| Uncommitted | **none** at handoff |
| Tests | `node --test "tests/*.test.mjs"` → **217 pass, 0 fail**, 21 files |
| Production | **untouched.** No deploy, no Vercel/Supabase/Fly/R2 mutation, no Hub edit. This round issued **no database reads at all** |
| Preview | `https://scintilla-widgets-git-cla-070619-aharveyrianhard-8432s-projects.vercel.app` |

**Branch note, standing:** an earlier task named `agent/station-visible-truth-closure-20260819`
and a later packet named this branch itself; the environment designation and the packet agree on
`claude/station-visible-truth-closure-8ipyru` being the single queue. (This session's harness
minted a fresh pointer `claude/scintilla-station-visible-truth-74to61` at the same commit; per
the packet's no-second-queue rule the work stayed here, and that pointer was left untouched.)

## Commits on the branch

Round 1–2 (executors 1–2): `d54da89` chart-shell re-sync · `cae3a58` STATION-001 · `289082c`
STATION-002 · `e8177e8` STATION-003 · `fa163c5` STATION-004 · `9a20a85` cohort axis + provider
transport + fabricated stamps · `bfb2a42` home vs membership; partial answers · `27ea7f0`
receipt · `8ebddae` live ticks, per-symbol cache, lane isolation · `4f581b5` fabricated prices,
unverified ownership, bounds · `00a5d69` identity and digest binding · `876de8d` failed page
read ≠ end of table · `acfda76` one price authority; canonical set not NULL-blind · `79cfb67`
handoff.

Round 3 (executor 3, this session — per-unit detail in the receipt's "Round — executor 3"):
`06e4a0a` D1 header healthy-state ReferenceError · `d544db5` D2 heartbeat is cadence, not
invalidation · `7189d92` D3 /health identity + bounded DB probes · `2bd8bf7` A1 allocation on
the accepted geiger only · `872e7ef` A2 zero voters is not a neutral market · `db01f2a` B1
fundamentals price: gate/TTL/kinds · `38694a5` pin repair (see errata) · `caef817` C1 DCF
cold-load Jul-24 authority removed · `0204279` C2 silent-alternate-price audit · `8c8ddfa` E1
sector spine LIVE/PARTIAL/no-shim gate · `d4eca89` E2 served-dependency inventory.

## Test files (21)

`chart-candle-immutability` · `chart-history-window` · `chart-input-boundary` ·
`chart-load-resilience` · `station-allocation-authority` · `station-cohort-routes` ·
`station-dcf-cold-load` · `station-equity-authority` · `station-fundamentals-price` ·
`station-h3-h4-backlog` · `station-health-identity` · `station-market-status` ·
`station-named-absence` · `station-news-time` · `station-price-audit` ·
`station-quote-pump` · `station-route-inventory` · `station-scenes` ·
`station-sector-spine` · `station-shared-state` · `station-transport-vs-absence`

There is no package.json, CI workflow or build step. The gate is: the suite, the inline-script
syntax check (`new Function` over every `<script>` body), `node --check` on the two JS modules,
an exact `chart/index.html` ↔ `station-shells/chart-v1/index.html` mirror, and
`git diff --check`. Run all of it before every commit — one pushed commit this round carried a
red pin for a few minutes because the full suite ran after the commit chain instead of gating
it (see errata).

## Errata this round, so they are not re-derived as mysteries

- `d4eca89`'s commit message says "219 tests"; the truth at that head is **217**.
- `db01f2a` (B1) was pushed with one stale pin red in `station-equity-authority` (it asserted
  B1's superseded disable mechanism); `38694a5` repaired it minutes later. Both facts are in
  the receipt.

## Open blockers — none of this is closed

| # | Item | State |
| --- | --- | --- |
| 1 | **F1 — sector rotation cross-project** | **ACTIVE/BLOCKED.** Canonical tool is the separate `scintilla-sector` project; `sectorrotation.scintillahub.ai/_provider/provider.js` is **404**; Fly CORS rejects that origin. NEW this round: the page now *detects* the missing shim and paints NOT PROVIDER AUTHORITY instead of captioning raw table reads "authority=provider", and never claims LIVE unless D/W/5m/1m all answered for every ticker. That makes the blocked state visible; the deploy + CORS work remains. |
| 2 | **Scene internals** | **ACTIVE/BLOCKED.** `ADD PCC CUMTICK TICK TRIN` — zero rows anywhere, no owner. Panes retry correctly; `/health` carries them in a BAD-by-construction lane. Needs a support-or-absence ruling from their owner lane. |
| 3 | **H2 (X)** | Untouched, proof-gated by instruction. |
| 4 | **H3 / H4** | Contracts asserted; gesture *feel* and fullscreen *geometry* need a human eye. |
| 5 | **Fly CORS vs preview origin** | Preview origin not allowed by Fly CORS → **no provider path provable end-to-end from the preview.** Preview green = static delivery only. |
| 6 | **Everything else** | Repaired, **pending independent re-audit**. Rounds keep finding real defects in work previously called complete — this round found them in D/A/B/C/E surfaces called done before. The test count is not the verdict. |

## The rules this work is held to

Established across the review rounds; binding on any new session.

1. **A failed read is never data.** Transport failure, HTTP non-OK, timeout, an error-tagged
   empty array, or a shim bug must never become an empty result, a named absence, or a `0`.
2. **Only the owner may name an absence.** Unnamed emptiness is retryable.
3. **A successful response must account for every requested symbol.**
4. **Emptiness is decided on the raw value.** `Number(null)`, `Number('')`, `Number(false)`
   are all `0`. Never coerce before testing presence.
5. **Unknown time stays null.** Never `|| Date.now()`, never `new Date(null)`.
6. **Ownership is identity, not cardinality, and fails closed.** Canonical set = active
   tickers with `type` NULL **or** not in (crypto, future, index, rate); full equalizer digest
   `f6cf97b57cf26a37aeb8393dec676f1776b02da282dffcce95786e5762697ad1` required.
7. **Soft 4.5s reports; hard 20s settles.** A caller's own abort outranks both.
8. **One price authority.** The provider quote or nothing — never `fundamentals.price`, never
   a cohort-feed price, never a static baseline, in any current-price arithmetic.
9. **Offset paging requires a total order,** and a paged read reports its own completeness.
10. **A sample may only speak for itself.**

New this round, earned the hard way:

11. **A heartbeat is cadence, not invalidation.** A periodic tick on an unchanged request must
    never retire the in-flight read it is pacing.
12. **No voters is not a neutral answer.** An average over an empty set is null, and every
    consumer says "unavailable" instead of acting on a fabricated midpoint.
13. **The gate lives where the paint lives.** A disable done as a one-time cell wipe is undone
    by the next render; put the check at the top of the paint path.
14. **A claim's evidence must match the claim's scope.** LIVE over D/W/5m/1m needs all four
    views; "authority=provider" needs the authority shim actually loaded; a loader count comes
    from script tags, not grep hits.

## Live facts, measured in earlier rounds — do not re-derive by guess

- `ticker_cohorts` is a view (`DISTINCT ticker, group_key AS cohort FROM ticker_membership
  JOIN tickers ON active`); **1,283** memberships; no `is_primary`. Legacy base table is
  `ticker_cohorts_legacy`.
- `tickers.cohort` is the **home** cohort: 387/387 active populated, 16 homes. NVDA →
  `AI_HARDWARE`; memberships `AI_HARDWARE, MEGA_CAP, MEGACAP, SEMICONDUCTORS, TECH`.
- Equity universe: 387 active − 22 (crypto 9, future 6, index 5, rate 2) = **365**. 90 actives
  have NULL `type`, AAPL among them.
- `news`: 312,664 rows, **1,246** with NULL `published_ts`; PK `(ticker, url)`; `url` alone
  not unique.
- `composite_staged.updated_ts` is **bigint epoch seconds**; `live_quotes.updated_ts` is
  **timestamptz**; `ohlcv_history.timestamp` is bigint epoch seconds.
- Unfiltered `ohlcv_history` order-by → Supabase **57014**; roster-filtered `tf=D` ≈ 1.5ms.
- Five live `/quotes` probes measured 0.84s, **6.86s**, 1.27s, 2.71s, 0.27s — the basis of
  rule 7.
- Non-equity roster with real rows: `BTCUSD ESUSD NQUSD CLUSD GCUSD SIUSD DXUSD US10Y VIX`
  (US10Y and VIX were 5 days stale on 2026-08-19; futures/crypto minutes old).

## Next READY units, in order — all runnable except where marked

1. **`.catch(() => null)` sweep** — `ranks`, `reflow`, `events` (earnings reads) and `cohorts`
   (FAV count) still convert failures into empty panels. Same class as defects already fixed;
   not yet swept. Runnable now, in-repo.
2. **Bound the template DB readers** — `/health` got the 20s ceiling with distinct timeout
   words; the `sb()`/`sbGet()` readers in `fundamentals`, `dcf` and `allocation-module` are
   still unbounded fetches. Same pattern, three files. Runnable now.
3. **`tokens.css` ruling** — served, referenced by nothing (named in the route inventory).
   Retire it or wire it; either is one small commit. Runnable now.
4. **DCF static-baseline wiring** — netDebt / D&A% / capex% / ΔNWC% / margin & tax defaults
   still carry the Jul-24 snapshot, honestly flagged STATIC. Wire them to
   `fundamentals`/`fundamentals_history` the way price/beta/shares/revenue already are.
   Runnable now (needs read-only queries to verify field availability).
5. **F1 cross-project deploy** — publish `_provider/provider.js` at the `sectorrotation`
   origin and allow that origin in Fly CORS, then re-verify the D/W/5m/1m spine end to end.
   BLOCKED here: needs the `scintilla-sector` project and Fly config, neither reachable from
   this branch. The client-side gate from `8c8ddfa` will flip from NOT PROVIDER AUTHORITY on
   its own once the file exists.
6. **Scene-internals contract** — a support-or-absence ruling for `ADD PCC CUMTICK TICK TRIN`
   from their owner lane. BLOCKED on an owner decision; no shim fabrication.
7. **Preview acceptance pass** — with Fly CORS allowing the preview origin, walk the 12-step
   checklist in the receipt with devtools open. BLOCKED on CORS + a browser.
8. **H3/H4 human verification** — gesture feel on iPad; fullscreen geometry. BLOCKED on a
   human eye.
9. **`MEGA_CAP` vs `MEGACAP`** — upstream duplication, outside this branch's boundary; worth
   a ruling.

## Locks and boundaries still in force

- Draft PR only. **Do not merge. Do not deploy production.** Do not change Vercel production
  settings, mutate Supabase/Fly/R2, edit the Hub repo, or change price / previous-close /
  Geiger authority or methodology.
- Supabase access, when used, is **read-only `SELECT`** for diagnosis. This round used none.
- The stable Station URL is untouched; all risk stays on this branch and its isolated preview.
- Do not claim visual acceptance without a browser and an allowed CORS origin.
- **Independent re-audit decides merge readiness, not the test count.**
