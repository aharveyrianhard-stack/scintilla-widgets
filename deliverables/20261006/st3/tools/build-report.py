#!/usr/bin/env python3
"""ST3: builds ST3.html from the measurements in ../data (every number on the page is read from a file there)."""
import json, os, html, subprocess, datetime
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE); DATA = os.path.join(ROOT, "data")
J = lambda n: json.load(open(os.path.join(DATA, n)))
E = html.escape
def opt(n):
    try: return J(n)
    except Exception: return None

before, after = J("soak-before-samples.json"), J("soak-after-samples.json")
pb, pa = opt("pair-before-samples.json"), opt("pair-after-samples.json")
rb, ra = J("soak-before-result.json"), J("soak-after-result.json")
at = lambda s, m: next(x for x in s if x["m"] == m)
def window(s, a, b, key): return at(s, b)[key] - at(s, a)[key]
def heap_avg(s, a, b): xs = [x["heapMB"] for x in s if a <= x["m"] <= b]; return sum(xs) / len(xs)
def alive(s, a, b): xs = [x["docs"] for x in s if a <= x["m"] <= b]; return f"{min(xs)}–{max(xs)}"

def svg_lines(series, ylabel, width=620, height=210, ymax=None):
    """series: [(label, [(x, y)…], dashed)] — two lines, direct labels, one axis."""
    pad_l, pad_r, pad_t, pad_b = 44, 110, 12, 26
    xs = [x for _, pts, _ in series for x, _ in pts]; ys = [y for _, pts, _ in series for _, y in pts]
    x0, x1, y1 = min(xs), max(xs), ymax or max(ys) * 1.08
    X = lambda x: pad_l + (x - x0) / (x1 - x0) * (width - pad_l - pad_r); Y = lambda y: height - pad_b - y / y1 * (height - pad_t - pad_b)
    out = [f'<svg viewBox="0 0 {width} {height}" width="{width}" height="{height}" role="img" aria-label="{E(ylabel)}">']
    for i in range(5):
        v = y1 * i / 4; out.append(f'<line x1="{pad_l}" x2="{width - pad_r}" y1="{Y(v):.1f}" y2="{Y(v):.1f}" stroke="#1A1A2A"/><text x="{pad_l - 6}" y="{Y(v) + 4:.1f}" text-anchor="end" fill="#9A9AB6" font-size="11">{v:.0f}</text>')
    for m in range(int(x0), int(x1) + 1, 5): out.append(f'<text x="{X(m):.1f}" y="{height - 8}" text-anchor="middle" fill="#9A9AB6" font-size="11">{m} min</text>')
    for label, pts, dashed in series:
        d = " ".join(f'{"M" if i == 0 else "L"}{X(x):.1f},{Y(y):.1f}' for i, (x, y) in enumerate(pts))
        col = "#9A9AB6" if dashed else "#F2F2F8"
        out.append(f'<path d="{d}" fill="none" stroke="{col}" stroke-width="{1.5 if dashed else 2}"{" stroke-dasharray=\'5 4\'" if dashed else ""}/>')
        out.append(f'<text x="{X(pts[-1][0]) + 6:.1f}" y="{Y(pts[-1][1]) + 4:.1f}" fill="{col}" font-size="11">{E(label)} · {pts[-1][1]:.0f}</text>')
    out.append("</svg>"); return "".join(out)

rows15 = [
    ("New chart documents built", window(before, 0, 15, "chartDocs"), window(after, 0, 15, "chartDocs")),
    ("…of those, after the first lap (minutes 12–15)", window(before, 12, 15, "chartDocs"), window(after, 12, 15, "chartDocs")),
    ("History reads (/candles)", window(before, 0, 15, "candles"), window(after, 0, 15, "candles")),
    ("All requests", window(before, 0, 15, "req"), window(after, 0, 15, "req")),
]
rows30 = [
    ("New chart documents built, 30 minutes", window(before, 0, 30, "chartDocs"), window(after, 0, 30, "chartDocs")),
    ("…in the second half (minutes 15–30)", window(before, 15, 30, "chartDocs"), window(after, 15, 30, "chartDocs")),
    ("History reads (/candles), 30 minutes", window(before, 0, 30, "candles"), window(after, 0, 30, "candles")),
    ("…in the second half (minutes 15–30)", window(before, 15, 30, "candles"), window(after, 15, 30, "candles")),
]
def tr(label, b, a, unit=""): return f"<tr><td>{E(label)}</td><td>{b}{unit}</td><td><b>{a}{unit}</b></td></tr>"
spare_b, spare_a = rb["made"]["spare"], ra["made"]["spare"]

