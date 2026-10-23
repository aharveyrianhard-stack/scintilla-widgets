#!/bin/bash
# show-titles.sh — plain list of "App — window title" for every window on this workspace.
# Bound to ⌥L. Useful when windows are parked small and their titles are clipped.

export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

ws=$(aerospace list-workspaces --focused 2>/dev/null)
list=$(aerospace list-windows --workspace focused --format '%{app-name}  —  %{window-title}' 2>/dev/null)
[ -z "$list" ] && list="(no windows on this workspace)"

# Pass the text as an argument so quotes in window titles cannot break the dialog.
osascript - "$list" "Windows on ${ws:-this workspace}" <<'APPLESCRIPT'
on run argv
  display dialog (item 1 of argv) with title (item 2 of argv) buttons {"OK"} default button 1
end run
APPLESCRIPT
