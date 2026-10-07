#!/usr/bin/env python3
"""ST3: gather the run outputs (a scratch folder) into ../data and ../shots, small enough to commit.
usage: collect.py <scratch>   (the folder the soak / xscroll runs wrote into)"""
import json, os, shutil, subprocess, sys, re
S = sys.argv[1]; HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
DATA, SHOTS = os.path.join(ROOT, "data"), os.path.join(ROOT, "shots")
os.makedirs(DATA, exist_ok=True); os.makedirs(SHOTS, exist_ok=True)
def slim(result):
    """a run's result without the long-task list (thousands of pairs)"""
    r = json.load(open(result))
    if r.get("made"): r["made"] = {"spare": r["made"]["spare"], "made": r["made"]["made"], "longTasks": len(r["made"].get("lt") or [])}
    return r
for side in ("before", "after"):
    shutil.copy(f"{S}/soak/{side}-samples.json", f"{DATA}/soak-{side}-samples.json")
    json.dump(slim(f"{S}/soak/{side}-result.json"), open(f"{DATA}/soak-{side}-result.json", "w"))
    shutil.copy(f"{S}/soak/{side}-end.png", f"{SHOTS}/soak-{side}-end.png")
    if os.path.exists(f"{S}/pair/pair-{side}-samples.json"): shutil.copy(f"{S}/pair/pair-{side}-samples.json", f"{DATA}/pair-{side}-samples.json")
    if os.path.exists(f"{S}/pair2/ready-{side}-result.json"):
        r = slim(f"{S}/pair2/ready-{side}-result.json"); json.dump({"fades": r.get("fades"), "samples": r.get("samples"), "spare": r["made"]["spare"]}, open(f"{DATA}/ready-{side}.json", "w"))
    out = subprocess.run([sys.executable, f"{HERE}/heap-diff.py", f"{S}/soak/{side}-heap-m5.json", f"{S}/soak/{side}-heap-m30.json", "8"], capture_output=True, text=True).stdout
    open(f"{DATA}/heap-{side}-m5-m30.txt", "w").write("\n".join(l[:150] for l in out.split("\n")))
raws = sorted(f for f in os.listdir(f"{S}/xfinal2") if f.endswith("-raw.json"))
subprocess.run([sys.executable, f"{HERE}/xscroll-analyze.py"] + [f"{S}/xfinal2/{f}" for f in raws], capture_output=True)
for f in raws:
    label = f[:-len("-raw.json")]
    shutil.copy(f"{S}/xfinal2/{label}-summary.json", f"{DATA}/x-{label}-summary.json")
    raw = json.load(open(f"{S}/xfinal2/{f}"))
    if raw.get("paceCheck"): json.dump(raw["paceCheck"], open(f"{DATA}/x-pace-check.json", "w"), indent=1)
    if raw.get("cost", {}).get("cadence", {}).get("scrollCode"): json.dump(raw["cost"]["cadence"]["scrollCode"], open(f"{DATA}/x-{label}-code-reads.json", "w"))
# the before picture is from the first set of runs: in the second set the unchanged bridge settled on a
# wider crop in two of its three runs (it does that with old and new code alike - see the page's notes)
for a, b in (("xfinal/before-3-pane.png", "x-before-3-pane.png"), ("xfinal2/before-3-pane.png", "x-before-3-pane-wide-crop.png"),
             ("xfinal2/after-3-pane.png", "x-after-3-pane.png"), ("xfinal2/after-3-more.png", "x-after-more.png")):
    if os.path.exists(f"{S}/{a}"): shutil.copy(f"{S}/{a}", f"{SHOTS}/{b}")
if os.path.exists(f"{S}/phone/phone-end.png"): shutil.copy(f"{S}/phone/phone-end.png", f"{SHOTS}/deck-390.png")
try:
    from PIL import Image
    im = Image.open(f"{S}/xa/dbg-source.png"); im.crop((0, 0, 150, 40)).resize((900, 240), Image.NEAREST).save(f"{SHOTS}/x-source-corner.png")
except Exception as e: print("corner picture:", e)
names = lambda tap: sorted(set(re.sub(r" \([0-9.]+ms\)$", "", l.strip()[2:]) for l in open(tap, errors="replace") if re.match(r"^\s*✖ ", l)))
count = lambda tap: {k: int(re.search(rf"^ℹ {k} (\d+)", open(tap, errors="replace").read(), re.M).group(1)) for k in ("tests", "pass", "fail")}
live, branch = names(f"{S}/base.tap"), names(f"{S}/after.tap")
open(f"{DATA}/tests-live.names", "w").write("\n".join(live) + "\n"); open(f"{DATA}/tests-branch.names", "w").write("\n".join(branch) + "\n")
json.dump({"live": count(f"{S}/base.tap"), "branch": count(f"{S}/after.tap"), "added": 15, "repinned": 5}, open(f"{DATA}/tests-counts.json", "w"), indent=1)
print("collected:", len(os.listdir(DATA)), "data files,", len(os.listdir(SHOTS)), "pictures; new failing names:", sorted(set(branch) - set(live)))
