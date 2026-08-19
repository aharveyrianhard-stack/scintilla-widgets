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
