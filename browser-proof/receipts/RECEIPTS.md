# Browser-proof receipts

Real Chromium (playwright-core) over the served repository with Supabase/provider answered from fixtures — outbound HTTPS to the real owners is blocked in this environment, so these receipts prove PAGE behavior under controlled data, not the owners' data. Regenerate any entry with the command it names.

---

## 2026-08-19T11:17:13Z — rig smoke + BEFORE state of the filed cohort defects

Command: `PW_MODULE_DIR=… node browser-proof/proofs/rig-smoke.mjs`

- Deck boots under fixtures with page errors: none.
- Scene select options: live, indexNow, indexLeadership, companyLeadership, focus2, macroCrossAsset, internalsFast, internalsSlow, sectorFamilies, themeFamilies, custom — **no cohort scene is reachable** (defects 1–2: AI_SOFTWARE / MEGACAP cannot replace the favorites-based rows because no cohort can be chosen at all; the legacy "cohort" id normalizes to themeFamilies).
- THEME FAMILIES renders NVDA, TSM, AVGO, ASML, MU, SNDK — the FIRST basket (AI COMPUTE); **AI POWER's declared rows are unreachable** (defect 3: familyBasket() is never given an id).
- Screenshots: browser-proof/receipts/rig-smoke-deck-live.png · browser-proof/receipts/before-themeFamilies-always-first-basket.png

---

## 2026-08-19T11:23:36Z — filed defects 1–2 FIXED and browser-verified: cohorts replace the favorites rows

Command: `PW_MODULE_DIR=… node browser-proof/proofs/cohort-scene.mjs` (asserts inline; a failed assertion fails the run)

- `/deck/?scene=cohort` lands on **FAV — MU, NBIS, SNDK** (the favorites rows, added order): browser-proof/receipts/cohort-FAV-favorites-rows.png
- Choosing **AI SOFTWARE** replaces them with **ADBE, CRM, MSFT, NOW, ORCL, PLTR** (page 1 / 2 · 7 members; no favorite present): browser-proof/receipts/cohort-AI_SOFTWARE-replaces-favorites.png
- Its page 2 pages honestly to **SNOW** alone: browser-proof/receipts/cohort-AI_SOFTWARE-page2.png
- Choosing **MEGACAP** replaces them with **AAPL, AMZN, GOOGL, META, MSFT, NVDA**: browser-proof/receipts/cohort-MEGACAP-replaces-favorites.png
- Choosing FAV again restores the favorites rows; zero page errors across the flow.

---

## 2026-08-19T11:26:49Z — filed defect 3 FIXED and browser-verified: AI POWER shows its declared rows

Command: `PW_MODULE_DIR=… node browser-proof/proofs/family-scene.mjs` (asserts inline)

- THEME FAMILIES defaults unchanged (AI COMPUTE: NVDA, TSM, AVGO, ASML, MU, SNDK); the family picker is visible on family scenes and hidden elsewhere.
- Choosing **AI POWER** renders exactly its declared rows — **OKLO, IREN, CIFR, BE, WULF, USAR**: browser-proof/receipts/family-AI_POWER-declared-rows.png
- The choice survives leaving and re-entering the scene (session memory).
- SECTOR FAMILIES' **DEFENSIVE** basket is reachable the same way: browser-proof/receipts/family-DEFENSIVE-declared-rows.png
- Zero page errors across the flow.

---

## 2026-08-19T11:33:10Z — ticks, repaint and provider-vs-display, browser-verified; CLOSED-label disposition

Command: `PW_MODULE_DIR=… node browser-proof/proofs/tick-repaint.mjs` (asserts inline)

- **Provider-vs-display**: the chart's day change equals the exact quote the provider served — 0.29% for NVDA 347/346, then 9.83% after a tick to 380; the deck pane likewise (0.33% → 16.94%). No display number differs from the provider's arithmetic.
- **Ticks**: the standalone chart takes a changed provider quote within one 10s poll (browser-proof/receipts/tick-chart-updates-from-provider.png); a deck pane takes it within one 10s pump heartbeat through the authority shim (browser-proof/receipts/tick-deck-pane-updates-from-provider.png).
- **Repaint**: through a cold 1W range switch, 20 continuous canvas samples — zero blank frames; the previous paint stands until the next is ready (browser-proof/receipts/repaint-1W-no-blank.png).
- **Deck healthy state**: the header paints **LIVE** with all panes ready and stamped (browser-proof/receipts/deck-header-LIVE-healthy-state.png) — the state that threw `ReferenceError: delayed is not defined` before `06e4a0a`, now proven in a real browser.
- **CLOSED labels — disposition**: no market-session CLOSED label exists anywhere in this repository (searched all served HTML/JS, case-insensitive, including "closed", "session", market-hours patterns; the only matches are WebRTC connection states and prose). The filed "CLOSED despite live feed" defect lives in the separate scintilla-hub deploy, which this branch's standing locks forbid editing. Kept visible as a cross-repo defect in the handoff; not representable, therefore not claimed, here.

---

## 2026-08-19T11:33:37Z — filed defects 1–2 FIXED and browser-verified: cohorts replace the favorites rows

Command: `PW_MODULE_DIR=… node browser-proof/proofs/cohort-scene.mjs` (asserts inline; a failed assertion fails the run)

- `/deck/?scene=cohort` lands on **FAV — MU, NBIS, SNDK** (the favorites rows, added order): browser-proof/receipts/cohort-FAV-favorites-rows.png
- Choosing **AI SOFTWARE** replaces them with **ADBE, CRM, MSFT, NOW, ORCL, PLTR** (page 1 / 2 · 7 members; no favorite present): browser-proof/receipts/cohort-AI_SOFTWARE-replaces-favorites.png
- Its page 2 pages honestly to **SNOW** alone: browser-proof/receipts/cohort-AI_SOFTWARE-page2.png
- Choosing **MEGACAP** replaces them with **AAPL, AMZN, GOOGL, META, MSFT, NVDA**: browser-proof/receipts/cohort-MEGACAP-replaces-favorites.png
- Choosing FAV again restores the favorites rows; zero page errors across the flow.

---

## 2026-08-19T11:33:49Z — filed defect 3 FIXED and browser-verified: AI POWER shows its declared rows

Command: `PW_MODULE_DIR=… node browser-proof/proofs/family-scene.mjs` (asserts inline)

- THEME FAMILIES defaults unchanged (AI COMPUTE: NVDA, TSM, AVGO, ASML, MU, SNDK); the family picker is visible on family scenes and hidden elsewhere.
- Choosing **AI POWER** renders exactly its declared rows — **OKLO, IREN, CIFR, BE, WULF, USAR**: browser-proof/receipts/family-AI_POWER-declared-rows.png
- The choice survives leaving and re-entering the scene (session memory).
- SECTOR FAMILIES' **DEFENSIVE** basket is reachable the same way: browser-proof/receipts/family-DEFENSIVE-declared-rows.png
- Zero page errors across the flow.

---

## 2026-08-19T11:37:51Z — the catch-null sweep, browser-verified: failures render as failures

Command: `PW_MODULE_DIR=… node browser-proof/proofs/failed-reads.mjs` (board_rsi and earnings_events forced to 500; asserts inline)

- **/ranks**: the RSI column says "board_rsi did not answer — this ranking is unavailable, not empty · retrying", with zero per-ticker "no data" claims; the healthy CHG column still ranks beside it: browser-proof/receipts/failed-read-ranks-rsi-column.png
- **/events**: the calendar says the read failed — "unavailable, not clear" / "unavailable, not absent" — instead of "nothing scheduled in the next 14 days": browser-proof/receipts/failed-read-events-calendar.png
- **/reflow**: the field refuses to draw grey non-answers over a failure and names the failed source: browser-proof/receipts/failed-read-reflow-rsi.png
- /cohorts' FAV chip now carries the failure in its tooltip when hub_favorites dies (source-pinned in tests; the chip still navigates).

---

## 2026-08-19T11:51:42Z — filed defects 1–2 FIXED and browser-verified: cohorts replace the favorites rows

Command: `PW_MODULE_DIR=… node browser-proof/proofs/cohort-scene.mjs` (asserts inline; a failed assertion fails the run)

- `/deck/?scene=cohort` lands on **FAV — MU, NBIS, SNDK** (the favorites rows, added order): browser-proof/receipts/cohort-FAV-favorites-rows.png
- Choosing **AI SOFTWARE** replaces them with **ADBE, CRM, MSFT, NOW, ORCL, PLTR** (page 1 / 2 · 7 members; no favorite present): browser-proof/receipts/cohort-AI_SOFTWARE-replaces-favorites.png
- Its page 2 pages honestly to **SNOW** alone: browser-proof/receipts/cohort-AI_SOFTWARE-page2.png
- Choosing **MEGACAP** replaces them with **AAPL, AMZN, GOOGL, META, MSFT, NVDA**: browser-proof/receipts/cohort-MEGACAP-replaces-favorites.png
- Choosing FAV again restores the favorites rows; zero page errors across the flow.

---

## 2026-08-19T11:51:54Z — filed defect 3 FIXED and browser-verified: AI POWER shows its declared rows

Command: `PW_MODULE_DIR=… node browser-proof/proofs/family-scene.mjs` (asserts inline)

- THEME FAMILIES defaults unchanged (AI COMPUTE: NVDA, TSM, AVGO, ASML, MU, SNDK); the family picker is visible on family scenes and hidden elsewhere.
- Choosing **AI POWER** renders exactly its declared rows — **OKLO, IREN, CIFR, BE, WULF, USAR**: browser-proof/receipts/family-AI_POWER-declared-rows.png
- The choice survives leaving and re-entering the scene (session memory).
- SECTOR FAMILIES' **DEFENSIVE** basket is reachable the same way: browser-proof/receipts/family-DEFENSIVE-declared-rows.png
- Zero page errors across the flow.

---

## 2026-08-19T11:52:32Z — ticks, repaint and provider-vs-display, browser-verified; CLOSED-label disposition

Command: `PW_MODULE_DIR=… node browser-proof/proofs/tick-repaint.mjs` (asserts inline)

- **Provider-vs-display**: the chart's day change equals the exact quote the provider served — 0.29% for NVDA 347/346, then 9.83% after a tick to 380; the deck pane likewise (0.33% → 16.94%). No display number differs from the provider's arithmetic.
- **Ticks**: the standalone chart takes a changed provider quote within one 10s poll (browser-proof/receipts/tick-chart-updates-from-provider.png); a deck pane takes it within one 10s pump heartbeat through the authority shim (browser-proof/receipts/tick-deck-pane-updates-from-provider.png).
- **Repaint**: through a cold 1W range switch, 20 continuous canvas samples — zero blank frames; the previous paint stands until the next is ready (browser-proof/receipts/repaint-1W-no-blank.png).
- **Deck healthy state**: the header paints **LIVE** with all panes ready and stamped (browser-proof/receipts/deck-header-LIVE-healthy-state.png) — the state that threw `ReferenceError: delayed is not defined` before `06e4a0a`, now proven in a real browser.
- **CLOSED labels — disposition**: no market-session CLOSED label exists anywhere in this repository (searched all served HTML/JS, case-insensitive, including "closed", "session", market-hours patterns; the only matches are WebRTC connection states and prose). The filed "CLOSED despite live feed" defect lives in the separate scintilla-hub deploy, which this branch's standing locks forbid editing. Kept visible as a cross-repo defect in the handoff; not representable, therefore not claimed, here.

---

## 2026-08-19T11:52:42Z — the catch-null sweep, browser-verified: failures render as failures

Command: `PW_MODULE_DIR=… node browser-proof/proofs/failed-reads.mjs` (board_rsi and earnings_events forced to 500; asserts inline)

- **/ranks**: the RSI column says "board_rsi did not answer — this ranking is unavailable, not empty · retrying", with zero per-ticker "no data" claims; the healthy CHG column still ranks beside it: browser-proof/receipts/failed-read-ranks-rsi-column.png
- **/events**: the calendar says the read failed — "unavailable, not clear" / "unavailable, not absent" — instead of "nothing scheduled in the next 14 days": browser-proof/receipts/failed-read-events-calendar.png
- **/reflow**: the field refuses to draw grey non-answers over a failure and names the failed source: browser-proof/receipts/failed-read-reflow-rsi.png
- /cohorts' FAV chip now carries the failure in its tooltip when hub_favorites dies (source-pinned in tests; the chip still navigates).

---

## 2026-08-19T12:06:20Z — degraded states, photographed: absence renders as absence

Command: `PW_MODULE_DIR=… node browser-proof/proofs/degraded-states.mjs` (asserts inline; failures injected per page over the healthy rig)

- **/health, provider dead** (browser-proof/receipts/degraded-health-provider-dead.png): all three equity lanes fail with the failure word; the database lanes still answer beside them (the fixture roster carries rows the way the live tables do); the internals lane stays BAD by construction — the fixtures deliberately carry ZERO rows for ADD/PCC/CUMTICK/TICK/TRIN, mirroring their measured live state.
- **/health, Supabase dead** (browser-proof/receipts/degraded-health-supabase-dead.png): provider quotes still answer, and the universe row fails CLOSED — "identity unverified — canonical set unreadable; count alone is not identity" — while the roster lane says "none readable" (a member that cannot be read is not a healthy member).
- **/allocation, every voter dead** (browser-proof/receipts/degraded-allocation-no-voters.png): header UNAVAILABLE — NO VOTER ANSWERED, heat —, targets and moves UNAVAILABLE, the trace declines to narrate, the ranking says "no candidate carries an accepted composite" and lists the unscored names. No fabricated NEUTRAL anywhere. **This scenario caught a real defect the source pin could not**: the cohort table's empty-state message sat behind `html || fallback`, but `html` always carries the header row, so the promised message was unreachable — zero ranked rows painted a bare header (an empty panel where a named absence was promised). Fixed by deciding emptiness on the raw row count; the COMPARABLES table had the same dead gate (its old fallback even named a state that cannot occur, since dropped rows stay rendered greyed-out) — both now append the named absence under the kept header.
- **/fundamentals, provider quotes dead** (browser-proof/receipts/degraded-fundamentals-quotes-dead.png): the header and banner state the missing price; valuation is disabled and STAYS disabled through a slider drag (the render-time gate, exercised in a real browser); the universe and fundamentals sections load normally around it. Also fixed in this unit: the page's boot had no catch, so a cold provider outage used to stop the whole page from booting with no banner at all — the universe failure now paints where the universe status lives and the ticker sections still load.

Zero page errors across all four scenarios.

---

## 2026-08-19T12:10:53Z — /pulse: a dead read no longer wears an empty table's words

Command: `PW_MODULE_DIR=… node browser-proof/proofs/pulse-failed-reads.mjs` (asserts inline; failures injected per page over the healthy rig)

- **vix_term dead, all else healthy** (browser-proof/receipts/pulse-vixterm-dead-beside-live-price.png): geiger counts and macro render normally, and the VIX section shows the live price BESIDE "vix_term did not answer · retrying" — the failure is named, the healthy half still speaks, and "no vix source" (the honest empty wording) never appears over a failure.
- **provider dead** (browser-proof/receipts/pulse-provider-dead-fails-closed.png): the shim fails its owned reads closed, so GEIGER and MACRO say their sources "did not answer — unavailable, not empty · retrying" in the failure style, while vix_term — never shim-owned — still answers with the /3M term ratio beside the dead-quotes marker. Before this unit, every one of these states rendered as "no composite_staged" / "no live_quotes": a dead read and an empty table were the same strip.

Zero page errors in both scenarios.

---

## 2026-08-19T12:13:56Z — an empty FAV names itself, and the way out works

Command: `PW_MODULE_DIR=… node browser-proof/proofs/cohort-empty-fav.mjs` (hub_favorites answers zero rows — a successful empty read, not a failure)

- **The wall says why it is empty** (browser-proof/receipts/cohort-empty-fav-named.png): "no favorites yet — the wall is empty, not broken · choose a cohort or edit the slot", with the indicator counting "page 1 / 1 · 0 favorites". Before this unit the state rendered as one blank editable slot with no wording anywhere on the wall. The wording is gated on the read having landed: before COHORT_READY the count is not yet a fact, and the note does not claim it.
- **Choosing a cohort still replaces the (empty) favorites** (browser-proof/receipts/cohort-empty-fav-to-cohort.png): AI SOFTWARE fills the wall with its full declared membership (7 members) from the empty state.

Zero page errors.

---

## 2026-08-19T12:21:52Z — the DCF FY baseline rides the history tables; the shortfall stays flagged

Command: `PW_MODULE_DIR=… node browser-proof/proofs/dcf-baseline.mjs` (fixture universe carries 8 of the 10 bar tickers; asserts inline)

- **Derived exactly** (browser-proof/receipts/dcf-fy-baseline-partial-overlay.png): NVDA's netDebt/D&A%/capex%/ΔNWC% in the running page equal the arithmetic over the fixture's own FY rows (net_debt in billions; D&A = ebitda − operating_income; capex sign normalized; ΔNWC over the same fiscal date).
- **The shortfall is worn, not hidden**: TSM and IREN are absent from the fixture universe, keep every Jul-24 static value, and the fy-baseline badge reads STALE with "netDebt 8/10 · D&A% 8/10 · capex% 8/10 · ΔNWC% 8/10" — a partial overlay never claims LIVE.
- **What has no DB source stays STATIC by name**: margin/tax defaults · MRP · debt weight, as-of the stated vintage.

Live field availability behind this unit was measured read-only the same day: all ten bar tickers carry complete latest-FY rows in balance_history/cashflow_history/fundamentals_history (balance_history carries net_debt directly), so on the real database the badge should read LIVE 10/10 — the rig's 8/10 is the fixture's own deliberate shape, not a claim about the owners' data.

Zero page errors.

---

## 2026-08-19T12:22:33Z — degraded states, photographed: absence renders as absence

Command: `PW_MODULE_DIR=… node browser-proof/proofs/degraded-states.mjs` (asserts inline; failures injected per page over the healthy rig)

- **/health, provider dead** (browser-proof/receipts/degraded-health-provider-dead.png): all three equity lanes fail with the failure word; the database lanes still answer beside them (the fixture roster carries rows the way the live tables do); the internals lane stays BAD by construction — the fixtures deliberately carry ZERO rows for ADD/PCC/CUMTICK/TICK/TRIN, mirroring their measured live state.
- **/health, Supabase dead** (browser-proof/receipts/degraded-health-supabase-dead.png): provider quotes still answer, and the universe row fails CLOSED — "identity unverified — canonical set unreadable; count alone is not identity" — while the roster lane says "none readable" (a member that cannot be read is not a healthy member).
- **/allocation, every voter dead** (browser-proof/receipts/degraded-allocation-no-voters.png): header UNAVAILABLE — NO VOTER ANSWERED, heat —, targets and moves UNAVAILABLE, the trace declines to narrate, the ranking says "no candidate carries an accepted composite" and lists the unscored names. No fabricated NEUTRAL anywhere. **This scenario caught a real defect the source pin could not**: the cohort table's empty-state message sat behind `html || fallback`, but `html` always carries the header row, so the promised message was unreachable — zero ranked rows painted a bare header (an empty panel where a named absence was promised). Fixed by deciding emptiness on the raw row count; the COMPARABLES table had the same dead gate (its old fallback even named a state that cannot occur, since dropped rows stay rendered greyed-out) — both now append the named absence under the kept header.
- **/fundamentals, provider quotes dead** (browser-proof/receipts/degraded-fundamentals-quotes-dead.png): the header and banner state the missing price; valuation is disabled and STAYS disabled through a slider drag (the render-time gate, exercised in a real browser); the universe and fundamentals sections load normally around it. Also fixed in this unit: the page's boot had no catch, so a cold provider outage used to stop the whole page from booting with no banner at all — the universe failure now paints where the universe status lives and the ticker sections still load.

Zero page errors across all four scenarios.

---

## 2026-08-19T12:22:38Z — rig smoke + BEFORE state of the filed cohort defects

Command: `PW_MODULE_DIR=… node browser-proof/proofs/rig-smoke.mjs`

- Deck boots under fixtures with page errors: none.
- Scene select options: live, indexNow, indexLeadership, companyLeadership, focus2, macroCrossAsset, internalsFast, internalsSlow, sectorFamilies, themeFamilies, cohort, custom — **no cohort scene is reachable** (defects 1–2: AI_SOFTWARE / MEGACAP cannot replace the favorites-based rows because no cohort can be chosen at all; the legacy "cohort" id normalizes to themeFamilies).
- THEME FAMILIES renders NVDA, TSM, AVGO, ASML, MU, SNDK — the FIRST basket (AI COMPUTE); **AI POWER's declared rows are unreachable** (defect 3: familyBasket() is never given an id).
- Screenshots: browser-proof/receipts/rig-smoke-deck-live.png · browser-proof/receipts/before-themeFamilies-always-first-basket.png

---

## 2026-08-19T12:29:50Z — /econ, /alerts, /news: dead reads named; empty tables keep their own words

Command: `PW_MODULE_DIR=… node browser-proof/proofs/panel-failed-reads.mjs` (forced 500s per page over the healthy rig; asserts inline)

These three pages still carried the catch(() => null) flattening the round-4 sweep removed elsewhere — found by re-measuring the repo instead of trusting the earlier "swept" claim (the unit pins only banned the spaced spelling, so the unspaced form survived the audit).

- **/econ, empty tables** (browser-proof/receipts/econ-empty-tables-empty-words.png): the fixture's honest empty state — "econ_dashboard has no rows" and "no calendar rows for this filter", no failure words anywhere.
- **/econ, both reads dead** (browser-proof/receipts/econ-dead-reads-named.png): the tiles and the calendar each name their failed source and the retry; the empty-filter claim never appears over a failure. Before: a dead dashboard read was a BLANK strip and a dead calendar read claimed "no calendar rows for this filter".
- **/alerts, both reads dead** (browser-proof/receipts/alerts-dead-reads-named.png): feed health and ticker alerts say "unavailable, not quiet · retrying" — a dead read no longer impersonates a quiet feed.
- **/news, sentiment dead** (browser-proof/receipts/news-dead-sentiment-named.png): the chip says "sentiment read failed — unavailable, not neutral · retrying" while the wire renders normally beside it; before, the chip silently vanished, identical to a ticker with no sentiment row.

Remaining catch-null sites, dispositioned rather than swept: /youtube's ytAct is a WRITE lane (star/unstar) whose failure silently loses a shared write — its own audit finding, and any fix must respect the shell mirrors; /templates/sector-rotation.html's spark catches feed the E1 coverage gate (PARTIAL / NOT PROVIDER AUTHORITY — visibly gated); /templates/dcf.html's three FY-baseline catches keep the flagged static value and are counted per field in the badge; /cohorts' hub_favorites catch is the kept marker behind its named tooltip; sector-rotation-older is the retained rollback copy, left as-is.

Zero page errors.

---

## 2026-08-19T13:16:05Z — /youtube: a lost shared write no longer stays painted as saved

Command: `PW_MODULE_DIR=… node browser-proof/proofs/yt-lost-write.mjs` (route /youtube/; three fixture youtube_feed rows, empty yt_watch_later; yt-act answered per page; asserts inline)

- **Write lost** (browser-proof/receipts/yt-star-lost-write-reverted.png): the star flips on optimistically, then REVERTS within one settle (DOM: `.sc-ytc__star` loses `is-on`; `ytWLGet().size === 0`), and the page's flash surface says "★ not saved — the shared watch-later write failed · try again" for long enough to read. Before this unit the failure was swallowed (`.then(r => r.json()).catch(() => null)`, result ignored): the star stayed painted "saved", the shared table never changed, and the lie stood until the next reconcile read.
- **Write landed** (browser-proof/receipts/yt-star-landed-write-stays.png): the star stays, `ytWLGet()` carries the id, no failure flash — success and failure are now different pictures.
- Success detection is a LANDED write only: non-2xx and error bodies resolve null (a 500 whose JSON parses is not a success).
- **Scope notes, measured in code**: the two mounted video shells already REVERT on this failure (state-honest) but stay reason-silent — recorded as a lesser gap, not repaired here, because their only failure surface today is the watch-list read lane and hijacking it would blank the list; their `subscribeToChannel` catch is the same state-honest/reason-silent shape. The 10s-cadence `ytPosPush` position write keeps its silent catch by design: positions re-push on cadence, so a lost write is retried by the next tick rather than lied about.

Zero page errors in both scenarios. Rollback: revert the single commit carrying this unit — the change is client-render behavior only (no schema, no endpoint, no authority change).

---

## 2026-08-19T13:21:17Z — /fundamentals: absent balance fields are flagged by name, not minted into net debt

Command: `PW_MODULE_DIR=… node browser-proof/proofs/fy-consistency.mjs` (route /templates/fundamentals.html, NVDA; balance_history answered per page; asserts inline)

- **total_debt NULL** (browser-proof/receipts/fundamentals-null-debt-flagged.png): the flags line says "balance_history.total_debt is null — net debt treats debt as 0 and WACC as all-equity; fair value is OVERSTATED if this name carries debt". Before this unit, `(b.total_debt||0)-(b.cash_and_equiv||0)` silently valued every such ticker debt-free — a missing balance row produced zero net debt, an all-equity WACC, and no sign anywhere.
- **Complete balance row** (browser-proof/receipts/fundamentals-complete-balance-no-flag.png): no absence flag, valuation renders normally — the flag appears exactly when the absence does.
- The same unit aligned buildBase's ratio windows with the rule the DCF FY baseline enforces: D&A% and capex% denominators now come from the SAME rows as their numerators (the same 4 quarters, or the same single FY — a mismatched FY pair keeps the flagged default rather than a cross-year ratio; an offset cashflow-vs-income quarter window is flagged out loud). fundamentals.revenue_ttm stays the projection BASE — currency there, consistency in ratios. A terminally underivable share count is flagged "NOT meaningful" instead of silently dividing by a 1B placeholder. Functional pins drive every case in tests/station-fundamentals-price.test.mjs.

Zero page errors in both scenarios. Rollback: revert the single commit carrying this unit — derivation and flag wording only; no schema, no authority, no methodology change (the DCF formulas are untouched; only the window selection and absence visibility moved).

---

## 2026-08-19T13:25:17Z — /news and /cohorts main reads: named when never loaded, STALE-stamped when they die mid-life

