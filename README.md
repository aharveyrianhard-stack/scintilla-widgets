# scintilla-widgets

SCINTILLA scene widgets — stage-1 Hub component extraction. Standalone, individually-windowable routes for the Hammerspoon scene wall (IT architecture layer 3). Owner: HUB/SURFACE COMMAND session ("Hawkeye"). Vercel deploys from `main`.

## Routes

- `/ticker` — MACRO + ALL marquee tape · explicit provider quotes + Geiger universe · 45s cadence · `?bands=macro,all` `?speed=45`
- `/geiger` — full 6-tile geiger summary (composite meter · trend ladder · RSI/W%R MTF · MACD · 3-ring volume) · `?t=MU` pin, or auto-rotate hub_favorites · `?auto=1` `?dwell=10`
- `/youtube` — youtube_feed grid + filters + docked player · yt_positions cross-device resume · yt-act watch-later sync · `?filt=ALL|SUBS|SHORTS|WATCH|$MU`
- `/chart` — scChart native canvas · explicit provider completed candles · R22 range ladder · retained non-equity realtime last-point · in-app TradingView modal · `?t=MU` `?range=1D`
- `/` — scene-module directory

## Rules

- Provider-owned equity quotes, previous close, candles, and accepted Geiger values use the explicit `/_provider/provider.js` product contracts backed by Massive.
- Raw daily technical indicators use the explicit FMP indicator contract with provider date and FORMING/SETTLED state intact; Station pages do not call FMP directly.
- Retained Supabase market tables are available only through narrow non-equity adapters. They are never an equity fallback.
- Missing, partial, or failed provider results remain named and unavailable; no compatibility alias makes an obsolete table request mean provider truth.
- The cockpit (scintilla-cockpit) is off-limits — this surface never touches it.
- LOOK rides the Visuals/Motion sprint — plumbing only here.
- Relay: spine_events · scintilla-live (wadinxqplrggagkvrdag). Receipts: HSC-STAGE1-BUILD-001, IT-DEPLOY-UNBLOCK-001.