X = {}
for sp in (3, 6, 12):
    for side in ("before", "after"):
        X[(side, sp)] = opt(f"x-{side}-{sp}-summary.json")
def xrow(sp):
    b, a = X[("before", sp)], X[("after", sp)]
    if not b or not a or "picture" not in b or "picture" not in a: return ""
    p, q, c, d = b["picture"], a["picture"], b["cost"], a["cost"]
    return (f"<tr><td>{sp} px a second<br><small>{ {3:'1× · today',6:'2×',12:'4×'}[sp] }</small></td>"
            f"<td>{p['backwardPerMin']:.0f} → <b>{q['backwardPerMin']:.0f}</b><br><small>worst {abs(p['worstBackPx']):.2f} → {abs(q['worstBackPx']):.2f} px</small></td>"
            f"<td>{p['stepP95']:.2f} → <b>{q['stepP95']:.2f}</b> px<br><small>a usual move is {q['stepP50']:.2f} px</small></td>"
            f"<td>{p['biggestStepPx']:.2f} → <b>{q['biggestStepPx']:.2f}</b> px</td>"
            f"<td>{p['pxPerS']:.1f} → {q['pxPerS']:.1f}</td>"
            f"<td>{c['rafOver25ms']} of {c['rafFrames']} → {d['rafOver25ms']} of {d['rafFrames']}</td>"
            f"<td>{c['longTasks']} → {d['longTasks']}</td>"
            f"<td>{c['mainThreadSPerMin']:.1f} → {d['mainThreadSPerMin']:.1f} s</td>"
            f"<td>{c['paintsPerS']:.0f} · {b['framesFromSourcePerS']:.1f}</td></tr>")
names_base = open(os.path.join(DATA, "tests-live.names")).read().strip().split("\n")
names_after = open(os.path.join(DATA, "tests-branch.names")).read().strip().split("\n")
new_fail = sorted(set(names_after) - set(names_base)); fixed = sorted(set(names_base) - set(names_after))
counts = J("tests-counts.json")
heap_b = open(os.path.join(DATA, "heap-before-m5-m30.txt")).read(); heap_a = open(os.path.join(DATA, "heap-after-m5-m30.txt")).read()
cache = [(x["m"], x.get("cache")) for x in after if x.get("cache")]
peak = max(cache, key=lambda c: c[1]["mChars"]); last = cache[-1]
sha = subprocess.run(["git", "rev-parse", "--short", "HEAD"], cwd=ROOT, capture_output=True, text=True).stdout.strip()
pair = ""
if pb and pa:
    m = min(pb[-1]["m"], pa[-1]["m"])
    pair = (f"<h3>The same two pages run side by side, {m} minutes, same moment, same machine</h3>"
            "<p>The long runs above were made one after the other, with other measurements running beside them, so their processor times cannot be compared fairly. "
            "This pair ran at the same time.</p><table><tr><th>What</th><th>Before</th><th>After</th></tr>"
            + tr("Script time", f'{at(pb, m)["scriptS"]:.1f}', f'{at(pa, m)["scriptS"]:.1f}', " s")
            + tr("All main-thread work", f'{at(pb, m)["taskS"]:.1f}', f'{at(pa, m)["taskS"]:.1f}', " s")
            + tr("Layout", f'{at(pb, m)["layoutS"]:.1f}', f'{at(pa, m)["layoutS"]:.1f}', " s")
            + tr("Long tasks (over 50 ms)", at(pb, m)["lt"], at(pa, m)["lt"])
            + tr("New chart documents built", window(pb, 0, m, "chartDocs"), window(pa, 0, m, "chartDocs"))
            + tr("History reads (/candles)", window(pb, 0, m, "candles"), window(pa, 0, m, "candles"))
            + tr("Heap at the end", f'{at(pb, m)["heapMB"]:.0f}', f'{at(pa, m)["heapMB"]:.0f}', " MB")
            + tr("Documents alive at the end", at(pb, m)["docs"], at(pa, m)["docs"]) + "</table>")