Command: `PW_MODULE_DIR=… node browser-proof/proofs/main-read-failure.mjs` (forced 500s; mid-life failures injected by re-routing after a healthy load and invoking the page's own tick(); asserts inline)

- **/news never loads** (browser-proof/receipts/news-main-read-never-loaded.png): "the news read failed — the wire is unavailable, not empty · retrying at the next refresh" — named and distinct from the empty-filter wording; the old boot catch said only "news unavailable".
- **/news dies after a healthy load** (browser-proof/receipts/news-refresh-failed-stale-stamp.png): the held headlines STAY (a failed read never erases knowledge) and the freshness line says "REFRESH FAILED — showing the read from Xs ago — the news read is failing, the list below is stale · retrying". Before, the interval catch was silent: the list froze with a "newest Xm ago" stamp that became false as time passed.
- **/cohorts never loads** (browser-proof/receipts/cohorts-main-read-never-loaded.png): the strip names the failed source ("the ticker_cohorts read failed — …"), not "cohort data unavailable".
- **/cohorts dies after a healthy load** (browser-proof/receipts/cohorts-refresh-failed-stale-marker.png): every chip is kept and a visible marker appends — "refresh failed (ticker_cohorts) — these chips are stale · retrying" — cleared naturally by the next successful rebuild.

Zero page errors across all four scenarios. Rollback: revert the single commit carrying this unit — render wording and failure-state plumbing only; queries, authorities and refresh cadences untouched.

---

## 2026-08-19T13:53:50Z — the DCF growth/margin slider seeds ride the FY history; the shortfall stays flagged

Command: `PW_MODULE_DIR=… node browser-proof/proofs/dcf-seeds.mjs` (route /templates/dcf.html, NVDA boot; fixture universe carries 8 of the 10 bar tickers; asserts inline)

- **Derived exactly and VISIBLE** (browser-proof/receipts/dcf-seeds-partial-overlay.png): NVDA's growth default equals the FY-to-FY revenue CAGR over the fixture's own rows and its margin default equals the latest FY's own margin — both land in TICKERS and on the sliders the user then owns (range inputs snap to their 0.5 step; asserted within one step). Clamps and window rules mirror the fundamentals cockpit: g 0..80, m 5..90, a CAGR needs two FY rows more than half a year apart.
- **The shortfall is worn, not hidden**: TSM and IREN are absent from the fixture universe and keep their Jul-24 static seeds; the fy-seeds badge reads STALE with "growth default 8/10 · EBITDA-margin default 8/10" — a partial overlay never claims LIVE.
- **What has no DB source stays STATIC by name**: tax default · terminal growth · MRP · debt weight (fundamentals_history carries no tax line — measured schema, round 5) — the static-baseline badge and the as-of bar both say so.

Zero page errors. Rollback: revert the single commit carrying this unit — seed derivation and badge wording only; the DCF formulas, price authority and Geiger methodology are untouched, and no provider history was written or deleted.

---

## 2026-08-19T14:25:41Z — the Hub entry: the live path's exact refusal, and the deck booting AT the hub origin

Command: `PW_MODULE_DIR=… node browser-proof/proofs/hub-entry.mjs` (rules parsed from vercel.json itself; asserts inline)

- **Live path, measured in the browser** (browser-proof/receipts/hub-entry-live-path-refused.png): Chromium pointed at https://station.scintillahub.ai/ through the environment's proxy fails with `page.goto: net::ERR_TUNNEL_CONNECTION_FAILED at https://station.scintillahub.ai/` — the CONNECT is refused before TLS begins, so nothing was bypassed and nothing live was reached or faked. The PREVIEW host gets the same measurement (browser-proof/receipts/hub-entry-preview-refused.png): `page.goto: net::ERR_TUNNEL_CONNECTION_FAILED at https://scintilla-widgets-git-cla-070619-aharveyrianhard-8432s-projects.vercel.app/deck/` — the branch's own deploy is equally unreachable from here, which is exactly the live-acceptance blocker the handoff carries. This is the browser-level twin of round 7's curl measurement: live acceptance still requires a browser outside this container.
- **The deck boots at the hub origin under the config's own rules** (browser-proof/receipts/hub-entry-deck-boots-at-hub-origin.png): navigating to https://station.scintillahub.ai/ with vercel.json's parsed rewrites applied over the rig serves the Station AT the hub host — title, StationScenes, the provider shim, the cohort axis and the mounted panes all up, location.host still the hub. ZERO asset 404s: every /deck dependency is absolute-pathed, so the root rewrite (source "/" only) breaks nothing — proven by outcome in a real browser, not by grep. The no-store cache rule rides every response, as pinned from the config.
- The config itself is pinned in tests/station-route-inventory.test.mjs: exactly two rewrites (hub root → /deck/, /status → orgstatus), no-store at all three cache layers.

This is stubbed-data page proof at the true hub ORIGIN — it verifies the entry path and the deck's behavior under the rewrite, not the live owners' data. Rollback: revert the single commit carrying this unit — proof, pin and receipts only; no served file changed.

---

## 2026-08-19T14:26:42Z — the Hub entry: the live path's exact refusal, and the deck booting AT the hub origin

Command: `PW_MODULE_DIR=… node browser-proof/proofs/hub-entry.mjs` (rules parsed from vercel.json itself; asserts inline)

- **Live path, measured in the browser** (browser-proof/receipts/hub-entry-live-path-refused.png): Chromium pointed at https://station.scintillahub.ai/ through the environment's proxy fails with `page.goto: net::ERR_TUNNEL_CONNECTION_FAILED at https://station.scintillahub.ai/` — the CONNECT is refused before TLS begins, so nothing was bypassed and nothing live was reached or faked. The PREVIEW host gets the same measurement (browser-proof/receipts/hub-entry-preview-refused.png): `page.goto: net::ERR_TUNNEL_CONNECTION_FAILED at https://scintilla-widgets-git-cla-070619-aharveyrianhard-8432s-projects.vercel.app/deck/` — the branch's own deploy is equally unreachable from here, which is exactly the live-acceptance blocker the handoff carries. This is the browser-level twin of round 7's curl measurement: live acceptance still requires a browser outside this container.
- **The deck boots at the hub origin under the config's own rules** (browser-proof/receipts/hub-entry-deck-boots-at-hub-origin.png): navigating to https://station.scintillahub.ai/ with vercel.json's parsed rewrites applied over the rig serves the Station AT the hub host — title, StationScenes, the provider shim, the cohort axis and the mounted panes all up, location.host still the hub. ZERO asset 404s: every /deck dependency is absolute-pathed, so the root rewrite (source "/" only) breaks nothing — proven by outcome in a real browser, not by grep. The no-store cache rule rides every response, as pinned from the config.
- The config itself is pinned in tests/station-route-inventory.test.mjs: exactly two rewrites (hub root → /deck/, /status → orgstatus), no-store at all three cache layers.

This is stubbed-data page proof at the true hub ORIGIN — it verifies the entry path and the deck's behavior under the rewrite, not the live owners' data. Rollback: revert the single commit carrying this unit — proof, pin and receipts only; no served file changed.

---

## 2026-08-19T14:27:57Z — the realtime channel's absence is said on the wall, in its own lane

Command: `PW_MODULE_DIR=… node browser-proof/proofs/realtime-absence.mjs` (the rig refuses the CDN naturally; scenario 2 stubs it; asserts inline)

- **SDK absent** (browser-proof/receipts/realtime-absent-said-on-the-wall.png): the deck paints "RT · absent" beside #marketStatus with the reason in the title ("supabase-js did not load (third-party CDN) — the realtime tick channel is absent; non-equity ticks ride polling only"), `SC_REALTIME.available === false` is queryable on deck and chart alike, the freshness lane is untouched (cadence is not freshness — rule 11), and nothing errors. Before this unit the lane vanished with no sign anywhere.
- **SDK present** (browser-proof/receipts/realtime-present-note-hidden.png): the note hides, the state flips, the wording carries the authority rule — equities never ride the channel; the shim's refusal guards (`realtime_equity_refused`, unknown-ownership-is-not-permission, the passthrough counter) are now PINNED in the equity-authority suite, where they had been unpinned.
- **Supply-chain fact, recorded for the owner**: the tag loads `@supabase/supabase-js@2` — a FLOATING major tag from a third-party CDN, in the price path's pages (/chart, its shell mirror, /deck). Version drift arrives unreviewed; pinning a version with an integrity hash, or vendoring the file same-origin, needs the exact bytes — unreachable from this container (proxy CONNECT 403) — so it is an OWNER RULING, named in the handoff, not a guess taken here. The audit that found it also measured seven other equity surfaces (/geiger /heat /cohort /compare /ticker /analytics /geigerwall) clean: zero page errors, zero non-owner host escapes at runtime.

Rollback: revert the single commit carrying this unit — a said state and pins only; the channel's behavior, the polling lanes and all authorities are untouched.

---

## 2026-08-19T14:29:16Z — the authority sweep: eight equity surfaces, zero unreviewed hosts at runtime

Command: `PW_MODULE_DIR=… node browser-proof/proofs/authority-sweep.mjs` (asserts inline; no screenshots — the assertions ARE the evidence, regenerable)

/geiger/ · /heat/ · /cohort/ · /compare/ · /ticker/ · /wall/ · /analytics/ · /geigerwall/ — each loads over the rig with **zero page errors**, paints a real surface, and makes **zero requests to any unreviewed host**: no Yahoo, no FMP, no CORS proxy. The single allowed third-party request is the pinned `cdn.jsdelivr.net/npm/@supabase/supabase-js@2` tag (the recorded supply-chain item awaiting an owner's pin-or-vendor ruling), observed via /wall's mounted chart frames — and the proof requires observing it, so a silent interception failure cannot fake a clean sweep.

This is the runtime half of the round-9 authority audit; the source half measured: zero Yahoo/FMP fetch lanes in served HTML outside sector-rotation's reviewed-relays-only flagged fallback (its third-party proxy lane was retired in F1's own fix, verified still absent); /health the only direct provider fetch (the ruled exception — /analytics's grep hit is banner prose); 20/20 shim-tag coverage on pages that read shim-owned tables (the remaining grep hits — /, /components — are prose descriptions, classified by eye).

---

## 2026-08-19T14:45:51Z — the inventory sweep: runtime coverage completed, and the LINES panel says its library is dead

Command: `PW_MODULE_DIR=… node browser-proof/proofs/inventory-sweep.mjs` (asserts inline; one screenshot for the found defect)

- **33 remaining surfaces loaded clean** — entry, ops, market (/parity), media, the visuals lab, the standalone spec pages: zero page errors, real painted surfaces, zero requests outside each page's CLASS allowance (data lanes: the two owners only; media-mounting pages: YouTube embed hosts + the pinned jsdelivr tag via chart frames; the retained rollback sector-rotation-older: its reviewed hub relay, exempt by ruling). Together with authority-sweep.mjs and the per-page proofs, EVERY served surface in the route inventory has now been loaded at least once under authority assertions — except the X lane, excluded because H2 is proof-gated (the bridge draft's offscreen document is recorded as throwing outside its extension context; its guard waits behind the same gate).
- **The found defect, fixed and photographed** (browser-proof/receipts/sector-lines-cdn-dead-said.png): /templates/sector-rotation.html loads lightweight-charts from unpkg (pinned 4.1.3, NO integrity hash — vendor-or-SRI is an OWNER RULING, recorded beside the supabase-js item). Unguarded, createChart threw a ReferenceError when the CDN was down and took the timeframe-following panels with it. The LINES panel now SAYS "lightweight-charts did not load … unavailable, not empty; every other panel is unaffected", the chart calls are guarded, and leaders/heatmap still follow a range click with the library dead — zero page errors before and after.

Rollback: revert the single commit carrying this unit — a said state, guards, pins and this proof; no data lane, authority or methodology changed; the rollback copy untouched.

---

## 2026-08-19T14:48:26Z — the preset scenes paint their declared rows: the first-basket class closed for every scene kind

Command: `PW_MODULE_DIR=… node browser-proof/proofs/scene-declared-rows.mjs` (asserts inline)

- **Fixed preset** (browser-proof/receipts/scene-macro-preset-declared-rows.png): /deck?scene=macroCrossAsset carries exactly US10Y · DXUSD · GCUSD · SIUSD · CLUSD · BTCUSD — the model's own frozen declaration, in order, at chartCount 6.
- **Time-windowed preset**: /deck?scene=indexNow's wall equals `indexNowTickersFor(new Date())` windowed by the model itself, compared IN the same browser at the same instant so the time dependence cancels — whatever the model declares for now is what the wall carries.
- With the cohort and family proofs of round 4, every scene KIND is now browser-proven to deliver its declared rows: fixed presets, time-windowed presets, cohort membership, family baskets. Also recorded from this sweep: /parity makes NO data reads at all (a static analysis page — authority-clean by construction).

Rollback: this unit adds a proof only; no served file changed.

---

## 2026-08-19T15:10:06Z — the realtime lane tells the truth at every stage, on the vendored library

Command: `PW_MODULE_DIR=… node browser-proof/proofs/realtime-absence.mjs` (asserts inline)

- **Script absent** (browser-proof/receipts/realtime-absent-said-on-the-wall.png): with the vendored /_vendor/supabase-js blocked, the deck paints "RT · absent" beside #marketStatus with the reason, SC_REALTIME.available === false, the freshness lane untouched, nothing errors.
- **Script present — the REAL library** (browser-proof/receipts/realtime-channel-error-said.png): the vendored npm-verified bytes execute in the rig (typeof supabase.createClient === "function" — no stub), availability flips, and the channel state is honest about the offline rig ("connecting" or a terminal failure). The WIRED status callback — pinned in the equity-authority suite as the exact function the channel calls — is driven through CHANNEL_ERROR ("RT · not connected", reason in the title) and SUBSCRIBED (note hidden). "Available" no longer means merely "script present": the channel lifecycle is the lane's truth.

Rollback: revert the vendoring commit — the CDN tags return; behavior is otherwise unchanged.

---

## 2026-08-19T15:10:50Z — the authority sweep: eight equity surfaces, zero unreviewed hosts at runtime

Command: `PW_MODULE_DIR=… node browser-proof/proofs/authority-sweep.mjs` (asserts inline; no screenshots — the assertions ARE the evidence, regenerable)

/geiger/ · /heat/ · /cohort/ · /compare/ · /ticker/ · /wall/ · /analytics/ · /geigerwall/ — each loads over the rig with **zero page errors**, paints a real surface, and makes **zero requests to any non-owner host at all**: no Yahoo, no FMP, no CORS proxy, and — since the vendoring — no CDN either. A deliberate canary request to an unserved host must land in the refusal log, so a silent interception failure cannot fake a clean sweep.

This is the runtime half of the round-9 authority audit; the source half measured: zero Yahoo/FMP fetch lanes in served HTML outside sector-rotation's reviewed-relays-only flagged fallback (its third-party proxy lane was retired in F1's own fix, verified still absent); /health the only direct provider fetch (the ruled exception — /analytics's grep hit is banner prose); 20/20 shim-tag coverage on pages that read shim-owned tables (the remaining grep hits — /, /components — are prose descriptions, classified by eye).

---

## 2026-08-19T15:12:24Z — the inventory sweep: runtime coverage completed, and the LINES panel says its library is dead

Command: `PW_MODULE_DIR=… node browser-proof/proofs/inventory-sweep.mjs` (asserts inline; one screenshot for the found defect)

- **33 remaining surfaces loaded clean** — entry, ops, market (/parity), media, the visuals lab, the standalone spec pages: zero page errors, real painted surfaces, zero requests outside each page's CLASS allowance (data lanes: the two owners only; media-mounting pages: YouTube embed hosts; the retained rollback sector-rotation-older: its reviewed hub relay + its legacy unpkg tag, exempt by ruling — no other page touches a CDN since the vendoring). Together with authority-sweep.mjs and the per-page proofs, EVERY served surface in the route inventory has now been loaded at least once under authority assertions — except the X lane, excluded because H2 is proof-gated (the bridge draft's offscreen document is recorded as throwing outside its extension context; its guard waits behind the same gate).
- **The found defect, proven fixed on the vendored library** (browser-proof/receipts/sector-lines-cdn-dead-said.png): with the same-origin /_vendor lightweight-charts script blocked, the LINES panel SAYS "lightweight-charts (vendored same-origin) did not load — unavailable, not empty; every other panel is unaffected", the chart calls are guarded, and leaders/heatmap still follow a range click with the library dead — zero page errors before and after. (The healthy load — the vendored library actually executing — is covered by the sweep above.)

Rollback: revert the single commit carrying this unit — a said state, guards, pins and this proof; no data lane, authority or methodology changed; the rollback copy untouched.

---

## 2026-08-19T15:13:28Z — the authority sweep: eight equity surfaces, zero unreviewed hosts at runtime

Command: `PW_MODULE_DIR=… node browser-proof/proofs/authority-sweep.mjs` (asserts inline; no screenshots — the assertions ARE the evidence, regenerable)

/geiger/ · /heat/ · /cohort/ · /compare/ · /ticker/ · /wall/ · /analytics/ · /geigerwall/ — each loads over the rig with **zero page errors**, paints a real surface, and makes **zero requests to any non-owner host at all**: no Yahoo, no FMP, no CORS proxy, and — since the vendoring — no CDN either. A deliberate canary request to an unserved host must land in the refusal log, so a silent interception failure cannot fake a clean sweep.

This is the runtime half of the round-9 authority audit; the source half measured: zero Yahoo/FMP fetch lanes in served HTML outside sector-rotation's reviewed-relays-only flagged fallback (its third-party proxy lane was retired in F1's own fix, verified still absent); /health the only direct provider fetch (the ruled exception — /analytics's grep hit is banner prose); 20/20 shim-tag coverage on pages that read shim-owned tables (the remaining grep hits — /, /components — are prose descriptions, classified by eye).

---

## 2026-08-19T15:13:34Z — an empty FAV names itself, and the way out works

Command: `PW_MODULE_DIR=… node browser-proof/proofs/cohort-empty-fav.mjs` (hub_favorites answers zero rows — a successful empty read, not a failure)

- **The wall says why it is empty** (browser-proof/receipts/cohort-empty-fav-named.png): "no favorites yet — the wall is empty, not broken · choose a cohort or edit the slot", with the indicator counting "page 1 / 1 · 0 favorites". Before this unit the state rendered as one blank editable slot with no wording anywhere on the wall. The wording is gated on the read having landed: before COHORT_READY the count is not yet a fact, and the note does not claim it.
- **Choosing a cohort still replaces the (empty) favorites** (browser-proof/receipts/cohort-empty-fav-to-cohort.png): AI SOFTWARE fills the wall with its full declared membership (7 members) from the empty state.

Zero page errors.

---

## 2026-08-19T15:13:43Z — filed defects 1–2 FIXED and browser-verified: cohorts replace the favorites rows

Command: `PW_MODULE_DIR=… node browser-proof/proofs/cohort-scene.mjs` (asserts inline; a failed assertion fails the run)

- `/deck/?scene=cohort` lands on **FAV — MU, NBIS, SNDK** (the favorites rows, added order): browser-proof/receipts/cohort-FAV-favorites-rows.png
- Choosing **AI SOFTWARE** replaces them with **ADBE, CRM, MSFT, NOW, ORCL, PLTR** (page 1 / 2 · 7 members; no favorite present): browser-proof/receipts/cohort-AI_SOFTWARE-replaces-favorites.png
- Its page 2 pages honestly to **SNOW** alone: browser-proof/receipts/cohort-AI_SOFTWARE-page2.png
- Choosing **MEGACAP** replaces them with **AAPL, AMZN, GOOGL, META, MSFT, NVDA**: browser-proof/receipts/cohort-MEGACAP-replaces-favorites.png
- Choosing FAV again restores the favorites rows; zero page errors across the flow.

---

## 2026-08-19T15:13:57Z — the DCF growth/margin slider seeds ride the FY history; the shortfall stays flagged

Command: `PW_MODULE_DIR=… node browser-proof/proofs/dcf-seeds.mjs` (route /templates/dcf.html, NVDA boot; fixture universe carries 8 of the 10 bar tickers; asserts inline)

- **Derived exactly and VISIBLE** (browser-proof/receipts/dcf-seeds-partial-overlay.png): NVDA's growth default equals the FY-to-FY revenue CAGR over the fixture's own rows and its margin default equals the latest FY's own margin — both land in TICKERS and on the sliders the user then owns (range inputs snap to their 0.5 step; asserted within one step). Clamps and window rules mirror the fundamentals cockpit: g 0..80, m 5..90, a CAGR needs two FY rows more than half a year apart.
- **The shortfall is worn, not hidden**: TSM and IREN are absent from the fixture universe and keep their Jul-24 static seeds; the fy-seeds badge reads STALE with "growth default 8/10 · EBITDA-margin default 8/10" — a partial overlay never claims LIVE.
- **What has no DB source stays STATIC by name**: tax default · terminal growth · MRP · debt weight (fundamentals_history carries no tax line — measured schema, round 5) — the static-baseline badge and the as-of bar both say so.

Zero page errors. Rollback: revert the single commit carrying this unit — seed derivation and badge wording only; the DCF formulas, price authority and Geiger methodology are untouched, and no provider history was written or deleted.

---

## 2026-08-19T15:14:17Z — degraded states, photographed: absence renders as absence

Command: `PW_MODULE_DIR=… node browser-proof/proofs/degraded-states.mjs` (asserts inline; failures injected per page over the healthy rig)

- **/health, provider dead** (browser-proof/receipts/degraded-health-provider-dead.png): all three equity lanes fail with the failure word; the database lanes still answer beside them (the fixture roster carries rows the way the live tables do); the internals lane stays BAD by construction — the fixtures deliberately carry ZERO rows for ADD/PCC/CUMTICK/TICK/TRIN, mirroring their measured live state.
- **/health, Supabase dead** (browser-proof/receipts/degraded-health-supabase-dead.png): provider quotes still answer, and the universe row fails CLOSED — "identity unverified — canonical set unreadable; count alone is not identity" — while the roster lane says "none readable" (a member that cannot be read is not a healthy member).
- **/allocation, every voter dead** (browser-proof/receipts/degraded-allocation-no-voters.png): header UNAVAILABLE — NO VOTER ANSWERED, heat —, targets and moves UNAVAILABLE, the trace declines to narrate, the ranking says "no candidate carries an accepted composite" and lists the unscored names. No fabricated NEUTRAL anywhere. **This scenario caught a real defect the source pin could not**: the cohort table's empty-state message sat behind `html || fallback`, but `html` always carries the header row, so the promised message was unreachable — zero ranked rows painted a bare header (an empty panel where a named absence was promised). Fixed by deciding emptiness on the raw row count; the COMPARABLES table had the same dead gate (its old fallback even named a state that cannot occur, since dropped rows stay rendered greyed-out) — both now append the named absence under the kept header.
- **/fundamentals, provider quotes dead** (browser-proof/receipts/degraded-fundamentals-quotes-dead.png): the header and banner state the missing price; valuation is disabled and STAYS disabled through a slider drag (the render-time gate, exercised in a real browser); the universe and fundamentals sections load normally around it. Also fixed in this unit: the page's boot had no catch, so a cold provider outage used to stop the whole page from booting with no banner at all — the universe failure now paints where the universe status lives and the ticker sections still load.

Zero page errors across all four scenarios.

---

## 2026-08-19T15:14:27Z — the catch-null sweep, browser-verified: failures render as failures

Command: `PW_MODULE_DIR=… node browser-proof/proofs/failed-reads.mjs` (board_rsi and earnings_events forced to 500; asserts inline)

- **/ranks**: the RSI column says "board_rsi did not answer — this ranking is unavailable, not empty · retrying", with zero per-ticker "no data" claims; the healthy CHG column still ranks beside it: browser-proof/receipts/failed-read-ranks-rsi-column.png
- **/events**: the calendar says the read failed — "unavailable, not clear" / "unavailable, not absent" — instead of "nothing scheduled in the next 14 days": browser-proof/receipts/failed-read-events-calendar.png
- **/reflow**: the field refuses to draw grey non-answers over a failure and names the failed source: browser-proof/receipts/failed-read-reflow-rsi.png
- /cohorts' FAV chip now carries the failure in its tooltip when hub_favorites dies (source-pinned in tests; the chip still navigates).

---

## 2026-08-19T15:14:39Z — filed defect 3 FIXED and browser-verified: AI POWER shows its declared rows

Command: `PW_MODULE_DIR=… node browser-proof/proofs/family-scene.mjs` (asserts inline)

- THEME FAMILIES defaults unchanged (AI COMPUTE: NVDA, TSM, AVGO, ASML, MU, SNDK); the family picker is visible on family scenes and hidden elsewhere.
- Choosing **AI POWER** renders exactly its declared rows — **OKLO, IREN, CIFR, BE, WULF, USAR**: browser-proof/receipts/family-AI_POWER-declared-rows.png
- The choice survives leaving and re-entering the scene (session memory).
- SECTOR FAMILIES' **DEFENSIVE** basket is reachable the same way: browser-proof/receipts/family-DEFENSIVE-declared-rows.png
- Zero page errors across the flow.

---

## 2026-08-19T15:14:52Z — /fundamentals: absent balance fields are flagged by name, not minted into net debt

Command: `PW_MODULE_DIR=… node browser-proof/proofs/fy-consistency.mjs` (route /templates/fundamentals.html, NVDA; balance_history answered per page; asserts inline)

- **total_debt NULL** (browser-proof/receipts/fundamentals-null-debt-flagged.png): the flags line says "balance_history.total_debt is null — net debt treats debt as 0 and WACC as all-equity; fair value is OVERSTATED if this name carries debt". Before this unit, `(b.total_debt||0)-(b.cash_and_equiv||0)` silently valued every such ticker debt-free — a missing balance row produced zero net debt, an all-equity WACC, and no sign anywhere.
- **Complete balance row** (browser-proof/receipts/fundamentals-complete-balance-no-flag.png): no absence flag, valuation renders normally — the flag appears exactly when the absence does.
- The same unit aligned buildBase's ratio windows with the rule the DCF FY baseline enforces: D&A% and capex% denominators now come from the SAME rows as their numerators (the same 4 quarters, or the same single FY — a mismatched FY pair keeps the flagged default rather than a cross-year ratio; an offset cashflow-vs-income quarter window is flagged out loud). fundamentals.revenue_ttm stays the projection BASE — currency there, consistency in ratios. A terminally underivable share count is flagged "NOT meaningful" instead of silently dividing by a 1B placeholder. Functional pins drive every case in tests/station-fundamentals-price.test.mjs.

Zero page errors in both scenarios. Rollback: revert the single commit carrying this unit — derivation and flag wording only; no schema, no authority, no methodology change (the DCF formulas are untouched; only the window selection and absence visibility moved).

---

## 2026-08-19T15:14:59Z — the Hub entry: the live path's exact refusal, and the deck booting AT the hub origin

Command: `PW_MODULE_DIR=… node browser-proof/proofs/hub-entry.mjs` (rules parsed from vercel.json itself; asserts inline)

- **Live path, measured in the browser** (browser-proof/receipts/hub-entry-live-path-refused.png): Chromium pointed at https://station.scintillahub.ai/ through the environment's proxy fails with `page.goto: net::ERR_TUNNEL_CONNECTION_FAILED at https://station.scintillahub.ai/` — the CONNECT is refused before TLS begins, so nothing was bypassed and nothing live was reached or faked. The PREVIEW host gets the same measurement (browser-proof/receipts/hub-entry-preview-refused.png): `page.goto: net::ERR_TUNNEL_CONNECTION_FAILED at https://scintilla-widgets-git-cla-070619-aharveyrianhard-8432s-projects.vercel.app/deck/` — the branch's own deploy is equally unreachable from here, which is exactly the live-acceptance blocker the handoff carries. This is the browser-level twin of round 7's curl measurement: live acceptance still requires a browser outside this container.
- **The deck boots at the hub origin under the config's own rules** (browser-proof/receipts/hub-entry-deck-boots-at-hub-origin.png): navigating to https://station.scintillahub.ai/ with vercel.json's parsed rewrites applied over the rig serves the Station AT the hub host — title, StationScenes, the provider shim, the cohort axis and the mounted panes all up, location.host still the hub. ZERO asset 404s: every /deck dependency is absolute-pathed, so the root rewrite (source "/" only) breaks nothing — proven by outcome in a real browser, not by grep. The no-store cache rule rides every response, as pinned from the config.
- The config itself is pinned in tests/station-route-inventory.test.mjs: exactly two rewrites (hub root → /deck/, /status → orgstatus), no-store at all three cache layers.

This is stubbed-data page proof at the true hub ORIGIN — it verifies the entry path and the deck's behavior under the rewrite, not the live owners' data. Rollback: revert the single commit carrying this unit — proof, pin and receipts only; no served file changed.

---

## 2026-08-19T15:16:33Z — the inventory sweep: runtime coverage completed, and the LINES panel says its library is dead

Command: `PW_MODULE_DIR=… node browser-proof/proofs/inventory-sweep.mjs` (asserts inline; one screenshot for the found defect)

- **33 remaining surfaces loaded clean** — entry, ops, market (/parity), media, the visuals lab, the standalone spec pages: zero page errors, real painted surfaces, zero requests outside each page's CLASS allowance (data lanes: the two owners only; media-mounting pages: YouTube embed hosts; the retained rollback sector-rotation-older: its reviewed hub relay + its legacy unpkg tag, exempt by ruling — no other page touches a CDN since the vendoring). Together with authority-sweep.mjs and the per-page proofs, EVERY served surface in the route inventory has now been loaded at least once under authority assertions — except the X lane, excluded because H2 is proof-gated (the bridge draft's offscreen document is recorded as throwing outside its extension context; its guard waits behind the same gate).
- **The found defect, proven fixed on the vendored library** (browser-proof/receipts/sector-lines-cdn-dead-said.png): with the same-origin /_vendor lightweight-charts script blocked, the LINES panel SAYS "lightweight-charts (vendored same-origin) did not load — unavailable, not empty; every other panel is unaffected", the chart calls are guarded, and leaders/heatmap still follow a range click with the library dead — zero page errors before and after. (The healthy load — the vendored library actually executing — is covered by the sweep above.)

