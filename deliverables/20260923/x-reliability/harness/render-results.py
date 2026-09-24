#!/usr/bin/env python3
"""Render the before/after table straight from the two machine-readable logs,
so no number in the deliverable is typed by hand."""
import json, sys, pathlib

HERE = pathlib.Path(__file__).resolve().parent.parent
SHOTS = HERE / "shots"
ROWS = [
    ("0-attached",            "attached and drawing"),
    ("a-resize-settled",      "<b>(a)</b> after ten window sizes"),
    ("b-reload-3s",           "<b>(b)</b> 3&nbsp;s after a Station reload"),
    ("b-reload-15s",          "<b>(b)</b> 15&nbsp;s after a Station reload"),
    ("c-selfupdate-15s",      "<b>(c)</b> 15&nbsp;s after the self-update reloads the X shell"),
    ("d-hidden-6s",           "<b>(d)</b> the pane's tab hidden for 6&nbsp;s"),
    ("d-shown-4s",            "<b>(d)</b> 4&nbsp;s after it comes back"),
    ("f-capture-black-3s",    "<b>(f)</b> the capture goes black · 3&nbsp;s"),
    ("f-capture-black-11s",   "<b>(f)</b> · 11&nbsp;s"),
    ("f-capture-black-51s",   "<b>(f)</b> · 51&nbsp;s"),
    ("f-capture-restored",    "<b>(f)</b> the capture comes back"),
    ("g-no-answer-8s",        "<b>(g)</b> reloaded, nobody answers · 8&nbsp;s"),
    ("g-no-answer-26s",       "<b>(g)</b> · 26&nbsp;s"),
    ("g-no-answer-71s",       "<b>(g)</b> · 71&nbsp;s"),
    ("g-answer-allowed-again","<b>(g)</b> the source can answer again"),
    ("h-crop-misses-3s",      "<b>(h)</b> a crop that misses the frame · 3&nbsp;s"),
    ("h-crop-misses-12s",     "<b>(h)</b> · 12&nbsp;s"),
    ("h-crop-released",       "<b>(h)</b> real crops again"),
]

def load(label):
    rows = {}
    data = json.load(open(SHOTS / f"{label}-log.json"))
    for entry in data["log"]:
        rows[entry["step"]] = entry
    return rows, data.get("summary", {})

def cell(entry):
    if not entry:
        return '<td colspan="2" class="k">not measured</td>'
    verdict = entry.get("verdict") or ""
    ink = entry.get("ink")
    klass = "bad" if verdict == "BLACK" else ("good" if verdict == "picture" else "mid")
    shown = "BLACK" if verdict == "BLACK" else verdict
    state = entry.get("state") or ("the offline card" if entry.get("cardVisible") else "—")
    link = entry.get("link") or {}
    if link.get("fullFrame"):
        state += " <span class='k'>(whole frame)</span>"
    return (f'<td class="{klass}"><b>{shown}</b> <span class="k">ink {ink}</span></td>'
            f'<td>{state}</td>')

before, bsum = load("before")
after, asum = load("after")
out = ['<table><tr><th rowspan="2">situation</th><th colspan="2">deployed today (5d30595)</th>'
       '<th colspan="2">this branch</th></tr>'
       '<tr><th>what the pane shows</th><th>what it says</th><th>what the pane shows</th><th>what it says</th></tr>']
for step, label in ROWS:
    out.append(f'<tr><td>{label}</td>{cell(before.get(step))}{cell(after.get(step))}</tr>')
out.append("</table>")
out.append(f'<p class="k">before: {bsum.get("sourceKind","?")} · after: {asum.get("sourceKind","?")}</p>')

# ---- the soak, straight from the same log ----
soak = [e for e in json.load(open(SHOTS / "after-log.json"))["log"] if e["step"].startswith("e-soak")]
if soak:
    pictures = sum(1 for e in soak if e.get("verdict") == "picture")
    worst = min(soak, key=lambda e: e.get("ink") or 0)
    states = sorted({(e.get("state") or "") for e in soak})
    renegotiated = max((e.get("webrtc") or 0) for e in soak) - min((e.get("webrtc") or 0) for e in soak)
    first, last = soak[0], soak[-1]
    soak_html = (
        f'<p>The same script then held the pane open for <b>{len(soak)} minutes</b>, resizing the window through ten '
        f'shapes, one a minute, with a measurement after each resize. <b>{pictures} of {len(soak)}</b> measurements '
        f'were a moving picture. The weakest was <code>ink {worst.get("ink")}</code> at <code>{worst["step"]}</code>. '
        f'The stream was renegotiated <b>{renegotiated}</b> times during the soak. Everything the pane said across the '
        f'whole run: {" · ".join("<code>" + (s or "nothing") + "</code>" for s in states)}. '
        f'Crops kept arriving throughout (<code>{first.get("crops")}</code> at the first measurement, '
        f'<code>{last.get("crops")}</code> at the last).</p>')
else:
    soak_html = '<p class="k">no soak rows in this run</p>'
out.append("<!--SOAKMARK-->" + soak_html)
print("\n".join(out))
