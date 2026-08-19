# Station visible-truth closure — session handoff

Written at a committed checkpoint by executor 3 after the round-8 hub-entry packet.
Everything below was re-derived from the working tree at head, not carried forward from an
earlier note.

## Exact state

| | |
| --- | --- |
| Repo | `aharveyrianhard-stack/scintilla-widgets` |
| Branch | `claude/station-visible-truth-closure-8ipyru` |
| Head | `5db90cc` + the docs commit carrying this update — pushed |
| PR | [#115](https://github.com/aharveyrianhard-stack/scintilla-widgets/pull/115) — **DRAFT, NO-MERGE** |
| Uncommitted | **none** at handoff |
| Tests | `node --test "tests/*.test.mjs"` → **249 pass, 0 fail**, 24 files |
| Browser receipts | `browser-proof/` — 15 proof files, 42 screenshots + `RECEIPTS.md`, every entry regenerable by the command it names |
| Production | **untouched.** No deploy, no Vercel/Supabase/Fly/R2 mutation, no Hub edit. Database access this round: **two read-only SELECTs** on scintilla-live (schema + FY availability, recorded in the receipt); rounds 3–4 used none |
| Preview | `https://scintilla-widgets-git-cla-070619-aharveyrianhard-8432s-projects.vercel.app` |

## What round 5 (the second continuation packet) closed

Per-unit detail and the commit map live in `STATION_VISIBLE_TRUTH_RECEIPT.md`, "second
continuation packet" section. In one paragraph: the four degraded states of /health,
/allocation and /fundamentals are photographed in a real browser (`degraded-states.mjs`),
which caught a real defect the source pins could not — the allocation tables' empty-state
messages were UNREACHABLE (`html || fallback` with the header always in `html`), so zero
ranked candidates painted a bare header; both tables now decide on the raw row count.
/fundamentals no longer dies silently on a cold provider outage (boot had no catch). /pulse,
/econ, /alerts and /news joined the failed-read discipline — re-measurement showed the
round-4 "swept" claim was spelling-scoped (pins banned `.catch(() => null)` but not
`.catch(()=>null)`), and three pages still rendered dead reads as empty tables; all are
fixed and photographed both ways (`pulse-failed-reads.mjs`, `panel-failed-reads.mjs`). An
empty FAV names itself on the deck wall, gated on the read having landed
(`cohort-empty-fav.mjs`); /deck's scene URL params are documented with each claim verified
against the code; tokens.css carries an explicit OWNER RULING NEEDED. The DCF FY baseline
(netDebt · D&A% · capex% · ΔNWC%) now rides
balance_history/cashflow_history/fundamentals_history — availability measured first with
read-only SELECTs (all ten bar tickers complete; balance_history carries net_debt directly);
ratios only from matching fiscal dates; the fy-baseline badge counts live fields per ticker
and never says LIVE while short (`dcf-baseline.mjs` photographs the deliberate 8/10 rig
state). margin/tax defaults, MRP and debt weight stay STATIC by name.

## Commit map

Rounds 1–2: `d54da89..79cfb67` (14 commits). Round 3: `06e4a0a..fbeb12d` (12 commits).
Round 4: `91dfe7f..41927ae` + docs `5876807` (9 commits; see the receipt). Round 5:
`405dc3a` allocation dead gates · `7bf4658` fundamentals boot guard · `7e52b34`
degraded-states proofs + fixtures · `305cf1c` /pulse failed reads · `04ae8d7` empty-FAV +
URL docs + tokens ruling · `77283ab` DCF FY baseline · `96ec505` /econ /alerts /news
failed reads · plus the docs commit carrying this handoff.

## Errata (cumulative, so nothing is re-derived as a mystery)

- `d4eca89` says "219 tests" in its message; truth was 217.
- `db01f2a` briefly red on one stale pin; repaired by `38694a5`.
- `5173ec7` pushed while the inventory count test was red; `ae3050f` fixed it minutes later.
  Every commit since goes through a gate script that requires `fail 0`.
- `ae3050f`'s Claude-Session trailer has a one-character URL typo. Recorded; unfixable.
- Round 5 added none: eight commits, all gated green before push.

## The rules (fourteen; unchanged)

A failed read is never data · only the owner may name an absence · a successful response
accounts for every requested symbol · emptiness is decided on the raw value · unknown time
stays null · ownership is identity, not cardinality, and fails closed (equalizer digest
`f6cf97b5…97ad1` in full) · soft 4.5s reports, hard 20s settles · one price authority ·
offset paging requires a total order · a sample may only speak for itself · a heartbeat is
cadence, not invalidation · no voters is not a neutral answer · the gate lives where the
paint lives · a claim's evidence must match the claim's scope.

Round 5 exercised rule 14 twice: a source pin proves words EXIST, not that they can PAINT
(the allocation dead gate survived its pin until a browser proof asserted the render); and a
"swept" claim scoped to one spelling is a claim about the spelling, not the class.

## Live facts, measured — do not re-derive by guess

Unchanged from earlier rounds: `ticker_cohorts` view, 1,283 memberships, no `is_primary`;
`tickers.cohort` = home (387/387, 16 homes); equity universe 365 = 387 − 22 with 90 NULL
types (AAPL among them); `news` 312,664 rows / 1,246 NULL `published_ts`, PK `(ticker,url)`;
`composite_staged.updated_ts` epoch seconds vs `live_quotes.updated_ts` timestamptz;
unfiltered `ohlcv_history` order-by → 57014; five `/quotes` probes 0.84s–6.86s (rule 7's
basis); non-equity roster `BTCUSD ESUSD NQUSD CLUSD GCUSD SIUSD DXUSD US10Y VIX`.

New this round (2026-08-19, read-only): `balance_history` columns include `net_debt`,
`current_assets`, `current_liabilities`; `cashflow_history` includes `capex`;
`fundamentals_history` includes `revenue`, `ebitda`, `operating_income`. All ten DCF bar
tickers (NVDA MU GOOGL NBIS AVGO TSM AAPL MSFT TSLA IREN) have latest-FY rows in all three
tables with every needed field non-null; latest FY dates range 2025-06-30 (IREN, MSFT) to
2026-01-25 (NVDA) and MATCH across the three tables per ticker today.

## Exact remaining defects and blockers

| # | Item | State |
| --- | --- | --- |
| 1 | **CLOSED labels despite live feed** | **CROSS-REPO.** Lives in scintilla-hub; no such label exists in this repository (search recorded). Needs Hub repo access, which the standing locks forbid from this branch. |
| 2 | **F1 — sector-rotation cross-project** | **ACTIVE/BLOCKED.** Needs the scintilla-sector deploy + CORS; the page refuses the authority claim without the shim and never claims LIVE on a short spine. |
| 3 | **Scene internals** | **ACTIVE/BLOCKED.** `ADD PCC CUMTICK TICK TRIN` unowned; `/health` carries them BAD by construction. Needs an owner's support-or-absence ruling. |
| 4 | **/youtube `ytAct` lost writes** | **FIXED** (`a754a69`, round 6): revert + named flash, browser-verified. The shells' reason-silence and subscribe lane stay recorded as lesser gaps. |
| 5 | **DCF live acceptance** | The fy-baseline AND fy-seeds badges should read LIVE 10/10 against the real database; needs a live browser on the preview — round 7 re-measured this container (CONNECT 403 to hub/preview/Supabase) so it stays blocked here. |
| 6 | **H2 (X)** | Untouched, proof-gated by instruction. |
| 7 | **H3 / H4** | Contracts asserted; gesture feel and fullscreen geometry need a human eye. |
| 8 | **Fly CORS vs preview origin** | Still not allowed → no LIVE-data provider path provable end-to-end from the preview. |
| 9 | **Independent re-audit** | Pending, and still the merge gate. Round 5 again found real defects behind surfaces called complete (the unreachable empty-state messages, the spelling-scoped sweep). The test count is not the verdict. |

## Next units, in order — ≥8, runnable-now first

1. **DONE round 6**: /youtube lost writes (`a754a69`) · fundamentals FY-consistency
   (`6d0d003`) · /news + /cohorts main-read failure states (`a338bad`) — receipts in the
   round-6 section.
2. **DONE round 7** (`39567f9`): DCF growth/margin seeds from FY history; tax/terminal/
   MRP/debt weight named STATIC — sourcing them is an owner ruling (no tax line in
   fundamentals_history, measured). Was: **DCF static remainder** — margin/tax defaults from fundamentals_history (margins are
   already served), term-growth/MRP/debtW likely need an owner ruling; wire what has a
   source, flag the rest. Runnable now.
3. **DCF live acceptance walk** (badge LIVE 10/10, values sane against the static baseline)
   — needs a live browser on the preview; SB reads work from any origin today.
6. **Hub-side CLOSED-labels fix** — BLOCKED here (needs scintilla-hub in scope).
7. **F1 cross-project deploy + CORS** — BLOCKED here.
8. **Scene-internals ownership ruling** — BLOCKED on an owner.
9. **H3/H4 human verification** — BLOCKED on a human eye.
10. **`MEGA_CAP` vs `MEGACAP`** — upstream duplication; worth a ruling.

## Locks and boundaries still in force

- Draft PR only. **Do not merge. Do not deploy production.** No Vercel production changes,
  no Supabase/Fly/R2 mutation, no Hub edit, no change to price / previous-close / Geiger
  authority or methodology.
- Supabase access, when used, is read-only `SELECT`; round 5 used exactly two (recorded).
- The stable Station URL is untouched; all risk stays on this branch and its preview.
- Browser receipts are stubbed-data page proofs; do not present them as live-data
  acceptance. Live visual acceptance still requires a browser plus an allowed CORS origin.
- **Independent re-audit decides merge readiness, not the test count.**