Rollback: revert the single commit carrying this unit — a said state, guards, pins and this proof; no data lane, authority or methodology changed; the rollback copy untouched.

---

## 2026-08-19T15:16:50Z — /news and /cohorts main reads: named when never loaded, STALE-stamped when they die mid-life

Command: `PW_MODULE_DIR=… node browser-proof/proofs/main-read-failure.mjs` (forced 500s; mid-life failures injected by re-routing after a healthy load and invoking the page's own tick(); asserts inline)

- **/news never loads** (browser-proof/receipts/news-main-read-never-loaded.png): "the news read failed — the wire is unavailable, not empty · retrying at the next refresh" — named and distinct from the empty-filter wording; the old boot catch said only "news unavailable".
- **/news dies after a healthy load** (browser-proof/receipts/news-refresh-failed-stale-stamp.png): the held headlines STAY (a failed read never erases knowledge) and the freshness line says "REFRESH FAILED — showing the read from Xs ago — the news read is failing, the list below is stale · retrying". Before, the interval catch was silent: the list froze with a "newest Xm ago" stamp that became false as time passed.
- **/cohorts never loads** (browser-proof/receipts/cohorts-main-read-never-loaded.png): the strip names the failed source ("the ticker_cohorts read failed — …"), not "cohort data unavailable".
- **/cohorts dies after a healthy load** (browser-proof/receipts/cohorts-refresh-failed-stale-marker.png): every chip is kept and a visible marker appends — "refresh failed (ticker_cohorts) — these chips are stale · retrying" — cleared naturally by the next successful rebuild.

Zero page errors across all four scenarios. Rollback: revert the single commit carrying this unit — render wording and failure-state plumbing only; queries, authorities and refresh cadences untouched.

---

## 2026-08-19T15:17:02Z — /econ, /alerts, /news: dead reads named; empty tables keep their own words

Command: `PW_MODULE_DIR=… node browser-proof/proofs/panel-failed-reads.mjs` (forced 500s per page over the healthy rig; asserts inline)

These three pages still carried the catch(() => null) flattening the round-4 sweep removed elsewhere — found by re-measuring the repo instead of trusting the earlier "swept" claim (the unit pins only banned the spaced spelling, so the unspaced form survived the audit).

- **/econ, empty tables** (browser-proof/receipts/econ-empty-tables-empty-words.png): the fixture's honest empty state — "econ_dashboard has no rows" and "no calendar rows for this filter", no failure words anywhere.
- **/econ, both reads dead** (browser-proof/receipts/econ-dead-reads-named.png): the tiles and the calendar each name their failed source and the retry; the empty-filter claim never appears over a failure. Before: a dead dashboard read was a BLANK strip and a dead calendar read claimed "no calendar rows for this filter".
- **/alerts, both reads dead** (browser-proof/receipts/alerts-dead-reads-named.png): feed health and ticker alerts say "unavailable, not quiet · retrying" — a dead read no longer impersonates a quiet feed.
- **/news, sentiment dead** (browser-proof/receipts/news-dead-sentiment-named.png): the chip says "sentiment read failed — unavailable, not neutral · retrying" while the wire renders normally beside it; before, the chip silently vanished, identical to a ticker with no sentiment row.

Remaining catch-null sites, dispositioned rather than swept: /youtube's ytAct is a WRITE lane (star/unstar) whose failure silently loses a shared write — its own audit finding, and any fix must respect the shell mirrors; /templates/sector-rotation.html's spark catches feed the E1 coverage gate (PARTIAL / NOT PROVIDER AUTHORITY — visibly gated); /templates/dcf.html's three FY-baseline catches keep the flagged static value and are counted per field in the badge; /cohorts' hub_favorites catch is the kept marker behind its named tooltip; sector-rotation-older is the retained rollback copy, left as-is.

Zero page errors.

---

## 2026-08-19T15:17:12Z — /pulse: a dead read no longer wears an empty table's words

Command: `PW_MODULE_DIR=… node browser-proof/proofs/pulse-failed-reads.mjs` (asserts inline; failures injected per page over the healthy rig)

- **vix_term dead, all else healthy** (browser-proof/receipts/pulse-vixterm-dead-beside-live-price.png): geiger counts and macro render normally, and the VIX section shows the live price BESIDE "vix_term did not answer · retrying" — the failure is named, the healthy half still speaks, and "no vix source" (the honest empty wording) never appears over a failure.
- **provider dead** (browser-proof/receipts/pulse-provider-dead-fails-closed.png): the shim fails its owned reads closed, so GEIGER and MACRO say their sources "did not answer — unavailable, not empty · retrying" in the failure style, while vix_term — never shim-owned — still answers with the /3M term ratio beside the dead-quotes marker. Before this unit, every one of these states rendered as "no composite_staged" / "no live_quotes": a dead read and an empty table were the same strip.

Zero page errors in both scenarios.

---

## 2026-08-19T15:17:21Z — the realtime lane tells the truth at every stage, on the vendored library

Command: `PW_MODULE_DIR=… node browser-proof/proofs/realtime-absence.mjs` (asserts inline)

- **Script absent** (browser-proof/receipts/realtime-absent-said-on-the-wall.png): with the vendored /_vendor/supabase-js blocked, the deck paints "RT · absent" beside #marketStatus with the reason, SC_REALTIME.available === false, the freshness lane untouched, nothing errors.
- **Script present — the REAL library** (browser-proof/receipts/realtime-channel-error-said.png): the vendored npm-verified bytes execute in the rig (typeof supabase.createClient === "function" — no stub), availability flips, and the channel state is honest about the offline rig ("connecting" or a terminal failure). The WIRED status callback — pinned in the equity-authority suite as the exact function the channel calls — is driven through CHANNEL_ERROR ("RT · not connected", reason in the title) and SUBSCRIBED (note hidden). "Available" no longer means merely "script present": the channel lifecycle is the lane's truth.

Rollback: revert the vendoring commit — the CDN tags return; behavior is otherwise unchanged.

---

## 2026-08-19T15:17:26Z — rig smoke + BEFORE state of the filed cohort defects

Command: `PW_MODULE_DIR=… node browser-proof/proofs/rig-smoke.mjs`

- Deck boots under fixtures with page errors: none.
- Scene select options: live, indexNow, indexLeadership, companyLeadership, focus2, macroCrossAsset, internalsFast, internalsSlow, sectorFamilies, themeFamilies, cohort, custom — **no cohort scene is reachable** (defects 1–2: AI_SOFTWARE / MEGACAP cannot replace the favorites-based rows because no cohort can be chosen at all; the legacy "cohort" id normalizes to themeFamilies).
- THEME FAMILIES renders NVDA, TSM, AVGO, ASML, MU, SNDK — the FIRST basket (AI COMPUTE); **AI POWER's declared rows are unreachable** (defect 3: familyBasket() is never given an id).
- Screenshots: browser-proof/receipts/rig-smoke-deck-live.png · browser-proof/receipts/before-themeFamilies-always-first-basket.png

---

## 2026-08-19T15:17:35Z — the preset scenes paint their declared rows: the first-basket class closed for every scene kind

Command: `PW_MODULE_DIR=… node browser-proof/proofs/scene-declared-rows.mjs` (asserts inline)

- **Fixed preset** (browser-proof/receipts/scene-macro-preset-declared-rows.png): /deck?scene=macroCrossAsset carries exactly US10Y · DXUSD · GCUSD · SIUSD · CLUSD · BTCUSD — the model's own frozen declaration, in order, at chartCount 6.
- **Time-windowed preset**: /deck?scene=indexNow's wall equals `indexNowTickersFor(new Date())` windowed by the model itself, compared IN the same browser at the same instant so the time dependence cancels — whatever the model declares for now is what the wall carries.
- With the cohort and family proofs of round 4, every scene KIND is now browser-proven to deliver its declared rows: fixed presets, time-windowed presets, cohort membership, family baskets. Also recorded from this sweep: /parity makes NO data reads at all (a static analysis page — authority-clean by construction).

Rollback: this unit adds a proof only; no served file changed.

---

## 2026-08-19T15:18:12Z — ticks, repaint and provider-vs-display, browser-verified; CLOSED-label disposition

Command: `PW_MODULE_DIR=… node browser-proof/proofs/tick-repaint.mjs` (asserts inline)

- **Provider-vs-display**: the chart's day change equals the exact quote the provider served — 0.29% for NVDA 347/346, then 9.83% after a tick to 380; the deck pane likewise (0.33% → 16.94%). No display number differs from the provider's arithmetic.
- **Ticks**: the standalone chart takes a changed provider quote within one 10s poll (browser-proof/receipts/tick-chart-updates-from-provider.png); a deck pane takes it within one 10s pump heartbeat through the authority shim (browser-proof/receipts/tick-deck-pane-updates-from-provider.png).
- **Repaint**: through a cold 1W range switch, 20 continuous canvas samples — zero blank frames; the previous paint stands until the next is ready (browser-proof/receipts/repaint-1W-no-blank.png).
- **Deck healthy state**: the header paints **LIVE** with all panes ready and stamped (browser-proof/receipts/deck-header-LIVE-healthy-state.png) — the state that threw `ReferenceError: delayed is not defined` before `06e4a0a`, now proven in a real browser.
- **CLOSED labels — disposition**: no market-session CLOSED label exists anywhere in this repository (searched all served HTML/JS, case-insensitive, including "closed", "session", market-hours patterns; the only matches are WebRTC connection states and prose). The filed "CLOSED despite live feed" defect lives in the separate scintilla-hub deploy, which this branch's standing locks forbid editing. Kept visible as a cross-repo defect in the handoff; not representable, therefore not claimed, here.

---

## 2026-08-19T15:18:15Z — /youtube: a lost shared write no longer stays painted as saved

Command: `PW_MODULE_DIR=… node browser-proof/proofs/yt-lost-write.mjs` (route /youtube/; three fixture youtube_feed rows, empty yt_watch_later; yt-act answered per page; asserts inline)

- **Write lost** (browser-proof/receipts/yt-star-lost-write-reverted.png): the star flips on optimistically, then REVERTS within one settle (DOM: `.sc-ytc__star` loses `is-on`; `ytWLGet().size === 0`), and the page's flash surface says "★ not saved — the shared watch-later write failed · try again" for long enough to read. Before this unit the failure was swallowed (`.then(r => r.json()).catch(() => null)`, result ignored): the star stayed painted "saved", the shared table never changed, and the lie stood until the next reconcile read.
- **Write landed** (browser-proof/receipts/yt-star-landed-write-stays.png): the star stays, `ytWLGet()` carries the id, no failure flash — success and failure are now different pictures.
- Success detection is a LANDED write only: non-2xx and error bodies resolve null (a 500 whose JSON parses is not a success).
- **Scope notes, measured in code**: the two mounted video shells already REVERT on this failure (state-honest) but stay reason-silent — recorded as a lesser gap, not repaired here, because their only failure surface today is the watch-list read lane and hijacking it would blank the list; their `subscribeToChannel` catch is the same state-honest/reason-silent shape. The 10s-cadence `ytPosPush` position write keeps its silent catch by design: positions re-push on cadence, so a lost write is retried by the next tick rather than lied about.

Zero page errors in both scenarios. Rollback: revert the single commit carrying this unit — the change is client-render behavior only (no schema, no endpoint, no authority change).

---

## 2026-08-19T15:18:48Z — rig smoke + BEFORE state of the filed cohort defects

Command: `PW_MODULE_DIR=… node browser-proof/proofs/rig-smoke.mjs`

- Deck boots under fixtures with page errors: none.
- Scene select options: live, indexNow, indexLeadership, companyLeadership, focus2, macroCrossAsset, internalsFast, internalsSlow, sectorFamilies, themeFamilies, cohort, custom — **no cohort scene is reachable** (defects 1–2: AI_SOFTWARE / MEGACAP cannot replace the favorites-based rows because no cohort can be chosen at all; the legacy "cohort" id normalizes to themeFamilies).
- THEME FAMILIES renders NVDA, TSM, AVGO, ASML, MU, SNDK — the FIRST basket (AI COMPUTE); **AI POWER's declared rows are unreachable** (defect 3: familyBasket() is never given an id).
- Screenshots: browser-proof/receipts/rig-smoke-deck-live.png · browser-proof/receipts/before-themeFamilies-always-first-basket.png

---

## 2026-08-19T15:19:24Z — the DCF FY baseline rides the history tables; the shortfall stays flagged

Command: `PW_MODULE_DIR=… node browser-proof/proofs/dcf-baseline.mjs` (fixture universe carries 8 of the 10 bar tickers; asserts inline)

- **Derived exactly** (browser-proof/receipts/dcf-fy-baseline-partial-overlay.png): NVDA's netDebt/D&A%/capex%/ΔNWC% in the running page equal the arithmetic over the fixture's own FY rows (net_debt in billions; D&A = ebitda − operating_income; capex sign normalized; ΔNWC over the same fiscal date).
- **The shortfall is worn, not hidden**: TSM and IREN are absent from the fixture universe, keep every Jul-24 static value, and the fy-baseline badge reads STALE with "netDebt 8/10 · D&A% 8/10 · capex% 8/10 · ΔNWC% 8/10" — a partial overlay never claims LIVE.
- **What has no DB source stays STATIC by name**: margin/tax defaults · MRP · debt weight, as-of the stated vintage.

Live field availability behind this unit was measured read-only the same day: all ten bar tickers carry complete latest-FY rows in balance_history/cashflow_history/fundamentals_history (balance_history carries net_debt directly), so on the real database the badge should read LIVE 10/10 — the rig's 8/10 is the fixture's own deliberate shape, not a claim about the owners' data.

Zero page errors.

---

## 2026-08-19T16:36:16Z — the watch-later lane tells the truth: unknown is said, lost writes say why

Command: `PW_MODULE_DIR=… node browser-proof/proofs/wl-truth.mjs` (page-level failure injection; asserts inline)

- **The mounted shell with the saved-list read DEAD** (browser-proof/receipts/shell-wl-read-dead-unknown.png): every card star paints the UNKNOWN "?" state ("watch-later state unknown — the saved-list read failed · a click retries the read"), zero cards claim saved-or-unsaved, and the bWatch button reads "watch later — state unknown" — a failed read is never data. A click on an unknown star retries the read and, still failing, flashes "★ unavailable — the saved-list read failed · nothing was changed" without flipping anything. The watch-later list itself paints "the watch-later read failed — the saved list is unavailable, not empty · retrying at the next refresh" (browser-proof/receipts/shell-wl-list-read-failed-named.png) — the old "YouTube reconnect required" wording, which named YouTube auth as the cause of a failed Supabase table read, is gone from the mounted shells and /pane-video (video-v1 keeps it: retained rollback, exempt by ruling).
- **The read lands, then a write is lost** (browser-proof/receipts/shell-wl-lost-write-said.png): the landed read paints exactly the saved video ★; a save click flips optimistically, the 500 settles, the flip REVERTS and the reason is said — "★ not saved — the shared watch-later write failed · try again". The shells used to revert silently; the gesture just vanished.
- **A lost subscribe says why**: "subscribe failed — the shared write did not land · try again" — the catch used to swallow it whole.
- **/youtube keeps the feed's own served flags** (browser-proof/receipts/youtube-wl-read-dead-feed-snapshot.png): the feed rows arrive with a server-side watch_later column — landed data. With the dedicated saved-list read dead, the flagged video KEEPS its star (it used to be zeroed by an empty page cache), the Watch Later chip wears a persistent "!" marker titled "the saved-list read failed — ★ rides the feed snapshot, not the saved list", and the failure is caught — before this unit it was an unhandled promise rejection.

Zero page errors in every scenario. Rollback: revert the single commit carrying this unit — said states, guards, pins and this proof; no data lane, authority or methodology changed; the rollback shell untouched.

---

## 2026-08-19T16:38:34Z — the authority sweep: eight equity surfaces, zero unreviewed hosts at runtime

Command: `PW_MODULE_DIR=… node browser-proof/proofs/authority-sweep.mjs` (asserts inline; no screenshots — the assertions ARE the evidence, regenerable)

/geiger/ · /heat/ · /cohort/ · /compare/ · /ticker/ · /wall/ · /analytics/ · /geigerwall/ — each loads over the rig with **zero page errors**, paints a real surface, and makes **zero requests to any non-owner host at all**: no Yahoo, no FMP, no CORS proxy, and — since the vendoring — no CDN either. A deliberate canary request to an unserved host must land in the refusal log, so a silent interception failure cannot fake a clean sweep.

This is the runtime half of the round-9 authority audit; the source half measured: zero Yahoo/FMP fetch lanes in served HTML outside sector-rotation's reviewed-relays-only flagged fallback (its third-party proxy lane was retired in F1's own fix, verified still absent); /health the only direct provider fetch (the ruled exception — /analytics's grep hit is banner prose); 20/20 shim-tag coverage on pages that read shim-owned tables (the remaining grep hits — /, /components — are prose descriptions, classified by eye).

---

## 2026-08-19T16:38:41Z — an empty FAV names itself, and the way out works

Command: `PW_MODULE_DIR=… node browser-proof/proofs/cohort-empty-fav.mjs` (hub_favorites answers zero rows — a successful empty read, not a failure)

- **The wall says why it is empty** (browser-proof/receipts/cohort-empty-fav-named.png): "no favorites yet — the wall is empty, not broken · choose a cohort or edit the slot", with the indicator counting "page 1 / 1 · 0 favorites". Before this unit the state rendered as one blank editable slot with no wording anywhere on the wall. The wording is gated on the read having landed: before COHORT_READY the count is not yet a fact, and the note does not claim it.
- **Choosing a cohort still replaces the (empty) favorites** (browser-proof/receipts/cohort-empty-fav-to-cohort.png): AI SOFTWARE fills the wall with its full declared membership (7 members) from the empty state.

Zero page errors.

---

## 2026-08-19T16:38:50Z — filed defects 1–2 FIXED and browser-verified: cohorts replace the favorites rows

Command: `PW_MODULE_DIR=… node browser-proof/proofs/cohort-scene.mjs` (asserts inline; a failed assertion fails the run)

- `/deck/?scene=cohort` lands on **FAV — MU, NBIS, SNDK** (the favorites rows, added order): browser-proof/receipts/cohort-FAV-favorites-rows.png
- Choosing **AI SOFTWARE** replaces them with **ADBE, CRM, MSFT, NOW, ORCL, PLTR** (page 1 / 2 · 7 members; no favorite present): browser-proof/receipts/cohort-AI_SOFTWARE-replaces-favorites.png
- Its page 2 pages honestly to **SNOW** alone: browser-proof/receipts/cohort-AI_SOFTWARE-page2.png
- Choosing **MEGACAP** replaces them with **AAPL, AMZN, GOOGL, META, MSFT, NVDA**: browser-proof/receipts/cohort-MEGACAP-replaces-favorites.png
- Choosing FAV again restores the favorites rows; zero page errors across the flow.

---

## 2026-08-19T16:38:57Z — the DCF FY baseline rides the history tables; the shortfall stays flagged

Command: `PW_MODULE_DIR=… node browser-proof/proofs/dcf-baseline.mjs` (fixture universe carries 8 of the 10 bar tickers; asserts inline)

- **Derived exactly** (browser-proof/receipts/dcf-fy-baseline-partial-overlay.png): NVDA's netDebt/D&A%/capex%/ΔNWC% in the running page equal the arithmetic over the fixture's own FY rows (net_debt in billions; D&A = ebitda − operating_income; capex sign normalized; ΔNWC over the same fiscal date).
- **The shortfall is worn, not hidden**: TSM and IREN are absent from the fixture universe, keep every Jul-24 static value, and the fy-baseline badge reads STALE with "netDebt 8/10 · D&A% 8/10 · capex% 8/10 · ΔNWC% 8/10" — a partial overlay never claims LIVE.
- **What has no DB source stays STATIC by name**: margin/tax defaults · MRP · debt weight, as-of the stated vintage.

Live field availability behind this unit was measured read-only the same day: all ten bar tickers carry complete latest-FY rows in balance_history/cashflow_history/fundamentals_history (balance_history carries net_debt directly), so on the real database the badge should read LIVE 10/10 — the rig's 8/10 is the fixture's own deliberate shape, not a claim about the owners' data.

Zero page errors.

---

## 2026-08-19T16:39:04Z — the DCF growth/margin slider seeds ride the FY history; the shortfall stays flagged

Command: `PW_MODULE_DIR=… node browser-proof/proofs/dcf-seeds.mjs` (route /templates/dcf.html, NVDA boot; fixture universe carries 8 of the 10 bar tickers; asserts inline)

- **Derived exactly and VISIBLE** (browser-proof/receipts/dcf-seeds-partial-overlay.png): NVDA's growth default equals the FY-to-FY revenue CAGR over the fixture's own rows and its margin default equals the latest FY's own margin — both land in TICKERS and on the sliders the user then owns (range inputs snap to their 0.5 step; asserted within one step). Clamps and window rules mirror the fundamentals cockpit: g 0..80, m 5..90, a CAGR needs two FY rows more than half a year apart.
- **The shortfall is worn, not hidden**: TSM and IREN are absent from the fixture universe and keep their Jul-24 static seeds; the fy-seeds badge reads STALE with "growth default 8/10 · EBITDA-margin default 8/10" — a partial overlay never claims LIVE.
- **What has no DB source stays STATIC by name**: tax default · terminal growth · MRP · debt weight (fundamentals_history carries no tax line — measured schema, round 5) — the static-baseline badge and the as-of bar both say so.

Zero page errors. Rollback: revert the single commit carrying this unit — seed derivation and badge wording only; the DCF formulas, price authority and Geiger methodology are untouched, and no provider history was written or deleted.

---

## 2026-08-19T16:39:23Z — degraded states, photographed: absence renders as absence

Command: `PW_MODULE_DIR=… node browser-proof/proofs/degraded-states.mjs` (asserts inline; failures injected per page over the healthy rig)

- **/health, provider dead** (browser-proof/receipts/degraded-health-provider-dead.png): all three equity lanes fail with the failure word; the database lanes still answer beside them (the fixture roster carries rows the way the live tables do); the internals lane stays BAD by construction — the fixtures deliberately carry ZERO rows for ADD/PCC/CUMTICK/TICK/TRIN, mirroring their measured live state.
- **/health, Supabase dead** (browser-proof/receipts/degraded-health-supabase-dead.png): provider quotes still answer, and the universe row fails CLOSED — "identity unverified — canonical set unreadable; count alone is not identity" — while the roster lane says "none readable" (a member that cannot be read is not a healthy member).
- **/allocation, every voter dead** (browser-proof/receipts/degraded-allocation-no-voters.png): header UNAVAILABLE — NO VOTER ANSWERED, heat —, targets and moves UNAVAILABLE, the trace declines to narrate, the ranking says "no candidate carries an accepted composite" and lists the unscored names. No fabricated NEUTRAL anywhere. **This scenario caught a real defect the source pin could not**: the cohort table's empty-state message sat behind `html || fallback`, but `html` always carries the header row, so the promised message was unreachable — zero ranked rows painted a bare header (an empty panel where a named absence was promised). Fixed by deciding emptiness on the raw row count; the COMPARABLES table had the same dead gate (its old fallback even named a state that cannot occur, since dropped rows stay rendered greyed-out) — both now append the named absence under the kept header.
- **/fundamentals, provider quotes dead** (browser-proof/receipts/degraded-fundamentals-quotes-dead.png): the header and banner state the missing price; valuation is disabled and STAYS disabled through a slider drag (the render-time gate, exercised in a real browser); the universe and fundamentals sections load normally around it. Also fixed in this unit: the page's boot had no catch, so a cold provider outage used to stop the whole page from booting with no banner at all — the universe failure now paints where the universe status lives and the ticker sections still load.

Zero page errors across all four scenarios.

---

## 2026-08-19T16:39:33Z — the catch-null sweep, browser-verified: failures render as failures

Command: `PW_MODULE_DIR=… node browser-proof/proofs/failed-reads.mjs` (board_rsi and earnings_events forced to 500; asserts inline)

- **/ranks**: the RSI column says "board_rsi did not answer — this ranking is unavailable, not empty · retrying", with zero per-ticker "no data" claims; the healthy CHG column still ranks beside it: browser-proof/receipts/failed-read-ranks-rsi-column.png
- **/events**: the calendar says the read failed — "unavailable, not clear" / "unavailable, not absent" — instead of "nothing scheduled in the next 14 days": browser-proof/receipts/failed-read-events-calendar.png
- **/reflow**: the field refuses to draw grey non-answers over a failure and names the failed source: browser-proof/receipts/failed-read-reflow-rsi.png
- /cohorts' FAV chip now carries the failure in its tooltip when hub_favorites dies (source-pinned in tests; the chip still navigates).

---

## 2026-08-19T16:39:45Z — filed defect 3 FIXED and browser-verified: AI POWER shows its declared rows

Command: `PW_MODULE_DIR=… node browser-proof/proofs/family-scene.mjs` (asserts inline)

- THEME FAMILIES defaults unchanged (AI COMPUTE: NVDA, TSM, AVGO, ASML, MU, SNDK); the family picker is visible on family scenes and hidden elsewhere.
- Choosing **AI POWER** renders exactly its declared rows — **OKLO, IREN, CIFR, BE, WULF, USAR**: browser-proof/receipts/family-AI_POWER-declared-rows.png
- The choice survives leaving and re-entering the scene (session memory).
- SECTOR FAMILIES' **DEFENSIVE** basket is reachable the same way: browser-proof/receipts/family-DEFENSIVE-declared-rows.png
- Zero page errors across the flow.

---

## 2026-08-19T16:39:58Z — /fundamentals: absent balance fields are flagged by name, not minted into net debt

Command: `PW_MODULE_DIR=… node browser-proof/proofs/fy-consistency.mjs` (route /templates/fundamentals.html, NVDA; balance_history answered per page; asserts inline)

- **total_debt NULL** (browser-proof/receipts/fundamentals-null-debt-flagged.png): the flags line says "balance_history.total_debt is null — net debt treats debt as 0 and WACC as all-equity; fair value is OVERSTATED if this name carries debt". Before this unit, `(b.total_debt||0)-(b.cash_and_equiv||0)` silently valued every such ticker debt-free — a missing balance row produced zero net debt, an all-equity WACC, and no sign anywhere.
- **Complete balance row** (browser-proof/receipts/fundamentals-complete-balance-no-flag.png): no absence flag, valuation renders normally — the flag appears exactly when the absence does.
- The same unit aligned buildBase's ratio windows with the rule the DCF FY baseline enforces: D&A% and capex% denominators now come from the SAME rows as their numerators (the same 4 quarters, or the same single FY — a mismatched FY pair keeps the flagged default rather than a cross-year ratio; an offset cashflow-vs-income quarter window is flagged out loud). fundamentals.revenue_ttm stays the projection BASE — currency there, consistency in ratios. A terminally underivable share count is flagged "NOT meaningful" instead of silently dividing by a 1B placeholder. Functional pins drive every case in tests/station-fundamentals-price.test.mjs.

Zero page errors in both scenarios. Rollback: revert the single commit carrying this unit — derivation and flag wording only; no schema, no authority, no methodology change (the DCF formulas are untouched; only the window selection and absence visibility moved).

---

## 2026-08-19T16:40:05Z — the Hub entry: the live path's exact refusal, and the deck booting AT the hub origin

Command: `PW_MODULE_DIR=… node browser-proof/proofs/hub-entry.mjs` (rules parsed from vercel.json itself; asserts inline)

- **Live path, measured in the browser** (browser-proof/receipts/hub-entry-live-path-refused.png): Chromium pointed at https://station.scintillahub.ai/ through the environment's proxy fails with `page.goto: net::ERR_TUNNEL_CONNECTION_FAILED at https://station.scintillahub.ai/` — the CONNECT is refused before TLS begins, so nothing was bypassed and nothing live was reached or faked. The PREVIEW host gets the same measurement (browser-proof/receipts/hub-entry-preview-refused.png): `page.goto: net::ERR_TUNNEL_CONNECTION_FAILED at https://scintilla-widgets-git-cla-070619-aharveyrianhard-8432s-projects.vercel.app/deck/` — the branch's own deploy is equally unreachable from here, which is exactly the live-acceptance blocker the handoff carries. This is the browser-level twin of round 7's curl measurement: live acceptance still requires a browser outside this container.
- **The deck boots at the hub origin under the config's own rules** (browser-proof/receipts/hub-entry-deck-boots-at-hub-origin.png): navigating to https://station.scintillahub.ai/ with vercel.json's parsed rewrites applied over the rig serves the Station AT the hub host — title, StationScenes, the provider shim, the cohort axis and the mounted panes all up, location.host still the hub. ZERO asset 404s: every /deck dependency is absolute-pathed, so the root rewrite (source "/" only) breaks nothing — proven by outcome in a real browser, not by grep. The no-store cache rule rides every response, as pinned from the config.
- The config itself is pinned in tests/station-route-inventory.test.mjs: exactly two rewrites (hub root → /deck/, /status → orgstatus), no-store at all three cache layers.

This is stubbed-data page proof at the true hub ORIGIN — it verifies the entry path and the deck's behavior under the rewrite, not the live owners' data. Rollback: revert the single commit carrying this unit — proof, pin and receipts only; no served file changed.

---

## 2026-08-19T16:41:38Z — the inventory sweep: runtime coverage completed, and the LINES panel says its library is dead

Command: `PW_MODULE_DIR=… node browser-proof/proofs/inventory-sweep.mjs` (asserts inline; one screenshot for the found defect)

- **33 remaining surfaces loaded clean** — entry, ops, market (/parity), media, the visuals lab, the standalone spec pages: zero page errors, real painted surfaces, zero requests outside each page's CLASS allowance (data lanes: the two owners only; media-mounting pages: YouTube embed hosts; the retained rollback sector-rotation-older: its reviewed hub relay + its legacy unpkg tag, exempt by ruling — no other page touches a CDN since the vendoring). Together with authority-sweep.mjs and the per-page proofs, EVERY served surface in the route inventory has now been loaded at least once under authority assertions — except the X lane, excluded because H2 is proof-gated (the bridge draft's offscreen document is recorded as throwing outside its extension context; its guard waits behind the same gate).
- **The found defect, proven fixed on the vendored library** (browser-proof/receipts/sector-lines-cdn-dead-said.png): with the same-origin /_vendor lightweight-charts script blocked, the LINES panel SAYS "lightweight-charts (vendored same-origin) did not load — unavailable, not empty; every other panel is unaffected", the chart calls are guarded, and leaders/heatmap still follow a range click with the library dead — zero page errors before and after. (The healthy load — the vendored library actually executing — is covered by the sweep above.)

