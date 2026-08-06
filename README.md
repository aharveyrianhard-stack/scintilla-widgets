# scintilla-widgets

SCINTILLA scene widgets — stage-1 Hub component extraction. Standalone, individually-windowable routes for the Hammerspoon scene wall (IT architecture layer 3). Owner: HUB/SURFACE COMMAND session ("Hawkeye"). Vercel deploys from `main`.

## Routes

- `/ticker` — MACRO + ALL marquee tape · live_quotes + composite_staged tf=D universe · 45s cadence · `?bands=macro,all` `?speed=45`
- `/geiger` — full 6-tile geiger summary (composite meter · trend ladder · RSI/W%R MTF · MACD · 3-ring volume) · `?t=MU` pin, or auto-rotate hub_favorites · `?auto=1` `?dwell=10`
- `/youtube` — youtube_feed grid + filters + docked player · yt_positions cross-device resume · yt-act watch-later sync · `?filt=ALL|SUBS|SHORTS|WATCH|$MU`
- `/chart` — scChart native canvas · ohlcv_history via PostgREST (DB-only) · R22 range ladder · realtime last-point · in-app TradingView modal · `?t=MU` `?range=1D`
- `/` — scene-module directory

## Rules

- Extracted from scintilla-hub (SC_BUILD 2026-07-16T0330, main@aafbc9b) — data paths verbatim.
- DB reads ONLY (scintilla-live) — pages NEVER call FMP.
- Price basis: raw DB prints + live_quotes served values, stated in-page. Adjusted lens (eod_adjusted) landed 2026-08-06 — flip pending ruling.
- The cockpit (scintilla-cockpit) is off-limits — this surface never touches it.
- LOOK rides the Visuals/Motion sprint — plumbing only here.
- Relay: spine_events · scintilla-live (wadinxqplrggagkvrdag). Receipts: HSC-STAGE1-BUILD-001, IT-DEPLOY-UNBLOCK-001.
