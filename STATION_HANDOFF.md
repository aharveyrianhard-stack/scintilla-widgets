# Station visible-truth closure — session handoff

Written at a committed checkpoint by executor 3 after the continuation packet. Everything
below was re-derived from the working tree at head, not carried forward from an earlier note.

## Exact state

| | |
| --- | --- |
| Repo | `aharveyrianhard-stack/scintilla-widgets` |
| Branch | `claude/station-visible-truth-closure-8ipyru` |
| Head | the docs commit carrying this handoff; last code commit `41927ae` — pushed |
| PR | [#115](https://github.com/aharveyrianhard-stack/scintilla-widgets/pull/115) — **DRAFT, NO-MERGE** |
| Uncommitted | **none** at handoff |
| Tests | `node --test "tests/*.test.mjs"` → **228 pass, 0 fail**, 23 files |
| Browser receipts | `browser-proof/receipts/` — 16 screenshots + `RECEIPTS.md`, every entry regenerable by the command it names |
| Production | **untouched.** No deploy, no Vercel/Supabase/Fly/R2 mutation, no Hub edit; no database reads at all in rounds 3–4 |
| Preview | `https://scintilla-widgets-git-cla-070619-aharveyrianhard-8432s-projects.vercel.app` |

## What round 4 (the continuation packet) closed

**The three filed defects, fixed and browser-verified** (per-defect detail and receipts in
`STATION_VISIBLE_TRUTH_RECEIPT.md`, "continuation packet" section):

1. **AI Software cohort replaces the Favorites rows** — the cohort scene is first-class
   again (the legacy `cohort→themeFamilies` collapse silently discarded every chosen
   cohort) and the navigation index is the FULL membership per cohort (it was intersected
   with hub_favorites, so a chosen cohort showed at most the favorites already on the
   wall). FAV is the explicit default entry the cohorts replace; the deck has a
   scene-scoped cohort picker with honest paging.
2. **Megacap replaces the Favorites rows** — same fix, proven separately.
3. **AI Power shows its declared rows** — `familyBasket()` was never given an id, so both
   family scenes rendered their first basket forever; a scene-scoped family picker makes
   every declared basket reachable (OKLO IREN CIFR BE WULF USAR verified on screen).

**The defect-packet cluster:** ticks reach the chart within one poll and a deck pane within
one pump heartbeat; the displayed change equals the provider's own arithmetic exactly; a
cold range switch never blanks the canvas (20 continuous samples); the deck header's LIVE
healthy state is photographed working. **CLOSED labels despite live feed** is a Hub-side
defect: no such label exists anywhere in this repository (search recorded in the receipts) —
it needs the scintilla-hub repo, which the standing locks forbid editing from here.

**PR-review continuation:** the last `catch(() => null)` class is swept (/ranks fails a
column by source name instead of claiming per-ticker "no data" and states its ETF-filter
outage; /reflow refuses grey non-answers over a failure; /events tells a dead read apart
from a clear calendar; /cohorts names the FAV-count failure) — browser-verified under forced
500s. The fundamentals/dcf/allocation DB readers now share /health's 20s ceiling with
timeout worded as its own kind.

**New capability:** `browser-proof/` — real Chromium over the served repo with both data
owners answered from one consistent fixture universe (outbound HTTPS to the real owners is
proxy-blocked here: CONNECT 403, measured). Receipts prove PAGE behavior under controlled
data, not the owners' data, and say so. Run:
`PW_MODULE_DIR=<dir-with-playwright-core> node browser-proof/proofs/<name>.mjs`.

## Commit map

Rounds 1–2: `d54da89..79cfb67` (14 commits — STATION-001…004, transport, identity, price
authority; see the receipt). Round 3: `06e4a0a..fbeb12d` (12 commits — header healthy state,
heartbeat vs bound, /health identity+ceilings, allocation geiger/zero-voters, fundamentals
gate/TTL/kinds, DCF cold-load, price audit, sector spine gate, dependency inventory, docs).
Round 4 (this packet): `91dfe7f` rig + BEFORE receipts · `4d7a65f` cohort scene model ·
`85b9260` cohort picker + proof · `713a0de` family picker + proof · `5173ec7` tick/repaint/
mismatch proofs + CLOSED disposition · `ae3050f` count erratum (regenerated from the
filesystem) · `0564e02` catch-null sweep + proof · `41927ae` reader ceilings.

## Errata (cumulative, so nothing is re-derived as a mystery)

- `d4eca89` says "219 tests" in its message; truth was 217.
- `db01f2a` briefly red on one stale pin; repaired by `38694a5`.
- `5173ec7` pushed while the inventory count test was red; `ae3050f` fixed it minutes later.
  The session now commits through a gate script that requires `fail 0`.
- `ae3050f`'s Claude-Session trailer has a one-character URL typo. Recorded; unfixable.

## The rules (fourteen; unchanged from round 3's handoff)

A failed read is never data · only the owner may name an absence · a successful response
accounts for every requested symbol · emptiness is decided on the raw value · unknown time
stays null · ownership is identity, not cardinality, and fails closed (equalizer digest
`f6cf97b5…97ad1` in full) · soft 4.5s reports, hard 20s settles · one price authority ·
offset paging requires a total order · a sample may only speak for itself · a heartbeat is
cadence, not invalidation · no voters is not a neutral answer · the gate lives where the
paint lives · a claim's evidence must match the claim's scope.

## Live facts, measured in earlier rounds — do not re-derive by guess

Unchanged from the round-3 handoff: `ticker_cohorts` view, 1,283 memberships, no
`is_primary`; `tickers.cohort` = home (387/387, 16 homes); equity universe 365 = 387 − 22
with 90 NULL types (AAPL among them); `news` 312,664 rows / 1,246 NULL `published_ts`, PK
`(ticker,url)`; `composite_staged.updated_ts` epoch seconds vs `live_quotes.updated_ts`
timestamptz; unfiltered `ohlcv_history` order-by → 57014; five `/quotes` probes 0.84s,
6.86s, 1.27s, 2.71s, 0.27s (the basis of rule 7); non-equity roster `BTCUSD ESUSD NQUSD
CLUSD GCUSD SIUSD DXUSD US10Y VIX`.

## Exact remaining defects and blockers

| # | Item | State |
| --- | --- | --- |
| 1 | **CLOSED labels despite live feed** | **CROSS-REPO.** Lives in scintilla-hub; no such label exists in this repository (search recorded). Needs Hub repo access, which the standing locks forbid from this branch. |
| 2 | **F1 — sector-rotation cross-project** | **ACTIVE/BLOCKED.** `sectorrotation.scintillahub.ai/_provider/provider.js` is 404; Fly CORS rejects that origin. The page now refuses the authority claim without the shim (NOT PROVIDER AUTHORITY) and never claims LIVE on a short spine — visible, not closed. Needs the scintilla-sector deploy + CORS. |
| 3 | **Scene internals** | **ACTIVE/BLOCKED.** `ADD PCC CUMTICK TICK TRIN` unowned; panes retry correctly; `/health` carries them BAD by construction. Needs an owner's support-or-absence ruling. |
| 4 | **H2 (X)** | Untouched, proof-gated by instruction. |
| 5 | **H3 / H4** | Contracts asserted; gesture feel and fullscreen geometry need a human eye. |
| 6 | **Fly CORS vs preview origin** | Still not allowed → no LIVE-data provider path provable end-to-end from the preview. The rig covers stubbed-data acceptance only, and says so. |
| 7 | **Independent re-audit** | Everything above, pending. Round 4 again found real defects in surfaces called complete earlier (the cohort collapse, the family id, the four catch-null panels). The test count is not the verdict. |

## Next units, in order — ≥8, runnable-now first

1. **Extend browser proofs to the degraded states** of /health, /allocation, /fundamentals
   and /dcf (provider dead, Supabase dead, both) — the rig makes each a small proof file
   with screenshots; the unavailable renderings from round 3 have unit pins but no browser
   receipts yet. Runnable now.
2. **`tokens.css` ruling** — served, referenced by nothing (named in the route inventory).
   Retire or wire; one small commit. Runnable now.
3. **DCF static-baseline DB wiring** — netDebt / D&A% / capex% / ΔNWC% / margin & tax
   defaults still carry the Jul-24 snapshot, honestly flagged STATIC. Wire to
   `fundamentals`/`fundamentals_history` as price/beta/shares/revenue already are. Runnable
   (verify field availability with read-only queries when Supabase is reachable).
4. **Cohort-scene edges** — an all-empty FAV (zero favorites) currently renders one empty
   editable slot; give it an explicit "no favorites yet — choose a cohort" wording. Document
   `?scene=cohort&cohort=…&page=…` in STATION_ROUTES.md. Small, runnable now.
5. **Hub-side CLOSED-labels fix** — needs the scintilla-hub repo in scope; carry the search
   evidence from the receipts so the Hub session starts warm. BLOCKED here.
6. **F1 cross-project deploy + CORS** — as above. BLOCKED here.
7. **Scene-internals ownership ruling** — as above. BLOCKED on an owner.
8. **Live preview acceptance** — with Fly CORS allowing the preview origin and a live
   browser, walk the receipt's 12-step checklist; the rig's stubbed acceptance is not this.
   BLOCKED on CORS.
9. **H3/H4 human verification** — BLOCKED on a human eye.
10. **`MEGA_CAP` vs `MEGACAP`** — upstream duplication, outside this branch; worth a ruling.

## Locks and boundaries still in force

- Draft PR only. **Do not merge. Do not deploy production.** No Vercel production changes,
  no Supabase/Fly/R2 mutation, no Hub edit, no change to price / previous-close / Geiger
  authority or methodology.
- Supabase access, when used, is read-only `SELECT`; rounds 3–4 used none.
- The stable Station URL is untouched; all risk stays on this branch and its preview.
- Browser receipts are stubbed-data page proofs; do not present them as live-data
  acceptance. Live visual acceptance still requires a browser plus an allowed CORS origin.
- **Independent re-audit decides merge readiness, not the test count.**