Rollback: revert the single commit carrying this unit — a said state, guards, pins and this proof; no data lane, authority or methodology changed; the rollback copy untouched.

---

## 2026-08-19T16:41:55Z — /news and /cohorts main reads: named when never loaded, STALE-stamped when they die mid-life

Command: `PW_MODULE_DIR=… node browser-proof/proofs/main-read-failure.mjs` (forced 500s; mid-life failures injected by re-routing after a healthy load and invoking the page's own tick(); asserts inline)

- **/news never loads** (browser-proof/receipts/news-main-read-never-loaded.png): "the news read failed — the wire is unavailable, not empty · retrying at the next refresh" — named and distinct from the empty-filter wording; the old boot catch said only "news unavailable".
- **/news dies after a healthy load** (browser-proof/receipts/news-refresh-failed-stale-stamp.png): the held headlines STAY (a failed read never erases knowledge) and the freshness line says "REFRESH FAILED — showing the read from Xs ago — the news read is failing, the list below is stale · retrying". Before, the interval catch was silent: the list froze with a "newest Xm ago" stamp that became false as time passed.
- **/cohorts never loads** (browser-proof/receipts/cohorts-main-read-never-loaded.png): the strip names the failed source ("the ticker_cohorts read failed — …"), not "cohort data unavailable".
- **/cohorts dies after a healthy load** (browser-proof/receipts/cohorts-refresh-failed-stale-marker.png): every chip is kept and a visible marker appends — "refresh failed (ticker_cohorts) — these chips are stale · retrying" — cleared naturally by the next successful rebuild.

Zero page errors across all four scenarios. Rollback: revert the single commit carrying this unit — render wording and failure-state plumbing only; queries, authorities and refresh cadences untouched.

---

## 2026-08-19T16:42:07Z — /econ, /alerts, /news: dead reads named; empty tables keep their own words

Command: `PW_MODULE_DIR=… node browser-proof/proofs/panel-failed-reads.mjs` (forced 500s per page over the healthy rig; asserts inline)

These three pages still carried the catch(() => null) flattening the round-4 sweep removed elsewhere — found by re-measuring the repo instead of trusting the earlier "swept" claim (the unit pins only banned the spaced spelling, so the unspaced form survived the audit).

- **/econ, empty tables** (browser-proof/receipts/econ-empty-tables-empty-words.png): the fixture's honest empty state — "econ_dashboard has no rows" and "no calendar rows for this filter", no failure words anywhere.
- **/econ, both reads dead** (browser-proof/receipts/econ-dead-reads-named.png): the tiles and the calendar each name their failed source and the retry; the empty-filter claim never appears over a failure. Before: a dead dashboard read was a BLANK strip and a dead calendar read claimed "no calendar rows for this filter".
- **/alerts, both reads dead** (browser-proof/receipts/alerts-dead-reads-named.png): feed health and ticker alerts say "unavailable, not quiet · retrying" — a dead read no longer impersonates a quiet feed.
- **/news, sentiment dead** (browser-proof/receipts/news-dead-sentiment-named.png): the chip says "sentiment read failed — unavailable, not neutral · retrying" while the wire renders normally beside it; before, the chip silently vanished, identical to a ticker with no sentiment row.

Remaining catch-null sites, dispositioned rather than swept: /youtube's ytAct is a WRITE lane (star/unstar) whose failure silently loses a shared write — its own audit finding, and any fix must respect the shell mirrors; /templates/sector-rotation.html's spark catches feed the E1 coverage gate (PARTIAL / NOT PROVIDER AUTHORITY — visibly gated); /templates/dcf.html's three FY-baseline catches keep the flagged static value and are counted per field in the badge; /cohorts' hub_favorites catch is the kept marker behind its named tooltip; sector-rotation-older is the retained rollback copy, left as-is.

Zero page errors.

---

## 2026-08-19T16:42:17Z — /pulse: a dead read no longer wears an empty table's words

Command: `PW_MODULE_DIR=… node browser-proof/proofs/pulse-failed-reads.mjs` (asserts inline; failures injected per page over the healthy rig)

- **vix_term dead, all else healthy** (browser-proof/receipts/pulse-vixterm-dead-beside-live-price.png): geiger counts and macro render normally, and the VIX section shows the live price BESIDE "vix_term did not answer · retrying" — the failure is named, the healthy half still speaks, and "no vix source" (the honest empty wording) never appears over a failure.
- **provider dead** (browser-proof/receipts/pulse-provider-dead-fails-closed.png): the shim fails its owned reads closed, so GEIGER and MACRO say their sources "did not answer — unavailable, not empty · retrying" in the failure style, while vix_term — never shim-owned — still answers with the /3M term ratio beside the dead-quotes marker. Before this unit, every one of these states rendered as "no composite_staged" / "no live_quotes": a dead read and an empty table were the same strip.

Zero page errors in both scenarios.

---

## 2026-08-19T16:42:26Z — the realtime lane tells the truth at every stage, on the vendored library

Command: `PW_MODULE_DIR=… node browser-proof/proofs/realtime-absence.mjs` (asserts inline)

- **Script absent** (browser-proof/receipts/realtime-absent-said-on-the-wall.png): with the vendored /_vendor/supabase-js blocked, the deck paints "RT · absent" beside #marketStatus with the reason, SC_REALTIME.available === false, the freshness lane untouched, nothing errors.
- **Script present — the REAL library** (browser-proof/receipts/realtime-channel-error-said.png): the vendored npm-verified bytes execute in the rig (typeof supabase.createClient === "function" — no stub), availability flips, and the channel state is honest about the offline rig ("connecting" or a terminal failure). The WIRED status callback — pinned in the equity-authority suite as the exact function the channel calls — is driven through CHANNEL_ERROR ("RT · not connected", reason in the title) and SUBSCRIBED (note hidden). "Available" no longer means merely "script present": the channel lifecycle is the lane's truth.

Rollback: revert the vendoring commit — the CDN tags return; behavior is otherwise unchanged.

---

## 2026-08-19T16:42:30Z — rig smoke + BEFORE state of the filed cohort defects

Command: `PW_MODULE_DIR=… node browser-proof/proofs/rig-smoke.mjs`

- Deck boots under fixtures with page errors: none.
- Scene select options: live, indexNow, indexLeadership, companyLeadership, focus2, macroCrossAsset, internalsFast, internalsSlow, sectorFamilies, themeFamilies, cohort, custom — **no cohort scene is reachable** (defects 1–2: AI_SOFTWARE / MEGACAP cannot replace the favorites-based rows because no cohort can be chosen at all; the legacy "cohort" id normalizes to themeFamilies).
- THEME FAMILIES renders NVDA, TSM, AVGO, ASML, MU, SNDK — the FIRST basket (AI COMPUTE); **AI POWER's declared rows are unreachable** (defect 3: familyBasket() is never given an id).
- Screenshots: browser-proof/receipts/rig-smoke-deck-live.png · browser-proof/receipts/before-themeFamilies-always-first-basket.png

---

## 2026-08-19T16:42:39Z — the preset scenes paint their declared rows: the first-basket class closed for every scene kind

Command: `PW_MODULE_DIR=… node browser-proof/proofs/scene-declared-rows.mjs` (asserts inline)

- **Fixed preset** (browser-proof/receipts/scene-macro-preset-declared-rows.png): /deck?scene=macroCrossAsset carries exactly US10Y · DXUSD · GCUSD · SIUSD · CLUSD · BTCUSD — the model's own frozen declaration, in order, at chartCount 6.
- **Time-windowed preset**: /deck?scene=indexNow's wall equals `indexNowTickersFor(new Date())` windowed by the model itself, compared IN the same browser at the same instant so the time dependence cancels — whatever the model declares for now is what the wall carries.
- With the cohort and family proofs of round 4, every scene KIND is now browser-proven to deliver its declared rows: fixed presets, time-windowed presets, cohort membership, family baskets. Also recorded from this sweep: /parity makes NO data reads at all (a static analysis page — authority-clean by construction).

Rollback: this unit adds a proof only; no served file changed.

---

## 2026-08-19T16:43:17Z — ticks, repaint and provider-vs-display, browser-verified; CLOSED-label disposition

Command: `PW_MODULE_DIR=… node browser-proof/proofs/tick-repaint.mjs` (asserts inline)

- **Provider-vs-display**: the chart's day change equals the exact quote the provider served — 0.29% for NVDA 347/346, then 9.83% after a tick to 380; the deck pane likewise (0.33% → 16.94%). No display number differs from the provider's arithmetic.
- **Ticks**: the standalone chart takes a changed provider quote within one 10s poll (browser-proof/receipts/tick-chart-updates-from-provider.png); a deck pane takes it within one 10s pump heartbeat through the authority shim (browser-proof/receipts/tick-deck-pane-updates-from-provider.png).
- **Repaint**: through a cold 1W range switch, 20 continuous canvas samples — zero blank frames; the previous paint stands until the next is ready (browser-proof/receipts/repaint-1W-no-blank.png).
- **Deck healthy state**: the header paints **LIVE** with all panes ready and stamped (browser-proof/receipts/deck-header-LIVE-healthy-state.png) — the state that threw `ReferenceError: delayed is not defined` before `06e4a0a`, now proven in a real browser.
- **CLOSED labels — disposition**: no market-session CLOSED label exists anywhere in this repository (searched all served HTML/JS, case-insensitive, including "closed", "session", market-hours patterns; the only matches are WebRTC connection states and prose). The filed "CLOSED despite live feed" defect lives in the separate scintilla-hub deploy, which this branch's standing locks forbid editing. Kept visible as a cross-repo defect in the handoff; not representable, therefore not claimed, here.

---

## 2026-08-19T16:43:37Z — the watch-later lane tells the truth: unknown is said, lost writes say why

Command: `PW_MODULE_DIR=… node browser-proof/proofs/wl-truth.mjs` (page-level failure injection; asserts inline)

- **The mounted shell with the saved-list read DEAD** (browser-proof/receipts/shell-wl-read-dead-unknown.png): every card star paints the UNKNOWN "?" state ("watch-later state unknown — the saved-list read failed · a click retries the read"), zero cards claim saved-or-unsaved, and the bWatch button reads "watch later — state unknown" — a failed read is never data. A click on an unknown star retries the read and, still failing, flashes "★ unavailable — the saved-list read failed · nothing was changed" without flipping anything. The watch-later list itself paints "the watch-later read failed — the saved list is unavailable, not empty · retrying at the next refresh" (browser-proof/receipts/shell-wl-list-read-failed-named.png) — the old "YouTube reconnect required" wording, which named YouTube auth as the cause of a failed Supabase table read, is gone from the mounted shells and /pane-video (video-v1 keeps it: retained rollback, exempt by ruling).
- **The read lands, then a write is lost** (browser-proof/receipts/shell-wl-lost-write-said.png): the landed read paints exactly the saved video ★; a save click flips optimistically, the 500 settles, the flip REVERTS and the reason is said — "★ not saved — the shared watch-later write failed · try again". The shells used to revert silently; the gesture just vanished.
- **A lost subscribe says why**: "subscribe failed — the shared write did not land · try again" — the catch used to swallow it whole.
- **/youtube keeps the feed's own served flags** (browser-proof/receipts/youtube-wl-read-dead-feed-snapshot.png): the feed rows arrive with a server-side watch_later column — landed data. With the dedicated saved-list read dead, the flagged video KEEPS its star (it used to be zeroed by an empty page cache), the Watch Later chip wears a persistent "!" marker titled "the saved-list read failed — ★ rides the feed snapshot, not the saved list", and the failure is caught — before this unit it was an unhandled promise rejection.

Zero page errors in every scenario. Rollback: revert the single commit carrying this unit — said states, guards, pins and this proof; no data lane, authority or methodology changed; the rollback shell untouched.

---

## 2026-08-19T16:43:41Z — /youtube: a lost shared write no longer stays painted as saved

Command: `PW_MODULE_DIR=… node browser-proof/proofs/yt-lost-write.mjs` (route /youtube/; three fixture youtube_feed rows, empty yt_watch_later; yt-act answered per page; asserts inline)

- **Write lost** (browser-proof/receipts/yt-star-lost-write-reverted.png): the star flips on optimistically, then REVERTS within one settle (DOM: `.sc-ytc__star` loses `is-on`; `ytWLGet().size === 0`), and the page's flash surface says "★ not saved — the shared watch-later write failed · try again" for long enough to read. Before this unit the failure was swallowed (`.then(r => r.json()).catch(() => null)`, result ignored): the star stayed painted "saved", the shared table never changed, and the lie stood until the next reconcile read.
- **Write landed** (browser-proof/receipts/yt-star-landed-write-stays.png): the star stays, `ytWLGet()` carries the id, no failure flash — success and failure are now different pictures.
- Success detection is a LANDED write only: non-2xx and error bodies resolve null (a 500 whose JSON parses is not a success).
- **Scope notes, measured in code**: the two mounted video shells already REVERT on this failure (state-honest) but stay reason-silent — recorded as a lesser gap, not repaired here, because their only failure surface today is the watch-list read lane and hijacking it would blank the list; their `subscribeToChannel` catch is the same state-honest/reason-silent shape. The 10s-cadence `ytPosPush` position write keeps its silent catch by design: positions re-push on cadence, so a lost write is retried by the next tick rather than lied about.

Zero page errors in both scenarios. Rollback: revert the single commit carrying this unit — the change is client-render behavior only (no schema, no endpoint, no authority change).

---

## 2026-08-19T16:54:32Z — a failed main read never claims the owner's absence: /youtube's feed fixed, the axis consumers photographed

Command: `PW_MODULE_DIR=… node browser-proof/proofs/feed-truth.mjs` (page-level failure injection; asserts inline)

- **/youtube, feed read DEAD** (browser-proof/receipts/youtube-feed-read-failed-said.png): the grid paints "youtube feed · read failed — the wire is unavailable, not empty · retrying at the next pass" — and does NOT paint "the youtube_feed table is empty" or blame the ingester. Before this unit the catch painted exactly those words for any transport failure: the owner's absence claimed off a read that never landed (rule 1 + rule 2 in one sentence). Zero page errors.
- **/youtube, feed read LANDED empty** (browser-proof/receipts/youtube-feed-landed-empty-owner-absence.png): the owner's wording survives — "awaiting feed — the youtube_feed table is empty; cards fill per video when the ingester lands" — because off a landed zero-row read that claim is now TRUE (rule 4: emptiness decided on the raw value).
- **The axis-consumer sweep's runtime half** (browser-proof/receipts/cohort-axis-dead-named.png, browser-proof/receipts/geigerwall-axis-dead-named.png): with `ticker_cohorts` dead at the page, /cohort boots to "cohort data unavailable" and /geigerwall to "cohort data unavailable — wall cannot compose", both with zero page errors — the last two of the ten SC_COHORT_AXIS consumers whose failure paint had never been photographed. The other eight were re-read this round: all answer a boot failure with a named state (analytics counts the axis as a feed and stamps COHORT AXIS FAILED; events refuses with the message; heat paints the COHORT HOMES UNAVAILABLE group; compare's init catch names the database; allocation's spine goes FALLBACK by name; fundamentals converts the flag to a throw under its boot guard; deck and the cohorts strip were fixed in earlier rounds).

Rollback: revert the single commit carrying this unit — one flag, one two-sentence branch, pins and this proof; no data lane, authority or methodology changed.

---

## 2026-08-19T16:55:45Z — the authority sweep: eight equity surfaces, zero unreviewed hosts at runtime

Command: `PW_MODULE_DIR=… node browser-proof/proofs/authority-sweep.mjs` (asserts inline; no screenshots — the assertions ARE the evidence, regenerable)

/geiger/ · /heat/ · /cohort/ · /compare/ · /ticker/ · /wall/ · /analytics/ · /geigerwall/ — each loads over the rig with **zero page errors**, paints a real surface, and makes **zero requests to any non-owner host at all**: no Yahoo, no FMP, no CORS proxy, and — since the vendoring — no CDN either. A deliberate canary request to an unserved host must land in the refusal log, so a silent interception failure cannot fake a clean sweep.

This is the runtime half of the round-9 authority audit; the source half measured: zero Yahoo/FMP fetch lanes in served HTML outside sector-rotation's reviewed-relays-only flagged fallback (its third-party proxy lane was retired in F1's own fix, verified still absent); /health the only direct provider fetch (the ruled exception — /analytics's grep hit is banner prose); 20/20 shim-tag coverage on pages that read shim-owned tables (the remaining grep hits — /, /components — are prose descriptions, classified by eye).

---

## 2026-08-19T16:55:52Z — an empty FAV names itself, and the way out works

Command: `PW_MODULE_DIR=… node browser-proof/proofs/cohort-empty-fav.mjs` (hub_favorites answers zero rows — a successful empty read, not a failure)

- **The wall says why it is empty** (browser-proof/receipts/cohort-empty-fav-named.png): "no favorites yet — the wall is empty, not broken · choose a cohort or edit the slot", with the indicator counting "page 1 / 1 · 0 favorites". Before this unit the state rendered as one blank editable slot with no wording anywhere on the wall. The wording is gated on the read having landed: before COHORT_READY the count is not yet a fact, and the note does not claim it.
- **Choosing a cohort still replaces the (empty) favorites** (browser-proof/receipts/cohort-empty-fav-to-cohort.png): AI SOFTWARE fills the wall with its full declared membership (7 members) from the empty state.

Zero page errors.

---

## 2026-08-19T16:56:01Z — filed defects 1–2 FIXED and browser-verified: cohorts replace the favorites rows

Command: `PW_MODULE_DIR=… node browser-proof/proofs/cohort-scene.mjs` (asserts inline; a failed assertion fails the run)

- `/deck/?scene=cohort` lands on **FAV — MU, NBIS, SNDK** (the favorites rows, added order): browser-proof/receipts/cohort-FAV-favorites-rows.png
- Choosing **AI SOFTWARE** replaces them with **ADBE, CRM, MSFT, NOW, ORCL, PLTR** (page 1 / 2 · 7 members; no favorite present): browser-proof/receipts/cohort-AI_SOFTWARE-replaces-favorites.png
- Its page 2 pages honestly to **SNOW** alone: browser-proof/receipts/cohort-AI_SOFTWARE-page2.png
- Choosing **MEGACAP** replaces them with **AAPL, AMZN, GOOGL, META, MSFT, NVDA**: browser-proof/receipts/cohort-MEGACAP-replaces-favorites.png
- Choosing FAV again restores the favorites rows; zero page errors across the flow.

---

## 2026-08-19T16:56:08Z — the DCF FY baseline rides the history tables; the shortfall stays flagged

Command: `PW_MODULE_DIR=… node browser-proof/proofs/dcf-baseline.mjs` (fixture universe carries 8 of the 10 bar tickers; asserts inline)

- **Derived exactly** (browser-proof/receipts/dcf-fy-baseline-partial-overlay.png): NVDA's netDebt/D&A%/capex%/ΔNWC% in the running page equal the arithmetic over the fixture's own FY rows (net_debt in billions; D&A = ebitda − operating_income; capex sign normalized; ΔNWC over the same fiscal date).
- **The shortfall is worn, not hidden**: TSM and IREN are absent from the fixture universe, keep every Jul-24 static value, and the fy-baseline badge reads STALE with "netDebt 8/10 · D&A% 8/10 · capex% 8/10 · ΔNWC% 8/10" — a partial overlay never claims LIVE.
- **What has no DB source stays STATIC by name**: margin/tax defaults · MRP · debt weight, as-of the stated vintage.

Live field availability behind this unit was measured read-only the same day: all ten bar tickers carry complete latest-FY rows in balance_history/cashflow_history/fundamentals_history (balance_history carries net_debt directly), so on the real database the badge should read LIVE 10/10 — the rig's 8/10 is the fixture's own deliberate shape, not a claim about the owners' data.

Zero page errors.

---

## 2026-08-19T16:56:15Z — the DCF growth/margin slider seeds ride the FY history; the shortfall stays flagged

Command: `PW_MODULE_DIR=… node browser-proof/proofs/dcf-seeds.mjs` (route /templates/dcf.html, NVDA boot; fixture universe carries 8 of the 10 bar tickers; asserts inline)

- **Derived exactly and VISIBLE** (browser-proof/receipts/dcf-seeds-partial-overlay.png): NVDA's growth default equals the FY-to-FY revenue CAGR over the fixture's own rows and its margin default equals the latest FY's own margin — both land in TICKERS and on the sliders the user then owns (range inputs snap to their 0.5 step; asserted within one step). Clamps and window rules mirror the fundamentals cockpit: g 0..80, m 5..90, a CAGR needs two FY rows more than half a year apart.
- **The shortfall is worn, not hidden**: TSM and IREN are absent from the fixture universe and keep their Jul-24 static seeds; the fy-seeds badge reads STALE with "growth default 8/10 · EBITDA-margin default 8/10" — a partial overlay never claims LIVE.
- **What has no DB source stays STATIC by name**: tax default · terminal growth · MRP · debt weight (fundamentals_history carries no tax line — measured schema, round 5) — the static-baseline badge and the as-of bar both say so.

Zero page errors. Rollback: revert the single commit carrying this unit — seed derivation and badge wording only; the DCF formulas, price authority and Geiger methodology are untouched, and no provider history was written or deleted.

---

## 2026-08-19T16:56:34Z — degraded states, photographed: absence renders as absence

Command: `PW_MODULE_DIR=… node browser-proof/proofs/degraded-states.mjs` (asserts inline; failures injected per page over the healthy rig)

- **/health, provider dead** (browser-proof/receipts/degraded-health-provider-dead.png): all three equity lanes fail with the failure word; the database lanes still answer beside them (the fixture roster carries rows the way the live tables do); the internals lane stays BAD by construction — the fixtures deliberately carry ZERO rows for ADD/PCC/CUMTICK/TICK/TRIN, mirroring their measured live state.
- **/health, Supabase dead** (browser-proof/receipts/degraded-health-supabase-dead.png): provider quotes still answer, and the universe row fails CLOSED — "identity unverified — canonical set unreadable; count alone is not identity" — while the roster lane says "none readable" (a member that cannot be read is not a healthy member).
- **/allocation, every voter dead** (browser-proof/receipts/degraded-allocation-no-voters.png): header UNAVAILABLE — NO VOTER ANSWERED, heat —, targets and moves UNAVAILABLE, the trace declines to narrate, the ranking says "no candidate carries an accepted composite" and lists the unscored names. No fabricated NEUTRAL anywhere. **This scenario caught a real defect the source pin could not**: the cohort table's empty-state message sat behind `html || fallback`, but `html` always carries the header row, so the promised message was unreachable — zero ranked rows painted a bare header (an empty panel where a named absence was promised). Fixed by deciding emptiness on the raw row count; the COMPARABLES table had the same dead gate (its old fallback even named a state that cannot occur, since dropped rows stay rendered greyed-out) — both now append the named absence under the kept header.
- **/fundamentals, provider quotes dead** (browser-proof/receipts/degraded-fundamentals-quotes-dead.png): the header and banner state the missing price; valuation is disabled and STAYS disabled through a slider drag (the render-time gate, exercised in a real browser); the universe and fundamentals sections load normally around it. Also fixed in this unit: the page's boot had no catch, so a cold provider outage used to stop the whole page from booting with no banner at all — the universe failure now paints where the universe status lives and the ticker sections still load.

Zero page errors across all four scenarios.

---

## 2026-08-19T16:56:44Z — the catch-null sweep, browser-verified: failures render as failures

Command: `PW_MODULE_DIR=… node browser-proof/proofs/failed-reads.mjs` (board_rsi and earnings_events forced to 500; asserts inline)

- **/ranks**: the RSI column says "board_rsi did not answer — this ranking is unavailable, not empty · retrying", with zero per-ticker "no data" claims; the healthy CHG column still ranks beside it: browser-proof/receipts/failed-read-ranks-rsi-column.png
- **/events**: the calendar says the read failed — "unavailable, not clear" / "unavailable, not absent" — instead of "nothing scheduled in the next 14 days": browser-proof/receipts/failed-read-events-calendar.png
- **/reflow**: the field refuses to draw grey non-answers over a failure and names the failed source: browser-proof/receipts/failed-read-reflow-rsi.png
- /cohorts' FAV chip now carries the failure in its tooltip when hub_favorites dies (source-pinned in tests; the chip still navigates).

---

## 2026-08-19T16:56:54Z — the inventory sweep: runtime coverage completed, and the LINES panel says its library is dead

Command: `PW_MODULE_DIR=… node browser-proof/proofs/inventory-sweep.mjs` (asserts inline; one screenshot for the found defect)

- **33 remaining surfaces loaded clean** — entry, ops, market (/parity), media, the visuals lab, the standalone spec pages: zero page errors, real painted surfaces, zero requests outside each page's CLASS allowance (data lanes: the two owners only; media-mounting pages: YouTube embed hosts; the retained rollback sector-rotation-older: its reviewed hub relay + its legacy unpkg tag, exempt by ruling — no other page touches a CDN since the vendoring). Together with authority-sweep.mjs and the per-page proofs, EVERY served surface in the route inventory has now been loaded at least once under authority assertions — except the X lane, excluded because H2 is proof-gated (the bridge draft's offscreen document is recorded as throwing outside its extension context; its guard waits behind the same gate).
- **The found defect, proven fixed on the vendored library** (browser-proof/receipts/sector-lines-cdn-dead-said.png): with the same-origin /_vendor lightweight-charts script blocked, the LINES panel SAYS "lightweight-charts (vendored same-origin) did not load — unavailable, not empty; every other panel is unaffected", the chart calls are guarded, and leaders/heatmap still follow a range click with the library dead — zero page errors before and after. (The healthy load — the vendored library actually executing — is covered by the sweep above.)

