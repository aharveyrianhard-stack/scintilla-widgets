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

| Commit | What |
| --- | --- |
| `d54da89` | Re-sync the versioned chart shell with the reviewed chart surface |
| `cae3a58` | STATION-001 — keep the stream's named absence named |
| `289082c` | STATION-002 — drop the dead `is_primary` filter |
| `e8177e8` | STATION-003 — stop dating undated news items to the Unix epoch |
| `fa163c5` | STATION-004 — take legacy equity authority off `/analytics` and `/health` |
| `9a20a85` | Pre-merge corrections: cohort axis, provider transport, fabricated stamps |
| `bfb2a42` | Cohort axis home vs membership; partial answers stop counting as absence |

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

`node --test "tests/*.test.mjs"` — **115 pass, 0 fail**. There is no package.json, CI workflow or
build step in this repository; the suite and the static syntax check are the whole gate.

| Suite | Before | After |
| --- | --- | --- |
| `station-named-absence` | 6 of 8 fail on `d54da89` | pass |
| `station-cohort-routes` | 26 of 29 (with transport) fail on `9a20a85` | pass |
| `station-news-time` | 10 of 10 fail on `289082c` | pass |
| `station-equity-authority` | 6 of 7 fail on `e8177e8` | pass |
| `station-transport-vs-absence` | 14 of 15 fail on `fa163c5` | pass |
| `station-route-inventory` | new | pass |

Each "before" figure was measured by checking the parent commit out into a detached worktree and
running the new suite against it.

## Status by item — nothing here is called closed

Independent re-review decides merge readiness, not the test count. Every item below is either
**code-complete pending re-review** or explicitly **open**.

| Item | Status |
| --- | --- |
| STATION-001 | code-complete, pending re-review |
| STATION-002 | code-complete, pending re-review |
| STATION-003 | code-complete, pending re-review |
| STATION-004 | code-complete, pending re-review |
| H1 inventory | code-complete, pending re-review — now covers standalone HTML files too |
| H2 (X) | **untouched and proof-gated**, by instruction |
| H3 | partial — the iPad page is pinned and the chart contracts are asserted; gesture *feel* is unverifiable here |
| H4 | partial — transport, subscribe and the ladder are asserted; fullscreen geometry is unverified |
| **F1** | **BLOCKED — not closed by this branch. See below.** |

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
   `NON-EQUITY LANE ONLY`. They are the live owner of crypto, futures, indices and rates, so a
   stale one is a real outage — what must be absent is any equity claim on those rows.

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
