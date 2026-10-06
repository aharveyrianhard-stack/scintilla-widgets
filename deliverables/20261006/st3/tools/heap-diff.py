#!/usr/bin/env python3
"""ST3: what is still holding memory. Reads the allocation samples soak.mjs saved (objects still alive
at minute N, by the line that made them) and prints the lines whose live bytes grew between two minutes.
usage: heap-diff.py <heap-mA.json> <heap-mB.json> [top]"""
import json, sys, collections, re
def live(path):
    prof = json.load(open(path)); by = collections.Counter(); stack = [(prof["head"], "")]
    while stack:
        node, parent = stack.pop()
        cf = node["callFrame"]; url = re.sub(r"^https?://[^/]+", "", cf.get("url", "")).split("?")[0]
        key = f'{cf.get("functionName") or "(anonymous)"} @ {url}:{cf.get("lineNumber", 0) + 1}'
        if node.get("selfSize"): by[key + "   ← " + parent] += node["selfSize"]
        for c in node.get("children", []): stack.append((c, key.split(" @ ")[0]))
    return by
a, b = live(sys.argv[1]), live(sys.argv[2]); top = int(sys.argv[3]) if len(sys.argv) > 3 else 25
print(f"live sampled bytes: {sum(a.values())/1048576:.1f} MB → {sum(b.values())/1048576:.1f} MB")
rows = sorted(((b[k] - a.get(k, 0), b[k], a.get(k, 0), k) for k in set(a) | set(b)), reverse=True)
for d, vb, va, k in rows[:top]: print(f"{d/1024:+9.0f} kB  ({va/1024:7.0f} → {vb/1024:7.0f})  {k}")
print("…shrank most:")
for d, vb, va, k in rows[-5:]: print(f"{d/1024:+9.0f} kB  ({va/1024:7.0f} → {vb/1024:7.0f})  {k}")