Rollback: revert the single commit carrying this unit — a said state, guards, pins and this proof; no data lane, authority or methodology changed; the rollback copy untouched.

---

## 2026-08-19T16:56:56Z — filed defect 3 FIXED and browser-verified: AI POWER shows its declared rows

Command: `PW_MODULE_DIR=… node browser-proof/proofs/family-scene.mjs` (asserts inline)

- THEME FAMILIES defaults unchanged (AI COMPUTE: NVDA, TSM, AVGO, ASML, MU, SNDK); the family picker is visible on family scenes and hidden elsewhere.
- Choosing **AI POWER** renders exactly its declared rows — **OKLO, IREN, CIFR, BE, WULF, USAR**: browser-proof/receipts/family-AI_POWER-declared-rows.png
- The choice survives leaving and re-entering the scene (session memory).
- SECTOR FAMILIES' **DEFENSIVE** basket is reachable the same way: browser-proof/receipts/family-DEFENSIVE-declared-rows.png
- Zero page errors across the flow.

---

## 2026-08-19T16:57:11Z — /news and /cohorts main reads: named when never loaded, STALE-stamped when they die mid-life

Command: `PW_MODULE_DIR=… node browser-proof/proofs/main-read-failure.mjs` (forced 500s; mid-life failures injected by re-routing after a healthy load and invoking the page's own tick(); asserts inline)

- **/news never loads** (browser-proof/receipts/news-main-read-never-loaded.png): "the news read failed — the wire is unavailable, not empty · retrying at the next refresh" — named and distinct from the empty-filter wording; the old boot catch said only "news unavailable".
- **/news dies after a healthy load** (browser-proof/receipts/news-refresh-failed-stale-stamp.png): the held headlines STAY (a failed read never erases knowledge) and the freshness line says "REFRESH FAILED — showing the read from Xs ago — the news read is failing, the list below is stale · retrying". Before, the interval catch was silent: the list froze with a "newest Xm ago" stamp that became false as time passed.
- **/cohorts never loads** (browser-proof/receipts/cohorts-main-read-never-loaded.png): the strip names the failed source ("the ticker_cohorts read failed — …"), not "cohort data unavailable".
- **/cohorts dies after a healthy load** (browser-proof/receipts/cohorts-refresh-failed-stale-marker.png): every chip is kept and a visible marker appends — "refresh failed (ticker_cohorts) — these chips are stale · retrying" — cleared naturally by the next successful rebuild.

Zero page errors across all four scenarios. Rollback: revert the single commit carrying this unit — render wording and failure-state plumbing only; queries, authorities and refresh cadences untouched.

---

## 2026-08-19T16:57:20Z — a failed main read never claims the owner's absence: /youtube's feed fixed, the axis consumers photographed

Command: `PW_MODULE_DIR=… node browser-proof/proofs/feed-truth.mjs` (page-level failure injection; asserts inline)

- **/youtube, feed read DEAD** (browser-proof/receipts/youtube-feed-read-failed-said.png): the grid paints "youtube feed · read failed — the wire is unavailable, not empty · retrying at the next pass" — and does NOT paint "the youtube_feed table is empty" or blame the ingester. Before this unit the catch painted exactly those words for any transport failure: the owner's absence claimed off a read that never landed (rule 1 + rule 2 in one sentence). Zero page errors.
- **/youtube, feed read LANDED empty** (browser-proof/receipts/youtube-feed-landed-empty-owner-absence.png): the owner's wording survives — "awaiting feed — the youtube_feed table is empty; cards fill per video when the ingester lands" — because off a landed zero-row read that claim is now TRUE (rule 4: emptiness decided on the raw value).
- **The axis-consumer sweep's runtime half** (browser-proof/receipts/cohort-axis-dead-named.png, browser-proof/receipts/geigerwall-axis-dead-named.png): with `ticker_cohorts` dead at the page, /cohort boots to "cohort data unavailable" and /geigerwall to "cohort data unavailable — wall cannot compose", both with zero page errors — the last two of the ten SC_COHORT_AXIS consumers whose failure paint had never been photographed. The other eight were re-read this round: all answer a boot failure with a named state (analytics counts the axis as a feed and stamps COHORT AXIS FAILED; events refuses with the message; heat paints the COHORT HOMES UNAVAILABLE group; compare's init catch names the database; allocation's spine goes FALLBACK by name; fundamentals converts the flag to a throw under its boot guard; deck and the cohorts strip were fixed in earlier rounds).

Rollback: revert the single commit carrying this unit — one flag, one two-sentence branch, pins and this proof; no data lane, authority or methodology changed.

---

## 2026-08-19T16:57:22Z — /econ, /alerts, /news: dead reads named; empty tables keep their own words

Command: `PW_MODULE_DIR=… node browser-proof/proofs/panel-failed-reads.mjs` (forced 500s per page over the healthy rig; asserts inline)

These three pages still carried the catch(() => null) flattening the round-4 sweep removed elsewhere — found by re-measuring the repo instead of trusting the earlier "swept" claim (the unit pins only banned the spaced spelling, so the unspaced form survived the audit).

- **/econ, empty tables** (browser-proof/receipts/econ-empty-tables-empty-words.png): the fixture's honest empty state — "econ_dashboard has no rows" and "no calendar rows for this filter", no failure words anywhere.
- **/econ, both reads dead** (browser-proof/receipts/econ-dead-reads-named.png): the tiles and the calendar each name their failed source and the retry; the empty-filter claim never appears over a failure. Before: a dead dashboard read was a BLANK strip and a dead calendar read claimed "no calendar rows for this filter".
- **/alerts, both reads dead** (browser-proof/receipts/alerts-dead-reads-named.png): feed health and ticker alerts say "unavailable, not quiet · retrying" — a dead read no longer impersonates a quiet feed.
- **/news, sentiment dead** (browser-proof/receipts/news-dead-sentiment-named.png): the chip says "sentiment read failed — unavailable, not neutral · retrying" while the wire renders normally beside it; before, the chip silently vanished, identical to a ticker with no sentiment row.

Remaining catch-null sites, dispositioned rather than swept: /youtube's ytAct is a WRITE lane (star/unstar) whose failure silently loses a shared write — its own audit finding, and any fix must respect the shell mirrors; /templates/sector-rotation.html's spark catches feed the E1 coverage gate (PARTIAL / NOT PROVIDER AUTHORITY — visibly gated); /templates/dcf.html's three FY-baseline catches keep the flagged static value and are counted per field in the badge; /cohorts' hub_favorites catch is the kept marker behind its named tooltip; sector-rotation-older is the retained rollback copy, left as-is.

Zero page errors.

---

## 2026-08-19T16:57:32Z — /pulse: a dead read no longer wears an empty table's words

Command: `PW_MODULE_DIR=… node browser-proof/proofs/pulse-failed-reads.mjs` (asserts inline; failures injected per page over the healthy rig)

- **vix_term dead, all else healthy** (browser-proof/receipts/pulse-vixterm-dead-beside-live-price.png): geiger counts and macro render normally, and the VIX section shows the live price BESIDE "vix_term did not answer · retrying" — the failure is named, the healthy half still speaks, and "no vix source" (the honest empty wording) never appears over a failure.
- **provider dead** (browser-proof/receipts/pulse-provider-dead-fails-closed.png): the shim fails its owned reads closed, so GEIGER and MACRO say their sources "did not answer — unavailable, not empty · retrying" in the failure style, while vix_term — never shim-owned — still answers with the /3M term ratio beside the dead-quotes marker. Before this unit, every one of these states rendered as "no composite_staged" / "no live_quotes": a dead read and an empty table were the same strip.

Zero page errors in both scenarios.

---

## 2026-08-19T16:57:33Z — /fundamentals: absent balance fields are flagged by name, not minted into net debt

Command: `PW_MODULE_DIR=… node browser-proof/proofs/fy-consistency.mjs` (route /templates/fundamentals.html, NVDA; balance_history answered per page; asserts inline)

- **total_debt NULL** (browser-proof/receipts/fundamentals-null-debt-flagged.png): the flags line says "balance_history.total_debt is null — net debt treats debt as 0 and WACC as all-equity; fair value is OVERSTATED if this name carries debt". Before this unit, `(b.total_debt||0)-(b.cash_and_equiv||0)` silently valued every such ticker debt-free — a missing balance row produced zero net debt, an all-equity WACC, and no sign anywhere.
- **Complete balance row** (browser-proof/receipts/fundamentals-complete-balance-no-flag.png): no absence flag, valuation renders normally — the flag appears exactly when the absence does.
- The same unit aligned buildBase's ratio windows with the rule the DCF FY baseline enforces: D&A% and capex% denominators now come from the SAME rows as their numerators (the same 4 quarters, or the same single FY — a mismatched FY pair keeps the flagged default rather than a cross-year ratio; an offset cashflow-vs-income quarter window is flagged out loud). fundamentals.revenue_ttm stays the projection BASE — currency there, consistency in ratios. A terminally underivable share count is flagged "NOT meaningful" instead of silently dividing by a 1B placeholder. Functional pins drive every case in tests/station-fundamentals-price.test.mjs.

Zero page errors in both scenarios. Rollback: revert the single commit carrying this unit — derivation and flag wording only; no schema, no authority, no methodology change (the DCF formulas are untouched; only the window selection and absence visibility moved).

---

## 2026-08-19T16:57:40Z — the Hub entry: the live path's exact refusal, and the deck booting AT the hub origin

Command: `PW_MODULE_DIR=… node browser-proof/proofs/hub-entry.mjs` (rules parsed from vercel.json itself; asserts inline)

- **Live path, measured in the browser** (browser-proof/receipts/hub-entry-live-path-refused.png): Chromium pointed at https://station.scintillahub.ai/ through the environment's proxy fails with `page.goto: net::ERR_TUNNEL_CONNECTION_FAILED at https://station.scintillahub.ai/` — the CONNECT is refused before TLS begins, so nothing was bypassed and nothing live was reached or faked. The PREVIEW host gets the same measurement (browser-proof/receipts/hub-entry-preview-refused.png): `page.goto: net::ERR_TUNNEL_CONNECTION_FAILED at https://scintilla-widgets-git-cla-070619-aharveyrianhard-8432s-projects.vercel.app/deck/` — the branch's own deploy is equally unreachable from here, which is exactly the live-acceptance blocker the handoff carries. This is the browser-level twin of round 7's curl measurement: live acceptance still requires a browser outside this container.
- **The deck boots at the hub origin under the config's own rules** (browser-proof/receipts/hub-entry-deck-boots-at-hub-origin.png): navigating to https://station.scintillahub.ai/ with vercel.json's parsed rewrites applied over the rig serves the Station AT the hub host — title, StationScenes, the provider shim, the cohort axis and the mounted panes all up, location.host still the hub. ZERO asset 404s: every /deck dependency is absolute-pathed, so the root rewrite (source "/" only) breaks nothing — proven by outcome in a real browser, not by grep. The no-store cache rule rides every response, as pinned from the config.
- The config itself is pinned in tests/station-route-inventory.test.mjs: exactly two rewrites (hub root → /deck/, /status → orgstatus), no-store at all three cache layers.

This is stubbed-data page proof at the true hub ORIGIN — it verifies the entry path and the deck's behavior under the rewrite, not the live owners' data. Rollback: revert the single commit carrying this unit — proof, pin and receipts only; no served file changed.

---

## 2026-08-19T16:57:41Z — the realtime lane tells the truth at every stage, on the vendored library

Command: `PW_MODULE_DIR=… node browser-proof/proofs/realtime-absence.mjs` (asserts inline)

- **Script absent** (browser-proof/receipts/realtime-absent-said-on-the-wall.png): with the vendored /_vendor/supabase-js blocked, the deck paints "RT · absent" beside #marketStatus with the reason, SC_REALTIME.available === false, the freshness lane untouched, nothing errors.
- **Script present — the REAL library** (browser-proof/receipts/realtime-channel-error-said.png): the vendored npm-verified bytes execute in the rig (typeof supabase.createClient === "function" — no stub), availability flips, and the channel state is honest about the offline rig ("connecting" or a terminal failure). The WIRED status callback — pinned in the equity-authority suite as the exact function the channel calls — is driven through CHANNEL_ERROR ("RT · not connected", reason in the title) and SUBSCRIBED (note hidden). "Available" no longer means merely "script present": the channel lifecycle is the lane's truth.

Rollback: revert the vendoring commit — the CDN tags return; behavior is otherwise unchanged.

---

## 2026-08-19T16:57:46Z — rig smoke + BEFORE state of the filed cohort defects

Command: `PW_MODULE_DIR=… node browser-proof/proofs/rig-smoke.mjs`

- Deck boots under fixtures with page errors: none.
- Scene select options: live, indexNow, indexLeadership, companyLeadership, focus2, macroCrossAsset, internalsFast, internalsSlow, sectorFamilies, themeFamilies, cohort, custom — **no cohort scene is reachable** (defects 1–2: AI_SOFTWARE / MEGACAP cannot replace the favorites-based rows because no cohort can be chosen at all; the legacy "cohort" id normalizes to themeFamilies).
- THEME FAMILIES renders NVDA, TSM, AVGO, ASML, MU, SNDK — the FIRST basket (AI COMPUTE); **AI POWER's declared rows are unreachable** (defect 3: familyBasket() is never given an id).
- Screenshots: browser-proof/receipts/rig-smoke-deck-live.png · browser-proof/receipts/before-themeFamilies-always-first-basket.png

---

## 2026-08-19T16:57:55Z — the preset scenes paint their declared rows: the first-basket class closed for every scene kind

Command: `PW_MODULE_DIR=… node browser-proof/proofs/scene-declared-rows.mjs` (asserts inline)

- **Fixed preset** (browser-proof/receipts/scene-macro-preset-declared-rows.png): /deck?scene=macroCrossAsset carries exactly US10Y · DXUSD · GCUSD · SIUSD · CLUSD · BTCUSD — the model's own frozen declaration, in order, at chartCount 6.
- **Time-windowed preset**: /deck?scene=indexNow's wall equals `indexNowTickersFor(new Date())` windowed by the model itself, compared IN the same browser at the same instant so the time dependence cancels — whatever the model declares for now is what the wall carries.
- With the cohort and family proofs of round 4, every scene KIND is now browser-proven to deliver its declared rows: fixed presets, time-windowed presets, cohort membership, family baskets. Also recorded from this sweep: /parity makes NO data reads at all (a static analysis page — authority-clean by construction).

Rollback: this unit adds a proof only; no served file changed.

---

## 2026-08-19T16:58:32Z — ticks, repaint and provider-vs-display, browser-verified; CLOSED-label disposition

Command: `PW_MODULE_DIR=… node browser-proof/proofs/tick-repaint.mjs` (asserts inline)

- **Provider-vs-display**: the chart's day change equals the exact quote the provider served — 0.29% for NVDA 347/346, then 9.83% after a tick to 380; the deck pane likewise (0.33% → 16.94%). No display number differs from the provider's arithmetic.
- **Ticks**: the standalone chart takes a changed provider quote within one 10s poll (browser-proof/receipts/tick-chart-updates-from-provider.png); a deck pane takes it within one 10s pump heartbeat through the authority shim (browser-proof/receipts/tick-deck-pane-updates-from-provider.png).
- **Repaint**: through a cold 1W range switch, 20 continuous canvas samples — zero blank frames; the previous paint stands until the next is ready (browser-proof/receipts/repaint-1W-no-blank.png).
- **Deck healthy state**: the header paints **LIVE** with all panes ready and stamped (browser-proof/receipts/deck-header-LIVE-healthy-state.png) — the state that threw `ReferenceError: delayed is not defined` before `06e4a0a`, now proven in a real browser.
- **CLOSED labels — disposition**: no market-session CLOSED label exists anywhere in this repository (searched all served HTML/JS, case-insensitive, including "closed", "session", market-hours patterns; the only matches are WebRTC connection states and prose). The filed "CLOSED despite live feed" defect lives in the separate scintilla-hub deploy, which this branch's standing locks forbid editing. Kept visible as a cross-repo defect in the handoff; not representable, therefore not claimed, here.

---

## 2026-08-19T16:58:53Z — the watch-later lane tells the truth: unknown is said, lost writes say why

Command: `PW_MODULE_DIR=… node browser-proof/proofs/wl-truth.mjs` (page-level failure injection; asserts inline)

- **The mounted shell with the saved-list read DEAD** (browser-proof/receipts/shell-wl-read-dead-unknown.png): every card star paints the UNKNOWN "?" state ("watch-later state unknown — the saved-list read failed · a click retries the read"), zero cards claim saved-or-unsaved, and the bWatch button reads "watch later — state unknown" — a failed read is never data. A click on an unknown star retries the read and, still failing, flashes "★ unavailable — the saved-list read failed · nothing was changed" without flipping anything. The watch-later list itself paints "the watch-later read failed — the saved list is unavailable, not empty · retrying at the next refresh" (browser-proof/receipts/shell-wl-list-read-failed-named.png) — the old "YouTube reconnect required" wording, which named YouTube auth as the cause of a failed Supabase table read, is gone from the mounted shells and /pane-video (video-v1 keeps it: retained rollback, exempt by ruling).
- **The read lands, then a write is lost** (browser-proof/receipts/shell-wl-lost-write-said.png): the landed read paints exactly the saved video ★; a save click flips optimistically, the 500 settles, the flip REVERTS and the reason is said — "★ not saved — the shared watch-later write failed · try again". The shells used to revert silently; the gesture just vanished.
- **A lost subscribe says why**: "subscribe failed — the shared write did not land · try again" — the catch used to swallow it whole.
- **/youtube keeps the feed's own served flags** (browser-proof/receipts/youtube-wl-read-dead-feed-snapshot.png): the feed rows arrive with a server-side watch_later column — landed data. With the dedicated saved-list read dead, the flagged video KEEPS its star (it used to be zeroed by an empty page cache), the Watch Later chip wears a persistent "!" marker titled "the saved-list read failed — ★ rides the feed snapshot, not the saved list", and the failure is caught — before this unit it was an unhandled promise rejection.

Zero page errors in every scenario. Rollback: revert the single commit carrying this unit — said states, guards, pins and this proof; no data lane, authority or methodology changed; the rollback shell untouched.

---

## 2026-08-19T16:58:56Z — /youtube: a lost shared write no longer stays painted as saved

Command: `PW_MODULE_DIR=… node browser-proof/proofs/yt-lost-write.mjs` (route /youtube/; three fixture youtube_feed rows, empty yt_watch_later; yt-act answered per page; asserts inline)

- **Write lost** (browser-proof/receipts/yt-star-lost-write-reverted.png): the star flips on optimistically, then REVERTS within one settle (DOM: `.sc-ytc__star` loses `is-on`; `ytWLGet().size === 0`), and the page's flash surface says "★ not saved — the shared watch-later write failed · try again" for long enough to read. Before this unit the failure was swallowed (`.then(r => r.json()).catch(() => null)`, result ignored): the star stayed painted "saved", the shared table never changed, and the lie stood until the next reconcile read.
- **Write landed** (browser-proof/receipts/yt-star-landed-write-stays.png): the star stays, `ytWLGet()` carries the id, no failure flash — success and failure are now different pictures.
- Success detection is a LANDED write only: non-2xx and error bodies resolve null (a 500 whose JSON parses is not a success).
- **Scope notes, measured in code**: the two mounted video shells already REVERT on this failure (state-honest) but stay reason-silent — recorded as a lesser gap, not repaired here, because their only failure surface today is the watch-list read lane and hijacking it would blank the list; their `subscribeToChannel` catch is the same state-honest/reason-silent shape. The 10s-cadence `ytPosPush` position write keeps its silent catch by design: positions re-push on cadence, so a lost write is retried by the next tick rather than lied about.

Zero page errors in both scenarios. Rollback: revert the single commit carrying this unit — the change is client-render behavior only (no schema, no endpoint, no authority change).

---

## 2026-08-19T17:52:59Z — the pane's direction color is claimed from the day's baseline, or not claimed at all

Command: `PW_MODULE_DIR=… node browser-proof/proofs/day-direction.mjs` (asserts inline; reads CANVAS PIXELS, not text)

The defect this proves fixed was invisible to source pins and to every text assertion: `chDayChange` already refused to state a day change without the provider's previous close (the badge said "—"), but the pane behind it was painted bull or bear regardless, because the draw path's baseline fell back to `pts[0].p` — the first bar of the LOADED WINDOW. That baseline moves with the range control, so the same prices could paint green at one range and red at another with no market event between them. On a wall, the color is what gets read.

Three scenarios on the same page with the same history, only the previous close changing — the pane's painted pixels counted against the `--bull`/`--bear`/`--ink2` tokens at a tight distance so antialiasing cannot vote:

- **Baseline known, below price** (browser-proof/receipts/chart-day-baseline-known-up.png): badge `20.00%`, pane **bull**, zero bear pixels.
- **Baseline known, above price** (browser-proof/receipts/chart-day-baseline-known-down.png): badge `(20.00%)`, pane **bear**, zero bull pixels.
- **Baseline UNKNOWN — the fix** (browser-proof/receipts/chart-day-baseline-unknown-neutral.png): badge `—`, pane **neutral**, **zero bull pixels and zero bear pixels**, with the series still drawn (neutral, not absent). Before this unit that same scenario painted a confident direction from a number nobody sent.

Zero page errors in all three. The mounted `/station-shells/chart-v1` is the byte-exact mirror of this file (gate-enforced), so the Station wall's panes carry the same refusal.

Rollback: revert the single commit — `chDayRef()`, the neutral branch, the removal of the three `_ref` substitution writes, pins and this proof. No data lane, authority or methodology changed; the previous close itself is read exactly as before.

---

## 2026-08-19T17:59:11Z — an unknown day change gets neither a sign nor a direction colour

Command: `PW_MODULE_DIR=… node browser-proof/proofs/unknown-change.mjs` (asserts inline; reads the painted tape and its computed colours)

`null >= 0` is **true** in JavaScript, so every unguarded directional ternary painted UNKNOWN as UP — a systematic bullish tint on missing data. `/ticker` went further and fabricated the value itself: `|| 0` turned "nobody sent a change" into a REPORTED FLAT DAY, printed `+0.00%` in the up colour, and fed that zero into the movers ranking as the least-moving symbol in the universe.

Four symbols served through the tape's own universe read (browser-proof/receipts/ticker-unknown-change-neutral.png):

- **A known gain** paints `+2.50%`, class `up`; **a known loss** paints `(1.25%)`, class `dn` — unchanged.
- **A REPORTED zero** still paints `+0.00%`, class `up`. This is the line the fix must not cross: refusing *unknown* is not refusing *zero*, and a landed zero is a real observation (rule 4 — emptiness is decided on the raw value).
- **An unknown change** (null on both `chg_pct` and `change`) paints `—` in the neutral colour, computed-colour-asserted as neither the up nor the down colour. It used to paint `+0.00%` in green.
- **No symbol is dropped**, and the unknown ranks *after* every known mover instead of impersonating the calmest stock on the board.

The same `null >= 0` shape was fixed in two more places the sweep found: `templates/allocation-module.html` painted its "—" day cell green, and `templates/sector-rotation.html` rendered a signed em-dash percentage (`+—%`) in green — now dim, and worded "change unknown". `/heat` was swept too and was already correct (both its colour functions refuse on null), which is what the fixed pages now match.

Zero page errors. Rollback: revert the single commit — three guarded ternaries, one un-fabricated value, one ranking partition, pins and this proof. No data lane, authority or methodology changed.

---

## 2026-08-19T18:02:26Z — the Station WALL refuses the day's direction when the provider states no previous close

Command: `PW_MODULE_DIR=… node browser-proof/proofs/deck-day-direction.mjs` (asserts inline; reads the canvas pixels INSIDE the mounted shell iframes)

`day-direction.mjs` proves the refusal on standalone `/chart`. This proves it where it matters: on `/deck`, whose panes are `/station-shells/chart-v1` iframes fed by the **deck's own** quote path — deck reads live_quotes, the provider shim rewrites that read to the provider's `/quotes`, deck maps the row and posts it across the frame boundary, and the shell's `scChartLive` puts the previous close into the map the pane colour is drawn from. A fix that held on the standalone page and broke anywhere along that chain would leave the wall still lying, so the wall is asserted on its own.

- **The provider states a previous close below the price** (browser-proof/receipts/deck-wall-day-baseline-known-up.png): every painted pane on the wall is **bull**, zero bear pixels — the claim still gets made when it is earned.
- **The provider states NO previous close — the fix** (browser-proof/receipts/deck-wall-day-baseline-unknown-neutral.png): every painted pane is **neutral**, with **zero bull and zero bear pixels**, and each pane's badge reads `—`. The series is still drawn; only the directional claim is withdrawn. Before this fix the wall painted a confident green or red here, from the first bar of whatever window happened to be loaded.

Zero page errors on the wall in both states.

Rollback: this proof is evidence only — it changes nothing. The unit it covers reverts with `chDayRef`'s commit.

---

## 2026-08-19T18:03:41Z — the Hub entry: the live path's exact refusal, and the deck booting AT the hub origin

Command: `PW_MODULE_DIR=… node browser-proof/proofs/hub-entry.mjs` (rules parsed from vercel.json itself; asserts inline)

- **Live path, measured in the browser** (browser-proof/receipts/hub-entry-live-path-refused.png): Chromium pointed at https://station.scintillahub.ai/ through the environment's proxy fails with `page.goto: net::ERR_TUNNEL_CONNECTION_FAILED at https://station.scintillahub.ai/` — the CONNECT is refused before TLS begins, so nothing was bypassed and nothing live was reached or faked. The PREVIEW host gets the same measurement (browser-proof/receipts/hub-entry-preview-refused.png): `page.goto: net::ERR_TUNNEL_CONNECTION_FAILED at https://scintilla-widgets-git-cla-070619-aharveyrianhard-8432s-projects.vercel.app/deck/` — the branch's own deploy is equally unreachable from here, which is exactly the live-acceptance blocker the handoff carries. This is the browser-level twin of round 7's curl measurement: live acceptance still requires a browser outside this container.
- **The deck boots at the hub origin under the config's own rules** (browser-proof/receipts/hub-entry-deck-boots-at-hub-origin.png): navigating to https://station.scintillahub.ai/ with vercel.json's parsed rewrites applied over the rig serves the Station AT the hub host — title, StationScenes, the provider shim, the cohort axis and the mounted panes all up, location.host still the hub. ZERO asset 404s: every /deck dependency is absolute-pathed, so the root rewrite (source "/" only) breaks nothing — proven by outcome in a real browser, not by grep. The no-store cache rule rides every response, as pinned from the config.
- The config itself is pinned in tests/station-route-inventory.test.mjs: exactly two rewrites (hub root → /deck/, /status → orgstatus), no-store at all three cache layers.

This is stubbed-data page proof at the true hub ORIGIN — it verifies the entry path and the deck's behavior under the rewrite, not the live owners' data. Rollback: revert the single commit carrying this unit — proof, pin and receipts only; no served file changed.

---

## 2026-08-19T18:03:48Z — the authority sweep: eight equity surfaces, zero unreviewed hosts at runtime

Command: `PW_MODULE_DIR=… node browser-proof/proofs/authority-sweep.mjs` (asserts inline; no screenshots — the assertions ARE the evidence, regenerable)

/geiger/ · /heat/ · /cohort/ · /compare/ · /ticker/ · /wall/ · /analytics/ · /geigerwall/ — each loads over the rig with **zero page errors**, paints a real surface, and makes **zero requests to any non-owner host at all**: no Yahoo, no FMP, no CORS proxy, and — since the vendoring — no CDN either. A deliberate canary request to an unserved host must land in the refusal log, so a silent interception failure cannot fake a clean sweep.

This is the runtime half of the round-9 authority audit; the source half measured: zero Yahoo/FMP fetch lanes in served HTML outside sector-rotation's reviewed-relays-only flagged fallback (its third-party proxy lane was retired in F1's own fix, verified still absent); /health the only direct provider fetch (the ruled exception — /analytics's grep hit is banner prose); 20/20 shim-tag coverage on pages that read shim-owned tables (the remaining grep hits — /, /components — are prose descriptions, classified by eye).

---

## 2026-08-19T18:03:55Z — an empty FAV names itself, and the way out works

Command: `PW_MODULE_DIR=… node browser-proof/proofs/cohort-empty-fav.mjs` (hub_favorites answers zero rows — a successful empty read, not a failure)

- **The wall says why it is empty** (browser-proof/receipts/cohort-empty-fav-named.png): "no favorites yet — the wall is empty, not broken · choose a cohort or edit the slot", with the indicator counting "page 1 / 1 · 0 favorites". Before this unit the state rendered as one blank editable slot with no wording anywhere on the wall. The wording is gated on the read having landed: before COHORT_READY the count is not yet a fact, and the note does not claim it.
- **Choosing a cohort still replaces the (empty) favorites** (browser-proof/receipts/cohort-empty-fav-to-cohort.png): AI SOFTWARE fills the wall with its full declared membership (7 members) from the empty state.

Zero page errors.

---

## 2026-08-19T18:04:05Z — filed defects 1–2 FIXED and browser-verified: cohorts replace the favorites rows

Command: `PW_MODULE_DIR=… node browser-proof/proofs/cohort-scene.mjs` (asserts inline; a failed assertion fails the run)

- `/deck/?scene=cohort` lands on **FAV — MU, NBIS, SNDK** (the favorites rows, added order): browser-proof/receipts/cohort-FAV-favorites-rows.png
- Choosing **AI SOFTWARE** replaces them with **ADBE, CRM, MSFT, NOW, ORCL, PLTR** (page 1 / 2 · 7 members; no favorite present): browser-proof/receipts/cohort-AI_SOFTWARE-replaces-favorites.png
- Its page 2 pages honestly to **SNOW** alone: browser-proof/receipts/cohort-AI_SOFTWARE-page2.png
- Choosing **MEGACAP** replaces them with **AAPL, AMZN, GOOGL, META, MSFT, NVDA**: browser-proof/receipts/cohort-MEGACAP-replaces-favorites.png
- Choosing FAV again restores the favorites rows; zero page errors across the flow.

---

## 2026-08-19T18:04:25Z — the pane's direction color is claimed from the day's baseline, or not claimed at all

Command: `PW_MODULE_DIR=… node browser-proof/proofs/day-direction.mjs` (asserts inline; reads CANVAS PIXELS, not text)

The defect this proves fixed was invisible to source pins and to every text assertion: `chDayChange` already refused to state a day change without the provider's previous close (the badge said "—"), but the pane behind it was painted bull or bear regardless, because the draw path's baseline fell back to `pts[0].p` — the first bar of the LOADED WINDOW. That baseline moves with the range control, so the same prices could paint green at one range and red at another with no market event between them. On a wall, the color is what gets read.

Three scenarios on the same page with the same history, only the previous close changing — the pane's painted pixels counted against the `--bull`/`--bear`/`--ink2` tokens at a tight distance so antialiasing cannot vote:

- **Baseline known, below price** (browser-proof/receipts/chart-day-baseline-known-up.png): badge `20.00%`, pane **bull**, zero bear pixels.
- **Baseline known, above price** (browser-proof/receipts/chart-day-baseline-known-down.png): badge `(20.00%)`, pane **bear**, zero bull pixels.
- **Baseline UNKNOWN — the fix** (browser-proof/receipts/chart-day-baseline-unknown-neutral.png): badge `—`, pane **neutral**, **zero bull pixels and zero bear pixels**, with the series still drawn (neutral, not absent). Before this unit that same scenario painted a confident direction from a number nobody sent.

Zero page errors in all three. The mounted `/station-shells/chart-v1` is the byte-exact mirror of this file (gate-enforced), so the Station wall's panes carry the same refusal.

Rollback: revert the single commit — `chDayRef()`, the neutral branch, the removal of the three `_ref` substitution writes, pins and this proof. No data lane, authority or methodology changed; the previous close itself is read exactly as before.

---

## 2026-08-19T18:04:33Z — the DCF FY baseline rides the history tables; the shortfall stays flagged

Command: `PW_MODULE_DIR=… node browser-proof/proofs/dcf-baseline.mjs` (fixture universe carries 8 of the 10 bar tickers; asserts inline)

- **Derived exactly** (browser-proof/receipts/dcf-fy-baseline-partial-overlay.png): NVDA's netDebt/D&A%/capex%/ΔNWC% in the running page equal the arithmetic over the fixture's own FY rows (net_debt in billions; D&A = ebitda − operating_income; capex sign normalized; ΔNWC over the same fiscal date).
- **The shortfall is worn, not hidden**: TSM and IREN are absent from the fixture universe, keep every Jul-24 static value, and the fy-baseline badge reads STALE with "netDebt 8/10 · D&A% 8/10 · capex% 8/10 · ΔNWC% 8/10" — a partial overlay never claims LIVE.
- **What has no DB source stays STATIC by name**: margin/tax defaults · MRP · debt weight, as-of the stated vintage.

Live field availability behind this unit was measured read-only the same day: all ten bar tickers carry complete latest-FY rows in balance_history/cashflow_history/fundamentals_history (balance_history carries net_debt directly), so on the real database the badge should read LIVE 10/10 — the rig's 8/10 is the fixture's own deliberate shape, not a claim about the owners' data.

Zero page errors.

---

## 2026-08-19T18:04:40Z — the DCF growth/margin slider seeds ride the FY history; the shortfall stays flagged

Command: `PW_MODULE_DIR=… node browser-proof/proofs/dcf-seeds.mjs` (route /templates/dcf.html, NVDA boot; fixture universe carries 8 of the 10 bar tickers; asserts inline)

- **Derived exactly and VISIBLE** (browser-proof/receipts/dcf-seeds-partial-overlay.png): NVDA's growth default equals the FY-to-FY revenue CAGR over the fixture's own rows and its margin default equals the latest FY's own margin — both land in TICKERS and on the sliders the user then owns (range inputs snap to their 0.5 step; asserted within one step). Clamps and window rules mirror the fundamentals cockpit: g 0..80, m 5..90, a CAGR needs two FY rows more than half a year apart.
- **The shortfall is worn, not hidden**: TSM and IREN are absent from the fixture universe and keep their Jul-24 static seeds; the fy-seeds badge reads STALE with "growth default 8/10 · EBITDA-margin default 8/10" — a partial overlay never claims LIVE.
- **What has no DB source stays STATIC by name**: tax default · terminal growth · MRP · debt weight (fundamentals_history carries no tax line — measured schema, round 5) — the static-baseline badge and the as-of bar both say so.

Zero page errors. Rollback: revert the single commit carrying this unit — seed derivation and badge wording only; the DCF formulas, price authority and Geiger methodology are untouched, and no provider history was written or deleted.

---

## 2026-08-19T18:05:04Z — the Station WALL refuses the day's direction when the provider states no previous close

Command: `PW_MODULE_DIR=… node browser-proof/proofs/deck-day-direction.mjs` (asserts inline; reads the canvas pixels INSIDE the mounted shell iframes)

`day-direction.mjs` proves the refusal on standalone `/chart`. This proves it where it matters: on `/deck`, whose panes are `/station-shells/chart-v1` iframes fed by the **deck's own** quote path — deck reads live_quotes, the provider shim rewrites that read to the provider's `/quotes`, deck maps the row and posts it across the frame boundary, and the shell's `scChartLive` puts the previous close into the map the pane colour is drawn from. A fix that held on the standalone page and broke anywhere along that chain would leave the wall still lying, so the wall is asserted on its own.

- **The provider states a previous close below the price** (browser-proof/receipts/deck-wall-day-baseline-known-up.png): every painted pane on the wall is **bull**, zero bear pixels — the claim still gets made when it is earned.
- **The provider states NO previous close — the fix** (browser-proof/receipts/deck-wall-day-baseline-unknown-neutral.png): every painted pane is **neutral**, with **zero bull and zero bear pixels**, and each pane's badge reads `—`. The series is still drawn; only the directional claim is withdrawn. Before this fix the wall painted a confident green or red here, from the first bar of whatever window happened to be loaded.

Zero page errors on the wall in both states.

Rollback: this proof is evidence only — it changes nothing. The unit it covers reverts with `chDayRef`'s commit.

---

## 2026-08-19T18:05:17Z — the inventory sweep: runtime coverage completed, and the LINES panel says its library is dead

Command: `PW_MODULE_DIR=… node browser-proof/proofs/inventory-sweep.mjs` (asserts inline; one screenshot for the found defect)

- **33 remaining surfaces loaded clean** — entry, ops, market (/parity), media, the visuals lab, the standalone spec pages: zero page errors, real painted surfaces, zero requests outside each page's CLASS allowance (data lanes: the two owners only; media-mounting pages: YouTube embed hosts; the retained rollback sector-rotation-older: its reviewed hub relay + its legacy unpkg tag, exempt by ruling — no other page touches a CDN since the vendoring). Together with authority-sweep.mjs and the per-page proofs, EVERY served surface in the route inventory has now been loaded at least once under authority assertions — except the X lane, excluded because H2 is proof-gated (the bridge draft's offscreen document is recorded as throwing outside its extension context; its guard waits behind the same gate).
- **The found defect, proven fixed on the vendored library** (browser-proof/receipts/sector-lines-cdn-dead-said.png): with the same-origin /_vendor lightweight-charts script blocked, the LINES panel SAYS "lightweight-charts (vendored same-origin) did not load — unavailable, not empty; every other panel is unaffected", the chart calls are guarded, and leaders/heatmap still follow a range click with the library dead — zero page errors before and after. (The healthy load — the vendored library actually executing — is covered by the sweep above.)

