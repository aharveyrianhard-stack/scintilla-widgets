#!/bin/bash
# size.sh big|half|park — manual kickoff sizing for the focused window.
#
# Nothing here runs on its own; only the hotkeys call it (⌥B / ⌥H / ⌥P).
#
# Editable knobs:
PARK_WIDTH=${PARK_WIDTH:-640}   # pixels. Wide enough that tabs and the title bar stay readable.
#
# How each size behaves (AeroSpace is a tiling manager, so widths are shares of the screen):
#   big  — the window fills the whole screen (native fullscreen, no gaps).
#   half — leaves fullscreen, then takes half the screen width next to its neighbours.
#   park — leaves fullscreen, then narrows to PARK_WIDTH next to its neighbours.
#   A window that is ALONE on its workspace always fills it; half/park show once
#   a second window shares the workspace. To size a lone window freely, float it first (⌥F).

export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

screen_width() {
  # Main display width in points. Finder reports the desktop bounds as "0, 0, W, H".
  osascript -e 'tell application "Finder" to get bounds of window of desktop' 2>/dev/null \
    | awk -F', ' '{print $3}'
}

case "${1:-}" in
  big)
    aerospace fullscreen on
    ;;
  half)
    aerospace fullscreen off 2>/dev/null
    aerospace layout tiling  2>/dev/null
    w=$(screen_width)
    if [ -n "$w" ]; then
      aerospace resize width $(( w / 2 ))
    else
      aerospace balance-sizes
    fi
    ;;
  park)
    aerospace fullscreen off 2>/dev/null
    aerospace layout tiling  2>/dev/null
    aerospace resize width "$PARK_WIDTH"
    ;;
  *)
    echo "usage: size.sh big|half|park" >&2
    exit 2
    ;;
esac
