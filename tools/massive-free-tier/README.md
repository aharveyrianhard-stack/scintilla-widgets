# Massive free-tier validation harness

This is an isolated, read-only inventory harness. It makes only Massive `GET` requests and does not import Station code or connect to production, Supabase, a database, a chart, a subscription, or a feed.

## Safety boundary

- The API key is read only from `~/.config/massive.env` as `MASSIVE_API_KEY=...`.
- A missing, empty, or placeholder key refuses the run before any request.
- The key is added only inside the HTTP transport and is scrubbed from errors and JSON output.
- A rolling-window limiter permits no more than five requests in any 60,000 ms window.
- The run is 48 read-only requests: 14 reference lookups, 28 one-minute aggregate requests, and six index-discovery searches. At the free-tier ceiling it takes at least nine minutes.

## Run

```sh
node tools/massive-free-tier/validate.mjs --output massive-validation.json
```

The same machine-readable JSON is written to standard output. An output file is created with owner-only permissions. HTTP `200`, `403`, `404`, an empty `200`, other HTTP errors, and transport failures remain distinct classifications.

The sessions are deliberately fixed: the verified regular NYSE session on 2026-08-11 (390 RTH minutes) and the verified 1:00 p.m. ET early close on 2025-07-03 (210 RTH minutes). Aggregate checks cover minute alignment and ordering, duplicates, exact RTH coverage, finite OHLCV values, OHLC invariants, nonnegative volume, and missing volume.

## Test without a key or live calls

```sh
node --test tests/massive-free-tier.test.mjs
```