Rollback: revert the single commit carrying this unit — a said state, guards, pins and this proof; no data lane, authority or methodology changed; the rollback copy untouched.

---

## 2026-08-19T18:05:24Z — degraded states, photographed: absence renders as absence

Command: `PW_MODULE_DIR=… node browser-proof/proofs/degraded-states.mjs` (asserts inline; failures injected per page over the healthy rig)

- **/health, provider dead** (browser-proof/receipts/degraded-health-provider-dead.png): all three equity lanes fail with the failure word; the database lanes still answer beside them (the fixture roster carries rows the way the live tables do); the internals lane stays BAD by construction — the fixtures deliberately carry ZERO rows for ADD/PCC/CUMTICK/TICK/TRIN, mirroring their measured live state.
- **/health, Supabase dead** (browser-proof/receipts/degraded-health-supabase-dead.png): provider quotes still answer, and the universe row fails CLOSED — "identity unverified — canonical set unreadable; count alone is not identity" — while the roster lane says "none readable" (a member that cannot be read is not a healthy member).
- **/allocation, every voter dead** (browser-proof/receipts/degraded-allocation-no-voters.png): header UNAVAILABLE — NO VOTER ANSWERED, heat —, targets and moves UNAVAILABLE, the trace declines to narrate, the ranking says "no candidate carries an accepted composite" and lists the unscored names. No fabricated NEUTRAL anywhere. **This scenario caught a real defect the source pin could not**: the cohort table's empty-state message sat behind `html || fallback`, but `html` always carries the header row, so the promised message was unreachable — zero ranked rows painted a bare header (an empty panel where a named absence was promised). Fixed by deciding emptiness on the raw row count; the COMPARABLES table had the same dead gate (its old fallback even named a state that cannot occur, since dropped rows stay rendered greyed-out) — both now append the named absence under the kept header.
- **/fundamentals, provider quotes dead** (browser-proof/receipts/degraded-fundamentals-quotes-dead.png): the header and banner state the missing price; valuation is disabled and STAYS disabled through a slider drag (the render-time gate, exercised in a real browser); the universe and fundamentals sections load normally around it. Also fixed in this unit: the page's boot had no catch, so a cold provider outage used to stop the whole page from booting with no banner at all — the universe failure now paints where the universe status lives and the ticker sections still load.

Zero page errors across all four scenarios.

---

## 2026-08-19T18:05:35Z — /news and /cohorts main reads: named when never loaded, STALE-stamped when they die mid-life

