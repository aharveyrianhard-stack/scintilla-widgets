# SCINTILLA Station — current local draft

Updated: 2026-08-10 (America/New_York)

This is the present-tense record for the active, **UNADMITTED local draft**. It is not the production Station and has not been pushed, deployed, or attached to `scintillahub.ai`.

## Open now

- Station: `http://127.0.0.1:4317/deck/?rev=076&charts=3&range=15m&c1=ESUSD&c2=GCUSD&c3=BTCUSD`
- Current working view: three 15-minute charts — S&P futures, gold futures, and Bitcoin.
- The `DISPLAY ↗` control opens the same Station in a dedicated second window. For Apple TV, put that window on an AirPlay **separate display**; ordinary mirroring follows the Mac and does not let the Hub remain independent.

## What works in this draft

- One to six charts. Layouts are 1; 2; 3 across; 2×2; 3+2; and 3×2.
- Every visible ticker field guides from the 210 active Hub symbols with chart history.
- Common external aliases resolve to the canonical Scintilla symbol. Examples: `ES`, `ES=F`, and `ES1!` resolve to `ESUSD`; `GC` and `GC=F` resolve to `GCUSD`; `BTC` resolves to `BTCUSD`.
- Station chart panes hide the duplicated embedded ticker/timeframe/TradingView bar. The single Station row drives every chart.
- Personal YouTube is chronological subscriptions. SCINTILLA YouTube has Subscribed and Watch Later. Both grids use two columns.
- The small star action is replaced by a readable `+ WATCH LATER` / `✓ WATCH LATER` action.
- X remains the dedicated Station capture, independently of the X Feed Float extension. List, Notifications, −30s, Refresh, hover-pause, and pane expansion remain.
- Desktop pane chips and old Wall / Scan / Why These? / Engine navigation are removed from the everyday Station view. The Hub remains linked.

## Live-market proof and known gap

At approximately 00:11 America/New_York on 2026-08-10, `live_quotes` and the 15-minute bars were current for `ESUSD`, `NQUSD`, `GCUSD`, `BTCUSD`, and `ETHUSD`. The Station's futures and crypto line charts now carry the current live quote as the final point even when a higher aggregate has not completed.

The futures aggregate trail is not fully healthy: 2h, 3h, 6h, 12h, daily, 3-day, and weekly histories are stale for at least ES and gold. This draft does not rewrite or conceal that history. It adds the current verified endpoint for visibility; the aggregation pipeline still needs a separate repair.

## Verification performed

- Real Chrome interaction: alias suggestion opened for `ES=F` and resolved to `ESUSD`.
- Real Chrome interaction: 1–6 selector reached the six-chart 3×2 view and returned to the working view.
- Real Chrome interaction: ES, gold, and Bitcoin loaded together at 15 minutes.
- X, Personal YouTube, and SCINTILLA YouTube remained present after reload.
- Inline JavaScript syntax checks passed for `deck`, `chart`, `pane-video`, and `pane-x`.

