#!/bin/bash
# set-the-table.sh — make sure the three workspaces exist (still empty) and land on alan-personal.
# Bound to ⌥T. Safe to run any time; it never moves or closes a window.
#
# Slot contents are deliberately NOT decided here.

export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

WORKSPACES="alan-personal ai-sandbox vault-background"

for ws in $WORKSPACES; do
  aerospace workspace "$ws"
done
aerospace workspace alan-personal

osascript -e 'display notification "alan-personal · ai-sandbox · vault-background" with title "AeroSpace — table set"' 2>/dev/null