Command: `PW_MODULE_DIR=… node browser-proof/proofs/main-read-failure.mjs` (forced 500s; mid-life failures injected by re-routing after a healthy load and invoking the page's own tick(); asserts inline)

- **/news never loads** (browser-proof/receipts/news-main-read-never-loaded.png): "the news read failed — the wire is unavailable, not empty · retrying at the next refresh" — named and distinct from the empty-filter wording; the old boot catch said only "news unavailable".
- **/news dies after a healthy load** (browser-proof/receipts/news-refresh-failed-stale-stamp.png): the held headlines STAY (a failed read never erases knowledge) and the freshness line says "REFRESH FAILED — showing the read from Xs ago — the news read is failing, the list below is stale · retrying". Before, the interval catch was silent: the list froze with a "newest Xm ago" stamp that became false as time passed.
- **/cohorts never loads** (browser-proof/receipts/cohorts-main-read-never-loaded.png): the strip names the failed source ("the ticker_cohorts read failed — …"), not "cohort data unavailable".
- **/cohorts dies after a healthy load** (browser-proof/receipts/cohorts-refresh-failed-stale-marker.png): every chip is kept and a visible marker appends — "refresh failed (ticker_cohorts) — these chips are stale · retrying" — cleared naturally by the next successful rebuild.

Zero page errors across all four scenarios. Rollback: revert the single commit carrying this unit — render wording and failure-state plumbing only; queries, authorities and refresh cadences untouched.

---

## 2026-08-19T18:05:35Z — the catch-null sweep, browser-verified: failures render as failures

Command: `PW_MODULE_DIR=… node browser-proof/proofs/failed-reads.mjs` (board_rsi and earnings_events forced to 500; asserts inline)

- **/ranks**: the RSI column says "board_rsi did not answer — this ranking is unavailable, not empty · retrying", with zero per-ticker "no data" claims; the healthy CHG column still ranks beside it: browser-proof/receipts/failed-read-ranks-rsi-column.png
- **/events**: the calendar says the read failed — "unavailable, not clear" / "unavailable, not absent" — instead of "nothing scheduled in the next 14 days": browser-proof/receipts/failed-read-events-calendar.png
- **/reflow**: the field refuses to draw grey non-answers over a failure and names the failed source: browser-proof/receipts/failed-read-reflow-rsi.png
- /cohorts' FAV chip now carries the failure in its tooltip when hub_favorites dies (source-pinned in tests; the chip still navigates).

---

## 2026-08-19T18:05:47Z — /econ, /alerts, /news: dead reads named; empty tables keep their own words

Command: `PW_MODULE_DIR=… node browser-proof/proofs/panel-failed-reads.mjs` (forced 500s per page over the healthy rig; asserts inline)

These three pages still carried the catch(() => null) flattening the round-4 sweep removed elsewhere — found by re-measuring the repo instead of trusting the earlier "swept" claim (the unit pins only banned the spaced spelling, so the unspaced form survived the audit).

- **/econ, empty tables** (browser-proof/receipts/econ-empty-tables-empty-words.png): the fixture's honest empty state — "econ_dashboard has no rows" and "no calendar rows for this filter", no failure words anywhere.
- **/econ, both reads dead** (browser-proof/receipts/econ-dead-reads-named.png): the tiles and the calendar each name their failed source and the retry; the empty-filter claim never appears over a failure. Before: a dead dashboard read was a BLANK strip and a dead calendar read claimed "no calendar rows for this filter".
- **/alerts, both reads dead** (browser-proof/receipts/alerts-dead-reads-named.png): feed health and ticker alerts say "unavailable, not quiet · retrying" — a dead read no longer impersonates a quiet feed.
- **/news, sentiment dead** (browser-proof/receipts/news-dead-sentiment-named.png): the chip says "sentiment read failed — unavailable, not neutral · retrying" while the wire renders normally beside it; before, the chip silently vanished, identical to a ticker with no sentiment row.

Remaining catch-null sites, dispositioned rather than swept: /youtube's ytAct is a WRITE lane (star/unstar) whose failure silently loses a shared write — its own audit finding, and any fix must respect the shell mirrors; /templates/sector-rotation.html's spark catches feed the E1 coverage gate (PARTIAL / NOT PROVIDER AUTHORITY — visibly gated); /templates/dcf.html's three FY-baseline catches keep the flagged static value and are counted per field in the badge; /cohorts' hub_favorites catch is the kept marker behind its named tooltip; sector-rotation-older is the retained rollback copy, left as-is.

Zero page errors.

---

## 2026-08-19T18:05:47Z — filed defect 3 FIXED and browser-verified: AI POWER shows its declared rows

Command: `PW_MODULE_DIR=… node browser-proof/proofs/family-scene.mjs` (asserts inline)

- THEME FAMILIES defaults unchanged (AI COMPUTE: NVDA, TSM, AVGO, ASML, MU, SNDK); the family picker is visible on family scenes and hidden elsewhere.
- Choosing **AI POWER** renders exactly its declared rows — **OKLO, IREN, CIFR, BE, WULF, USAR**: browser-proof/receipts/family-AI_POWER-declared-rows.png
- The choice survives leaving and re-entering the scene (session memory).
- SECTOR FAMILIES' **DEFENSIVE** basket is reachable the same way: browser-proof/receipts/family-DEFENSIVE-declared-rows.png
- Zero page errors across the flow.

---

## 2026-08-19T18:05:58Z — /pulse: a dead read no longer wears an empty table's words

Command: `PW_MODULE_DIR=… node browser-proof/proofs/pulse-failed-reads.mjs` (asserts inline; failures injected per page over the healthy rig)

- **vix_term dead, all else healthy** (browser-proof/receipts/pulse-vixterm-dead-beside-live-price.png): geiger counts and macro render normally, and the VIX section shows the live price BESIDE "vix_term did not answer · retrying" — the failure is named, the healthy half still speaks, and "no vix source" (the honest empty wording) never appears over a failure.
- **provider dead** (browser-proof/receipts/pulse-provider-dead-fails-closed.png): the shim fails its owned reads closed, so GEIGER and MACRO say their sources "did not answer — unavailable, not empty · retrying" in the failure style, while vix_term — never shim-owned — still answers with the /3M term ratio beside the dead-quotes marker. Before this unit, every one of these states rendered as "no composite_staged" / "no live_quotes": a dead read and an empty table were the same strip.

Zero page errors in both scenarios.

---

## 2026-08-19T18:06:07Z — the realtime lane tells the truth at every stage, on the vendored library

Command: `PW_MODULE_DIR=… node browser-proof/proofs/realtime-absence.mjs` (asserts inline)

- **Script absent** (browser-proof/receipts/realtime-absent-said-on-the-wall.png): with the vendored /_vendor/supabase-js blocked, the deck paints "RT · absent" beside #marketStatus with the reason, SC_REALTIME.available === false, the freshness lane untouched, nothing errors.
- **Script present — the REAL library** (browser-proof/receipts/realtime-channel-error-said.png): the vendored npm-verified bytes execute in the rig (typeof supabase.createClient === "function" — no stub), availability flips, and the channel state is honest about the offline rig ("connecting" or a terminal failure). The WIRED status callback — pinned in the equity-authority suite as the exact function the channel calls — is driven through CHANNEL_ERROR ("RT · not connected", reason in the title) and SUBSCRIBED (note hidden). "Available" no longer means merely "script present": the channel lifecycle is the lane's truth.

Rollback: revert the vendoring commit — the CDN tags return; behavior is otherwise unchanged.

---

## 2026-08-19T18:06:12Z — rig smoke + BEFORE state of the filed cohort defects

Command: `PW_MODULE_DIR=… node browser-proof/proofs/rig-smoke.mjs`

- Deck boots under fixtures with page errors: none.
- Scene select options: live, indexNow, indexLeadership, companyLeadership, focus2, macroCrossAsset, internalsFast, internalsSlow, sectorFamilies, themeFamilies, cohort, custom — **no cohort scene is reachable** (defects 1–2: AI_SOFTWARE / MEGACAP cannot replace the favorites-based rows because no cohort can be chosen at all; the legacy "cohort" id normalizes to themeFamilies).
- THEME FAMILIES renders NVDA, TSM, AVGO, ASML, MU, SNDK — the FIRST basket (AI COMPUTE); **AI POWER's declared rows are unreachable** (defect 3: familyBasket() is never given an id).
- Screenshots: browser-proof/receipts/rig-smoke-deck-live.png · browser-proof/receipts/before-themeFamilies-always-first-basket.png

---

## 2026-08-19T18:06:13Z — a failed main read never claims the owner's absence: /youtube's feed fixed, the axis consumers photographed

Command: `PW_MODULE_DIR=… node browser-proof/proofs/feed-truth.mjs` (page-level failure injection; asserts inline)

- **/youtube, feed read DEAD** (browser-proof/receipts/youtube-feed-read-failed-said.png): the grid paints "youtube feed · read failed — the wire is unavailable, not empty · retrying at the next pass" — and does NOT paint "the youtube_feed table is empty" or blame the ingester. Before this unit the catch painted exactly those words for any transport failure: the owner's absence claimed off a read that never landed (rule 1 + rule 2 in one sentence). Zero page errors.
- **/youtube, feed read LANDED empty** (browser-proof/receipts/youtube-feed-landed-empty-owner-absence.png): the owner's wording survives — "awaiting feed — the youtube_feed table is empty; cards fill per video when the ingester lands" — because off a landed zero-row read that claim is now TRUE (rule 4: emptiness decided on the raw value).
- **The axis-consumer sweep's runtime half** (browser-proof/receipts/cohort-axis-dead-named.png, browser-proof/receipts/geigerwall-axis-dead-named.png): with `ticker_cohorts` dead at the page, /cohort boots to "cohort data unavailable" and /geigerwall to "cohort data unavailable — wall cannot compose", both with zero page errors — the last two of the ten SC_COHORT_AXIS consumers whose failure paint had never been photographed. The other eight were re-read this round: all answer a boot failure with a named state (analytics counts the axis as a feed and stamps COHORT AXIS FAILED; events refuses with the message; heat paints the COHORT HOMES UNAVAILABLE group; compare's init catch names the database; allocation's spine goes FALLBACK by name; fundamentals converts the flag to a throw under its boot guard; deck and the cohorts strip were fixed in earlier rounds).

Rollback: revert the single commit carrying this unit — one flag, one two-sentence branch, pins and this proof; no data lane, authority or methodology changed.

---

## 2026-08-19T18:06:22Z — the preset scenes paint their declared rows: the first-basket class closed for every scene kind

Command: `PW_MODULE_DIR=… node browser-proof/proofs/scene-declared-rows.mjs` (asserts inline)

- **Fixed preset** (browser-proof/receipts/scene-macro-preset-declared-rows.png): /deck?scene=macroCrossAsset carries exactly US10Y · DXUSD · GCUSD · SIUSD · CLUSD · BTCUSD — the model's own frozen declaration, in order, at chartCount 6.
- **Time-windowed preset**: /deck?scene=indexNow's wall equals `indexNowTickersFor(new Date())` windowed by the model itself, compared IN the same browser at the same instant so the time dependence cancels — whatever the model declares for now is what the wall carries.
- With the cohort and family proofs of round 4, every scene KIND is now browser-proven to deliver its declared rows: fixed presets, time-windowed presets, cohort membership, family baskets. Also recorded from this sweep: /parity makes NO data reads at all (a static analysis page — authority-clean by construction).

Rollback: this unit adds a proof only; no served file changed.

---

## 2026-08-19T18:06:26Z — /fundamentals: absent balance fields are flagged by name, not minted into net debt

Command: `PW_MODULE_DIR=… node browser-proof/proofs/fy-consistency.mjs` (route /templates/fundamentals.html, NVDA; balance_history answered per page; asserts inline)

- **total_debt NULL** (browser-proof/receipts/fundamentals-null-debt-flagged.png): the flags line says "balance_history.total_debt is null — net debt treats debt as 0 and WACC as all-equity; fair value is OVERSTATED if this name carries debt". Before this unit, `(b.total_debt||0)-(b.cash_and_equiv||0)` silently valued every such ticker debt-free — a missing balance row produced zero net debt, an all-equity WACC, and no sign anywhere.
- **Complete balance row** (browser-proof/receipts/fundamentals-complete-balance-no-flag.png): no absence flag, valuation renders normally — the flag appears exactly when the absence does.
- The same unit aligned buildBase's ratio windows with the rule the DCF FY baseline enforces: D&A% and capex% denominators now come from the SAME rows as their numerators (the same 4 quarters, or the same single FY — a mismatched FY pair keeps the flagged default rather than a cross-year ratio; an offset cashflow-vs-income quarter window is flagged out loud). fundamentals.revenue_ttm stays the projection BASE — currency there, consistency in ratios. A terminally underivable share count is flagged "NOT meaningful" instead of silently dividing by a 1B placeholder. Functional pins drive every case in tests/station-fundamentals-price.test.mjs.

Zero page errors in both scenarios. Rollback: revert the single commit carrying this unit — derivation and flag wording only; no schema, no authority, no methodology change (the DCF formulas are untouched; only the window selection and absence visibility moved).

---

## 2026-08-19T18:07:00Z — ticks, repaint and provider-vs-display, browser-verified; CLOSED-label disposition

Command: `PW_MODULE_DIR=… node browser-proof/proofs/tick-repaint.mjs` (asserts inline)

- **Provider-vs-display**: the chart's day change equals the exact quote the provider served — 0.29% for NVDA 347/346, then 9.83% after a tick to 380; the deck pane likewise (0.33% → 16.94%). No display number differs from the provider's arithmetic.
- **Ticks**: the standalone chart takes a changed provider quote within one 10s poll (browser-proof/receipts/tick-chart-updates-from-provider.png); a deck pane takes it within one 10s pump heartbeat through the authority shim (browser-proof/receipts/tick-deck-pane-updates-from-provider.png).
- **Repaint**: through a cold 1W range switch, 20 continuous canvas samples — zero blank frames; the previous paint stands until the next is ready (browser-proof/receipts/repaint-1W-no-blank.png).
- **Deck healthy state**: the header paints **LIVE** with all panes ready and stamped (browser-proof/receipts/deck-header-LIVE-healthy-state.png) — the state that threw `ReferenceError: delayed is not defined` before `06e4a0a`, now proven in a real browser.
- **CLOSED labels — disposition**: no market-session CLOSED label exists anywhere in this repository (searched all served HTML/JS, case-insensitive, including "closed", "session", market-hours patterns; the only matches are WebRTC connection states and prose). The filed "CLOSED despite live feed" defect lives in the separate scintilla-hub deploy, which this branch's standing locks forbid editing. Kept visible as a cross-repo defect in the handoff; not representable, therefore not claimed, here.

---

## 2026-08-19T18:07:04Z — an unknown day change gets neither a sign nor a direction colour

Command: `PW_MODULE_DIR=… node browser-proof/proofs/unknown-change.mjs` (asserts inline; reads the painted tape and its computed colours)

`null >= 0` is **true** in JavaScript, so every unguarded directional ternary painted UNKNOWN as UP — a systematic bullish tint on missing data. `/ticker` went further and fabricated the value itself: `|| 0` turned "nobody sent a change" into a REPORTED FLAT DAY, printed `+0.00%` in the up colour, and fed that zero into the movers ranking as the least-moving symbol in the universe.

Four symbols served through the tape's own universe read (browser-proof/receipts/ticker-unknown-change-neutral.png):

- **A known gain** paints `+2.50%`, class `up`; **a known loss** paints `(1.25%)`, class `dn` — unchanged.
- **A REPORTED zero** still paints `+0.00%`, class `up`. This is the line the fix must not cross: refusing *unknown* is not refusing *zero*, and a landed zero is a real observation (rule 4 — emptiness is decided on the raw value).
- **An unknown change** (null on both `chg_pct` and `change`) paints `—` in the neutral colour, computed-colour-asserted as neither the up nor the down colour. It used to paint `+0.00%` in green.
- **No symbol is dropped**, and the unknown ranks *after* every known mover instead of impersonating the calmest stock on the board.

The same `null >= 0` shape was fixed in two more places the sweep found: `templates/allocation-module.html` painted its "—" day cell green, and `templates/sector-rotation.html` rendered a signed em-dash percentage (`+—%`) in green — now dim, and worded "change unknown". `/heat` was swept too and was already correct (both its colour functions refuse on null), which is what the fixed pages now match.

Zero page errors. Rollback: revert the single commit — three guarded ternaries, one un-fabricated value, one ranking partition, pins and this proof. No data lane, authority or methodology changed.

---

## 2026-08-19T18:07:26Z — the watch-later lane tells the truth: unknown is said, lost writes say why

Command: `PW_MODULE_DIR=… node browser-proof/proofs/wl-truth.mjs` (page-level failure injection; asserts inline)

- **The mounted shell with the saved-list read DEAD** (browser-proof/receipts/shell-wl-read-dead-unknown.png): every card star paints the UNKNOWN "?" state ("watch-later state unknown — the saved-list read failed · a click retries the read"), zero cards claim saved-or-unsaved, and the bWatch button reads "watch later — state unknown" — a failed read is never data. A click on an unknown star retries the read and, still failing, flashes "★ unavailable — the saved-list read failed · nothing was changed" without flipping anything. The watch-later list itself paints "the watch-later read failed — the saved list is unavailable, not empty · retrying at the next refresh" (browser-proof/receipts/shell-wl-list-read-failed-named.png) — the old "YouTube reconnect required" wording, which named YouTube auth as the cause of a failed Supabase table read, is gone from the mounted shells and /pane-video (video-v1 keeps it: retained rollback, exempt by ruling).
- **The read lands, then a write is lost** (browser-proof/receipts/shell-wl-lost-write-said.png): the landed read paints exactly the saved video ★; a save click flips optimistically, the 500 settles, the flip REVERTS and the reason is said — "★ not saved — the shared watch-later write failed · try again". The shells used to revert silently; the gesture just vanished.
- **A lost subscribe says why**: "subscribe failed — the shared write did not land · try again" — the catch used to swallow it whole.
- **/youtube keeps the feed's own served flags** (browser-proof/receipts/youtube-wl-read-dead-feed-snapshot.png): the feed rows arrive with a server-side watch_later column — landed data. With the dedicated saved-list read dead, the flagged video KEEPS its star (it used to be zeroed by an empty page cache), the Watch Later chip wears a persistent "!" marker titled "the saved-list read failed — ★ rides the feed snapshot, not the saved list", and the failure is caught — before this unit it was an unhandled promise rejection.

Zero page errors in every scenario. Rollback: revert the single commit carrying this unit — said states, guards, pins and this proof; no data lane, authority or methodology changed; the rollback shell untouched.

---

## 2026-08-19T18:07:30Z — /youtube: a lost shared write no longer stays painted as saved

Command: `PW_MODULE_DIR=… node browser-proof/proofs/yt-lost-write.mjs` (route /youtube/; three fixture youtube_feed rows, empty yt_watch_later; yt-act answered per page; asserts inline)

- **Write lost** (browser-proof/receipts/yt-star-lost-write-reverted.png): the star flips on optimistically, then REVERTS within one settle (DOM: `.sc-ytc__star` loses `is-on`; `ytWLGet().size === 0`), and the page's flash surface says "★ not saved — the shared watch-later write failed · try again" for long enough to read. Before this unit the failure was swallowed (`.then(r => r.json()).catch(() => null)`, result ignored): the star stayed painted "saved", the shared table never changed, and the lie stood until the next reconcile read.
- **Write landed** (browser-proof/receipts/yt-star-landed-write-stays.png): the star stays, `ytWLGet()` carries the id, no failure flash — success and failure are now different pictures.
- Success detection is a LANDED write only: non-2xx and error bodies resolve null (a 500 whose JSON parses is not a success).
- **Scope notes, measured in code**: the two mounted video shells already REVERT on this failure (state-honest) but stay reason-silent — recorded as a lesser gap, not repaired here, because their only failure surface today is the watch-list read lane and hijacking it would blank the list; their `subscribeToChannel` catch is the same state-honest/reason-silent shape. The 10s-cadence `ytPosPush` position write keeps its silent catch by design: positions re-push on cadence, so a lost write is retried by the next tick rather than lied about.

Zero page errors in both scenarios. Rollback: revert the single commit carrying this unit — the change is client-render behavior only (no schema, no endpoint, no authority change).

---

## 2026-08-19T18:10:25Z — a size is a claim: an unknown SIZE metric is a placeholder, not a measurement

Command: `PW_MODULE_DIR=… node browser-proof/proofs/unknown-size.mjs` (asserts inline; measures the laid-out box geometry, not the source)

`/reflow` picks its cell AREA from `?size=` and its rank from `?rank=`, **independently** — so a ticker can carry a perfectly good rank value and no market cap at all. In the default view (rank by change, size by market cap) that used to draw at size 1 against real caps whose sqrt runs to the hundreds of thousands: an unmarked sliver reading as "a negligible company" when the truth is "nobody told us how big it is". The gap marking beside it is computed on the RANK value, so nothing said otherwise.

Four tickers, equal footing on rank, caps 9T / 4T / 1T / **null** (browser-proof/receipts/reflow-unknown-size-placeholder.png):

- **The knowns still claim their size** — 9T draws larger than 4T draws larger than 1T, none marked, none disclaimed.
- **The unknown is a marked placeholder**: it carries the `nosize` dashed outline and the title "mcap unknown, so this cell's SIZE is a placeholder, not a measurement", and its measured area sits **above the smallest known cell and below the largest** — the median of what IS known, a deliberately uninformative middle. It is no longer the sliver.
- **Its rank value is untouched** and still painted: only the size was ever missing, and the cell is not a rank gap.

Zero page errors. Rollback: revert the single commit — one sizing helper, one marking class, pins and this proof. No data lane, authority or methodology changed.

---

## 2026-08-19T18:11:13Z — a size is a claim: an unknown SIZE metric is a placeholder, not a measurement

Command: `PW_MODULE_DIR=… node browser-proof/proofs/unknown-size.mjs` (asserts inline; measures the laid-out box geometry, not the source)

`/reflow` picks its cell AREA from `?size=` and its rank from `?rank=`, **independently** — so a ticker can carry a perfectly good rank value and no market cap at all. In the default view (rank by change, size by market cap) that used to draw at size 1 against real caps whose sqrt runs to the hundreds of thousands: an unmarked sliver reading as "a negligible company" when the truth is "nobody told us how big it is". The gap marking beside it is computed on the RANK value, so nothing said otherwise.

Four tickers, equal footing on rank, caps 9T / 4T / 1T / **null** (browser-proof/receipts/reflow-unknown-size-placeholder.png):

- **The knowns still claim their size** — 9T draws larger than 4T draws larger than 1T, none marked, none disclaimed.
- **The unknown is a marked placeholder**: it carries the `nosize` dashed outline and the title "mcap unknown, so this cell's SIZE is a placeholder, not a measurement", and its measured area sits **above the smallest known cell and below the largest** — the median of what IS known, a deliberately uninformative middle.
- **What it did before, measured rather than argued**: restoring the old `1`-for-unknown and re-running this proof against the same board gives the unknown-cap cell **area 0**. reflow hides any cell under 2px, so the ticker did not merely READ as negligible — it was **removed from the board**, silently shrinking the universe while the header still counted it. That is the defect in its true size.
- **Its rank value is untouched** and still painted: only the size was ever missing, and the cell is not a rank gap.

Zero page errors. Rollback: revert the single commit — one sizing helper, one marking class, pins and this proof. No data lane, authority or methodology changed.

---

## 2026-08-19T18:13:32Z — the authority sweep: eight equity surfaces, zero unreviewed hosts at runtime

Command: `PW_MODULE_DIR=… node browser-proof/proofs/authority-sweep.mjs` (asserts inline; no screenshots — the assertions ARE the evidence, regenerable)

/geiger/ · /heat/ · /cohort/ · /compare/ · /ticker/ · /wall/ · /analytics/ · /geigerwall/ — each loads over the rig with **zero page errors**, paints a real surface, and makes **zero requests to any non-owner host at all**: no Yahoo, no FMP, no CORS proxy, and — since the vendoring — no CDN either. A deliberate canary request to an unserved host must land in the refusal log, so a silent interception failure cannot fake a clean sweep.

This is the runtime half of the round-9 authority audit; the source half measured: zero Yahoo/FMP fetch lanes in served HTML outside sector-rotation's reviewed-relays-only flagged fallback (its third-party proxy lane was retired in F1's own fix, verified still absent); /health the only direct provider fetch (the ruled exception — /analytics's grep hit is banner prose); 20/20 shim-tag coverage on pages that read shim-owned tables (the remaining grep hits — /, /components — are prose descriptions, classified by eye).

---

## 2026-08-19T18:13:39Z — an empty FAV names itself, and the way out works

Command: `PW_MODULE_DIR=… node browser-proof/proofs/cohort-empty-fav.mjs` (hub_favorites answers zero rows — a successful empty read, not a failure)

- **The wall says why it is empty** (browser-proof/receipts/cohort-empty-fav-named.png): "no favorites yet — the wall is empty, not broken · choose a cohort or edit the slot", with the indicator counting "page 1 / 1 · 0 favorites". Before this unit the state rendered as one blank editable slot with no wording anywhere on the wall. The wording is gated on the read having landed: before COHORT_READY the count is not yet a fact, and the note does not claim it.
- **Choosing a cohort still replaces the (empty) favorites** (browser-proof/receipts/cohort-empty-fav-to-cohort.png): AI SOFTWARE fills the wall with its full declared membership (7 members) from the empty state.

Zero page errors.

---

## 2026-08-19T18:13:49Z — filed defects 1–2 FIXED and browser-verified: cohorts replace the favorites rows

Command: `PW_MODULE_DIR=… node browser-proof/proofs/cohort-scene.mjs` (asserts inline; a failed assertion fails the run)

- `/deck/?scene=cohort` lands on **FAV — MU, NBIS, SNDK** (the favorites rows, added order): browser-proof/receipts/cohort-FAV-favorites-rows.png
- Choosing **AI SOFTWARE** replaces them with **ADBE, CRM, MSFT, NOW, ORCL, PLTR** (page 1 / 2 · 7 members; no favorite present): browser-proof/receipts/cohort-AI_SOFTWARE-replaces-favorites.png
- Its page 2 pages honestly to **SNOW** alone: browser-proof/receipts/cohort-AI_SOFTWARE-page2.png
- Choosing **MEGACAP** replaces them with **AAPL, AMZN, GOOGL, META, MSFT, NVDA**: browser-proof/receipts/cohort-MEGACAP-replaces-favorites.png
- Choosing FAV again restores the favorites rows; zero page errors across the flow.

---

## 2026-08-19T18:14:09Z — the pane's direction color is claimed from the day's baseline, or not claimed at all

Command: `PW_MODULE_DIR=… node browser-proof/proofs/day-direction.mjs` (asserts inline; reads CANVAS PIXELS, not text)

The defect this proves fixed was invisible to source pins and to every text assertion: `chDayChange` already refused to state a day change without the provider's previous close (the badge said "—"), but the pane behind it was painted bull or bear regardless, because the draw path's baseline fell back to `pts[0].p` — the first bar of the LOADED WINDOW. That baseline moves with the range control, so the same prices could paint green at one range and red at another with no market event between them. On a wall, the color is what gets read.

Three scenarios on the same page with the same history, only the previous close changing — the pane's painted pixels counted against the `--bull`/`--bear`/`--ink2` tokens at a tight distance so antialiasing cannot vote:

- **Baseline known, below price** (browser-proof/receipts/chart-day-baseline-known-up.png): badge `20.00%`, pane **bull**, zero bear pixels.
- **Baseline known, above price** (browser-proof/receipts/chart-day-baseline-known-down.png): badge `(20.00%)`, pane **bear**, zero bull pixels.
- **Baseline UNKNOWN — the fix** (browser-proof/receipts/chart-day-baseline-unknown-neutral.png): badge `—`, pane **neutral**, **zero bull pixels and zero bear pixels**, with the series still drawn (neutral, not absent). Before this unit that same scenario painted a confident direction from a number nobody sent.

Zero page errors in all three. The mounted `/station-shells/chart-v1` is the byte-exact mirror of this file (gate-enforced), so the Station wall's panes carry the same refusal.

Rollback: revert the single commit — `chDayRef()`, the neutral branch, the removal of the three `_ref` substitution writes, pins and this proof. No data lane, authority or methodology changed; the previous close itself is read exactly as before.

---

## 2026-08-19T18:14:16Z — the DCF FY baseline rides the history tables; the shortfall stays flagged

Command: `PW_MODULE_DIR=… node browser-proof/proofs/dcf-baseline.mjs` (fixture universe carries 8 of the 10 bar tickers; asserts inline)

- **Derived exactly** (browser-proof/receipts/dcf-fy-baseline-partial-overlay.png): NVDA's netDebt/D&A%/capex%/ΔNWC% in the running page equal the arithmetic over the fixture's own FY rows (net_debt in billions; D&A = ebitda − operating_income; capex sign normalized; ΔNWC over the same fiscal date).
- **The shortfall is worn, not hidden**: TSM and IREN are absent from the fixture universe, keep every Jul-24 static value, and the fy-baseline badge reads STALE with "netDebt 8/10 · D&A% 8/10 · capex% 8/10 · ΔNWC% 8/10" — a partial overlay never claims LIVE.
- **What has no DB source stays STATIC by name**: margin/tax defaults · MRP · debt weight, as-of the stated vintage.

Live field availability behind this unit was measured read-only the same day: all ten bar tickers carry complete latest-FY rows in balance_history/cashflow_history/fundamentals_history (balance_history carries net_debt directly), so on the real database the badge should read LIVE 10/10 — the rig's 8/10 is the fixture's own deliberate shape, not a claim about the owners' data.

Zero page errors.

---

## 2026-08-19T18:14:24Z — the DCF growth/margin slider seeds ride the FY history; the shortfall stays flagged

Command: `PW_MODULE_DIR=… node browser-proof/proofs/dcf-seeds.mjs` (route /templates/dcf.html, NVDA boot; fixture universe carries 8 of the 10 bar tickers; asserts inline)

- **Derived exactly and VISIBLE** (browser-proof/receipts/dcf-seeds-partial-overlay.png): NVDA's growth default equals the FY-to-FY revenue CAGR over the fixture's own rows and its margin default equals the latest FY's own margin — both land in TICKERS and on the sliders the user then owns (range inputs snap to their 0.5 step; asserted within one step). Clamps and window rules mirror the fundamentals cockpit: g 0..80, m 5..90, a CAGR needs two FY rows more than half a year apart.
- **The shortfall is worn, not hidden**: TSM and IREN are absent from the fixture universe and keep their Jul-24 static seeds; the fy-seeds badge reads STALE with "growth default 8/10 · EBITDA-margin default 8/10" — a partial overlay never claims LIVE.
- **What has no DB source stays STATIC by name**: tax default · terminal growth · MRP · debt weight (fundamentals_history carries no tax line — measured schema, round 5) — the static-baseline badge and the as-of bar both say so.

Zero page errors. Rollback: revert the single commit carrying this unit — seed derivation and badge wording only; the DCF formulas, price authority and Geiger methodology are untouched, and no provider history was written or deleted.

---

## 2026-08-19T18:14:39Z — the inventory sweep: runtime coverage completed, and the LINES panel says its library is dead

Command: `PW_MODULE_DIR=… node browser-proof/proofs/inventory-sweep.mjs` (asserts inline; one screenshot for the found defect)

- **33 remaining surfaces loaded clean** — entry, ops, market (/parity), media, the visuals lab, the standalone spec pages: zero page errors, real painted surfaces, zero requests outside each page's CLASS allowance (data lanes: the two owners only; media-mounting pages: YouTube embed hosts; the retained rollback sector-rotation-older: its reviewed hub relay + its legacy unpkg tag, exempt by ruling — no other page touches a CDN since the vendoring). Together with authority-sweep.mjs and the per-page proofs, EVERY served surface in the route inventory has now been loaded at least once under authority assertions — except the X lane, excluded because H2 is proof-gated (the bridge draft's offscreen document is recorded as throwing outside its extension context; its guard waits behind the same gate).
- **The found defect, proven fixed on the vendored library** (browser-proof/receipts/sector-lines-cdn-dead-said.png): with the same-origin /_vendor lightweight-charts script blocked, the LINES panel SAYS "lightweight-charts (vendored same-origin) did not load — unavailable, not empty; every other panel is unaffected", the chart calls are guarded, and leaders/heatmap still follow a range click with the library dead — zero page errors before and after. (The healthy load — the vendored library actually executing — is covered by the sweep above.)

Rollback: revert the single commit carrying this unit — a said state, guards, pins and this proof; no data lane, authority or methodology changed; the rollback copy untouched.

---

## 2026-08-19T18:14:47Z — the Station WALL refuses the day's direction when the provider states no previous close

Command: `PW_MODULE_DIR=… node browser-proof/proofs/deck-day-direction.mjs` (asserts inline; reads the canvas pixels INSIDE the mounted shell iframes)

`day-direction.mjs` proves the refusal on standalone `/chart`. This proves it where it matters: on `/deck`, whose panes are `/station-shells/chart-v1` iframes fed by the **deck's own** quote path — deck reads live_quotes, the provider shim rewrites that read to the provider's `/quotes`, deck maps the row and posts it across the frame boundary, and the shell's `scChartLive` puts the previous close into the map the pane colour is drawn from. A fix that held on the standalone page and broke anywhere along that chain would leave the wall still lying, so the wall is asserted on its own.

- **The provider states a previous close below the price** (browser-proof/receipts/deck-wall-day-baseline-known-up.png): every painted pane on the wall is **bull**, zero bear pixels — the claim still gets made when it is earned.
- **The provider states NO previous close — the fix** (browser-proof/receipts/deck-wall-day-baseline-unknown-neutral.png): every painted pane is **neutral**, with **zero bull and zero bear pixels**, and each pane's badge reads `—`. The series is still drawn; only the directional claim is withdrawn. Before this fix the wall painted a confident green or red here, from the first bar of whatever window happened to be loaded.

Zero page errors on the wall in both states.

Rollback: this proof is evidence only — it changes nothing. The unit it covers reverts with `chDayRef`'s commit.

---

## 2026-08-19T18:14:57Z — /news and /cohorts main reads: named when never loaded, STALE-stamped when they die mid-life

