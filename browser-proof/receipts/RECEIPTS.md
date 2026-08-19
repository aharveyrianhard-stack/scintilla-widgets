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
