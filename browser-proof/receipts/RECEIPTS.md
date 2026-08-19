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