Command: `PW_MODULE_DIR=… node browser-proof/proofs/main-read-failure.mjs` (forced 500s; mid-life failures injected by re-routing after a healthy load and invoking the page's own tick(); asserts inline)

- **/news never loads** (browser-proof/receipts/news-main-read-never-loaded.png): "the news read failed — the wire is unavailable, not empty · retrying at the next refresh" — named and distinct from the empty-filter wording; the old boot catch said only "news unavailable".
- **/news dies after a healthy load** (browser-proof/receipts/news-refresh-failed-stale-stamp.png): the held headlines STAY (a failed read never erases knowledge) and the freshness line says "REFRESH FAILED — showing the read from Xs ago — the news read is failing, the list below is stale · retrying". Before, the interval catch was silent: the list froze with a "newest Xm ago" stamp that became false as time passed.
- **/cohorts never loads** (browser-proof/receipts/cohorts-main-read-never-loaded.png): the strip names the failed source ("the ticker_cohorts read failed — …"), not "cohort data unavailable".
- **/cohorts dies after a healthy load** (browser-proof/receipts/cohorts-refresh-failed-stale-marker.png): every chip is kept and a visible marker appends — "refresh failed (ticker_cohorts) — these chips are stale · retrying" — cleared naturally by the next successful rebuild.

Zero page errors across all four scenarios. Rollback: revert the single commit carrying this unit — render wording and failure-state plumbing only; queries, authorities and refresh cadences untouched.

---

## 2026-08-19T18:15:08Z — degraded states, photographed: absence renders as absence

Command: `PW_MODULE_DIR=… node browser-proof/proofs/degraded-states.mjs` (asserts inline; failures injected per page over the healthy rig)

- **/health, provider dead** (browser-proof/receipts/degraded-health-provider-dead.png): all three equity lanes fail with the failure word; the database lanes still answer beside them (the fixture roster carries rows the way the live tables do); the internals lane stays BAD by construction — the fixtures deliberately carry ZERO rows for ADD/PCC/CUMTICK/TICK/TRIN, mirroring their measured live state.
- **/health, Supabase dead** (browser-proof/receipts/degraded-health-supabase-dead.png): provider quotes still answer, and the universe row fails CLOSED — "identity unverified — canonical set unreadable; count alone is not identity" — while the roster lane says "none readable" (a member that cannot be read is not a healthy member).
- **/allocation, every voter dead** (browser-proof/receipts/degraded-allocation-no-voters.png): header UNAVAILABLE — NO VOTER ANSWERED, heat —, targets and moves UNAVAILABLE, the trace declines to narrate, the ranking says "no candidate carries an accepted composite" and lists the unscored names. No fabricated NEUTRAL anywhere. **This scenario caught a real defect the source pin could not**: the cohort table's empty-state message sat behind `html || fallback`, but `html` always carries the header row, so the promised message was unreachable — zero ranked rows painted a bare header (an empty panel where a named absence was promised). Fixed by deciding emptiness on the raw row count; the COMPARABLES table had the same dead gate (its old fallback even named a state that cannot occur, since dropped rows stay rendered greyed-out) — both now append the named absence under the kept header.
- **/fundamentals, provider quotes dead** (browser-proof/receipts/degraded-fundamentals-quotes-dead.png): the header and banner state the missing price; valuation is disabled and STAYS disabled through a slider drag (the render-time gate, exercised in a real browser); the universe and fundamentals sections load normally around it. Also fixed in this unit: the page's boot had no catch, so a cold provider outage used to stop the whole page from booting with no banner at all — the universe failure now paints where the universe status lives and the ticker sections still load.

Zero page errors across all four scenarios.

---

## 2026-08-19T18:15:09Z — /econ, /alerts, /news: dead reads named; empty tables keep their own words

Command: `PW_MODULE_DIR=… node browser-proof/proofs/panel-failed-reads.mjs` (forced 500s per page over the healthy rig; asserts inline)

These three pages still carried the catch(() => null) flattening the round-4 sweep removed elsewhere — found by re-measuring the repo instead of trusting the earlier "swept" claim (the unit pins only banned the spaced spelling, so the unspaced form survived the audit).

- **/econ, empty tables** (browser-proof/receipts/econ-empty-tables-empty-words.png): the fixture's honest empty state — "econ_dashboard has no rows" and "no calendar rows for this filter", no failure words anywhere.
- **/econ, both reads dead** (browser-proof/receipts/econ-dead-reads-named.png): the tiles and the calendar each name their failed source and the retry; the empty-filter claim never appears over a failure. Before: a dead dashboard read was a BLANK strip and a dead calendar read claimed "no calendar rows for this filter".
- **/alerts, both reads dead** (browser-proof/receipts/alerts-dead-reads-named.png): feed health and ticker alerts say "unavailable, not quiet · retrying" — a dead read no longer impersonates a quiet feed.
- **/news, sentiment dead** (browser-proof/receipts/news-dead-sentiment-named.png): the chip says "sentiment read failed — unavailable, not neutral · retrying" while the wire renders normally beside it; before, the chip silently vanished, identical to a ticker with no sentiment row.

Remaining catch-null sites, dispositioned rather than swept: /youtube's ytAct is a WRITE lane (star/unstar) whose failure silently loses a shared write — its own audit finding, and any fix must respect the shell mirrors; /templates/sector-rotation.html's spark catches feed the E1 coverage gate (PARTIAL / NOT PROVIDER AUTHORITY — visibly gated); /templates/dcf.html's three FY-baseline catches keep the flagged static value and are counted per field in the badge; /cohorts' hub_favorites catch is the kept marker behind its named tooltip; sector-rotation-older is the retained rollback copy, left as-is.

Zero page errors.

---

## 2026-08-19T18:15:19Z — the catch-null sweep, browser-verified: failures render as failures

Command: `PW_MODULE_DIR=… node browser-proof/proofs/failed-reads.mjs` (board_rsi and earnings_events forced to 500; asserts inline)

- **/ranks**: the RSI column says "board_rsi did not answer — this ranking is unavailable, not empty · retrying", with zero per-ticker "no data" claims; the healthy CHG column still ranks beside it: browser-proof/receipts/failed-read-ranks-rsi-column.png
- **/events**: the calendar says the read failed — "unavailable, not clear" / "unavailable, not absent" — instead of "nothing scheduled in the next 14 days": browser-proof/receipts/failed-read-events-calendar.png
- **/reflow**: the field refuses to draw grey non-answers over a failure and names the failed source: browser-proof/receipts/failed-read-reflow-rsi.png
- /cohorts' FAV chip now carries the failure in its tooltip when hub_favorites dies (source-pinned in tests; the chip still navigates).

---

## 2026-08-19T18:15:20Z — /pulse: a dead read no longer wears an empty table's words

Command: `PW_MODULE_DIR=… node browser-proof/proofs/pulse-failed-reads.mjs` (asserts inline; failures injected per page over the healthy rig)

- **vix_term dead, all else healthy** (browser-proof/receipts/pulse-vixterm-dead-beside-live-price.png): geiger counts and macro render normally, and the VIX section shows the live price BESIDE "vix_term did not answer · retrying" — the failure is named, the healthy half still speaks, and "no vix source" (the honest empty wording) never appears over a failure.
- **provider dead** (browser-proof/receipts/pulse-provider-dead-fails-closed.png): the shim fails its owned reads closed, so GEIGER and MACRO say their sources "did not answer — unavailable, not empty · retrying" in the failure style, while vix_term — never shim-owned — still answers with the /3M term ratio beside the dead-quotes marker. Before this unit, every one of these states rendered as "no composite_staged" / "no live_quotes": a dead read and an empty table were the same strip.

Zero page errors in both scenarios.

---

## 2026-08-19T18:15:29Z — the realtime lane tells the truth at every stage, on the vendored library

Command: `PW_MODULE_DIR=… node browser-proof/proofs/realtime-absence.mjs` (asserts inline)

- **Script absent** (browser-proof/receipts/realtime-absent-said-on-the-wall.png): with the vendored /_vendor/supabase-js blocked, the deck paints "RT · absent" beside #marketStatus with the reason, SC_REALTIME.available === false, the freshness lane untouched, nothing errors.
- **Script present — the REAL library** (browser-proof/receipts/realtime-channel-error-said.png): the vendored npm-verified bytes execute in the rig (typeof supabase.createClient === "function" — no stub), availability flips, and the channel state is honest about the offline rig ("connecting" or a terminal failure). The WIRED status callback — pinned in the equity-authority suite as the exact function the channel calls — is driven through CHANNEL_ERROR ("RT · not connected", reason in the title) and SUBSCRIBED (note hidden). "Available" no longer means merely "script present": the channel lifecycle is the lane's truth.

Rollback: revert the vendoring commit — the CDN tags return; behavior is otherwise unchanged.

---

## 2026-08-19T18:15:31Z — filed defect 3 FIXED and browser-verified: AI POWER shows its declared rows

Command: `PW_MODULE_DIR=… node browser-proof/proofs/family-scene.mjs` (asserts inline)

- THEME FAMILIES defaults unchanged (AI COMPUTE: NVDA, TSM, AVGO, ASML, MU, SNDK); the family picker is visible on family scenes and hidden elsewhere.
- Choosing **AI POWER** renders exactly its declared rows — **OKLO, IREN, CIFR, BE, WULF, USAR**: browser-proof/receipts/family-AI_POWER-declared-rows.png
- The choice survives leaving and re-entering the scene (session memory).
- SECTOR FAMILIES' **DEFENSIVE** basket is reachable the same way: browser-proof/receipts/family-DEFENSIVE-declared-rows.png
- Zero page errors across the flow.

---

## 2026-08-19T18:15:35Z — rig smoke + BEFORE state of the filed cohort defects

Command: `PW_MODULE_DIR=… node browser-proof/proofs/rig-smoke.mjs`

- Deck boots under fixtures with page errors: none.
- Scene select options: live, indexNow, indexLeadership, companyLeadership, focus2, macroCrossAsset, internalsFast, internalsSlow, sectorFamilies, themeFamilies, cohort, custom — **no cohort scene is reachable** (defects 1–2: AI_SOFTWARE / MEGACAP cannot replace the favorites-based rows because no cohort can be chosen at all; the legacy "cohort" id normalizes to themeFamilies).
- THEME FAMILIES renders NVDA, TSM, AVGO, ASML, MU, SNDK — the FIRST basket (AI COMPUTE); **AI POWER's declared rows are unreachable** (defect 3: familyBasket() is never given an id).
- Screenshots: browser-proof/receipts/rig-smoke-deck-live.png · browser-proof/receipts/before-themeFamilies-always-first-basket.png

---

## 2026-08-19T18:15:44Z — the preset scenes paint their declared rows: the first-basket class closed for every scene kind

Command: `PW_MODULE_DIR=… node browser-proof/proofs/scene-declared-rows.mjs` (asserts inline)

- **Fixed preset** (browser-proof/receipts/scene-macro-preset-declared-rows.png): /deck?scene=macroCrossAsset carries exactly US10Y · DXUSD · GCUSD · SIUSD · CLUSD · BTCUSD — the model's own frozen declaration, in order, at chartCount 6.
- **Time-windowed preset**: /deck?scene=indexNow's wall equals `indexNowTickersFor(new Date())` windowed by the model itself, compared IN the same browser at the same instant so the time dependence cancels — whatever the model declares for now is what the wall carries.
- With the cohort and family proofs of round 4, every scene KIND is now browser-proven to deliver its declared rows: fixed presets, time-windowed presets, cohort membership, family baskets. Also recorded from this sweep: /parity makes NO data reads at all (a static analysis page — authority-clean by construction).

Rollback: this unit adds a proof only; no served file changed.

---

## 2026-08-19T18:15:56Z — a failed main read never claims the owner's absence: /youtube's feed fixed, the axis consumers photographed

Command: `PW_MODULE_DIR=… node browser-proof/proofs/feed-truth.mjs` (page-level failure injection; asserts inline)

- **/youtube, feed read DEAD** (browser-proof/receipts/youtube-feed-read-failed-said.png): the grid paints "youtube feed · read failed — the wire is unavailable, not empty · retrying at the next pass" — and does NOT paint "the youtube_feed table is empty" or blame the ingester. Before this unit the catch painted exactly those words for any transport failure: the owner's absence claimed off a read that never landed (rule 1 + rule 2 in one sentence). Zero page errors.
- **/youtube, feed read LANDED empty** (browser-proof/receipts/youtube-feed-landed-empty-owner-absence.png): the owner's wording survives — "awaiting feed — the youtube_feed table is empty; cards fill per video when the ingester lands" — because off a landed zero-row read that claim is now TRUE (rule 4: emptiness decided on the raw value).
- **The axis-consumer sweep's runtime half** (browser-proof/receipts/cohort-axis-dead-named.png, browser-proof/receipts/geigerwall-axis-dead-named.png): with `ticker_cohorts` dead at the page, /cohort boots to "cohort data unavailable" and /geigerwall to "cohort data unavailable — wall cannot compose", both with zero page errors — the last two of the ten SC_COHORT_AXIS consumers whose failure paint had never been photographed. The other eight were re-read this round: all answer a boot failure with a named state (analytics counts the axis as a feed and stamps COHORT AXIS FAILED; events refuses with the message; heat paints the COHORT HOMES UNAVAILABLE group; compare's init catch names the database; allocation's spine goes FALLBACK by name; fundamentals converts the flag to a throw under its boot guard; deck and the cohorts strip were fixed in earlier rounds).

Rollback: revert the single commit carrying this unit — one flag, one two-sentence branch, pins and this proof; no data lane, authority or methodology changed.

---

## 2026-08-19T18:16:10Z — /fundamentals: absent balance fields are flagged by name, not minted into net debt

Command: `PW_MODULE_DIR=… node browser-proof/proofs/fy-consistency.mjs` (route /templates/fundamentals.html, NVDA; balance_history answered per page; asserts inline)

- **total_debt NULL** (browser-proof/receipts/fundamentals-null-debt-flagged.png): the flags line says "balance_history.total_debt is null — net debt treats debt as 0 and WACC as all-equity; fair value is OVERSTATED if this name carries debt". Before this unit, `(b.total_debt||0)-(b.cash_and_equiv||0)` silently valued every such ticker debt-free — a missing balance row produced zero net debt, an all-equity WACC, and no sign anywhere.
- **Complete balance row** (browser-proof/receipts/fundamentals-complete-balance-no-flag.png): no absence flag, valuation renders normally — the flag appears exactly when the absence does.
- The same unit aligned buildBase's ratio windows with the rule the DCF FY baseline enforces: D&A% and capex% denominators now come from the SAME rows as their numerators (the same 4 quarters, or the same single FY — a mismatched FY pair keeps the flagged default rather than a cross-year ratio; an offset cashflow-vs-income quarter window is flagged out loud). fundamentals.revenue_ttm stays the projection BASE — currency there, consistency in ratios. A terminally underivable share count is flagged "NOT meaningful" instead of silently dividing by a 1B placeholder. Functional pins drive every case in tests/station-fundamentals-price.test.mjs.

Zero page errors in both scenarios. Rollback: revert the single commit carrying this unit — derivation and flag wording only; no schema, no authority, no methodology change (the DCF formulas are untouched; only the window selection and absence visibility moved).

---

## 2026-08-19T18:16:18Z — the Hub entry: the live path's exact refusal, and the deck booting AT the hub origin

Command: `PW_MODULE_DIR=… node browser-proof/proofs/hub-entry.mjs` (rules parsed from vercel.json itself; asserts inline)

- **Live path, measured in the browser** (browser-proof/receipts/hub-entry-live-path-refused.png): Chromium pointed at https://station.scintillahub.ai/ through the environment's proxy fails with `page.goto: net::ERR_TUNNEL_CONNECTION_FAILED at https://station.scintillahub.ai/` — the CONNECT is refused before TLS begins, so nothing was bypassed and nothing live was reached or faked. The PREVIEW host gets the same measurement (browser-proof/receipts/hub-entry-preview-refused.png): `page.goto: net::ERR_TUNNEL_CONNECTION_FAILED at https://scintilla-widgets-git-cla-070619-aharveyrianhard-8432s-projects.vercel.app/deck/` — the branch's own deploy is equally unreachable from here, which is exactly the live-acceptance blocker the handoff carries. This is the browser-level twin of round 7's curl measurement: live acceptance still requires a browser outside this container.
- **The deck boots at the hub origin under the config's own rules** (browser-proof/receipts/hub-entry-deck-boots-at-hub-origin.png): navigating to https://station.scintillahub.ai/ with vercel.json's parsed rewrites applied over the rig serves the Station AT the hub host — title, StationScenes, the provider shim, the cohort axis and the mounted panes all up, location.host still the hub. ZERO asset 404s: every /deck dependency is absolute-pathed, so the root rewrite (source "/" only) breaks nothing — proven by outcome in a real browser, not by grep. The no-store cache rule rides every response, as pinned from the config.
- The config itself is pinned in tests/station-route-inventory.test.mjs: exactly two rewrites (hub root → /deck/, /status → orgstatus), no-store at all three cache layers.

This is stubbed-data page proof at the true hub ORIGIN — it verifies the entry path and the deck's behavior under the rewrite, not the live owners' data. Rollback: revert the single commit carrying this unit — proof, pin and receipts only; no served file changed.

---

## 2026-08-19T18:16:22Z — ticks, repaint and provider-vs-display, browser-verified; CLOSED-label disposition

Command: `PW_MODULE_DIR=… node browser-proof/proofs/tick-repaint.mjs` (asserts inline)

- **Provider-vs-display**: the chart's day change equals the exact quote the provider served — 0.29% for NVDA 347/346, then 9.83% after a tick to 380; the deck pane likewise (0.33% → 16.94%). No display number differs from the provider's arithmetic.
- **Ticks**: the standalone chart takes a changed provider quote within one 10s poll (browser-proof/receipts/tick-chart-updates-from-provider.png); a deck pane takes it within one 10s pump heartbeat through the authority shim (browser-proof/receipts/tick-deck-pane-updates-from-provider.png).
- **Repaint**: through a cold 1W range switch, 20 continuous canvas samples — zero blank frames; the previous paint stands until the next is ready (browser-proof/receipts/repaint-1W-no-blank.png).
- **Deck healthy state**: the header paints **LIVE** with all panes ready and stamped (browser-proof/receipts/deck-header-LIVE-healthy-state.png) — the state that threw `ReferenceError: delayed is not defined` before `06e4a0a`, now proven in a real browser.
- **CLOSED labels — disposition**: no market-session CLOSED label exists anywhere in this repository (searched all served HTML/JS, case-insensitive, including "closed", "session", market-hours patterns; the only matches are WebRTC connection states and prose). The filed "CLOSED despite live feed" defect lives in the separate scintilla-hub deploy, which this branch's standing locks forbid editing. Kept visible as a cross-repo defect in the handoff; not representable, therefore not claimed, here.

---

## 2026-08-19T18:16:26Z — an unknown day change gets neither a sign nor a direction colour

Command: `PW_MODULE_DIR=… node browser-proof/proofs/unknown-change.mjs` (asserts inline; reads the painted tape and its computed colours)

`null >= 0` is **true** in JavaScript, so every unguarded directional ternary painted UNKNOWN as UP — a systematic bullish tint on missing data. `/ticker` went further and fabricated the value itself: `|| 0` turned "nobody sent a change" into a REPORTED FLAT DAY, printed `+0.00%` in the up colour, and fed that zero into the movers ranking as the least-moving symbol in the universe.

Four symbols served through the tape's own universe read (browser-proof/receipts/ticker-unknown-change-neutral.png):

- **A known gain** paints `+2.50%`, class `up`; **a known loss** paints `(1.25%)`, class `dn` — unchanged.
- **A REPORTED zero** still paints `+0.00%`, class `up`. This is the line the fix must not cross: refusing *unknown* is not refusing *zero*, and a landed zero is a real observation (rule 4 — emptiness is decided on the raw value).
- **An unknown change** (null on both `chg_pct` and `change`) paints `—` in the neutral colour, computed-colour-asserted as neither the up nor the down colour. It used to paint `+0.00%` in green.
- **No symbol is dropped**, and the unknown ranks *after* every known mover instead of impersonating the calmest stock on the board.

The same `null >= 0` shape was fixed in two more places the sweep found: `templates/allocation-module.html` painted its "—" day cell green, and `templates/sector-rotation.html` rendered a signed em-dash percentage (`+—%`) in green — now dim, and worded "change unknown". `/heat` was swept too and was already correct (both its colour functions refuse on null), which is what the fixed pages now match.

Zero page errors. Rollback: revert the single commit — three guarded ternaries, one un-fabricated value, one ranking partition, pins and this proof. No data lane, authority or methodology changed.

---

## 2026-08-19T18:16:31Z — a size is a claim: an unknown SIZE metric is a placeholder, not a measurement

Command: `PW_MODULE_DIR=… node browser-proof/proofs/unknown-size.mjs` (asserts inline; measures the laid-out box geometry, not the source)

`/reflow` picks its cell AREA from `?size=` and its rank from `?rank=`, **independently** — so a ticker can carry a perfectly good rank value and no market cap at all. In the default view (rank by change, size by market cap) that used to draw at size 1 against real caps whose sqrt runs to the hundreds of thousands: an unmarked sliver reading as "a negligible company" when the truth is "nobody told us how big it is". The gap marking beside it is computed on the RANK value, so nothing said otherwise.

Four tickers, equal footing on rank, caps 9T / 4T / 1T / **null** (browser-proof/receipts/reflow-unknown-size-placeholder.png):

- **The knowns still claim their size** — 9T draws larger than 4T draws larger than 1T, none marked, none disclaimed.
- **The unknown is a marked placeholder**: it carries the `nosize` dashed outline and the title "mcap unknown, so this cell's SIZE is a placeholder, not a measurement", and its measured area sits **above the smallest known cell and below the largest** — the median of what IS known, a deliberately uninformative middle.
- **What it did before, measured rather than argued**: restoring the old `1`-for-unknown and re-running this proof against the same board gives the unknown-cap cell **area 0**. reflow hides any cell under 2px, so the ticker did not merely READ as negligible — it was **removed from the board**, silently shrinking the universe while the header still counted it. That is the defect in its true size.
- **Its rank value is untouched** and still painted: only the size was ever missing, and the cell is not a rank gap.

Zero page errors. Rollback: revert the single commit — one sizing helper, one marking class, pins and this proof. No data lane, authority or methodology changed.

---

## 2026-08-19T18:16:53Z — the watch-later lane tells the truth: unknown is said, lost writes say why

Command: `PW_MODULE_DIR=… node browser-proof/proofs/wl-truth.mjs` (page-level failure injection; asserts inline)

- **The mounted shell with the saved-list read DEAD** (browser-proof/receipts/shell-wl-read-dead-unknown.png): every card star paints the UNKNOWN "?" state ("watch-later state unknown — the saved-list read failed · a click retries the read"), zero cards claim saved-or-unsaved, and the bWatch button reads "watch later — state unknown" — a failed read is never data. A click on an unknown star retries the read and, still failing, flashes "★ unavailable — the saved-list read failed · nothing was changed" without flipping anything. The watch-later list itself paints "the watch-later read failed — the saved list is unavailable, not empty · retrying at the next refresh" (browser-proof/receipts/shell-wl-list-read-failed-named.png) — the old "YouTube reconnect required" wording, which named YouTube auth as the cause of a failed Supabase table read, is gone from the mounted shells and /pane-video (video-v1 keeps it: retained rollback, exempt by ruling).
- **The read lands, then a write is lost** (browser-proof/receipts/shell-wl-lost-write-said.png): the landed read paints exactly the saved video ★; a save click flips optimistically, the 500 settles, the flip REVERTS and the reason is said — "★ not saved — the shared watch-later write failed · try again". The shells used to revert silently; the gesture just vanished.
- **A lost subscribe says why**: "subscribe failed — the shared write did not land · try again" — the catch used to swallow it whole.
- **/youtube keeps the feed's own served flags** (browser-proof/receipts/youtube-wl-read-dead-feed-snapshot.png): the feed rows arrive with a server-side watch_later column — landed data. With the dedicated saved-list read dead, the flagged video KEEPS its star (it used to be zeroed by an empty page cache), the Watch Later chip wears a persistent "!" marker titled "the saved-list read failed — ★ rides the feed snapshot, not the saved list", and the failure is caught — before this unit it was an unhandled promise rejection.

Zero page errors in every scenario. Rollback: revert the single commit carrying this unit — said states, guards, pins and this proof; no data lane, authority or methodology changed; the rollback shell untouched.

---

## 2026-08-19T18:16:57Z — /youtube: a lost shared write no longer stays painted as saved

Command: `PW_MODULE_DIR=… node browser-proof/proofs/yt-lost-write.mjs` (route /youtube/; three fixture youtube_feed rows, empty yt_watch_later; yt-act answered per page; asserts inline)

- **Write lost** (browser-proof/receipts/yt-star-lost-write-reverted.png): the star flips on optimistically, then REVERTS within one settle (DOM: `.sc-ytc__star` loses `is-on`; `ytWLGet().size === 0`), and the page's flash surface says "★ not saved — the shared watch-later write failed · try again" for long enough to read. Before this unit the failure was swallowed (`.then(r => r.json()).catch(() => null)`, result ignored): the star stayed painted "saved", the shared table never changed, and the lie stood until the next reconcile read.
- **Write landed** (browser-proof/receipts/yt-star-landed-write-stays.png): the star stays, `ytWLGet()` carries the id, no failure flash — success and failure are now different pictures.
- Success detection is a LANDED write only: non-2xx and error bodies resolve null (a 500 whose JSON parses is not a success).
- **Scope notes, measured in code**: the two mounted video shells already REVERT on this failure (state-honest) but stay reason-silent — recorded as a lesser gap, not repaired here, because their only failure surface today is the watch-list read lane and hijacking it would blank the list; their `subscribeToChannel` catch is the same state-honest/reason-silent shape. The 10s-cadence `ytPosPush` position write keeps its silent catch by design: positions re-push on cadence, so a lost write is retried by the next tick rather than lied about.

Zero page errors in both scenarios. Rollback: revert the single commit carrying this unit — the change is client-render behavior only (no schema, no endpoint, no authority change).

---

## 2026-08-19T18:27:27Z — a position is a claim: a row with no value has not earned a rank

Command: `PW_MODULE_DIR=… node browser-proof/proofs/unranked-position.mjs` (asserts inline; reads the rendered `translateY` coordinates, not the source)

`/compare` is a ranked wall: `place()` positions each cohort row at `translateY(pos * 44)`, where `pos` is its index in the order `computeOrder()` returns. That order used to contain **only the cohorts that had a value** — and `place()` moves exactly what the order contains. So a cohort whose value stopped landing was never moved again: it kept the coordinate it last earned, wore the rank numeral it last earned, and — because the ranked list is now shorter than the wall — a ranked row could be assigned the same index and **land on top of it**. Two rows at one coordinate, one of them lying about its place.

Five cohorts served, one of them carrying members no composite covers (browser-proof/receipts/compare-unranked-row-placed-last.png):

- **All four rows stay on the wall.** The wall does not shrink to hide what it cannot rank.
- **No two rows share a coordinate** — asserted as a set-size equality over the measured transforms, so a collision cannot pass.
- **The four valued rows** hold coordinates 0 / 44 / 88 / 132 in rank order and are numbered 1 to 4.
- **The starved row sits at 176 — after every ranked row** — with the numeral `—` instead of a stale number, the value `—`, a dimmed opacity, and **no stale marking** (that marking is a claim about the read window, and it used to survive on a row that had lost its reading entirely, because the early return for a null value ran before the toggle).

Zero page errors. Rollback: revert the single commit — one `concat` in the order, one numeral guard, one full reset in the null branch, pins and this proof. No data lane, authority or methodology changed; the cohort values are read exactly as before.

---

## 2026-08-19T18:28:34Z — a position is a claim: a row with no value has not earned a rank

Command: `PW_MODULE_DIR=… node browser-proof/proofs/unranked-position.mjs` (asserts inline; reads the rendered `translateY` coordinates, not the source)

`/compare` is a ranked wall: `place()` positions each cohort row at `translateY(pos * 44)`, where `pos` is its index in the order `computeOrder()` returns. That order used to contain **only the cohorts that had a value** — and `place()` moves exactly what the order contains. So a cohort whose value stopped landing was never moved again: it kept the coordinate it last earned, wore the rank numeral it last earned, and — because the ranked list is now shorter than the wall — a ranked row could be assigned the same index and **land on top of it**. Two rows at one coordinate, one of them lying about its place.

Five cohorts served, one of them carrying members no composite covers (browser-proof/receipts/compare-unranked-row-placed-last.png):

- **All five rows stay on the wall.** The wall does not shrink to hide what it cannot rank.
- **No two rows share a coordinate** — asserted as a set-size equality over the measured transforms, so a collision cannot pass.
- **The four valued rows** hold coordinates 0 / 44 / 88 / 132 in rank order and are numbered 1 to 4.
- **The header counts what it ranked**: "4 cohorts ranked by COMPOSITE · 1 with no reading, held below the ranking". Extending the order to carry unranked rows would otherwise have turned `order.length` into a claim that all five were ranked — the fix's own side effect, caught and corrected in the same unit.
- **The starved row sits at 176 — after every ranked row** — with the numeral `—` instead of a stale number, the value `—`, a dimmed opacity, and **no stale marking** (that marking is a claim about the read window, and it used to survive on a row that had lost its reading entirely, because the early return for a null value ran before the toggle).

Zero page errors. Rollback: revert the single commit — one `concat` in the order, one numeral guard, one full reset in the null branch, pins and this proof. No data lane, authority or methodology changed; the cohort values are read exactly as before.