page = f"""<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>ST3 · Station faster: charts kept, X feed smooth</title>
<style>:root{{--bg:#0A0A0F;--panel2:#0F0F1A;--line:#1A1A2A;--ink:#F2F2F8;--ink2:#C6C8DE;--ink3:#9A9AB6;--mute:#3A3A52;--crk:#00D4FF;--mono:"SF Mono","JetBrains Mono",ui-monospace,Menlo,monospace}}
body{{margin:0;background:var(--bg);color:var(--ink2);font-family:var(--mono);font-size:12px;line-height:1.6;padding:18px 22px 60px}} h1{{color:var(--ink);font-size:17px;letter-spacing:.06em;margin:0 0 4px}} h2{{color:var(--crk);font-size:12px;letter-spacing:.18em;text-transform:uppercase;margin:34px 0 10px;border-bottom:1px solid var(--line);padding-bottom:6px}} h3{{color:var(--ink);font-size:12px;margin:18px 0 6px}}
.sub{{color:var(--ink3);font-size:11px}} b{{color:var(--ink);font-weight:600}} small{{color:var(--ink3);font-size:11px}} p,ul,ol{{max-width:980px}}
figure{{margin:0;display:inline-block;vertical-align:top}} figure img{{display:block;max-width:100%;border:1px solid var(--line);background:#000}} figcaption{{color:var(--ink3);font-size:11px;margin:4px 0 12px;max-width:640px}}
.pics{{display:flex;gap:14px;flex-wrap:wrap}} .pics figure{{flex:1 1 420px;max-width:820px}} .pics.small figure{{flex:0 1 300px}}
table{{border-collapse:collapse;margin:8px 0 14px;font-size:11.5px}} th,td{{border:1px solid var(--line);padding:5px 9px;text-align:left;vertical-align:top}} th{{color:var(--crk);font-weight:500;letter-spacing:.08em;font-size:11px;text-transform:uppercase;background:var(--panel2)}}
.rec{{border:1px solid rgba(0,212,255,.34);background:var(--panel2);padding:10px 14px;max-width:980px}} pre{{background:var(--panel2);border:1px solid var(--line);padding:10px;overflow-x:auto;font-size:11px;color:var(--ink3);max-width:1100px}}
.wide{{overflow-x:auto}} svg{{max-width:100%;height:auto}} svg text{{font-family:var(--mono)}}
details.sc-pagespecs{{margin-top:40px;color:var(--ink3);font-size:11px}} details.sc-pagespecs summary{{color:var(--ink3);letter-spacing:.16em;font-size:11px;cursor:pointer}}</style></head><body>
<h1>Station faster: charts are kept instead of rebuilt, and the X feed stops hopping</h1>
<div class="sub">ST3 · 6 Oct 2026 · branch <b>station/st3-speed-x-20261006</b> · the real Station page in a hidden browser on the MacBook, live data · nothing deployed, nothing live · built {datetime.datetime.now().strftime("%-d %b %Y %H:%M")} ET</div>

<h2>The short version</h2>
<ol>
<li><b>Charts.</b> In 30 minutes the Station built <b>{window(before, 0, 30, "chartDocs")}</b> new chart documents; on this branch it builds <b>{window(after, 0, 30, "chartDocs")}</b>, and only <b>{window(after, 15, 30, "chartDocs")}</b> of them after the first quarter of an hour (it was {window(before, 15, 30, "chartDocs")}). Same pages, same look.</li>
<li><b>X feed.</b> The X pane is not a list of posts. It is a live picture of the real X tab, scrolled by the bridge. Measured: at today's pace the picture <b>hopped backwards about {X[("before",3)]["picture"]["backwardPerMin"]:.0f} times a minute</b> (up to {abs(X[("before",3)]["picture"]["worstBackPx"]):.1f} px each). With the change it hops <b>{X[("after",3)]["picture"]["backwardPerMin"]:.0f}</b> times. A pace choice (1× · 2× · 4×) sits behind the ⋯. This part needs the bridge extension reloaded once (0.7.24).</li>
<li><b>Memory.</b> The drift was one thing: the Station's shared store of price history kept series long after they had expired. It now lets them go. At the half-hour mark of the run it dropped from {peak[1]["mChars"]:.0f} million characters to {min(c[1]["mChars"] for c in cache if c[0] > peak[0]):.0f} million within two minutes.</li>
</ol>

<h2>1 · Charts: a parked chart is re-used, not rebuilt</h2>
<div class="pics">
<figure><img src="shots/soak-before-end.png" alt="The Station after 30 minutes, before the change" loading="lazy"><figcaption>Before · the Station after 30 minutes of its own lap, 1680 × 1050. Eight charts, the X column (no X source in a hidden browser, so it shows its offline card), the two tapes.</figcaption></figure>
<figure><img src="shots/soak-after-end.png" alt="The Station after 30 minutes, with the change" loading="lazy"><figcaption>After · the same run on this branch. The same wall: the charts, their badges, lens and Geiger chips are where they were. The pages differ only because the lap was at a different page when each picture was taken.</figcaption></figure>
</div>
<h3>New chart documents built, minute by minute</h3>
{svg_lines([("before", [(x["m"], x["chartDocs"]) for x in before], True), ("after", [(x["m"], x["chartDocs"]) for x in after], False)], "new chart documents built, cumulative")}
<p>The dashed line is today's Station: it keeps building. The solid line is this branch: it builds what the first lap needs, then nearly stops.</p>
<h3>15 minutes</h3>
<table><tr><th>What</th><th>Before</th><th>After</th></tr>
{"".join(tr(*r) for r in rows15)}
{tr("Heap, average of minutes 5–15", f"{heap_avg(before, 5, 15):.0f}", f"{heap_avg(after, 5, 15):.0f}", " MB")}
{tr("Documents alive (all frames), minutes 5–15", alive(before, 5, 15), alive(after, 5, 15))}
</table>
<h3>30 minutes</h3>
<table><tr><th>What</th><th>Before</th><th>After</th></tr>
{"".join(tr(*r) for r in rows30)}
{tr("Heap, average of minutes 20–30", f"{heap_avg(before, 20, 30):.0f}", f"{heap_avg(after, 20, 30):.0f}", " MB")}
{tr("Documents alive (all frames), minutes 20–30", alive(before, 20, 30), alive(after, 20, 30))}
{tr("Times a parked chart was re-used", spare_b["taken"], spare_a["taken"])}
{tr("Times a new one was built because the parked one had been thrown away or did not fit", spare_b["none"] + spare_b["mismatch"], spare_a["none"] + spare_a["mismatch"])}
{tr("…of those: the parked chart was the wrong kind (plain vs RSI page)", spare_b["mismatch"], spare_a["mismatch"])}
</table>
{pair}
<h3>What was wrong</h3>
<p>The Station already parked one chart per slot to re-use on the next step. It threw that parked chart away in three cases, and each one is a normal part of the lap: when a page shows fewer charts than the last one (every 2-, 4- and 6-chart page emptied the slots above it); when the next page carries the RSI study (the parked plain chart cannot become an RSI chart, so it was dropped and a new one built, and the same on the way back); and on any page outside the lap.</p>
<h3>What changed</h3>
<ul><li>On a wide screen, a slot keeps up to two parked charts, one plain and one RSI, through pages that hide it. They are let go after five minutes away from the lap.</li>
<li>A parked chart is told it is parked and stops re-reading its history every minute until it is given a name again.</li>
<li>iPad and phone keep the old rules exactly: one parked chart, dropped as before.</li></ul>
<h3>What it costs, and what did not move</h3>
<ul><li><b>More charts are kept alive</b> ({alive(before, 20, 30)} documents before, {alive(after, 20, 30)} after), so the heap is about the same or a little higher, not lower. The gain is work not done: no page to parse, no scripts to compile, no canvases to make for each change.</li>
<li><b>History reads barely move.</b> A new chart document mostly reads from the shared store, so building fewer documents does not save many reads. The reads are set by how long a series may be kept (45 seconds just after each half hour, then until the next one).</li></ul>

<h2>2 · The X feed: the picture carries its own position, so it can only move forward</h2>
<div class="pics small">
<figure><img src="shots/x-before-3-pane.png" alt="The X pane before, on the stand-in feed" loading="lazy"><figcaption>Before · the Station's X pane (520 × 820) showing the stand-in feed. The white bars are the test's ruler, not part of the product.</figcaption></figure>
<figure><img src="shots/x-after-3-pane.png" alt="The X pane after" loading="lazy"><figcaption>After · the same pane. Same bar, same crop, same text size; nothing new is on screen until ⋯ is opened.</figcaption></figure>
<figure><img src="shots/x-after-more.png" alt="The X pane's ⋯ panel with the pace choice" loading="lazy"><figcaption>After · the ⋯ panel: under the refresh choice, a new line "scroll 1× 2× 4×". 1× is today's pace.</figcaption></figure>
<figure><img src="shots/x-source-corner.png" alt="The top-left corner of the X window, enlarged, with the row of squares" loading="lazy"><figcaption>The X window's own top-left corner, enlarged six times: the row of black and white squares the bridge now paints there. It is 120 × 8 px, outside the column the Station shows.</figcaption></figure>
</div>
<h3>What "scrolling" is here</h3>
<p>The bridge moves the real X page a whole pixel at a time (about four times a second at today's pace). The browser sends a new picture only when the page changes. Between two pictures the pane slides its crop by fractions of a pixel so the feed looks continuous. The pane paints 12 times a second. So a list that draws only what is visible, images that load late, and a scroll done with a transform are all things X's own page already does or that do not exist in a picture; they are not ours to add.</p>
<h3>What was wrong</h3>
<p>The picture and the crop that belongs to it reach the pane by two different roads. Around every whole-pixel step they arrive apart, and for a paint or two the pane put the new crop on the old picture, or the old crop on the new one. The feed jumped back by the step and forward again.</p>
<h3>Measured, before → after</h3>
<div class="wide"><table><tr><th>Pace</th><th>Backward hops a minute</th><th>Biggest usual move<br><small>19 paints in 20 are smaller</small></th><th>Biggest single move</th><th>Feed speed seen<br><small>px a second</small></th><th>Frames late<br><small>over 25 ms</small></th><th>Long tasks</th><th>Pane's own work<br><small>a minute</small></th><th>Paints · new pictures<br><small>a second</small></th></tr>
{xrow(3)}{xrow(6)}{xrow(12)}
</table></div>
<p>Each run is 40 seconds of motion and 40 seconds of cost, before and after back to back. "Backward hop" means a paint where the picture moved up the feed by more than an eighth of a pixel.</p>
<h3>What changed</h3>
<ul><li><b>The bridge</b> paints the page's scroll position as a small row of squares in the corner of the X window, in the same frame as every scroll.</li>
<li><b>The pane</b> reads that row from the very picture it is about to draw. It no longer guesses which scroll the picture holds, so what it shows can only move forward.</li>
<li><b>Pace.</b> The ⋯ panel gains 1× · 2× · 4× (3, 6 and 12 px a second). The default stays 1×.</li>
<li>With an older bridge, or if the squares cannot be read, the pane behaves exactly as it does today. The pane also times its own reading and falls back for a minute if it costs more than 3 ms.</li></ul>

<h2>3 · Memory: what was holding it</h2>
<p>The browser was asked which lines of code made the objects still alive at minute 5 and at minute 30. One line accounts for the growth:</p>
<pre>{E(heap_b)}</pre>
<p><b>candleCachePut</b> is the Station's shared store of price history (one copy for every chart). A series in it has a time limit, but an expired series was only removed when the same series was asked for again, or when the store reached 48 million characters. Names the lap had moved on from stayed.</p>
<p>The store now removes expired series itself, at most once a minute. Measured on the after run: it held <b>{peak[1]["entries"]} series, {peak[1]["mChars"]:.1f} million characters</b> at minute {peak[0]} ({peak[1]["expired"]} of them expired when the half hour turned), and <b>{at(after, peak[0] + 2)["cache"]["entries"]} series, {at(after, peak[0] + 2)["cache"]["mChars"]:.1f} million</b> two minutes later. At minute 30 it held {last[1]["entries"]} series, {last[1]["mChars"]:.1f} million.</p>
<h3>Heap, minute by minute</h3>
{svg_lines([("before", [(x["m"], x["heapMB"]) for x in before], True), ("after", [(x["m"], x["heapMB"]) for x in after], False)], "JS heap in MB after a forced clean-up")}
<p>The heap after the change, same question, minute 5 → minute 30:</p>
<pre>{E(heap_a)}</pre>

<h2>Tests</h2>
<p>Whole suite, <code>node --test</code> at the repo root. Live: {counts["live"]["tests"]} tests, {counts["live"]["fail"]} failing ({len(names_base)} distinct names). Branch: {counts["branch"]["tests"]} tests, {counts["branch"]["fail"]} failing ({len(names_after)} names). <b>New failing names: {len(new_fail)}</b>{(" — " + "; ".join(map(E, new_fail))) if new_fail else ""}. Fixed: {len(fixed)}. {counts["added"]} tests were added for this work; {counts["repinned"]} older tests that quoted exact lines were updated to the new wording.</p>

<h2>What could be wrong</h2>
<ul>
<li><b>The X numbers come from a stand-in.</b> x.com refuses an automated browser, so the test used the real bridge and the real pane on a plain page shaped like the feed. Real X has videos, images arriving and its own re-anchoring. The hop itself comes from how the picture and the crop travel, which is the same on real X, but the counts will differ.</li>
<li><b>Reading the squares costs something on every paint.</b> On the MacBook's hidden browser the pane's own work went from {X[("before",3)]["cost"]["mainThreadSPerMin"]:.1f} to {X[("after",3)]["cost"]["mainThreadSPerMin"]:.1f} seconds a minute at 1×. The iMac's graphics may differ. That is why the pane times itself and steps back when it is dear.</li>
<li><b>At 4× the test machine was overloaded</b> in some runs (long tasks before and after alike), so those numbers are rough.</li>
<li><b>Processor time in the two long chart runs is not comparable</b>; other measurements ran beside them. The side-by-side pair is the fair one.</li>
<li>A parked chart that keeps its name for more than a minute is re-read when it returns; a hidden chart that is not parked still re-reads every minute, as before.</li>
</ul>
<h2>Not done</h2>
<ul>
<li>Nothing is deployed. The bridge on this Mac is still 0.7.21; the X part does nothing until 0.7.24 is loaded.</li>
<li>Not seen on real X, on the iMac, or on the iPad mirror.</li>
<li>The pane still paints 12 times a second against 10 crops a second, so about one paint in five moves nothing. Tying the paint to the crop would make every paint move; not built.</li>
<li>The phone-width Station was only checked to load (picture below); its rules were not changed.</li>
</ul>
<div class="pics small"><figure><img src="shots/deck-390.png" alt="The Station at phone width on this branch" loading="lazy"><figcaption>This branch at 390 px wide: the stacked phone wall, unchanged.</figcaption></figure></div>

<h2>For Alan</h2>
<div class="rec"><ol>
<li><b>Ship the chart change and the memory fix?</b> Recommend yes. Same look; the Station stops rebuilding charts it already has.</li>
<li><b>Ship the X change (it needs the bridge reloaded once on each browser)?</b> Recommend yes, after one look at the real feed on the iMac at 1×.</li>
<li><b>Which pace should be the default?</b> Recommend 2×: the feed then travels about a third of the pane between two page-ups instead of a sixth, and it measured as smooth as 1×.</li>
</ol></div>

<details class="sc-pagespecs"><summary>PAGE SPECS</summary><div>
<p>Chart runs: <code>tools/soak.mjs</code> — the live Station (station.scintillahub.ai) in headless Chromium at 1680 × 1050, with this checkout's files served in place of the deployed ones and every non-GET request blocked ({rb["req"]["blocked"]} before, {ra["req"]["blocked"]} after). "Before" is commit 6051585 (S16b + SLOW1, byte-identical to live 46a7f73). A chart document is counted when the browser requests <code>/station-shells/chart-v1</code> as a document. Heap is read after a forced garbage collection. Data: <code>data/soak-*.json</code>, <code>data/pair-*.json</code>.</p>
<p>Memory: <code>tools/heap-diff.py</code> on the browser's allocation samples (objects still alive, by the line that made them). Data: <code>data/heap-*.txt</code>.</p>
<p>X runs: <code>tools/xscroll.mjs</code> + <code>tools/xscroll-analyze.py</code> — new headless Chromium (no window) with the bridge loaded from this checkout, a stand-in x.com page carrying a ruler (a white bar every 48 px), the bridge's own capture document handed a tab capture at its cap (1920 × 1080, at most 15 frames a second), and the pane from this checkout at 520 × 820. On every paint the ruler's position in the pane's canvas is read to a fraction of a pixel; that is the picture's real movement. The pane's 60-second page-up is held off during a run. Data: <code>data/x-*-summary.json</code>.</p>
<p>Files changed: <code>deck/index.html</code> (parked charts), <code>station-shells/chart-v1/index.html</code> = <code>chart/index.html</code> (parked: no re-read), <code>_provider/provider.js</code> (expired series), <code>station-shells/x-v2/index.html</code> (reads the squares; pace), <code>station-x-bridge-draft/content.js</code> + <code>manifest.json</code> 0.7.24 (paints the squares; pace), <code>x-health/index.html</code> (expects 0.7.24), tests.</p>
</div></details>
</body></html>"""
open(os.path.join(ROOT, "ST3.html"), "w").write(page)
print("wrote ST3.html", len(page))
