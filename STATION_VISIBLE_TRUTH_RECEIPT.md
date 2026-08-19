# Station visible-truth closure — receipt

Draft only. No production deploy, no Vercel production setting changed, no Supabase/Fly/R2
mutation, no Hub edit, no change to price, previous-close or Geiger authority, and no change to
Geiger methodology. Every read against the live database was `SELECT` only.

## Branch — deviation recorded

The task named `agent/station-visible-truth-closure-20260819`. The work is on
**`claude/station-visible-truth-closure-8ipyru`**, which is the branch this execution
environment designated and instructed never to deviate from without explicit permission. The two
instructions conflict; the environment's designation won, and this is the deviation, stated
rather than buried. Nothing else about the boundary changed. Renaming or re-pushing to the
originally named branch is one command if that is preferred.

- PR: [#115](https://github.com/aharveyrianhard-stack/scintilla-widgets/pull/115) — **draft**
- Preview: `https://scintilla-widgets-git-cla-070619-aharveyrianhard-8432s-projects.vercel.app`
  (branch preview, isolated; the stable Station URL is untouched)

## Commits

**Head: `00a5d69`.** Every number below was re-derived from this head, not carried forward.

| Commit | What |
| --- | --- |
| `d54da89` | Re-sync the versioned chart shell with the reviewed chart surface |
| `cae3a58` | STATION-001 — keep the stream's named absence named |
| `289082c` | STATION-002 — drop the dead `is_primary` filter |
| `e8177e8` | STATION-003 — stop dating undated news items to the Unix epoch |
| `fa163c5` | STATION-004 — take legacy equity authority off `/analytics` and `/health` |
| `9a20a85` | Pre-merge corrections: cohort axis, provider transport, fabricated stamps |
| `bfb2a42` | Cohort axis home vs membership; partial answers stop counting as absence |
| `27ea7f0` | Add this receipt |
| `8ebddae` | Live ticks, per-symbol cache, lane isolation, honest scope |
| `4f581b5` | Fabricated prices, unverified ownership, bounds measurement disproved |
| `00a5d69` | Bind equity authority to identity and digest, not to a count |

## Root causes, each confirmed against the live system

Every diagnosis below was verified by read-only query or by the reviewer's live provider
capture. None is inferred from the code alone.

**Baseline.** Three tests were red on clean `main`. The Supabase Realtime equity bypass landed in
`chart/index.html` only, so `station-shells/chart-v1` kept a copy in which a legacy price could
still patch a provider-owned chart.

**STATION-001.** A history read that *failed* and one that *succeeded carrying nothing* were the
same thing to the chart: paint `data delayed · retrying`, arm another timer. On INDEX NOW, MACRO
CROSS-ASSET, INTERNALS FAST and INTERNALS SLOW the answer is settled, so the timer never resolved
anything.

**STATION-002.** `ticker_cohorts` is now a view — `SELECT DISTINCT m.ticker, m.group_key AS
cohort FROM ticker_membership m JOIN tickers t ON t.ticker = m.ticker AND t.active` — with no
`is_primary`. The old base table survives as `ticker_cohorts_legacy`. `is_primary=eq.true`
returns 400, which each page's `pg()` rethrows without retrying, so all four routes died on
first paint. Underneath that: the view holds **1283** memberships against PostgREST's 1000-row
cap, and `tickers.cohort` — not any ordering rule — is the curated home cohort, populated for all
**387** active tickers over **16** home cohorts. NVDA's home is `AI_HARDWARE`; its memberships are
`AI_HARDWARE, MEGA_CAP, MEGACAP, SEMICONDUCTORS, TECH`.

**STATION-003.** `order=published_ts.desc` is NULLS FIRST in Postgres; **1246 of 312664** news
rows have a NULL `published_ts`; all 60 rows of the default page were among them; `null * 1000`
is `0`. The displayed age was the age of the Unix epoch — 20,684 days is `Date.now()` expressed
in days. The seconds/milliseconds/ISO tolerance added alongside is defensive breadth, not the
cause.

**STATION-004.** `/analytics` never loaded `_provider/provider.js`, so every equity number came
from the legacy tables while every other surface had moved. `/health` advertised `live_quotes` and
`composite_staged` as equity truth on a page whose job is to say what is true.

**Provider contract faults** (all found by the live review, all fixed): transport failure
collapsing into named absence at four points; ownership failing *open*, so a cold `/geiger`
failure routed every equity back to the legacy tables; `price_sip_utc` read where the payload
carries `price_observation_utc`; `Date.now()` written as the Geiger's compute time where
`/geiger` publishes `computed_utc`; `new Date()` substituted for a missing `updated_ts`;
`fundamentals.price` rendered under a heading that said the price was the provider's; and partial
batches, stale cache rows and half-failed passthroughs all resolving as successful answers.

**F1.** `templates/sector-rotation.html` and `templates/sector-rotation-older.html` ended their
relay chain in a direct Yahoo call and two public CORS proxies, reached silently whenever the
reviewed relays were unavailable. The newer page also called `ohlcv_history` its primary price
spine with a Yahoo fallback.

## Changed files

`_provider/provider.js` · `_cohorts/cohort-axis.js` (new) · `deck/index.html` ·
`chart/index.html` · `station-shells/chart-v1/index.html` · `news/index.html` ·
`analytics/index.html` · `health/index.html` · `cohorts/index.html` · `cohort/index.html` ·
`compare/index.html` · `geigerwall/index.html` · `heat/index.html` · `events/index.html` ·
`station-ipad/index.html` · `templates/fundamentals.html` · `templates/sector-rotation.html` ·
`templates/sector-rotation-older.html` · `STATION_ROUTES.md` (new) · six test files.

## Tests

`node --test "tests/*.test.mjs"` at head `00a5d69` — **160 pass, 0 fail**, across **13 files**.
There is no package.json, CI workflow or build step in this repository; the suite plus the static
syntax check, the JS parse check, the exact chart-shell mirror and `git diff --check` are the
whole gate.

Suites (13): `chart-candle-immutability` · `chart-history-window` · `chart-input-boundary` ·
`chart-load-resilience` · `station-cohort-routes` · `station-equity-authority` ·
`station-h3-h4-backlog` · `station-named-absence` · `station-news-time` ·
`station-route-inventory` · `station-scenes` · `station-shared-state` ·
`station-transport-vs-absence`.

Each new or rewritten suite was checked out against its parent commit in a detached worktree and
confirmed to fail there — most recently 66 of 145 failing on `8ebddae`. A passing count is
evidence that a stated contract holds, not evidence that the work is finished.

## Status by item — nothing here is called closed

Independent re-review decides merge readiness, not the test count. Every item below is either
**code-complete pending re-review** or explicitly **open**.

**Nothing here is closed.** Independent re-audit decides, not the test count. Successive review
rounds have found real defects in work this receipt previously called code-complete — including
two I introduced — so "pending re-audit" is the strongest status any row below carries.

| Item | Status |
| --- | --- |
| STATION-001 | repaired, **pending re-audit** — and its original claim was wrong; see below |
| STATION-002 | repaired, pending re-audit |
| STATION-003 | repaired, pending re-audit |
| STATION-004 | repaired, pending re-audit |
| H1 inventory | repaired, pending re-audit — 63 deployed HTML surfaces, both directions enforced |
| H2 (X) | **untouched and proof-gated**, by instruction |
| H3 | partial — the iPad page is pinned and the chart contracts are asserted; gesture *feel* is unverifiable here |
| H4 | partial — transport, subscribe and the ladder are asserted; fullscreen geometry is unverified |
| **F1** | **ACTIVE / BLOCKED — not closed by this branch. See below.** |
| **Scene internals** | **ACTIVE / BLOCKED** — ADD, PCC, CUMTICK, TICK, TRIN. See below. |

### STATION-001's original claim was wrong

It was described as making the four non-equity scenes settle on a name and stop. Measured
2026-08-19, that splits:

- `ESUSD` `NQUSD` `CLUSD` `US10Y` `VIX` — thousands of bars at scene timeframes, a `live_quotes`
  row, registered in `tickers`. These work.
- `ADD` `PCC` `CUMTICK` `TICK` `TRIN` — zero rows in `ohlcv_history`, `live_quotes` and
  `composite_staged`, and not registered in `tickers` at all.

Nothing owns the second group, so nothing *names* a terminal absence for them, and
`data delayed · retrying` is the truthful state for those panes. Stopping would fabricate a
certainty no owner has expressed. What STATION-001 actually fixed is the **conversion** — an
owner's named answer is no longer flattened into an endless retry. `/health` now carries those
five in their own lane, BAD by construction until an owner supports them.

### F1 is blocked, not done

What this branch did to `templates/sector-rotation.html` and `-older.html` is real: the direct
Yahoo call and the two public CORS proxies are gone, and the newer page's price spine reads the
provider contract. It does not close F1, for three reasons that live outside this repository:

- The canonical home of that tool is the separate **`scintilla-sector`** project. The copies
  here are copies; changing them does not change what is deployed there.
- `sectorrotation.scintillahub.ai/_provider/provider.js` is **404** — the authority shim these
  edits depend on is not deployed at that origin at all.
- Fly CORS does not allow the `sectorrotation` origin, so even a deployed shim could not reach
  the provider contract from there.

F1 therefore needs a cross-project follow-up with its own deploy and CORS proof. Treat it as
**ACTIVE/BLOCKED**, and do not read this branch as having closed it.

### Equity authority, and what "verified" now means

Ownership is bound to identity and to the equalizer digest, not to a count:

- The accepted equity set is every **active** ticker whose `type` is not crypto, future, index or
  rate. Measured 2026-08-19: 387 active less 22 excluded is exactly the 365 the provider
  publishes, missing `[]` and extra `[]`. A same-size swap — drop `AAPL`, add `TICK` — fails on
  membership, which a cardinality check could only have caught by luck.
- The full equalizer digest `f6cf97b5…97ad1` is required for both ownership and the Geiger read.
  A composite computed under a different equalizer is different numbers wearing the same name.
- Both fail **closed**: no verified ownership means no classification, and nothing is routed to
  the legacy tables on a guess.

Consequence, stated: a cold start while the provider or the canonical `tickers` read is
unreachable leaves non-equity charts delayed rather than served from Supabase, because the shim
cannot know they are non-equities. A warm verified map survives a bad read.

### Timeouts: two thresholds, because one was measurably wrong

Five read-only `/quotes` probes returned 200 with time-to-first-byte of 0.84s, 6.86s, 1.27s,
2.71s and 0.27s. A single hard 4.5s abort would have called a working provider unreachable on one
read in five. Everywhere a bound exists — the shim, the deck, `/health` — **soft 4.5s** reports
and lets the request finish, **hard 20s** guarantees settlement. A caller's own abort outranks
both and is answered immediately.

### H1 is an inventory, not a deployment gate

`STATION_ROUTES.md` now covers standalone `.html` files as well as directory routes — 63
deployed HTML surfaces, including ten standalone pages that the first version of the walk could
not see while claiming completeness. It records what the repository *would* serve. Whether a
given surface *should* be reachable is a separate ruling; where one is not wanted, exclude it in
the deployment config rather than by leaving it out of the inventory.

## Not accepted — needs an isolated preview and a human eye

No browser or computer-use surface is exposed to this session, and outbound HTTPS to Supabase and
to `scintilla-massive-chart-api.fly.dev` is blocked by the environment's network policy. Nothing
here claims visual acceptance.

**The Vercel preview origin is not currently allowed by the Fly CORS policy.** Static serving and
a green suite on that preview are therefore *not* end-to-end provider proof, and must not be
read as one.

Verify on the preview, with devtools open:

1. `/deck/` → INDEX NOW, MACRO CROSS-ASSET, INTERNALS FAST, INTERNALS SLOW. A pane the
   provider **names** should settle on that name and **stop**; the header should read
   `DATA · not observed by stream (n)`. Watch for two minutes — a named pane may not return to
   `data delayed · retrying`. A pane whose data is merely short or unnamed **should** keep
   retrying: that is the correct behaviour, not a regression.
2. Kill the network briefly on a loaded `/deck/`. Every pane must go to `data delayed · retrying`
   and keep retrying. This is the half that must NOT be quiet.
3. `/cohorts`, `/cohort`, `/compare`, `/geigerwall` → all four render. `/compare` should show
   more than 1000 memberships' worth of cohorts.
4. `/heat?group=cohort` → reload five times; NVDA must land in `AI_HARDWARE` every time.
5. `/news` → newest item has a real age. The header shows an exact undated count as a link;
   follow it to `?undated=1`, where those rows are listed and read `no date`. They are **not**
   reachable by scrolling the dated feed — putting dated items first is what made them
   unreachable, which is why they get their own door and their own count.
6. `/analytics` → `PRICE·PROVIDER` column. EQR must show the absence reason, **not** `63.8`.
   `GEIGER FRESH` must show a real age from `computed_utc`, not `0s`.
7. `/health` → the equity lane must report the provider universe against 365 and flag a
   disagreement rather than adopting it.
8. iPad: open `/station-ipad`, two-finger drag on the header. The page must not move.
9. `/compare` → LIVE COMPOSITE renders. Switch to 1M RETURN, 3M RETURN or BREADTH: the status
   line must name `whole universe bars not served` and the rows must empty, rather than drawing
   a blank table as though the cohorts had no history.
10. `/health` → `live_quotes`, `composite_staged` and `ohlcv_history` still appear, each marked
   `NON-EQUITY LANE ONLY`, probed by name and reported on their **oldest** member. The equity
   lane must show the accepted equalizer digest and the full universe count, not a five-symbol
   sample. The `Scene internals` lane must be BAD.
11. `/analytics` → count the header columns against a body row: RET must sit between CHG% and
   GEIGER. The universe card must read 365, not ~387.
12. `/news?undated=1` → page 2 and the last page must both be reachable, `1201–1246 of 1246` on
   the final page, with no row appearing twice.

## Blockers, stated

- Fly CORS does not allow the preview origin, so provider-path behaviour cannot be proved from
  the preview. Either allow that origin for the test window or verify from an allowed origin.
- H2 (X) is untouched and stays proof-gated. The intermittent iPad source-offline flash needs a
  real signed-in isolated surface; there is no such surface here and no evidence is claimed.
- H4's fullscreen geometry — one video across both video panes with X in the remaining black —
  is implemented as the two-stage media ladder and covered by tests, but the *visual* result is
  not verified here.
- F1 is blocked on the `scintilla-sector` project's own deploy and on Fly CORS for the
  `sectorrotation` origin. Neither is reachable from this branch.

## Accepted consequences, not hidden

- With ownership failing closed, a cold start while the provider is unreachable leaves
  **non-equity** charts delayed/retrying rather than served from Supabase, because the shim
  cannot know they are non-equities. A warm ownership map survives a bad read, so this is the
  cold-start case only.
- `/analytics` lost the panel that compared `eod_adjusted` against `ohlcv_history` and named the
  adjusted lens this surface's authority. Both are legacy tables; the adjusted-lens question is a
  live ruling and belongs where that ruling is made. Restoring it is a decision, not an omission.
- The whole-universe RETURN window on `/analytics` is stated as unavailable: the provider serves
  completed bars one symbol at a time. It had in fact been dead for as long as its doubled
  PostgREST prefix had been there; the URL is fixed, the honest answer is now visible.
- `/compare`'s 1M RETURN, 3M RETURN and BREADTH detents are unavailable for the same reason and
  now say so by name. They were rendering blank before — the limitation is not new, only
  visible. LIVE COMPOSITE is unaffected.
- With the provider read bounded at 4.5s, a provider that is merely slow now fails into the
  retrying lane rather than hanging. That is the intended trade: a hung read left the deck's
  in-flight flag set forever and the wall stopped moving entirely.

## Noticed upstream, not touched

`ticker_cohorts` carries both `MEGA_CAP` and `MEGACAP` as separate cohorts, and NVDA is in both.
That is an upstream duplication, outside this branch's boundary, and is left alone.

---

# Round — executor 3 (2026-08-19, same day, fresh session)

Eleven commits, `06e4a0a..d4eca89`, plus the docs commit carrying this section. Ten atomic
units across five lanes, every one with tests written to fail on the pre-fix code (verified by
stash-and-rerun where the defect was behavioral). Suite grew 164 → **217 pass, 0 fail, 21
files**. Same locks as every round: Draft PR only, no deploy, no Supabase/Fly/R2 mutation, no
Hub edit, no authority or methodology change. No database read at all this round — every
diagnosis below is from the working tree and the measured facts already recorded.

## The units, with the defect each one killed

| Commit | Unit | Defect |
| --- | --- | --- |
| `06e4a0a` | D1 | `paintMarketStatus`'s ready path read `delayed.length` from a name that only existed inside `chartDataSummary`: **every fully healthy paint threw ReferenceError**, so LIVE was unreachable and the header froze on its last degraded text. Ready/waiting paints also now clear the absent flag they could inherit. |
| `d544db5` | D2 | The 10s heartbeat entered `refreshDeckQuotes` through the invalidating door, retiring the in-flight read on every tick: any quote read slower than one heartbeat was discarded on landing, so the effective hard bound was 10s, not the stated 20s. Cadence callers now queue behind the read; set-changing callers keep invalidation. |
| `7189d92` | D3 | `/health`'s universe row compared a **count** to 365 (a swap passes a count); its PostgREST probes had **no bound** while the page claimed none could hang; `PROVIDER_SLOW` latched forever; re-check could race a live run. Now: exact set identity via the shim's own canonical query (NULL branch included, 1000-cap truncation refused), 20s DB ceiling with "no answer in 20s" kept distinct from "unreachable", per-run SLOW, one run at a time. |
| `2bd8bf7` | A1 | Allocation still consumed the retired client geiger or its cohort-feed in four paths: tranche-cadence breadth, THE BRIEF, the audit trace (absent geiger printed as **0**), and a dead internals table. All on the provider composite now; the cohort-feed fetch, store, machinery and the inert geiger dials are removed; the failure badge no longer claims "cohort-feed prices in use". One Yahoo lane remains: macro-feed VIX/US10Y **levels**, flagged wherever they vote. |
| `872e7ef` | A2 | With zero voters, `heat()` returned 0 — NEUTRAL — pricing the invested curve at its midpoint exactly when the provider was down. No score is now null: header, targets, moves, donut, curve marker, brief and trace all say unavailable; the LENS no longer wears the 50/50 rail as a reading; unscored symbols are listed by name under the ranking. |
| `db01f2a` | B1 | Fundamentals' valuation disable was a one-time cell wipe that the next render overwrote with values divided by a null price; the quote cache had no TTL (a load-time blip disabled valuation forever); failure kinds were conflated and a missing **quote** was blamed on the fundamentals **table**. Now: render-time gate ahead of any fair-value arithmetic, quoted/invalid/unquoted/failed recorded distinctly with their own words, 60s/15s TTLs, a bounded recovery poller, and a failed read cannot erase a held price. |
| `38694a5` | — | Repaired the equity-authority pin that still asserted B1's superseded mechanism. (This unit exists because the full suite caught it after the B1 push — the B1 commit itself went out with that one pin red, caught and fixed within minutes. Recorded, not hidden.) |
| `caef817` | C1 | `setTicker('NVDA')` painted a full DCF against the static Jul-24 prices before the overlay's first answer, and a **failed** quote read kept the static price while the spine claimed the valuation was disabled. Prices now start absent (Jul-24 figures demoted to labelled `priceStatic` references); the no-price gate clears every section instead of leaving the previous ticker's valuation standing; the football field no longer draws the market price as the 1-Stage bar when WACC ≤ g. |
| `0204279` | C2 | Silent-alternate-price audit, recorded as `station-price-audit.test.mjs`. Found and fixed: sector-rotation's technicalRead used the last **Yahoo daily close** as the price inside a read captioned "LIVE, DB-sourced" (now named at every surface). Relabelled: dcf-methodology's "(FMP, live)" on a static capture. Audited clean: company-full (a declared STATIC MOCK, label now pinned), sector-rotation-older (its own caveat pinned). |
| `8c8ddfa` | E1 | The sector-rotation spine said "LIVE (D/W/5/1)" off the daily benchmark alone, and would caption raw table reads "authority=provider" on any origin where the shim is 404 (the F1 origin). Now: per-view/per-ticker coverage, LIVE only when all four views answered for every ticker, PARTIAL names the short views, and a shim-presence gate paints NOT PROVIDER AUTHORITY with the F1 deploy named as the fix. The 5m/1m contract tokens and the shim's legacy `'5'/'1'` mapping are pinned. |
| `d4eca89` | E2 | The route inventory listed the 63 HTML surfaces and nothing else the deploy serves. It now carries a regenerated served-dependencies section: 66 non-HTML files, each either a load-bearing row (shim, cohort-axis, scenes.js, PWA identity, and `tokens.css` — named as the orphan it is) or a member of exactly one counted class. Loader counts are taken from script tags (20), not grep (21 — `/health` mentions the shim in prose and does not load it). |

## Errata, stated

- Commit `d4eca89`'s message says "219 tests, 0 fail"; the true count at that head is **217**.
  A commit message cannot be corrected after push; this line is the correction.
- The earlier "Accepted consequences" bullet reading "With the provider read bounded at 4.5s…
  fails into the retrying lane" describes a **superseded** design: since `8ebddae`/`4f581b5`,
  4.5s is the soft report and only the 20s hard bound cancels. The historical text above is
  left as written; this note supersedes it.

## What this round did NOT close

Unchanged from the previous handoff, still open: **F1** (the cross-project deploy + Fly CORS —
this round added the client-side gate that refuses the authority claim without the shim, which
makes the blocked state visible, not closed), **scene internals** (ADD/PCC/CUMTICK/TICK/TRIN
still unowned; `/health` still carries them BAD by construction), **H2** (untouched,
proof-gated), **H3/H4** (human eye), **Fly CORS vs preview** (no provider path provable
end-to-end from the preview; preview green = static delivery only), and **independent re-audit
of everything above** — the test count is not the verdict.

---

# Round — executor 3, continuation packet (2026-08-19, same session)

Eight code commits, `91dfe7f..41927ae`. Suite 217 → **228 pass, 0 fail, 23 repo test
files**. The round's new capability: a **browser-verification rig** — real Chromium
(playwright-core, out of tree) over the served repository with Supabase and the provider
answered from one consistent fixture universe, because outbound HTTPS to the real owners is
proxy-blocked here (CONNECT 403, measured). Every receipt states that scope: these prove
PAGE behavior under controlled data, not the owners' data. 16 screenshots + a receipt log
live in `browser-proof/receipts/`, each regenerable by the command its entry names.

## The three filed defects — fixed and browser-verified

| Filed | Root cause | Fix | Receipt |
| --- | --- | --- | --- |
| AI Software cohort must replace Favorites rows | Two mechanisms: `normalizeScene` collapsed `"cohort"` into themeFamilies (a chosen cohort silently discarded), and the navigation index intersected every cohort with hub_favorites (a chosen cohort showed at most the favorites already on the wall). | `cohort` is first-class in IDS again; `buildCohortIndex` carries every cohort's FULL membership with FAV as the explicit default entry the cohorts replace; deck gains a scene-scoped cohort picker with honest paging; an explicit choice always shows that cohort's rows now. | `cohort-FAV-favorites-rows.png` → `cohort-AI_SOFTWARE-replaces-favorites.png` (ADBE CRM MSFT NOW ORCL PLTR, page 1/2 · 7 members, zero favorites present) → `cohort-AI_SOFTWARE-page2.png` (SNOW alone) |
| Megacap must replace Favorites rows | same | same | `cohort-MEGACAP-replaces-favorites.png` (AAPL AMZN GOOGL META MSFT NVDA) |
| AI Power must show its declared cohort rows | `familyBasket()` was never given an id — both family scenes rendered their FIRST basket forever; AI POWER, AI INFRA and DEFENSIVE were declared and unreachable. | A scene-scoped family picker; the choice validated against the scene's declarations, session-remembered, explicit (paints the declared rows now). Defaults and rotation unchanged. | `family-AI_POWER-declared-rows.png` (OKLO IREN CIFR BE WULF USAR) · `family-DEFENSIVE-declared-rows.png` |

`before-themeFamilies-always-first-basket.png` and the rig-smoke receipt entry capture the
BEFORE state of all three, from the pre-fix tree.

## The defect-packet cluster

- **CLOSED labels despite live feed — disposition, not a fix.** No market-session CLOSED
  label exists anywhere in this repository (searched all served HTML/JS, case-insensitive;
  the only "closed" matches are WebRTC connection states and prose). The defect lives in the
  separate scintilla-hub deploy, which this branch's standing locks forbid editing. Kept
  visible as a cross-repo defect; not representable, therefore not claimed, here.
- **Ticks** (`tick-chart-updates-from-provider.png`, `tick-deck-pane-updates-from-provider.png`):
  a changed provider quote reaches the standalone chart within one 10s poll and a deck pane
  within one 10s pump heartbeat through the authority shim.
- **Provider-vs-display**: the chart's day change equals the exact arithmetic of the quote
  the provider served — 0.29% (347/346) → 9.83% (380/346); pane 0.33% → 16.94%. Asserted, not
  eyeballed.
- **Transient blank/repaint** (`repaint-1W-no-blank.png`): twenty continuous canvas samples
  through a cold range switch, zero blank frames.
- **Deck healthy state** (`deck-header-LIVE-healthy-state.png`): the header paints **LIVE**
  with all panes ready and stamped — the state that threw `ReferenceError` before `06e4a0a`,
  now photographed in a real browser.

## PR-review continuation

- `0564e02` — the last swept `catch(() => null)` class: /ranks fails a COLUMN by its source
  name instead of claiming "no data" per ticker (and states its ETF-filter outage); /reflow
  refuses to draw grey non-answers over a failure; /events tells a dead read apart from a
  clear calendar; /cohorts names the FAV-count failure in the chip tooltip. Browser-verified
  with board_rsi and earnings_events forced to 500 (`failed-read-*.png`).
- `41927ae` — fundamentals/dcf/allocation DB readers get /health's 20s ceiling, body read
  included; a timeout is worded "no answer in 20s", never "HTTP undefined".

## Errata, stated

- `5173ec7` was pushed while the route-inventory count test was red (a scratch probe's
  screenshot had landed in the receipts directory uncounted); `ae3050f` corrected the counts
  minutes later, regenerated from the filesystem. Same class as the B1 erratum. The commit
  gate for the rest of the session is a script that refuses to proceed unless the suite
  prints `fail 0`.
- `ae3050f`'s Claude-Session trailer carries a one-character typo in the session URL
  (`FGSs` for `FgSs`). A pushed commit message cannot be corrected; this line is the record.

---

# Round — executor 3, second continuation packet (2026-08-19, same session)

Directive: finish the 8-unit repair packet, claim the next runnable unit after each result,
preserve production safety, write a measured handoff. All eight named items were verified
closed or dispositioned at entry (receipts above); this round's work is what re-measurement
found behind them, plus the two runnable units the round-4 handoff queued. Nine units,
eight commits (`405dc3a..96ec505` + the docs commit carrying this section). Suite at close:
**238 pass, 0 fail** across 24 files; 10 browser proofs, 29 screenshots, all regenerable.

## The units, with the defect each one killed

- `405dc3a` — the allocation cohort table's promised "no candidate carries an accepted
  composite — nothing can be ranked" was UNREACHABLE: `html || fallback` with `html` always
  carrying the header row, so zero ranked candidates painted a bare header. The COMPARABLES
  table had the identical dead gate, and its fallback named a state that cannot occur
  ("all suggestions dropped" — dropped rows stay rendered greyed-out). Both decide on the
  raw row count now. **The unit pin had proved the words exist, not that they could paint**
  — only the degraded-states browser proof caught it. Rule 14 in practice.
- `7bf4658` — /fundamentals boot had no catch: a cold provider outage (shim fails composite
  reads closed) left every section at initial HTML with no banner anywhere. The failure now
  paints at the universe status and the ticker sections still load.
- `7e52b34` — `proofs/degraded-states.mjs`: /health provider-dead, /health Supabase-dead
  (universe row fails CLOSED, roster lane "none readable"), /allocation all-voters-dead
  (no fabricated NEUTRAL anywhere), /fundamentals quotes-dead (the render-time gate survives
  a slider drag in a real browser). Fixtures grew the fundamentals/DCF spine and gate
  ohlcv_history to the symbols the live table carries, so the unsupported internals keep
  their true zero-rows state.
- `305cf1c` — /pulse still carried the flattening: a dead read and an empty table were the
  same strip. READ_FAILED + per-section failure wording in a distinct style; VIX fails by
  half (live price beside a named dead vix_term). Proven both ways in
  `proofs/pulse-failed-reads.mjs`, including the provider-dead case where the shim fails its
  owned reads closed while vix_term still answers.
- `04ae8d7` — zero favorites rendered one blank editable slot with no wording on the wall;
  it now says "no favorites yet — the wall is empty, not broken", gated on the read having
  landed (absence is only claimed once it is a fact). /deck's `?scene=`/`?cohort=`/`?page=`
  addressing documented with each claim verified against the code; tokens.css ruled
  OWNER RULING NEEDED (external consumers unverifiable from this repo — not deletable here).
- `77283ab` — the DCF FY baseline (netDebt, D&A%, capex%, ΔNWC%) rides
  balance_history/cashflow_history/fundamentals_history. Field availability measured FIRST
  with read-only SELECTs: all ten bar tickers carry complete latest-FY rows;
  balance_history carries net_debt directly. Ratios only from matching fiscal dates; a
  negative ebitda−operating_income is rejected as an anomaly; the fy-baseline badge counts
  who is live per field and reads STALE at 8/10 in the rig (TSM/IREN deliberately absent
  from the fixture universe) — a partial overlay never rounds up. margin/tax defaults, MRP
  and debt weight remain STATIC by name.
- `96ec505` — re-measuring found the round-4 "swept" claim was SPELLING-SCOPED: the unit
  pins banned `.catch(() => null)` but not `.catch(()=>null)`, and three pages still
  flattened. /econ (dead dashboard = blank strip; dead calendar = "no calendar rows for
  this filter"), /alerts (dead reads impersonating a quiet feed), /news (dead sentiment
  chip vanishing like a no-row ticker) — all now keep named failures with honest empties
  beside them, photographed both ways in `proofs/panel-failed-reads.mjs`.

## Findings recorded, not fixed

- **/youtube `ytAct` catch-null is a WRITE lane**: a failed star/unstar silently loses a
  shared Watch Later write while the local UI shows it landed. Its own unit; any fix must
  respect the station-shells mirrors (youtube/index.html is the reviewed source of two
  mounted shells).
- Remaining catch-null sites are deliberate and dispositioned by name in
  `browser-proof/receipts/RECEIPTS.md` (sector-rotation spark catches feed the E1 coverage
  gate; dcf FY-baseline catches keep the flagged static value counted per field; /cohorts'
  hub_favorites catch is the kept marker behind its named tooltip; sector-rotation-older is
  the retained rollback copy).

## Database access this round

Read-only, via the Supabase management surface: one `information_schema.columns` read and
one 10-ticker FY-availability probe on scintilla-live (plus the project listing to find the
ref). No mutation of any kind. Rounds 3–4 used none; this round's two SELECTs are the whole
of it, and they are what made the DCF wiring runnable instead of speculative.

## Errata, stated

- None new: all eight commits went through the gate (`fail 0` + chart mirror + whitespace)
  before push, and no pushed message overstates a count. The round-4 errata stand as
  recorded above.

---

# Round — executor 3, protocol-turn packet (2026-08-19, same session)

Turn ack recorded honestly: the named protocol file is a path on the operator's Mac and no
copy exists in this repository, so it was not readable from this remote container; the
locks, queue and receipts in-repo were re-read instead. Three units, three commits, each
browser-verified with route, data state and DOM evidence in
`browser-proof/receipts/RECEIPTS.md`, rollback stated per commit. Suite at close: **245
pass, 0 fail**; 13 browser proofs, 39 screenshots.

## The units

- `a754a69` — **/youtube: a lost shared write no longer stays painted as saved.** ytWLToggle
  flipped the Watch Later set optimistically and threw the write's outcome away: a failed
  star/unstar left the star "saved", the shared table unchanged, the lie standing until the
  next reconcile read. Success now means a LANDED write only (non-2xx and error bodies are
  null); on failure the flip reverts, both call sites repaint from the settle, and the
  page's flash surface names the failure. Proven in-browser both ways
  (`proofs/yt-lost-write.mjs`): the optimistic frame, the revert (DOM class + ytWLGet()),
  the named reason; the landed write distinct. Scope notes: the two mounted video shells
  already revert (state-honest, reason-silent — lesser gap, recorded); ytPosPush keeps its
  silent catch by design (10s-cadence re-push retries a lost position write).
- `6d0d003` — **buildBase learns the window rule; absent balance fields stop minting a net
  debt.** The queued audit found /fundamentals did NOT share the DCF baseline's discipline:
  D&A%/capex% divided history-window numerators by fundamentals.revenue_ttm (a foreign
  window); `(total_debt||0)−(cash||0)` valued a missing balance row as zero net debt with
  an all-equity WACC, unflagged and sliderless; `shares||1` silently divided by an invented
  1B in the terminal case. Denominators now come from the same rows as their numerators
  (same 4 quarters or same single FY; cross-year pairs refused to the flagged default;
  offset cashflow-vs-income windows flagged); every absent balance field is flagged by name
  with its direction of error; the terminal share count is flagged NOT meaningful.
  Functional pins drive every case; browser receipt `proofs/fy-consistency.mjs` (a NULL
  total_debt renders its named flag; a complete row carries none).
- `a338bad` — **/news and /cohorts main reads: named when never loaded, STALE-stamped when
  they die mid-life.** The primary reads rejected to a boot-only unworded catch and a
  SILENT interval catch — the worst state was a wire dying after a healthy load: stale
  content with a frozen "newest Xm ago" stamp that became false as time passed. Never
  loaded now names the source, distinct from the empty-filter words; died mid-life keeps
  the held rows/chips (a failed read never erases knowledge) and stamps them stale where
  freshness lives, cleared by the next successful rebuild. All four states photographed
  (`proofs/main-read-failure.mjs`), the mid-life ones injected by re-routing after a
  healthy load and invoking the page's own tick().

## Errata, stated

- None new: three commits, each gated green (`fail 0` + chart mirror + whitespace) before
  push. No database access of any kind this packet.

---

# Round — executor 3, live-path verification packet (2026-08-19, same session)

Directive: verify the live Hub-visible path, reconcile the PR against the canonical queue,
one browser-visible proof unit, next handoff. One code commit (`39567f9`) plus the docs
commit carrying this section. Suite at close: **248 pass, 0 fail**; 14 browser proofs, 40
screenshots. No provider history touched, no Geiger change, no database access.

## The live Hub-visible path, measured

- **From this container: unreachable, exactly as round 4 measured.** CONNECT 403 at the
  proxy for `station.scintillahub.ai`, the Vercel preview, and Supabase (curl with the
  environment's own CA bundle; TLS verification never disabled). End-to-end live acceptance
  — the DCF fy-baseline/fy-seeds badges reading LIVE 10/10, the 12-step preview checklist —
  remains blocked on a browser outside this container. Nothing was faked around this.
- **The repo side of the path, verified against `vercel.json` (not memory):** exactly two
  rewrites — `station.scintillahub.ai/` → `/deck/` (host-conditioned, ROOT PATH ONLY: deep
  paths on the hub domain serve the same repo pages directly by path), and `/status` → the
  orgstatus Supabase function. Every response carries `no-store` at all three cache layers
  (browser, CDN, Vercel CDN), so a pushed fix is Hub-visible on the next load with no CDN
  staleness — there is no cache to invalidate and no stale Station to explain.

## PR #115 reconciled against the canonical queue (fresh API reads)

Draft ✓ open ✓ unmerged ✓ mergeable CLEAN ✓ head = local `e98188d` at reconciliation time ✓
base `main@bb55f94` unchanged since the PR opened (no base drift) ✓ zero review threads ✓
one comment (the Vercel bot's deployment status) ✓. The PR's Open table matches the
handoff's blockers one-for-one, with the fixed /youtube item correctly absent. **No drift
found.** One cosmetic correction taken in this docs commit: the handoff's header still said
"round 5" while carrying round-6 state.

## The unit — `39567f9`: the DCF growth/margin slider seeds ride the FY history

The claimed static remainder, delivered: gDefault = FY-to-FY revenue CAGR, mDefault = the
latest FY's own margin, derived by `deriveFySeeds()` on the same per-ticker fetch as the FY
baseline (limit 1 → 4), under the fundamentals cockpit's clamps and window rules (g 0..80,
m 5..90, a CAGR needs two FY rows more than half a year apart, Number(null) cannot seed).
Seeds are slider inputs the user then owns; refusals keep the flagged static value. The
fy-seeds badge counts per field and never claims LIVE while short. What remains static is
now named exactly — tax default · terminal growth · MRP · debt weight — because
fundamentals_history carries NO tax line (measured schema): sourcing those is an owner
ruling, not a guess. Browser receipt `proofs/dcf-seeds.mjs`: NVDA's seeds equal the fixture
arithmetic exactly and reach the visible sliders; TSM keeps its Jul-24 static seeds; the
badge reads STALE 8/10 on the fixture's deliberate 8-of-10 universe. Rollback: revert the
one commit.

## Errata, stated

- None new: one code commit, gated green before push.

---

# Round — executor 3, hub-entry packet (2026-08-19, same session)

One unit (`5db90cc`) on the operator's live-path directive, both halves photographed and
neither faked. LIVE: Chromium through the environment proxy at
https://station.scintillahub.ai/ fails `net::ERR_TUNNEL_CONNECTION_FAILED` — recorded
verbatim, screenshotted; the CONNECT dies before TLS, nothing bypassed. CONFIG-EMULATED:
the same URL served under vercel.json's PARSED rules boots the Station AT the hub origin —
title, scene machinery, shim, axis, panes, zero asset 404s — proving by outcome that
/deck's absolute-path discipline survives the root rewrite, a surface nothing had exercised
before. The config is pinned from the parsed file (two rewrites exactly; no-store at all
three cache layers). Suite 249/0; 15 proofs, 42 screenshots. No provider history touched,
no Geiger change, no database access. Errata: none new.

---

# Round — executor 3, long-sprint authority packet (2026-08-19, same session)

Directive: live path + preview evidence, remaining provider/legacy authority defects,
browser-visible regression tests, batch commits. One code batch (`2905ad2`) plus the docs
commit carrying this section. Suite at close: **250 pass, 0 fail**; 17 proofs, 45
screenshots. No provider history touched, no Geiger change, no database access.

## The audit and what it found

**Source half** (host-grep + shim-tag/reader set difference, prose hits classified by eye):
zero Yahoo/FMP fetch lanes in served HTML outside sector-rotation's reviewed-relays-only
flagged fallback — its third-party CORS-proxy lane, retired by F1's own fix, verified still
absent; /health the only direct provider fetch (the ruled exception; /analytics's grep hit
is banner prose); 20/20 shim-tag coverage on real readers (/, /components hits are prose).

**Runtime half** (`authority-sweep.mjs`, durable): the eight equity surfaces no proof had
ever loaded — /geiger /heat /cohort /compare /ticker /wall /analytics /geigerwall — each
with zero page errors, a real painted surface, and zero requests to any unreviewed host,
with the interception's liveness itself asserted.

**The one real find**: /chart, its byte-mirrored shell, and /deck load `supabase-js` from a
third-party CDN on a FLOATING `@2` tag — executable code in the price path's pages, version
drift unreviewed, and its failure used to kill the non-equity realtime lane silently. Fixed
within scope (`realtime-absence.mjs`): the absence is now a said state — "RT · absent"
beside #marketStatus with the reason, SC_REALTIME queryable on both pages, both branches
proven (natural CDN refusal vs stubbed SDK), and the channel's previously UNPINNED
authority guards (equities refused; unknown ownership is not permission) pinned. Pin-or-
vendor for the tag needs the exact bytes, unreachable from this container: **OWNER RULING**.

**Preview evidence** (`hub-entry.mjs` extended): the branch's own preview deploy refused at
the browser level with the same verbatim tunnel error as the hub domain, screenshotted —
both named hosts of the live-acceptance blocker now carry browser-level measurements that
would fail loudly if the path ever opened.

## The wall, stated

Every runnable-now unit in the canonical queue is done. What remains requires something
this container does not have: the scintilla-hub repo (CLOSED labels), the scintilla-sector
deploy + Fly CORS (F1, live provider path), an owner's ruling (scene internals ownership;
tokens.css; the supabase-js pin-or-vendor; tax/terminal/MRP/debt-weight sources), a live
browser outside this container (DCF LIVE 10/10 acceptance; the 12-step preview checklist),
a human eye (H3/H4), or the explicit proof-gate (H2). The independent re-audit remains the
merge gate. Idle from here is not idleness; it is the measured edge of this branch's reach.

## Errata, stated

- None new: one batch commit, gated green before push.

---

# Round — executor 3, coverage-completion sprint (2026-08-19, same session)

Two code commits (`55e4526`, `8175459`) plus the docs commit carrying this section. Suite at
close: **251 pass, 0 fail**; 19 proofs, 47 screenshots. No provider history touched, no
Geiger change, no database access.

## Runtime coverage of the route inventory: COMPLETE

`inventory-sweep.mjs` loaded the thirty-three surfaces no proof had ever exercised — entry,
ops, /parity, media, the visuals lab, the standalone spec pages — each with zero page
errors, a real painted surface, and zero requests outside its CLASS allowance (data lanes:
the two owners only; media-mounting pages: YouTube embed hosts, whose player and thumbnails
ARE the media content while the feed's data stays on youtube_feed; the retained rollback
sector-rotation-older: its reviewed hub relay, exempt by ruling). With authority-sweep and
the per-page proofs, EVERY served surface has now been loaded at least once under authority
assertions. The X lane is the one exclusion — H2 is proof-gated, and even observation stays
out until it opens; the bridge draft's offscreen document throws outside its extension
context (recorded), and its one-line guard waits behind the same gate.

## The sprint's one live find, fixed: the LINES panel says its library is dead

/templates/sector-rotation.html loads lightweight-charts from unpkg — pinned 4.1.3 but with
NO integrity hash (vendor-or-SRI: OWNER RULING, recorded beside the supabase-js floating-@2
item). The unguarded createChart threw a ReferenceError when the CDN was down and took the
timeframe-following panels with it. The panel now SAYS "lightweight-charts did not load
(third-party CDN unpkg.com) — the LINES panel is unavailable, not empty; every other panel
is unaffected · reload to retry"; the chart calls are guarded; leaders and heatmap follow a
range click with the library dead — proven with the CDN blocked, photographed. The rollback
copy untouched and pinned so.

## The first-basket class, closed for every scene kind

`scene-declared-rows.mjs`: the fixed preset carries exactly its frozen declaration in
order; the time-windowed indexNow wall equals the model's own declaration compared in the
same browser at the same instant. With round 4's cohort and family proofs, every scene KIND
is browser-proven to deliver its declared rows. Also recorded: /parity makes no data reads
at all — static, authority-clean by construction.

## The wall, restated

Unchanged from round 9, now with fuller evidence behind it: every runnable-now unit is
done, and the whole inventory is measured. Remaining items each name their wall — the Hub
repo, the sector deploy + Fly CORS, owner rulings (scene internals · tokens.css ·
supabase-js pin-or-vendor · lightweight-charts SRI-or-vendor · tax/terminal/MRP/debt-weight
sources), a live browser outside this container, a human eye, the H2 gate, and the
independent re-audit that decides merge readiness.

## Errata, stated

- None new: two commits, both gated green before push.

---

# Round — executor 3, vendoring sprint (2026-08-19, same session)

One code batch (`f1adfae`) plus the docs commit carrying this section. Suite at close:
**251 pass, 0 fail**; all **19 browser proofs re-run PASSED** against the vendored tree.
No provider history touched, no Geiger change, no database access, no production change.

## The wall that moved, and the evidence

The two supply-chain rulings were blocked on "the exact bytes are unreachable from this
container." Measured this sprint: `registry.npmjs.org` → **HTTP 200 through the proxy**
(cdn.jsdelivr.net and unpkg.com stay CONNECT-refused). Chain of custody, exact:

- `@supabase/supabase-js`: dist-tag `latest` = highest stable 2.x = **2.112.3** (what the
  floating `@2` tag resolves to today). Tarball
  `https://registry.npmjs.org/@supabase/supabase-js/-/supabase-js-2.112.3.tgz` downloaded
  and hashed: sha512 **equals** the registry's published integrity
  (`sha512-Jv1bxVQmEJNkjvPEhFaKjPzsh+Ozyew6lWGD+SoYcsclDEP1z7yEvKvfUQfzy0DkxRIQnZNxmmWtAzw5XLTQoA==`).
  The package's own `jsdelivr`/`unpkg` fields name `dist/umd/supabase.js` — the exact file
  the CDN tag served — vendored as `/_vendor/supabase-js-2.112.3-umd.min.js` (211,907
  bytes, `sha384-qafw21c/iciq0VXsi9FzkfoQv5I/V0iqE4lSNcKXPnW9/UTJLnv5CcN4FHxVLnKg`, carried
  as the tag's integrity attribute).
- `lightweight-charts` 4.1.3: tarball sha512 **equals** the registry's published integrity
  (`sha512-SJacmEyx3LmT2Qsc7Kq7cEX7nEHtQv0MOlujhRlcDxhW62pG6nkBlcM52/jNqkq8B28KQeVmgOQ7zrdJ4BCPDw==`);
  `dist/lightweight-charts.standalone.production.js` — the exact path the unpkg tag
  referenced — vendored as `/_vendor/lightweight-charts-4.1.3.standalone.production.js`
  (160,943 bytes, `sha384-JZigAjwiaZtkUbA44CWkPaT3iBb/mU5pO6QOANp+OqHd4q+1+7MG1kzp2OOP9ZfP`).

/deck, /chart + its byte-mirrored shell, and /templates/sector-rotation.html now load these
same-origin under their integrity attributes; the retained rollback copy keeps its legacy
tags by ruling. **Zero third-party CDNs remain in any current price-path page** — the
authority sweep's class allowances tightened accordingly, its interception-liveness canary
is now a deliberate refused request, and the realtime proof exercises the REAL vendored SDK
(asserted, not stubbed) plus the newly wired channel-status truth: "available" no longer
means merely "script present" — SUBSCRIBED clears the note, CHANNEL_ERROR/TIMED_OUT/CLOSED
paint "RT · not connected", a pending connect claims nothing.

## UNKNOWNs, stated

- Whether jsdelivr's `@2` endpoint served byte-identical content to the tarball entry was
  never verifiable from here — MOOT once vendored, but the historical CDN bytes were never
  audited.
- Production wss connectivity (the channel actually reaching SUBSCRIBED on the live site)
  is unverifiable from this container; the rig's offline channel states are honest but are
  not a live acceptance.
- The vendored files execute in the rig; their behavior on the live deploy is expected
  identical (same bytes, same-origin serving) but unverified from here, like every live
  claim on this branch.

## Errata, stated

- `dcf-baseline.mjs` went stale-RED when `39567f9` reworded the as-of bar (round 7) and was
  not re-run afterward; the full 19-proof battery this sprint caught it, the assertion is
  fixed in `f1adfae`, and the battery habit is the remedy. No pushed commit message
  overclaimed (the proof was simply not re-run), but the receipt's "every entry regenerable"
  promise was four rounds stale for that one proof — recorded.

## Rollback and next unit

Rollback: revert `f1adfae` — the CDN tags return; behavior is otherwise unchanged. Next
runnable unit: none new — the wall stands as round 10 stated it, with two items MOVED:
the supabase-js and lightweight-charts rulings are now EXECUTED on the branch in their
verifiable form (vendor); the SRI-on-CDN alternative remains open to the owner before
merge. The independent re-audit remains the merge gate.

---

# Round 12 — the watch-later lane tells the truth on every surface that carries it

Continuation packet, 2026-08-19. Resumed from head `6d99577` on the roster-audit packet
("validate the highest-impact Hub-facing fixes with runtime/browser evidence"). The
canonical protocol path (`/Users/alanharvey/SCINTILLA 0.5/repo/…`) is a macOS path not
present in this container, as every round: the in-repo receipt, handoff and routes doctrine
were re-read instead.

## What was measured before anything was touched

- **Walls re-probed at 2026-08-19T16:20:53Z**: preview, Supabase, hub and Fly all still
  refuse at the proxy (`CONNECT tunnel failed, response 403`, curl exit 35 each). The DCF
  live-acceptance walk and every live-data claim stay blocked here; fresh timestamp so the
  next session does not re-derive it.
- **Service-worker sweep**: zero `serviceWorker` registrations and zero Cache API uses in
  the served tree — the `no-store` ruling has no cache layer hiding behind it. Measured
  absence, recorded.
- **`origin/main` unmoved** (`bb55f94`, ancestor of HEAD); working tree clean at resume;
  rig and gate intact in the scratchpad.
- **/chart's realtime paint scope is deliberate and in-code** ("the chart is a mounted
  shell — the DECK paints the note for the wall; standalone, the state stays queryable
  here under the same name") — re-read, not an overclaim, not a unit.
- **The class, swept by table name, not by page name** (rule 14): `grep -l yt_watch_later`
  over served HTML returns exactly five files — `/youtube`, `/pane-video`,
  `personal-video-v1`, `scintilla-video-v1` (byte-identical pair, measured `diff` = 0),
  and `video-v1`, the retained rollback. The deck mounts the identical pair, so this lane
  IS Hub-facing: it is what the Station wall's two video panes run.

## The defects, by rule

1. **A failed read painted as "unsaved" (rule 1)** — every surface in the class booted
   `WATCH`/`YT_WATCH_LATER` as an empty set and painted card stars, the bWatch button and
   the ★ filter from it while the shared saved-list read was still in flight or after it
   FAILED. A saved video rendered "save to watch later"/☆ — an unlanded read painted as
   the unsaved claim. `/youtube` was worse twice over: its feed query already carries a
   server-side `watch_later` column (landed data), which boot OVERWROTE with the empty
   page cache; and its dedicated `yt_watch_later` read had no `.catch` at all — the
   failure was an unhandled promise rejection that left every star zeroed.
2. **Reason-silent reverts (the recorded "lesser gap", now closed)** — the shells' and
   /pane-video's `toggleWatch` reverted a lost write correctly but said nothing: the
   gesture just vanished. `subscribeToChannel`'s `catch (e) { }` swallowed lost
   subscribes whole.
3. **A mislabeled cause (rule 2's spirit: name only what you measured)** — a failed
   Supabase REST read of `yt_watch_later` painted **"YouTube reconnect required"**: a
   YouTube-auth diagnosis for a database read the page never made against YouTube.

## The fix, per surface (`536ba59`)

- **/youtube**: `YT_WL_READY`/`YT_WL_READ_FAILED` flags; boot seeds the page cache from
  the feed's own served `watch_later` flags (so the overwrite is a no-op until the
  AUTHORITATIVE read replaces it); the dedicated read's failure is CAUGHT and said —
  transient flash plus a persistent red `!` marker on the Watch Later chip titled "the
  saved-list read failed — ★ rides the feed snapshot, not the saved list · retried with
  the feed pass".
- **/pane-video + both mounted shells** (kept byte-identical, `cp` + test pin): card
  stars render through `starHTML(v)` — while `!WATCH_READY` they paint a dimmed `?`
  ("watch-later state unknown — the saved-list read failed / has not landed yet · a click
  retries the read"), never ☆ or ★; the shells' bWatch button reads "watch later — state
  unknown" (failed) or "watch later…" (in flight) instead of the unsaved claim;
  `toggleWatch` against an unknown state REFUSES the flip — it retries the read, paints
  the recovered truth, and tells the user to click again, because a gesture aimed at an
  unknown state has no knowable intent; lost writes flash "★ not saved / ★ not removed —
  the shared watch-later write failed · try again" (matching /youtube's round-6 wording);
  lost subscribes flash "subscribe failed — the shared write did not land · try again";
  the watch-list read failure paints "the watch-later read failed — the saved list is
  unavailable, not empty · retrying at the next refresh". Boot-read failure sets the
  named error and repaints button and stars. A small `#wlFlash` status element carries
  the transient sayings.
- **video-v1 untouched** — the rollback stays a pointer change, wording and all; pinned
  by test exactly like `sector-rotation-older`.

## Evidence

- **Tests: 253 pass, 0 fail** (24 files; +2 from round 11). New pins/functional tests in
  `station-failed-read-render.test.mjs`: shell byte-identity; `starHTML` truth table
  (unknown-failed / unknown-pending / saved / unsaved / non-scintilla feed) run in vm for
  BOTH /pane-video and the shell; async `toggleWatch` driven through all four scenarios
  (dead read → refusal said, recovery → truth first, lost write → revert + said, landed
  write → stays, no flash); `refreshWatchButton` truth table; the old wording banned from
  the fixed three and REQUIRED in the rollback. `station-scenes.test.mjs`'s boot-read pin
  updated to the new shape (same intent, plus the named-failure pin).
- **Browser proof: `browser-proof/proofs/wl-truth.mjs` — PASSED** (4 scenarios, failure
  injection at PAGE level so the shared fixtures stay untouched for every other proof):
  the mounted shell with the read dead (3 unknown stars, zero claiming, the button's
  refusal, the click-retry flash, the named watch-list state, the old wording absent);
  read lands → exactly the saved video ★, lost write flips optimistically, REVERTS and
  says why; lost subscribe says why; /youtube with the dedicated read dead keeps the
  feed-flagged star, wears the chip marker, and throws NOTHING (the pre-fix page fails
  that assertion with the unhandled rejection). Four screenshots in the receipts log.
- **Preview**: Vercel built `536ba59` and reports Ready at 16:39Z (bot comment edit —
  echo-class wake, no action). Stubbed-data page proofs remain page proofs; nothing here
  is a live-data acceptance.

## Lesser gaps measured this round, recorded not fixed

- The video surfaces' quiet 120s refresh failure holds the painted grid with no stale
  stamp. Measured: the grids paint NO freshness claim (no "newest/ago" stamp), so a held
  grid states nothing false — unlike /news, whose aging stamp lied. Recorded as a lesser
  gap in the R14 family, not worth widening the diff for under this packet's scope.
- The `yt_positions` resume lane (shared playback positions) fails silently both ways;
  playback position is UX state, not a data claim on a market surface. Recorded.
- /tv's DB-read catch is a worded deliberate no-op over a baked default arrangement
  (honest: the baked content is real content); /tvwall fetches nothing; /feed-a and
  /feed-b name their feed failure and have no refresh cadence to die mid-life. Media
  catch-null sweep: clean.

## The battery, run in full

All **20 proofs** (the 19 standing ones plus `wl-truth.mjs`) re-run against the committed
tree at `536ba59`: **20 passed, 0 failed** — the round-11 erratum's remedy held as a habit,
and no proof sat silently red behind this round's edits. The regenerated receipts log and
screenshots ride the docs commit.

## UNKNOWNs, stated

- Whether the live `yt-act` edge function treats a re-`star` of an already-saved video as
  idempotent was not probed (no writes are allowed from here; the refusal-to-toggle against
  an unknown state makes the question moot in the fixed pages, but the rollback shell can
  still send one).
- The real `youtube_feed.watch_later` column's freshness relative to `yt_watch_later` is
  the server's business; the pages now claim only "the feed snapshot", which is true
  regardless.
- Live behavior of all of this on the deployed preview is expected identical (same bytes,
  same-origin) but unverifiable from this container — walls re-probed this round, all
  still refused.

## Rollback and next unit

Rollback: revert `536ba59` (and this docs commit) — the lane returns to silent reverts and
zeroed stars; no data lane, authority or methodology is touched either way; `video-v1`
untouched in both worlds. Next runnable unit: none KNOWN — the wall stands as the handoff
now states it (narrowed honestly: "every runnable-now unit **found by the sweeps run so
far** is done"), and the next session may either open an operator-named wall or run one
more class-sweep by table/lane name — this round is the standing proof such sweeps can
still pay. The independent re-audit remains the merge gate.

---

# Round 13 — the sweeps keep paying: /youtube's feed lie, and the axis-consumer class verified

Continuation packet, 2026-08-19, resumed from head `ad80562`. Protocol path unreachable as
every round; in-repo doctrine current. The round-12 handoff's next-unit line said: open an
operator-named wall or run another class-sweep by table/lane name. No wall was opened, so
two sweeps ran.

## Sweep 1 — `youtube_feed` main-read failure states (by table name)

Consumers: /youtube, /pane-video, the two mounted shells, video-v1 (rollback), /feed-a,
/feed-b. All but one already answer honestly ("feed unavailable", named states — measured
round 12 or earlier). The one: **/youtube's own feed catch painted the OWNER's absence for
any failure** — "the youtube_feed table is empty; cards fill per video when the ingester
lands" — rule 1 and rule 2 broken in one sentence: a transport failure claimed as the
owner's empty table, blaming an ingester nobody measured.

**Fixed (`6bde1d4`)**: `YT_MAIN_FAILED` set by the catch, cleared only by a LANDED read;
the empty grid now chooses between two sentences — "read failed — the wire is unavailable,
not empty · retrying at the next pass" (failure) and the original owner's wording, which
survives exactly where it is true: a read that landed with zero rows (rule 4).

## Sweep 2 — the ten `SC_COHORT_AXIS` consumers (by lane name)

Re-read every consumer's failure path. **All ten answer a boot failure with a named
state** — the per-page hardening of earlier rounds held: /analytics counts the axis as a
feed and stamps "COHORT AXIS FAILED" in the as-of line; /events refuses with the error
message; /heat paints the "COHORT HOMES UNAVAILABLE" group instead of mis-grouping into
UNASSIGNED; /compare's init catch names the database; allocation-module's spine goes
FALLBACK by name ("hardcoded TICKER_STYLES in use"); fundamentals converts its adapter's
error flag to a throw under the round-5 boot guard; /deck, /cohorts, /cohort and
/geigerwall paint their named states. Died-mid-life on the two interval pages is honest
without a stamp: /cohort's age line recomputes per render from the DATA's own
`updated_ts` (a held wall ages truthfully), and /geigerwall paints no freshness claim at
all. No axis code changed — the sweep is the evidence.

## Evidence

- **Tests: 254 pass, 0 fail** (24 files, +1): the feed-failure pins (flag declared, catch
  sets it, landed read clears it, the branch chooses the sentence, both wordings pinned).
- **Browser proof: `feed-truth.mjs` — PASSED**, four scenarios, page-level injection:
  /youtube feed DEAD paints the failure sentence and does NOT paint "table is empty" or
  "ingester" (zero page errors); /youtube feed landed EMPTY keeps the owner's wording;
  /cohort and /geigerwall with `ticker_cohorts` dead boot to their named axis-dead paints
  with zero page errors — the last two of the ten consumers whose failure paint had never
  been photographed. Four screenshots.
- **Preview**: Ready on `6bde1d4` at 16:55Z (echo-class bot edit, no action).
- **The full battery, both rounds**: all **21 browser proofs re-run PASSED** against head
  `6bde1d4` (run in two halves to fit the runner's timeout; 11+10, zero failures) — the
  round-11 erratum's remedy held for a second and third consecutive round: no proof is
  claimed that was not re-run at head.

## UNKNOWNs, stated

- The axis sweep verified BOOT failure paints; the two interval pages' died-mid-life
  behavior was verified by reading (held wall + honestly-aging or absent stamps), not
  photographed — a mid-life kill scenario in the rig would need clock control and was
  judged not worth the rig complexity this round.
- /youtube's 120s pass retries a failed feed read (`YT_LOADED = false` → refetch); the
  retry wording says "at the next pass" and the pass interval is the code's own — not
  re-measured under a live wire.

## Rollback and next unit

Rollback: `536ba59` and `6bde1d4` revert independently and cleanly (said states, guards,
pins, proofs; no data lane, authority or methodology changed; rollback shells untouched).
Next runnable unit: the sweeps are the renewable unit — next candidates by lane name:
`yt_positions` (recorded lesser), the `spine_events`/`feed_alerts` consumers beyond
/alerts and /pulse, and the `ohlcv_history` readers' failure paints on /wall and
/analytics panes. Everything else stands behind the walls the handoff names (Hub repo ·
sector deploy + CORS · owner rulings · a live browser outside the container · a human eye
· the H2 proof-gate · the independent re-audit as merge gate).

---

# Round 14 — the signal beside the sentence: what the paint claims when the text refuses

Continuation packet, 2026-08-19, resumed from head `425d2fd` on the operator's own
priority: **Hub/Station visible truth and provider-close / transport-state presentation.**
Protocol path unreachable as every round; in-repo doctrine re-read. Three units, three
commits, each with a browser proof that reads what the page PAINTS.

## The rule this round discovered, stated once

Every earlier round asked whether the WORDS were true. This round asked a narrower question
that had never been asked: **when the text refuses a claim, does the signal beside it refuse
too?** A colour, a tone, a sort order and a sign are claims — and on a wall read at a glance,
the colour is the claim that actually lands. Three surfaces were saying "unknown" in text
while painting a confident direction beside it, and every one of them passed every existing
source pin and every text assertion in the suite.

## Unit 1 (`636a8f5`) — the chart pane's direction had no authority behind it

`chDayChange` already refused to state a day change without the provider's previous close;
the badge painted `—`. **The pane behind it was painted bull or bear regardless.** The draw
path's baseline (`host._ref`) fell back to `pts[0].p` — the first bar of the LOADED WINDOW —
so the direction was computed against a number nobody sent, and that number **moves with the
range control**: the same prices could paint green at one range and red at another with no
market event between them.

Fixed: `chDayRef(host)` reads the current ticker's previous close live (never a copy — the
three `_ref` writes are gone, so a pane whose ticker changed cannot keep the old symbol's
baseline), refuses `0`, `""`, non-numbers and absence alike, and the pane paints `--ink2`
with no directional claim when it is null. Byte-mirrored to `/station-shells/chart-v1`.

## Unit 2 (`efcb12b`) — `null >= 0` is TRUE, so unknown was painted UP

A relational comparison coerces null to 0. Every unguarded directional ternary in the tree
therefore painted **unknown as up** — a systematic bullish tint on missing data. Swept the
whole class by shape; three carried it, and one fabricated the value first:

- **`/ticker`** (a Station surface): `|| 0` turned an unknown change into a REPORTED FLAT
  DAY — `+0.00%` in the up colour — and fed that zero into the movers ranking, where it
  impersonated the calmest stock on the board. Unknown now stays null, prints `—` in
  neutral, and ranks after every known mover: kept and greyed, never dropped.
- **`templates/allocation-module.html`** painted its `—` day cell green.
- **`templates/sector-rotation.html`** rendered a signed em-dash percentage — literally
  `+—%` — in green; now dim, worded "change unknown".

**The line the fix must not cross**: a REPORTED zero still reads as flat and still carries
the up tone. Refusing *unknown* is not refusing *zero* (rule 4 — emptiness is decided on the
raw value), and the proof asserts that boundary explicitly.

Swept and found ALREADY CORRECT, so the fixed pages now match them: `/heat` (both colour
functions refuse on null), `/ranks` (formatters run only on non-null rows; gaps say "no
data"), `/reflow` (same, plus a fixed small size for gaps), `/compare` (returns before the
directional paint), `/cohort`, `/geigerwall`, `/cohorts`, `/scenes` (all `> 0 / < 0 / else`
forms, which null falls through to neutral).

## Unit 3 (`9f0788e`) — the same refusal, proven on the WALL

A fix that holds on standalone `/chart` and breaks anywhere in the deck's own chain would
leave the Station wall still lying, and that chain differs in every step: deck reads
`live_quotes`, the provider shim rewrites the read to the provider's `/quotes`, deck maps
the row and posts it across the frame boundary, and the shell's `scChartLive` fills the map
the pane colour is drawn from. Asserted on `/deck` itself, inside the mounted shell iframes.

## Evidence

- **Tests: 256 pass, 0 fail** (24 files, +2 from round 13). New: the `chDayRef` truth table
  run in vm for BOTH `/chart` and the shell (known / missing / zero / empty-string /
  non-number / no host / no dataset), the badge-and-colour agreement pinned on the same
  input, the removal of every `_ref` site pinned, `fmtC`'s null/NaN/zero behaviour, the
  tape's ranking partition, and the two template ternaries.
- **Browser proofs: 24 files** (+3), and every one of the three new ones was **verified to
  DISCRIMINATE** by restoring the pre-fix code and watching it fail:
  - `day-direction.mjs` reads CANVAS PIXELS on `/chart`, counting them against the
    `--bull`/`--bear`/`--ink2` tokens at a tight distance so antialiasing cannot vote. With
    the old code restored, the unknown-baseline scenario paints **12,321 bear pixels**
    — a confident red "down day" beside a badge reading `—`. With the fix: zero bull, zero
    bear, series still drawn.
  - `unknown-change.mjs` reads the painted tape and its computed colours. With the old code
    restored, the unknown symbol paints `+0.00%`. With the fix: `—`, neutral, ranked last,
    not dropped — and the reported zero still reads `+0.00%` / up.
  - `deck-day-direction.mjs` reads the canvas INSIDE the mounted shell iframes on `/deck`:
    **2 mounted panes**, all bull with a stated previous close, all neutral with none.
- **Preview**: Ready on each pushed head (bot comment edits — echo-class, no action).
- **Production untouched; no database access this round.** No provider raw/history, Geiger
  authority, R2, credentials or Supabase work touched: the previous close is READ exactly as
  before — only what the page is permitted to claim from its absence changed.

## UNKNOWNs, stated

- The pane's direction compares the series' LAST POINT to the baseline, while the badge
  compares the LIVE QUOTE to it. They agree in practice because a live tick patches the last
  point, but they are two different current-price authorities feeding one claim, and the
  first run of `day-direction.mjs` made them disagree by injecting a quote far from the
  series. The proof now pins both so the baseline is the only variable. **Whether these
  should be unified is an owner-facing question, recorded, not decided here.**
- `templates/sector-rotation.html:1271` (`r.p >= 0` on `periodChange`) and `:1415`
  (`live.composite >= 0`) were read and judged guarded by their callers, not proven so by
  execution — sector-rotation's live path is F1-blocked from this container.
- The neutral pane colour is `--ink2`, the same token the live-price label already used for
  its flat tone. Whether the wall wants a MORE distinct "no baseline" treatment (a dashed
  stroke, say) is a look ruling for the owner, not a truth question.

## Rollback and next unit

Rollback: the three commits revert independently. `636a8f5` restores the substituted
baseline; `efcb12b` restores the coerced ternaries; `9f0788e` is evidence only and changes
no page. No data lane, authority or methodology changed by any of them.

Next runnable unit — the class this round opened is broader than the three fixes: **audit
the remaining non-text signals for the same question.** Sizes (`/reflow`'s `Math.sqrt(mcap)`
and its `0.5` default for unknown; `/heat`'s tile areas), sort orders (any comparator where
a null sorts as a value rather than to the end), and opacity/strike treatments. Each is a
claim, and none has been swept by that question yet. Everything else stands behind the walls
the handoff names.
