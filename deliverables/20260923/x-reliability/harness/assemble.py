#!/usr/bin/env python3
"""Fill the deliverable's measured sections from the logs the rig wrote.
Everything in the page that is a number comes through here."""
import json, pathlib, subprocess, sys

HERE = pathlib.Path(__file__).resolve().parent.parent
PAGE = HERE / "X-RELIABILITY.html"
SHOTS = HERE / "shots"

rendered = subprocess.run([sys.executable, str(HERE / "harness/render-results.py")],
                          capture_output=True, text=True, check=True).stdout
table, _, soak = rendered.partition("<!--SOAKMARK-->")

def shot(name, caption):
    return (f'<figure><img src="shots/{name}"><figcaption>{caption}</figcaption></figure>'
            if (SHOTS / name).exists() else f'<figure><figcaption>{caption} — not captured</figcaption></figure>')

pairs = [
    ("before-f-capture-black-11s.png", "after-f-capture-black-11s.png",
     "(f) the capture has been sending black frames for 11 s"),
    ("before-g-no-answer-71s.png", "after-g-no-answer-71s.png",
     "(g) reloaded 71 s ago, and nothing can answer"),
    ("before-h-crop-misses-12s.png", "after-h-crop-misses-12s.png",
     "(h) a crop that misses the captured frame"),
]
grid = []
for b, a, caption in pairs:
    grid.append(f'<h3>{caption}</h3><div class="shots">'
                + shot(b, "deployed today · what Alan sees")
                + shot(a, "this branch · same second, same rig") + "</div>")

heart = ""
hb = SHOTS / "heartbeat-log.json"
if hb.exists():
    h = json.load(open(hb))
    ok = "yes" if h.get("crossesTheFrame") else "no"
    honest = "yes" if h.get("reportsBlackHonestly") else "no"
    heart = (f'<h2>4b · The heartbeat the deck relies on</h2>'
             f'<p>The deck can only hold a reload if the pane tells it that it is live, and that message has to cross '
             f'an iframe boundary the main rig never exercises (there the pane is top-level, so the heartbeat is a '
             f'no-op). A second check mounts the real shell in a real iframe with the real bridge and a real capture '
             f'({h.get("capture")}): the host received <b>{h.get("beats")}</b> beats. Reaches the deck while the pane '
             f'is showing the feed: <b>{ok}</b>. Reports <code>live</code> but <code>picture:false</code> once the '
             f'capture goes black under it: <b>{honest}</b>.</p>'
             f'<p class="k">last beats while showing: {json.dumps(h.get("whileShowing"))}<br>'
             f'last beats while black: {json.dumps(h.get("whileBlack"))}</p>')

page = PAGE.read_text()
page = page.replace("<!--RESULTS-->", table + "\n" + "\n".join(grid))
page = page.replace("<!--SOAK-->", soak.strip())
page = page.replace("<!--HEARTBEAT-->", heart)
PAGE.write_text(page)
print("assembled:", PAGE, len(page), "bytes")
for marker in ("<!--RESULTS-->", "<!--SOAK-->", "<!--HEARTBEAT-->", "<!--TODO-->"):
    if marker in page:
        print("STILL UNFILLED:", marker)
