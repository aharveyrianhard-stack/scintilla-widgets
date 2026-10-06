# Y4 — the Station's YouTube grid (6 Oct 2026)

The report for Alan is on the Hub branch `hub/y4-youtube-feed-20261006`:
`deliverables/20261006/y4-youtube-feed/Y4-YOUTUBE-FEED.html`.

Here:
- `screens/` — the headless pictures (1680 × 1050, the pane's 403 px, a phone) and, beside each run, the JSON of what it counted; `screens/FACTS.txt` is the same in one page.
- `tools/shots.mjs` — takes them (headless, every non-GET request blocked and counted). `--root` points it at an export of the live branch for the "before" set.
- `tools/market-signal-rows.mjs` → `data/market-signal-simulated.json` — Market Signal's videos from YouTube's public feed, in the shape the Station's feed serves. SIMULATED: they are not in the table until the staged list change on the Hub branch is applied.
- `tools/facts.mjs` — prints the measurements.
