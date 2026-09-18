# Cloud Workshop — isolated preview

This is an additive experiment based on Station source commit `4ea90f9bce7eccbb329f82f70a8f2321f1ce9641`. It does not replace `/chart/` or `/deck/`, and this restricted preview deployment must **never be promoted wholesale over Station**.

## Preserved visual contract

- Daily EMA13/EMA21 and SMA50/SMA200; no extra smoothing.
- Approved indigo `#0C3299` and pink `#E6007E`; independent line and fill opacity ladders.
- Fastest fill owns overlapping regions. Optional dashed SMA100 is width 3 and does not change any fill.
- Labels use price relative to each average; curve and fill states use their existing MA-pair comparisons.
- Pixel-reserved label area, smaller price text, signed required price movement `100*(MA/price-1)`. A short leader keeps the anchor exact when nearby text rows need separation.
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
