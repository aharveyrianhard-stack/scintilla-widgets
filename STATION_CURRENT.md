# SCINTILLA Station — current state

Updated: 2026-08-10 (America/New_York)

This is the present-tense record for the verified live Station and the separately admitted Scenes V2 navigation candidate. Scenes V1 and the clean-root baseline are already production. Station routing, Hub, iMac/X Bridge, database, and indicators are outside this candidate.

## Remote review and delivery state

- Production source: `scintilla-widgets` main at `5b59353e9ccad8221886e59d15611c9816c72c53`
- Production deployment: `dpl_WnX6dRuG8hqdM3xaEDJfw3iQVVJR`
- Public Station: `https://station.scintillahub.ai/`
- Scenes v1 delivery: [merged scintilla-widgets PR #3](https://github.com/aharveyrianhard-stack/scintilla-widgets/pull/3)
- Scenes v1 production memo: `https://docs.google.com/document/d/1i57VFlXAoMjTAiNf2rLYj0InCxujeWTEr45emMfgGrA`
- The clean-root baseline consumes deliberate deep-link inputs once, keeps runtime scene state out of the address bar, and uses `/` as the PWA identity/start URL.
- A separate routing-only correction remains owned by the Station routing workstream and is not part of Scenes V2.
- Canonical architecture roadmap: `https://docs.google.com/document/d/1aLDEcIa4647copZrrO-rFsXuNeY98R8YS5Ux3OZQaxQ/edit`
- Scenes V2 preview job: `SCINTILLA-STATION-SCENES-V2-NAV-PRIMITIVES-001`
- Scenes V2 candidate branch: `agent/station-scenes-v2-nav-primitives`, based exactly on production `5b59353e...`
- Scenes V2 review: [draft scintilla-widgets PR #7](https://github.com/aharveyrianhard-stack/scintilla-widgets/pull/7); implementation commit `8343269`.
- Scenes V2 status: **preview only**. No production merge or promotion is authorized by this job.

## Open now

- Open the live Station: `https://station.scintillahub.ai/`
- Localhost URLs are development evidence only; they are never delivery.
- Station with X expanded across the lower row: use the pane-expansion control. An explicit `?full=x` launch input remains supported for deliberate deep links; ordinary runtime state no longer belongs in the address bar in the clean-URL candidate.
- Current saved example: two visible two-hour charts, SPY and QQQ. Four additional editable slots remain remembered as Bitcoin, Airbnb, Abbott, and Adobe when the chart-count selector is increased; none is a fixed bundle.
- The `DISPLAY ↗` control opens the same Station in a dedicated second window. For Apple TV, put that window on an AirPlay **separate display**; ordinary mirroring follows the Mac and does not let the Hub remain independent.
- The same Station surface now has remembered `AUTO`, `DESK`, `DISPLAY`, and `COMPACT` presentation profiles. `DISPLAY ↗` opens the same route with the Display profile; it is not a second product or a separately maintained scene.

## Scenes V2 preview candidate

- Replaces the raw, oversized cohort dropdown with a small purpose-first scene list: LIVE, OVERNIGHT, INDEX LEADERSHIP, COMPANY LEADERSHIP, MACRO SHORT, MACRO LONG, SECTORS, THEMES, and CUSTOM.
- Keeps basket membership separate from presentation. Chart count, timeframe, density, and paging no longer abandon a named scene or silently turn it into CUSTOM.
- Fixes the concrete 2→6 failure: a covered family expands from the same basket offset and fills the next real members instead of activating empty `Choose a symbol` slots.
- Uses a compact secondary selector only inside SECTORS and THEMES. It exposes only explicitly reviewed family keys with real favorite-backed coverage; raw backend cohorts, zero-member cohorts, and unreviewed names do not enter normal navigation automatically.
- Keeps exact INDEX LEADERSHIP order: SPY, QQQ, IWM, MAGS, SMH, DIA. DOW Inc. is never substituted.
- Leaves COMPANY LEADERSHIP, MACRO SHORT, and MACRO LONG as honest `basket TBD` states until Alan approves exact ordered membership. It invents no tickers.
- Uses offset windows with explicit `x–y of total` status. Changing count preserves the first visible member; sparse baskets use a smaller effective layout; empty baskets show one honest state and do not mount a chart iframe.
- Direct ticker editing from a curated named scene copies only the visible view into device-local CUSTOM. LIVE remains the existing editable workspace, and curated definitions cannot be overwritten from the Station UI.
- Preserves the existing five-pane LIVE surface, keeps Personal YouTube / SCINTILLA YouTube / X mounted, and retains visible-only chart mounting and one X pane.
- This first candidate deliberately keeps 1/2/3/4/6 chart structures. Eight-chart layouts, MA/RSI panes, automatic rotation, movers/volume ranking, cross-device sync, and indicator work require separate reviewed jobs.

## What works in production

- Scenes v1 adds same-route OVERNIGHT (`ESUSD`, `NQUSD`, `CLUSD`) and six-slot INDEX LEADERSHIP (`SPY`, `QQQ`, `IWM`, `MAGS`, `SMH`, `DIA`) presets without remounting the media or X panes. `DIA` is registered and has a live quote plus limited intraday history; its 1D pane remains an honest chart-data-unavailable state until daily history exists. `DOW` is never substituted.
- COHORT FAVORITES is generated from the real favorites/membership intersection, keeps every favorite across pages of six, and uses an empty chart rather than filler when a cohort has no favorites. CUSTOM is remembered separately.
- One, two, three, four, or six charts. The awkward five-chart geometry is intentionally not offered.
- Every visible ticker field guides from the current active Hub symbol registry; the count is loaded from the database rather than hard-coded.
- Each ticker field now lives in its own chart header. Clicking it selects the complete current symbol so the first typed character replaces it; the duplicate ticker row is removed.
- Empty chart cards open the corresponding ticker guide instead of presenting a dead “tap to load” action.
- Common external aliases resolve to the canonical Scintilla symbol. Examples: `ES`, `ES=F`, and `ES1!` resolve to `ESUSD`; `GC` and `GC=F` resolve to `GCUSD`; `BTC` resolves to `BTCUSD`.
- Station chart panes hide the duplicated embedded ticker/timeframe/TradingView bar. The single Station row drives every chart.
- The current database price is visually primary at a responsive 12–16px, with no badge border or background covering the line. It uses market-aware precision: ES/NQ preserve quarter-point ticks with two decimals, GC uses its one-decimal $0.10 tick, and ordinary prices above $1 retain two decimals. Repeated LIVE/time text is removed from the individual charts; the oldest visible quote time and delayed-instrument count live once in the Station header. The price scale now uses several rounded, height-responsive levels drawn as faint grid lines with bare 9px labels; it does not reserve the former 58px right-axis gutter.
- Charts default to full-data fit with the newest observation held at a stable TradingView-style right margin. Vertical wheel/pinch always changes horizontal scale while keeping that current point anchored, even after a prior history drag. A gesture is treated as horizontal pan only when horizontal motion materially dominates vertical motion; click-drag remains the explicit history pan. The price axis automatically refits to only the visible points. Double-click returns to full fit/current. One chart gesture broadcasts the same absolute time window to every other mounted chart, so zoom and pan stay synchronized across tickers. Reaching the oldest loaded observation requests another 800 older observations with no browser-side maximum; expansion stops only when the database reports that the selected timeframe has no older aggregate bars. Matching compact right/bottom axis bands give the labels defined homes. The lower band uses two rows—date/context above and time/detail below—adds three to twelve non-duplicated ticks according to pane width, and changes precision with both timeframe and visible span.
- Personal YouTube is chronological subscriptions. SCINTILLA YouTube has Subscribed and Watch Later. Both grids use two columns.
- YouTube cards retain two title lines even in narrow Station panes.
- Both account-scoped YouTube panes reread the database every two minutes while visible and idle; opening a video pauses that pane refresh so playback is not interrupted. This is a database read, not another YouTube API query. Background refresh compares the new ordered result with the current grid and does not repaint, blank, or reload thumbnails when nothing changed; a failed background read also preserves the current grid.
- The top list tab remains fully labeled `WATCH LATER`. Video-card actions are a bare 19px hollow/filled star positioned exactly 1px from the thumbnail's top and right edges; its transparent 34px corner hit area stays easy to tap without displaying a button background.
- X remains the dedicated Station capture, independently of the X Feed Float extension. List, Notifications, −30s, Refresh, hover-pause, and pane expansion remain. The pane-expansion control is pinned at the right edge instead of disappearing into the narrow control-strip overflow.
- X rendering now recomputes from both pane width and pane height. Narrow panes use the available width; expanded panes center a capped readable feed instead of stretching the same captured column into oversized text.
- The approved X source capture survives Station reloads, duplicate Station/display tabs, Chrome extension-worker sleep, and an accidental second shortcut press. The generic browser picker is no longer shown inside the X box.
- Pane resizing now updates the X crop without renegotiating/replacing the live WebRTC transport, removing the brief red “source offline” flash during row expansion.
- Station X Bridge `0.7.14` treats a same-pane `READY` message as a heartbeat only. It does not reconnect WebRTC, reactivate a feed, or realign an already-running X source. Reattaching a genuinely new pane instance remains supported even if Chrome reuses its frame ID.
- One authenticated X capture can now feed multiple Station windows simultaneously. Each Station pane owns a separate WebRTC receiver, while one explicit active display alone controls scrolling, List/Notifications, refresh, resize, and source shutdown. An older Station pane becomes a live view-only mirror instead of going offline; its heartbeat cannot steal control or double the scrolling rate.
- Every live Station mirror may contribute the 30 Hz wall-clock pulse. The bridge deduplicates simultaneous pulses before forwarding them to X, so a background-throttled controller cannot freeze the Apple TV window and two visible windows cannot double the scroll speed. One action controller still serializes view switches, refresh, resize, and source shutdown so simultaneous windows cannot fight.
- Action control follows interaction: clicking List, Notifications, refresh, rewind, or pause in any Station viewer makes that viewer the controller and applies the shared change to every receiver. A mirror therefore never presents dead controls, and Alan does not need to know which window was previously active.
- Closing one Station display drops only that receiver. The source capture and surviving Station mirrors remain connected without requesting another tab capture.
- Extension-worker recovery now prunes stored source/consumer tab IDs that Chrome says no longer exist. X and Station content scripts route runtime messages through an invalidation-safe wrapper so reloading the unpacked helper does not leave repeating `Extension context invalidated` exceptions.
- The dedicated X source tab is set to 125% zoom for the Station crop. The separate X Feed Float remains unchanged.
- The Station X view switcher uses compact list and bell controls with full titles and accessibility labels; List and Notifications remain separate views.
- Pane expansion now spans that pane's own row: an X or YouTube pane absorbs the lower row while charts stay visible, and a chart absorbs the upper row while feeds stay visible. A separate top-level `⛶` takes the resulting Station view to true browser fullscreen.
- Desktop pane chips and old Wall / Scan / Why These? / Engine navigation are removed from the everyday Station view. The Hub remains linked.

## Live-market proof and known gap

The browser rereads `live_quotes` every ten seconds and also listens for realtime database updates. That proves screen freshness, not exchange-level liveness. Source tracing on 2026-08-10 found:

- `BTCUSD` is written every minute by `crypto-coinbase` from Coinbase spot.
- `ESUSD`, `NQUSD`, and `GCUSD` are written every minute by `yahoo-futures` from Yahoo symbols `ES=F`, `NQ=F`, and `GC=F`.
- The current FMP batch writer excludes rows whose type is `future` and skips nights/weekends; it is not the source of these futures quotes.
- This is a Scintilla routing choice, not proof that FMP lacks futures. A contained read-only FMP matrix tested quotes repeatedly and then checked the one-minute endpoints. The same Ultimate credential returned SPY, QQQ, AAPL, BTC, crude oil, and copper at roughly 0–4 seconds freshness, while ES, NQ, gold, and silver remained consistently about 600 seconds behind; natural gas was roughly 32 seconds behind in the sample. Five samples ten seconds apart proved both groups changed continuously. The one-minute endpoints reproduced the same split: SPY/QQQ/crude had the current completed minute while ES/NQ/GC were ten minutes behind. This is therefore a deterministic symbol/feed coverage difference, not a globally delayed account and not browser caching. FMP's public material calls the endpoints real-time, so the exact exchange entitlement/coverage cause remains a provider question; the observed behavior does not.
- The Databento futures cron is inactive, its function is kill-switched unless `databento_enabled=true`, and the recovered function is a delayed historical-bar loader rather than a live quote writer.
- The 06:57 UTC Yahoo run returned ES `7786.25`, NQ `29915`, and GC `4417`, but its newest provider observations were approximately ten minutes old (06:46–06:47 UTC). The values changed across consecutive runs, so they were not frozen; they were delayed Yahoo futures quotes. The Station must not describe this feed as exchange-real-time until a real-time futures authority is connected and the provider event timestamp is stored separately from the database write timestamp.

The previous display rounded all values above 1,000 to whole numbers. That was a UI defect, not a loss of source precision, and is corrected in this draft.

Current product ruling: every instrument should use the lowest-latency proven authority available; delayed observations are fallback-only and must be labeled. Normal equities and ETFs should use the already-proven FMP authority. Futures must preserve each provider's event timestamp and choose on measured freshness, not familiarity. If the current FMP and Yahoo routes remain equally delayed for ES/NQ/GC, FMP is the simpler consistent fallback; the real-time futures path still needs a proven exchange-speed authority. A future futures pull should call only approved symbols during Globex hours, request only bars newer than the last stored timestamp, and must not re-enable the old overlapping Databento downloads.

The futures aggregate trail is not fully healthy: 2h, 3h, 6h, 12h, daily, 3-day, and weekly histories are stale for at least ES and gold. This draft does not rewrite or conceal that history. It adds the current verified endpoint for visibility; the aggregation pipeline still needs a separate repair.

The chart now has no artificial frontend depth cap, but it cannot draw aggregate bars that do not exist. A fresh read-only 2026-08-10 count proved the remaining timeframe-dependent boundary: SPY and QQQ each have 1,627 stored 2h bars beginning 2025-02-20, 2,253/2,252 15m bars beginning 2026-05-11, and 5,037 daily bars beginning 2006-07-30. The newly filled one-minute inventory is dramatically deeper: SPY contains 4,240,458 minutes beginning 2003-09-08 and QQQ contains 2,762,380 beginning 2011-03-01, split between R2 and the current Postgres seam. The sealed deep one-minute archive is therefore present, but the Station-readable 15m/30m/hourly aggregates have not been rebuilt to that depth. Station should continue reading the lean `ohlcv_history` table rather than making every browser scan the cold archive. Equal calendar depth across timeframes requires a verified aggregate rebuild, not another frontend zoom workaround.

Current SPY / QQQ Station-readable aggregate boundaries (read-only count at 2026-08-10):

| timeframe | SPY / QQQ rows | first stored bar (ET) |
|---|---:|---|
| 15m | 2,253 / 2,252 | 2026-05-11 07:00 |
| 30m | 1,472 / 1,472 | 2026-04-10 06:30 |
| 1h | 1,749 / 1,749 | 2025-10-17 06:30 |
| 2h | 1,627 / 1,627 | 2025-02-20 04:30 |
| 3h | 1,598 / 1,598 | 2025-07-08 11:00 |
| 4h | 1,568 / 1,568 | 2024-05-07 04:00 |
| 6h | 1,543 / 1,543 | 2023-07-31 / 2023-07-28 |
| 12h | 1,524 / 1,524 | 2023-07-05 |
| 1D | 5,037 / 5,037 | 2006-07-30 |
| 3D | 2,387 / 2,387 | 2006-07-29 |
| 1W | 1,045 / 1,045 | 2006-07-30 |

The non-monotonic 2h/3h boundary is real stored-state evidence: 3h currently starts later than 2h. The rebuild acceptance check must therefore validate each timeframe independently from the minute authority rather than assuming larger bars are automatically deeper.

## Hub Social YouTube tenant finding

The live Scintilla Hub Social → YouTube reader is not equivalent to the Station panes. Its current production query selects `is_sub` but omits `subscription_accounts`, and the `SUBS` filter accepts every row with `is_sub=true`. The live Hub automatically reruns that query every two minutes while the YouTube tab is open, with an additional pull when the tab is re-entered after 90 seconds.

The underlying rows are not mixed: Megyn Kelly and LastWeekTonight/John Oliver examples are stored with `subscription_accounts=["personal"]` and no Scintilla tag. After the 2026-08-10 subscription edits, the latest read-only count found 1,033 Scintilla-only rows, 489 Personal-only rows, 60 rows explicitly shared by both accounts, and 2,147 unscoped/search rows. Station's personal and Scintilla panes correctly query their own account tag. The Hub reader must select provenance and scope its Scintilla-branded view to rows whose `subscription_accounts` contains `scintilla`; refreshing or deleting videos is not the repair. The current RSS collector only merges/adds account tags on previously seen videos, so unsubscribing does not retroactively remove an old account tag. A one-time current-subscription reconciliation is still required before the existing rows can be called clean.

## Verification performed

- Real Chrome interaction: alias suggestion opened for `ES=F` and resolved to `ESUSD`.
- Real Chrome interaction: the chart selector reached the six-chart 3×2 view and returned to the working view.
- Real Chrome interaction: ES, gold, and Bitcoin loaded together at 15 minutes.
- X, Personal YouTube, and SCINTILLA YouTube remained present after reload.
- Real Chrome interaction: X expanded across the entire lower row and returned without disconnecting the source.
- Real Chrome interaction: the unpacked bridge was first reloaded from running version `0.7.6` to the heartbeat-safe `0.7.7`, then to the visible-clock `0.7.8`, active-display ownership `0.7.9`, recovery-safe `0.7.10`, active-display control isolation `0.7.11`, multi-view receiver version `0.7.12`, deduplicated multi-view clock version `0.7.13`, and interaction-following control version `0.7.14`.
- Before the `0.7.10` recovery correction, Chrome's extension error page showed repeated `Extension context invalidated` exceptions after helper reloads plus two stale-recipient failures (`No tab with id: 351840991` and `351841063`). A later inspection on `0.7.11` showed that the remaining invalidation entries came from Station page contexts that had not yet been reloaded after the unpacked helper update. Every open Station and X context was reloaded, the historical log was cleared only afterward, and Chrome recorded no new extension error during the next 40-second observation window.
- Sustained real-Chrome monitoring covered more than two 30-second bridge heartbeat boundaries with zero offline flashes after the heartbeat correction. On `0.7.13`, the original two-chart Station and six-chart Apple TV Station both remained live from one X capture. Two screenshots of the six-chart display eight seconds apart visibly showed the X timeline advancing; the two-chart view remained simultaneously online.
- After every Station and X page had been reloaded into the `0.7.13` extension context, Chrome's exact SCINTILLA Station X Bridge card showed no **Errors** button. It was observed again beyond the next 30-second heartbeat boundary with both Station receivers connected; the card still showed no Errors button and no new `Extension context invalidated` or stale-tab entry.
- Real Chrome on `0.7.14` switched the shared X source from Notifications to List and back to Notifications using the two-chart Station's controls. The source route changed between `x.com/home` and `x.com/i/timeline`; the separate three-chart Apple TV viewer remained live and followed the same shared view. The exact extension card remained on `0.7.14` with no Errors button afterward.
- For AirPlay load, the shared capture is capped at 1920×1080 and 30 fps, each Station canvas redraw is capped near 30 fps, and canvas device-pixel-ratio is capped at 1.25. A single process snapshot still showed WindowServer at roughly 95% CPU while AirPlay, Chrome, Computer Use, and both Station windows were active, so this is an optimization, not proof that full-display AirPlay is yet smooth under every load.
- Real Chrome interaction: the X source was increased to 125% at Alan's request and the enlarged Station crop remained live.
- Real Chrome interaction: the compact list/bell view controls rendered in the live X pane after a cache-busted pane reload.
- The compact horizontal crop experiment was removed after real-screen review because it cut the feed incorrectly. The expanded lower row still caps the feed column at 540px instead of billboard-scaling it. The visible Station pane now supplies the scrolling clock at 30 Hz, matching the original X Feed Float's visible-window timing instead of relying on Chrome to animate a hidden source tab.
- Real Chrome interaction on `0.7.8` monitored the X feed for more than 40 seconds after reload. It advanced through successive posts across the old 30-second failure boundary with no source-offline flash and no reset to the first post.
- Real Chrome interaction zoomed SPY with the trackpad/wheel, dragged the zoomed history window, observed the price scale refit, and double-clicked back to full-data fit. The other five chart windows stayed independent.
- The final local chart pass reproduced the prior failure sequence—drag history first, then wheel zoom—and verified that the live/rightmost point returned and remained anchored across all three synchronized charts. A 15-minute change visibly rendered a denser date/time axis; daily rendered zoom-aware month/year labels; rounded price levels refit with the visible range; and the 58px axis gutter remained absent.
- The `DESK` profile was changed from the live Station control without reloading the panes. It enlarged Station controls, YouTube captions, and the X crop while leaving the separate display window free to retain `DISPLAY`.
- A second real-Chrome pass after the TradingView behavior review proved the corrected interaction contract: vertical trackpad zoom retained the Aug 10 current point at the same right margin; click-drag moved the visible history; horizontal trackpad movement panned it; double-click restored current/full fit. Zooming outward at the old 400-point boundary loaded the next depth and extended the visible 3h history from April back to November without moving the current point.
- Real Chrome then verified synchronized two-chart behavior on SPY and QQQ at 2h: zooming SPY moved both charts to the identical July 9–August 10 window; deeper expansion moved both through the same February–August window. A second outward request correctly stopped at the database's shared February 2025 first bar rather than a browser cap.
- Real-browser computed style verified each Scintilla card has a transparent, borderless 20px star in a 34px corner hit area. Personal cards correctly have no Watch Later action.
- The consolidated header rendered `LIVE · 2s · 10:43 AM` in the working six-chart view and updates its age every ten seconds even when the underlying quote has not changed.
- The six chart badges showed price only; the Station header consolidated the oldest visible quote time. During the same no-reload run that header advanced from 10:23 to 10:25.
- The completed and abandoned Google device-flow tabs were closed. Code inspection confirms Station opens a device authorization window only from an explicit Connect/Reconnect click; none of its quote, video-grid, or X timers launches OAuth.
- A 12-second real-Chrome quote sample moved the displayed database timestamps from approximately 02:41:01–03 to 02:42:00–04; Bitcoin changed from 65,142 to 65,164 while unchanged futures prices remained stable. This proves the page-side ten-second quote reread/realtime path is active without a page reload.
- A second no-reload market-hours sample independently proved the same behavior: SPY moved from `772.91` at 09:37 to `772.65` at 09:41, QQQ moved from `721.64` to `720.84`, and BTC updated from `64,739.79` to `64,621.85`. The browser showed the new `live_quotes` timestamps without any Station reload.
- The expanded FMP probe made read-only provider calls only. At 10:13 ET, SPY/QQQ/AAPL/BTC provider timestamps were 1–4 seconds old while ES/NQ/GC were 602–603 seconds old. Five quote samples ten seconds apart reproduced 0–2 second freshness for SPY/QQQ/crude and 600–607 seconds for ES/NQ/GC; every price series changed. One-minute calls at 10:14 ET showed 10:13 for SPY/QQQ/crude and 10:03 for ES/NQ/GC. No database write was made.
- The existing normal-instrument batch path was also checked directly: all 194 active stocks/ETFs/index symbols had a current `live_quotes` row, and the scheduled batch was succeeding roughly once per minute. The Station's ten-second browser reread therefore exposes each new database quote without a page reload; it does not manufacture sub-minute source data.
- A real WebSocket entitlement probe tested both documented FMP stock clusters with the existing credential. The current cluster rejected the handshake; the legacy cluster opened but returned `401 Unauthorized` to login and subscribe. No tick was received. FMP publicly says Ultimate includes unlimited WebSockets, but this credential is not provisioned successfully; immediate sub-minute work must use the proven REST batch route unless FMP fixes that entitlement.
- Consecutive `yahoo-futures` run receipts showed real price changes: ES `7785.25` → `7785.75` → `7786.25`; GC `4413.80` → `4414.60` → `4414.80` → `4417.00`. The same receipts exposed the roughly ten-minute provider delay.
- Real Chrome was reloaded after the market-aware precision correction and visibly rendered ES `7,787.25`, GC `4,418.6`, and BTC `65,221.75`.
- Inline JavaScript syntax checks passed for `deck`, `chart`, `pane-video`, and `pane-x`.
- Station X Bridge tests pass 17/17, including same-frame heartbeat idempotence, explicit active-display ownership, old-heartbeat non-theft, view-only mirror negotiation, interaction-following control handoff, distinct peer identity, crop broadcast to every mirror, multi-view clock deduplication, mirror clock survival, resize after handoff, standby handback, stale-tab pruning, same-frame/new-instance reattachment, reload, display-tab handoff, extension-worker restart, and accidental-shortcut persistence.

## Current X acceptance boundary

The repeating-post diagnosis was reproduced in real Chrome before the `0.7.7` correction: the supplied screen recording shows the offline/reset state at 10.95, 40.95, and 70.95 seconds, matching the old 30-second reconnect behavior. The heartbeat-safe bridge passed sustained monitoring. Version `0.7.14` retains that correction, uses one capture for multiple live Station receivers, deduplicates clock pulses from every viewer, transfers action control to whichever viewer Alan touches, and hardens extension reload recovery. The verified bridge is live against the exact production host. The Scenes V2 preview candidate does not modify the bridge or multiply X capture. Localhost results remain development evidence only; they are not delivery.

## Permanent X architecture direction

The unpacked Chrome helper is the current private bridge, not the desired permanent command-center foundation. A normal web page cannot directly embed, scroll, or read an authenticated X timeline because X blocks framing and the browser isolates another logged-in tab. For continuous viewing, the durable primary is an installed local **Station Bridge** on the always-on iMac: it owns one dedicated authenticated X browser session, captures and scrolls it once, and sends the pixels peer-to-peer to every authorized Station view. `https://station.scintillahub.ai/` is the live interface; the bridge is an invisible local capability rather than a setup repeated per Station window. The intended visible contract is one `Share X` / `Stop sharing` switch; reconnects, version alignment, stale-context cleanup, additional viewers, and source recovery are automatic.

Alan explicitly permits a cloud-held X login for a later structured reader. That reader should extract post text, images, author, timestamps, source view, and provenance on demand or on a bounded schedule, then let Station render native independent panes for iPad and sentiment analysis. It should not be confused with the continuous pixel wall. A live account inspection on 2026-08-10 proved that the existing Cloudflare account is on **Workers Free**, whose Browser Run allowance is 10 minutes/day. Continuous 24/7 Browser Run would require Workers Paid plus roughly 710 metered browser-hours/month (about $64/month at the current $0.09/hour overage, before the $5 plan fee), so it is not the default continuous source. Existing R2 usage does not include or upgrade Browser Run.
