# FMP market-feed probe — 2026-08-10

Status: read-only evidence for the **UNADMITTED local Station draft**. No database, deployment, GitHub, DNS, or production mutation was made.

## Question

Is the existing FMP Ultimate credential globally delayed, or is freshness different by symbol/feed? Can it power the Station's normal instruments without reloads, and what does it actually provide for ES, NQ, and gold?

## Exact probes

- Provider: Financial Modeling Prep stable API
- Credential: existing local FMP environment file; value remained redacted
- Quote matrix: SPY, QQQ, AAPL, ESUSD, NQUSD, GCUSD, BTCUSD, CLUSD, SIUSD, NGUSD, HGUSD, ZCUSD
- Repetition test: five quote samples, ten seconds apart, for SPY, QQQ, CLUSD, ESUSD, NQUSD, and GCUSD
- One-minute comparison: SPY, QQQ, CLUSD, ESUSD, NQUSD, and GCUSD
- Database inspection: existing normal-instrument `live_quotes` coverage and FMP batch receipts
- Mutations: none

## Quote freshness

At 2026-08-10 10:13 EDT, the same credential returned:

| Symbol | Instrument | Observed provider delay |
|---|---|---:|
| SPY | US ETF | 2 seconds |
| QQQ | US ETF | 2 seconds |
| AAPL | US equity | 1 second |
| BTCUSD | crypto | 4 seconds |
| CLUSD | crude oil | 1 second |
| HGUSD | copper | 1 second |
| NGUSD | natural gas | 32 seconds |
| ESUSD | S&P futures proxy | 603 seconds |
| NQUSD | Nasdaq futures proxy | 602 seconds |
| GCUSD | gold | 602 seconds |
| SIUSD | silver | 603 seconds |
| ZCUSD | corn | no row returned |

The five-sample repetition test ran from 10:13:41 through 10:14:24 EDT. SPY, QQQ, and crude stayed 0–2 seconds fresh. ES, NQ, and gold stayed 600–607 seconds behind. Every returned price series changed during the test. The delay is therefore not a frozen response, client cache, or globally delayed account; it is deterministic by symbol/feed.

## One-minute endpoint

At approximately 10:14:40 EDT:

- SPY, QQQ, and crude returned 10:13 as their newest completed minute.
- ES, NQ, and gold returned 10:03 as their newest minute.

The quote and one-minute endpoints independently reproduce the same freshness split.

## Existing Scintilla path

The normal-instrument price-pull code already batches 194 active instruments—187 stocks, six ETFs, and one index—in one FMP call. All 194 had a current `live_quotes` row. Recent successful batch receipts were approximately one minute apart and roughly 18.3 KB each.

The Station checks `live_quotes` every ten seconds and also listens for database realtime updates. That means normal instruments update on screen without a page reload, but the source currently changes only when the roughly one-minute batch runs. A ten-second browser check is not the same thing as ten-second provider data.

If an interim ten-second FMP batch were used during a 16-hour active window, the observed payload size projects to about 3.2 GB per trailing 30 days, far below the published Ultimate 150 GB allowance and 3,000-calls-per-minute ceiling. The database/realtime write load—not FMP bandwidth—is the material engineering tradeoff.

## WebSocket entitlement test

The current and legacy official U.S.-stock WebSocket clusters were tested with the same existing credential:

- `wss://financialmodelingprep.com/ws/us-stocks`: handshake rejected before the socket opened.
- `wss://websockets.financialmodelingprep.com`: socket opened, but both login and subscribe returned HTTP-style status `401 Unauthorized`.

No tick was received. FMP's public FAQ says Ultimate includes unlimited WebSockets, but this specific credential does not currently authenticate to either documented cluster. Streaming must therefore be treated as unavailable until FMP corrects or explicitly provisions the entitlement. It cannot be the immediate Station dependency.

## Conclusion

The Ultimate account is demonstrably near-real-time for normal US instruments, Bitcoin, and some commodities. It is not generically ten minutes delayed. ES, NQ, gold, and silver are nevertheless consistently about ten minutes delayed on the tested FMP routes under this credential. FMP's public material calls its market data real-time, so the exact licensing or exchange-coverage reason should be confirmed with FMP; it must not be guessed. The observed timestamps are conclusive enough to prevent these delayed routes from being labeled exchange-real-time.

Product routing:

- Normal stocks and ETFs: use the proven FMP route.
- Bitcoin: the existing Coinbase route remains appropriate; FMP was also fresh in this probe.
- ES/NQ/GC: the tested FMP and current Yahoo routes are delayed fallback candidates, not exchange-speed authorities.
- UI: preserve the provider event timestamp separately from database write time and visibly label delayed data.
- Faster normal-instrument display now: use a contained faster server-side REST batch/hot-quote cadence. Longer term, use a server-side FMP WebSocket relay only after the actual credential authenticates. Do not expose the FMP key in the browser.

Official FMP references used for the capacity/coverage claims:

- Ultimate plan: https://site.financialmodelingprep.com/pricing-plans
- WebSocket coverage: https://site.financialmodelingprep.com/datasets/websocket
- Account/API FAQ: https://site.financialmodelingprep.com/contact
