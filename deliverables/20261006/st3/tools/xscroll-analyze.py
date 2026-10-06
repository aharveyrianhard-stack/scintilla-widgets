#!/usr/bin/env python3
"""ST3: turn xscroll.mjs raw runs into the numbers of the report.
usage: xscroll-analyze.py <raw.json> [<raw.json> ...]   -> prints one JSON object per run, writes <label>-summary.json beside it

How the picture's movement is read: the stand-in feed carries a white bar every 48 px. On every
paint of the pane's canvas the harness records where the bars landed (to a fraction of a pixel).
The bars' common phase, unwrapped over time, is the distance the PICTURE has scrolled - whatever
the source, the capture and the crop each believed."""
import json, math, statistics, sys, os

RULER_CSS_PX = 48.0

def phase_track(paints):
    spacings = []
    for p in paints:
        bars = [b for b in (p[1] or []) if isinstance(b, (int, float))]
        spacings += [b - a for a, b in zip(bars, bars[1:]) if 30 < b - a < 90]
    if len(spacings) < 20:
        return None, []
    period = statistics.median(spacings)
    out, prev, turns = [], None, 0
    for p in paints:
        bars = [b for b in (p[1] or []) if isinstance(b, (int, float))]
        # keep the bars that sit one period from a neighbour (the top of the pane holds partial marks)
        good = [b for i, b in enumerate(bars) if any(abs(abs(b - o) - period) < 2.5 for o in bars if o is not b)]
        if not good:
            continue
        ang = [2 * math.pi * (b % period) / period for b in good]
        ph = math.atan2(sum(map(math.sin, ang)) / len(ang), sum(map(math.cos, ang)) / len(ang)) / (2 * math.pi) * period
        if prev is not None:
            d = ph - prev
            if d > period / 2: turns -= 1
            elif d < -period / 2: turns += 1
        prev = ph
        # the picture moving UP the pane is the feed scrolling forward: position grows
        out.append((p[0], -(ph + turns * period)))
    return period, out

def pct(xs, q):
    xs = sorted(xs)
    return xs[min(len(xs) - 1, int(q * len(xs)))] if xs else None

def summarize(path):
    r = json.load(open(path))
    s = {"label": r.get("label"), "speedAsked": r.get("speedAsked"), "shell": r.get("shell"), "bridge": r.get("bridgeVersion"),
         "throttle": r.get("throttle"), "error": r.get("error")}
    m, c = r.get("motion"), r.get("cost")
    if not m or not c:
        return s
    period, track = phase_track(m["paints"])
    s["sourcePxPerS"] = m["sourcePxPerS"]
    s["paintsPerS"] = round(len(m["paints"]) / m["seconds"], 1)
    s["framesFromSourcePerS"] = round(m["video"]["decoded"] / m["seconds"], 1)
    s["cropsPerS"] = round(m["crops"] / m["seconds"], 1)
    if period and len(track) > 20:
        k = RULER_CSS_PX / period                      # canvas px -> source (X page) px
        steps = [(b[1] - a[1]) * k for a, b in zip(track, track[1:])]
        gaps = [b[0] - a[0] for a, b in zip(track, track[1:])]
        secs = (track[-1][0] - track[0][0]) / 1000
        speed = (track[-1][1] - track[0][1]) * k / secs
        ideal = [speed * g / 1000 for g in gaps]
        err = [st - i for st, i in zip(steps, ideal)]
        s["picture"] = {
            "pxPerS": round(speed, 2),                                   # what the eye sees, in X-page px a second
            "panePxPerS": round(speed / k, 2),
            "moves": len(steps),
            "stillShare": round(sum(1 for st in steps if abs(st) < 0.04) / len(steps), 3),     # a paint that moved nothing
            "backwardShare": round(sum(1 for st in steps if st < -0.12) / len(steps), 3),      # a paint that went back up
            "backwardPerMin": round(sum(1 for st in steps if st < -0.12) / secs * 60, 1),
            "worstBackPx": round(min(steps), 2),
            "biggestStepPx": round(max(steps), 2),
            "stepP50": round(pct(steps, .5), 3), "stepP95": round(pct(steps, .95), 3),
            "unevenPx": round(statistics.pstdev(err), 3),                # 0 = every paint moved exactly its share
            "paintGapMsP50": round(pct(gaps, .5), 1), "paintGapMsP95": round(pct(gaps, .95), 1),
            # movement changes on screen per second: paints that actually moved the picture
            "movingPaintsPerS": round(sum(1 for st in steps if abs(st) >= 0.04) / secs, 1),
        }
    raf = c["raf"]
    s["cost"] = {
        "rafFrames": len(raf), "rafOver25ms": sum(1 for x in raf if x > 25), "rafOver50ms": sum(1 for x in raf if x > 50),
        "rafWorstMs": max(raf) if raf else None,
        "longTasks": len(c["lt"]), "longTaskMs": sum(x[1] for x in c["lt"]),
        "mainThreadSPerMin": round(c["taskS"] / c["seconds"] * 60, 2), "scriptSPerMin": round(c["scriptS"] / c["seconds"] * 60, 2),
        "paintsPerS": round(len(c["paints"]) / c["seconds"], 1), "framesFromSourcePerS": round(c["video"]["decoded"] / c["seconds"], 1),
        "heapMB": c["heapMB"], "canvas": c["canvas"], "video": [c["video"]["w"], c["video"]["h"]],
    }
    src = c.get("cropLog") or []
    if src:
        s["source"] = {"ackFallbacks": (src[-1][4] or 0) - (src[0][4] or 0), "runawayResets": (src[-1][5] or 0) - (src[0][5] or 0)}
    return s

for path in sys.argv[1:]:
    s = summarize(path)
    json.dump(s, open(os.path.join(os.path.dirname(path), (s.get("label") or "run") + "-summary.json"), "w"), indent=1)
    print(json.dumps(s))
