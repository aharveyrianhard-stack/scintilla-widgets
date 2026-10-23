#!/bin/bash
# preflight.sh — plain-English health check for AeroSpace on the iMac.
#
#   ~/.config/aerospace/bin/preflight.sh            prints the report
#   ~/.config/aerospace/bin/preflight.sh --dialog   also shows it in a window (⌥⇧P)
#
# Exit code 0 = everything needed is in place. 1 = at least one hard check failed.

export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

CONFIG="$HOME/.config/aerospace/aerospace.toml"
BIN="$HOME/.config/aerospace/bin"
WORKSPACES="alan-personal ai-sandbox vault-background"

fail=0
report=""
say() { report="$report$1"$'\n'; }
ok()  { say "  ✓ $1"; }
bad() { say "  ✗ $1"; fail=1; }
note(){ say "  · $1"; }

say "AeroSpace preflight — iMac — $(date '+%Y-%m-%d %H:%M')"
say ""

# 1. Installed
if command -v aerospace >/dev/null 2>&1 && [ -d /Applications/AeroSpace.app ]; then
  ver=$(aerospace --version 2>/dev/null | head -1)
  ok "AeroSpace is installed (${ver:-version unknown})."
else
  bad "AeroSpace is not installed. Run install.sh first."
fi

# 2. Running
pid=$(pgrep -x AeroSpace | head -1)
if [ -n "$pid" ]; then
  ok "AeroSpace is running right now."
else
  bad "AeroSpace is not running. Open it from /Applications, or run: open -a AeroSpace"
fi

# 3. Start at login + did it survive the last reboot?
if grep -Eq '^[[:space:]]*start-at-login[[:space:]]*=[[:space:]]*true' "$CONFIG" 2>/dev/null; then
  ok "Start at login is switched on in the config."
else
  bad "Start at login is NOT on in the config (start-at-login = true is missing)."
fi
if [ -n "$pid" ]; then
  boot=$(sysctl -n kern.boottime 2>/dev/null | sed -E 's/.*sec = ([0-9]+).*/\1/')
  started=$(ps -o lstart= -p "$pid" 2>/dev/null)
  started_epoch=$(date -j -f '%a %b %d %T %Y' "$started" '+%s' 2>/dev/null)
  if [ -n "$boot" ] && [ -n "$started_epoch" ]; then
    gap=$(( started_epoch - boot ))
    if [ "$gap" -ge 0 ] && [ "$gap" -le 300 ]; then
      ok "It came up on its own within 5 minutes of the last boot — reboot survival confirmed."
    else
      note "It was started by hand after boot ($(( gap / 60 )) min later). Reboot once, then run this again to confirm survival."
    fi
  else
    note "Could not compare boot time and process start time; reboot survival not confirmed."
  fi
else
  note "Reboot survival cannot be confirmed while it is not running."
fi

# 4. Config file present, in the place AeroSpace reads, and it parses
if [ -f "$HOME/.aerospace.toml" ]; then
  bad "There is a ~/.aerospace.toml — AeroSpace reads THAT one first and ignores $CONFIG. Remove or merge it."
fi
if [ -f "$CONFIG" ]; then
  ok "Config found at $CONFIG"
  if command -v aerospace >/dev/null 2>&1 && [ -n "$pid" ]; then
    if err=$(aerospace reload-config --dry-run --no-gui 2>&1); then
      ok "Config parses cleanly."
    else
      bad "Config has an error: $(echo "$err" | head -3 | tr '\n' ' ')"
    fi
  fi
else
  bad "No config at $CONFIG"
fi

# 5. Workspaces
if [ -n "$pid" ]; then
  have=$(aerospace list-workspaces --all 2>/dev/null)
  missing=""
  for ws in $WORKSPACES; do
    echo "$have" | grep -qx "$ws" || missing="$missing $ws"
  done
  if [ -z "$missing" ]; then
    ok "Workspaces present: $(echo $WORKSPACES | sed 's/ / · /g')"
  else
    bad "Workspaces missing:$missing  — press ⌥T (set the table) and run this again."
  fi
fi

# 6. Helper scripts
for s in size.sh set-the-table.sh show-titles.sh preflight.sh; do
  if [ -x "$BIN/$s" ]; then ok "Helper ready: bin/$s"; else bad "Helper missing or not executable: $BIN/$s"; fi
done

# 7. Hotkeys (as bound in the config right now)
say ""
say "Hotkeys (⌥ = Option):"
if [ -f "$CONFIG" ]; then
  hot=$(grep -E '^alt-' "$CONFIG" \
    | sed -E "s/^alt-shift-/⌥⇧/; s/^alt-/⌥/; s/[[:space:]]*=[[:space:]]*/  →  /; s/[[:space:]]+#.*//" \
    | sed -E "s/exec-and-forget ~\/.config\/aerospace\/bin\///" \
    | sed 's/^/    /')
  report="$report$hot"$'\n'
fi

say ""
if [ "$fail" -eq 0 ]; then
  say "Result: all good."
else
  say "Result: something needs attention (see ✗ above)."
fi

printf '%s' "$report"

if [ "${1:-}" = "--dialog" ]; then
  osascript - "$report" <<'APPLESCRIPT' >/dev/null 2>&1
on run argv
  display dialog (item 1 of argv) with title "AeroSpace preflight" buttons {"OK"} default button 1
end run
APPLESCRIPT
fi

exit $fail
