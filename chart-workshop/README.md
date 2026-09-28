# Cloud Workshop — isolated preview

This is an additive experiment based on Station source commit `4ea90f9bce7eccbb329f82f70a8f2321f1ce9641`. It does not replace `/chart/` or `/deck/`, and this restricted preview deployment must **never be promoted wholesale over Station**.

## September 19 dynamic pass

### Latest review — September 21, EMA8 and zoom sizing

Supersedes prior appearance notes below: a thin dashed EMA8 now accompanies the existing ribbon without adding a cloud. Its stroke and alpha sit one restrained step below EMA13 at every zoom density (0.6 hierarchy width; 20% blue / 8% pink), while preserving the approved neon hues. Price scales from 3.8 to 5px with zoom and remains over 1.4 times thicker than the heaviest indicator. Label identity text scales from 10 to 17px (14px cap in compact panes), with price/percentage details scaling too. Indicator widths scale continuously from .28 to .85 of their hierarchy. Faint indigo display gain changes from .26 to .23; pink fill intensity is reduced 6%, preserving the neon hue and all numerical fill alphas. Clouds remain the baseline; the toggle is a workshop inspection control, not the proposed Station default.

Preview: https://scintilla-widgets-i0qspiae7-aharveyrianhard-8432s-projects.vercel.app/chart-workshop/

54 local checks pass, including EMA8 recurrence, unchanged cloud geometry and price-width dominance. The deployment is READY; fresh browser visual verification is pending native Chrome window recovery. No production Station changes.

### September 21 latest-bar annotation correction

Supersedes the older displaced-label description below: labels now remain at the exact moving-average y value and sit immediately after the true latest loaded bar. Nearby labels stagger horizontally with price/distance details, never vertically into a price-axis column. Panning away from the latest bar removes all annotations; Reset view restores them. Verified in Chrome with five TSLA labels → zero → five. The cloud palette and computations are unchanged. 54 local checks pass.

Current preview: https://scintilla-widgets-2vmnei8o4-aharveyrianhard-8432s-projects.vercel.app/chart-workshop/

### September 21 correction (supersedes the rendering and connection notes below)

The workshop now extracts/adapts Station's actual `scChartDraw` price trace and `scChartScrub` input semantics into `station-renderer.mjs`: equal observation spacing, quadratic price trace, latest-anchored zoom, horizontal scrolling, drag, two-pointer pinch, Safari gesture handlers and keyboard controls. No production Station source was modified. Price is 3.2px; MA borders cap at 2.2px and become thinner at wider zoom. Price-only autoscale excludes offscreen MA labels.

The daily ribbon uses one set of confirmed anchors on every price timeframe. A daily value is available at the next supplied session; historical values are joined for display, and the last available value is carried to the visible price endpoint. This adds no computed MA samples. It is intentionally **not** a developing-daily TradingView series and is not parity-certified. The raw average formulas and pair-state calculations remain unchanged. Available history can differ between provider timeframes; the renderer does not fill missing bars.

Indigo is `#3455FF` with three explicit display-brightness levels; pink mapping is unchanged. Source percentages remain in the computation/appearance contract; these custom RGB display tones are not numerical opacity parity with Pine.

Published preview: https://scintilla-widgets-qte7189wl-aharveyrianhard-8432s-projects.vercel.app/chart-workshop/

52 local tests pass, including 1,000 seeded crossing configurations with three cross-sections each. The cloud renderer now splits its polygons at all actual MA intersections; endpoint-only subtraction had left visible holes when the ordering changed between daily anchors. This corrects display topology without changing indicator observations. Chrome checks verified horizontal wheel pan, Ctrl-wheel zoom, mouse drag, simulated two-touch pinch, 4h / 10m / daily and all three price styles. Physical Safari and touchscreen hardware were not tested. Desktop MCP currently reports `RUNNING_WITHOUT_CDP`; browser checks are separate evidence, not proof of a working MCP connection.

Endpoint labels now float beside the last plotted sample. There is no vertical label rail; collision leaders appear only for displaced text, while dots remain at the exact average. Font size and stroke width respond to candle density and pane width. The same 1/2/3/4 hierarchy is scaled in display pixels, never by changing MA periods.

Intraday options: 10m (complete contiguous pairs of provider 5m bars), provider 15m / 1h / 4h. These views hold the prior completed ET daily session's averages, explicitly avoiding same-day lookahead. This conservative mapping is not a claim to match a developing TradingView daily bar. Provider timestamps and gaps are preserved, and each pane states its latest supplied date. September 19 endpoint checks returned intraday bars only through September 17; the UI does not label them current or fill the gap.

The custom pink hue is now saturated #FF00A8, not a white tint. Indigo and the source opacity ladder are retained. No global Station palette changes.

## Preserved visual contract

- Daily EMA13/EMA21 and SMA50/SMA200; no extra smoothing.
- Indigo `#0C3299` and custom neon pink `#FF00A8`; independent line and fill opacity ladders.
- Fastest fill owns overlapping regions. Optional dashed SMA100 is width 3 and does not change any fill.
- Labels use price relative to each average; curve and fill states use their existing MA-pair comparisons.
- Floating endpoint labels, smaller price text, signed required price movement `100*(MA/price-1)`. A short leader keeps the anchor exact only when nearby text rows need separation.
- One- and six-pane modes, responsive phone layout, scroll zoom, drag historical inspection.

## Real data, but not certified parity

The read-only `/api/cloud-workshop-candles` handler retrieves actual Massive provider-built daily OHLCV. It retains adjustment/session/finality metadata and fetch provenance. There is no database write, made-up dataset, stale-cache substitution, or silent RTH/ETH selector.

The averages in this preview are computed in the browser from those daily closes. They are **not** the current database MA series. EMA starts at the first supplied close; SMA remains unavailable until its full window exists. These are explicitly provisional until compared with a pinned TradingView closed session, exact instrument/feed mapping, adjustment basis, daily-session definition, and warm-up history.

The bounded September 18 audit found equity `fan_daily` and FMP indicator snapshots dated August 20, despite newer provider candles. The direct TradingView MCP works on Desktop targets, but does not expose the Chrome unified review target. Neither fact is hidden by this renderer.

`3 sessions` means aggregation of consecutive provider daily bars, not a claim to match TradingView's 3D exchange anchoring. Weekly groups use calendar-week buckets. Display aggregation never recomputes daily MAs. Intraday, exact exchange-calendar aggregation, log-axis mode, finality parity, and database-backed historical curves remain further work.

## Evidence and verification

Export evidence downloads a machine-readable JSON twin: raw candles, source envelope metadata, daily averages, computation contract, view range, and active layers. This is an inspectable preview, not a validation certificate or trading recommendation.

Local development only:

```sh
node chart-workshop/preview-server.mjs
node --test tests/cloud-workshop-*.test.mjs
```

The loopback-only server is for tests; it is not a product delivery URL. Remote previews use the isolated API handler. No credentials are embedded in the workshop or handler. The `.vercelignore` allowlist excludes repository documentation, tests, local servers, and unrelated routes from preview upload.

Visual checks completed at native width, 1440×900 (3×2 panes), and 390×844 (phone-width stacked panes): prices and labels stayed within pane bounds. Temporary viewport overrides were reset. A local UI screenshot is not proof of remote deployment health; the public preview requires its own API and browser checks.
