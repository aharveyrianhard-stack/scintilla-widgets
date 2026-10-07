# RM1 · the Station's side — what a left-open Station holds on to (7 Oct 2026)

Alan, 7 Oct: "When I leave Scintilla open and the Station open, it takes a lot of RAM in Activity Monitor after a while. When I quit and come back, it's perfectly fine … especially on the iMac it's a problem."

**The report with the pictures is on the Hub branch**: `hub/rm1-memory-20261007` → `deliverables/20261007/rm1-memory/RM1-MEMORY.html`. This folder holds the Station's own readings and the tools that made them.

## What was found

- **Every chart kept a full copy of its own picture.** To place the context lens the chart reads its whole canvas, four bytes a pixel, and kept the copy until its next repaint; a parked chart never repaints. Measured headless on live `b859b30` at 1680 × 1050 retina: ten charts held **53.7 MB of the page's 54.9 MB of buffers** (9.8 MB for a two-up chart, 2.4 MB for an eight-up one). Fixed: the copy is handed back as soon as the lens has its place (`_indicators/lens-placement.mjs` `inkReader`, `_indicators/station-lens.mjs`). The buffers averaged **40 MB over the live page's 90 minutes and 8 MB over the branch's 50**; side by side at the same moment, 42.5 MB live and 8.4 MB on the branch, with the lens in exactly the same place on 8 of 8 charts.
- **Nothing else piles up in the Station's own code.** Over the live page's 90 minutes: listeners, repeating timers and documents rise and fall with the page on the wall and come back to where they started; nodes kept off the page stay at about 90 (the video player's own icons). The JS heap moves in a half-hour saw-tooth: the shared store of price history fills (21.5 MB after 25 minutes) and empties itself on every half hour, by design, under a 48 MB ceiling.
- **Not measured here:** a playing video and a live X picture. The test browser refuses every request that is not a plain read, which stops YouTube from playing, and the X pane needs Alan's own X window and the extension. The X pane's code was read instead: each picture frame is closed after its paint.

## The night reload (the stopgap)

Between 3 and 5 in the morning a Station open four hours or more loads itself again, once; a Station open thirty hours (the Mac slept through its night) does so at its next quiet moment. It asks the release rule's own question (`selfUpdatePlan`): two minutes without a hand on the deck or any pane, no video open in a pane, a live X pane given its 30 minutes — and the server must have just answered. It also waits while the Station is in the browser's full screen or a video is floating. It reloads the Station page only; **the X window and its extension are never touched**.

Kept: scene, page, timeframe, chart count, feeds and lists (remembered already); the expanded pane and each video list's scroll (carried over the one reload).

**Off:** open the Station once at `station.scintillahub.ai/?nightreload=0` (remembered on that browser; `?nightreload=1` turns it back on), or set `NIGHT_RELOAD_DEFAULT_ON = false` in `deck/index.html`.

Proved headless on a moved clock (`data/verify-night-reload-station*.txt`): 10 of 10 checks on the reload itself, 4 of 4 on waiting for full screen, and no reload with ?nightreload=0.

## Files

- `data/before-station/` — the live page, 90 minutes, one reading every 5 minutes (`samples.jsonl`) and what the run asked the network (`meta.json`).
- `data/after-station/` — this branch, **50 minutes, not 90**: the run was stopped at 11:16 ET on 7 Oct, with every other test page, because the live quote read was failing and this lane's test load was the likely cause (the Hub report's "What went wrong during the test"; from 10:50 ET both runs were reading a Station whose quotes were failing). A full run is still owed, outside market hours, one page at a time: `node tools/soak.mjs --name station-after --url https://station.scintillahub.ai/ --minutes 90 --interval 5 --settle 120 --override <map.json> --out <dir>` (an example map is `data/override-station.example.json`).
- `data/diag-station/` — a 25-minute run used to name the largest holders early.
- `data/heapdiff-*.txt`, `data/allocsites-*.txt`, `data/named-*.txt` — the start and end heap pictures compared, the code lines whose allocations were still alive, and what each named store held.
- `data/verify-lens.txt` — the live and branch walls side by side: every lens's box.
- `tools/` — `soak.mjs` (+ `instrument.js`), `series.mjs`, `detail.mjs`, `heapdiff.mjs`, `heapfind.mjs`, `heapvars.mjs`, `heapcount.mjs`, `allocsites.mjs`, `threads.mjs`, `verify-night-reload.mjs`, `verify-lens.mjs`. All headless; every non-GET request is refused and counted.

Branch `station/rm1-memory-20261007`. Tests: node --test at the repo root — live b859b30: 1,095 tests, 27 failing; this branch: 1,108 tests, the same 27 failing, none new. 13 new tests: tests/station-rm1-memory-20261007.test.mjs (3) and tests/station-rm1-night-reload-20261007.test.mjs (10). Nothing deployed.
