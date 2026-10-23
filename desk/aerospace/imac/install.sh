#!/bin/bash
# install.sh — put AeroSpace on the iMac with this folder's config, and make it start at login.
#
# Run ON THE iMAC, from this folder:
#     ./install.sh                     # newest AeroSpace via Homebrew
#     ./install.sh --version 0.19.2    # match the MacBook: run `aerospace --version` there first
#
# What it does, in order:
#   1. Homebrew present? (installs it if not — Apple's Command Line Tools may prompt once)
#   2. AeroSpace installed (Homebrew cask, or the exact GitHub release when --version is given)
#   3. Config + helper scripts copied to ~/.config/aerospace/  (existing config backed up)
#   4. AeroSpace launched, config reloaded  (start-at-login = true registers the login item)
#   5. Preflight printed
#
# It never decides what goes in the workspaces. It never touches the MacBook.

set -e
HERE="$(cd "$(dirname "$0")" && pwd)"
DEST="$HOME/.config/aerospace"
WANT=""

while [ $# -gt 0 ]; do
  case "$1" in
    --version) WANT="${2#v}"; shift 2 ;;
    -h|--help) sed -n '2,16p' "$0"; exit 0 ;;
    *) echo "unknown option: $1" >&2; exit 2 ;;
  esac
done

if [ "$(uname -s)" != "Darwin" ]; then
  echo "This installer is for macOS (the iMac). Nothing done." >&2
  exit 1
fi

step() { printf '\n== %s\n' "$1"; }

# 1. Homebrew --------------------------------------------------------------
step "Homebrew"
if ! command -v brew >/dev/null 2>&1; then
  for p in /opt/homebrew/bin/brew /usr/local/bin/brew; do [ -x "$p" ] && eval "$("$p" shellenv)"; done
fi
if ! command -v brew >/dev/null 2>&1; then
  echo "Homebrew is not installed. Installing it now (this can take a few minutes and may ask for your password)."
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
  for p in /opt/homebrew/bin/brew /usr/local/bin/brew; do [ -x "$p" ] && eval "$("$p" shellenv)"; done
fi
echo "Homebrew: $(brew --version | head -1)"

# 2. AeroSpace ---------------------------------------------------------------
step "AeroSpace"
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
have=""
command -v aerospace >/dev/null 2>&1 && have=$(aerospace --version 2>/dev/null | grep -Eo '[0-9]+\.[0-9]+\.[0-9]+' | head -1)

if [ -n "$WANT" ] && [ "$have" != "$WANT" ]; then
  echo "Installing AeroSpace v$WANT from the GitHub release (to match the MacBook)."
  tmp=$(mktemp -d)
  url="https://github.com/nikitabobko/AeroSpace/releases/download/v$WANT/AeroSpace-v$WANT.zip"
  curl -fL "$url" -o "$tmp/aerospace.zip"
  ( cd "$tmp" && unzip -q aerospace.zip )
  src=$(find "$tmp" -maxdepth 2 -name AeroSpace.app -type d | head -1)
  [ -n "$src" ] || { echo "Release zip did not contain AeroSpace.app" >&2; exit 1; }
  pkill -x AeroSpace 2>/dev/null || true
  rm -rf /Applications/AeroSpace.app
  cp -R "$src" /Applications/AeroSpace.app
  cli=$(find "$tmp" -maxdepth 3 -path '*/bin/aerospace' -type f | head -1)
  if [ -n "$cli" ]; then
    sudo mkdir -p /usr/local/bin
    sudo cp "$cli" /usr/local/bin/aerospace
    sudo chmod +x /usr/local/bin/aerospace
  fi
  rm -rf "$tmp"
elif [ -z "$have" ]; then
  echo "Installing AeroSpace via Homebrew."
  brew install --cask nikitabobko/tap/aerospace
else
  echo "AeroSpace already installed (v$have) — keeping it."
fi
echo "AeroSpace: $(aerospace --version 2>/dev/null | head -1)"

# 3. Config ------------------------------------------------------------------
step "Config → $DEST"
mkdir -p "$DEST/bin"
if [ -f "$DEST/aerospace.toml" ] && ! cmp -s "$HERE/aerospace.toml" "$DEST/aerospace.toml"; then
  bak="$DEST/aerospace.toml.bak-$(date +%Y%m%d-%H%M%S)"
  cp "$DEST/aerospace.toml" "$bak"
  echo "Existing config backed up to $bak"
fi
cp "$HERE/aerospace.toml" "$DEST/aerospace.toml"
cp "$HERE"/bin/*.sh "$DEST/bin/"
chmod +x "$DEST"/bin/*.sh
if [ -f "$HOME/.aerospace.toml" ]; then
  echo "WARNING: ~/.aerospace.toml exists and AeroSpace reads it INSTEAD of $DEST/aerospace.toml."
  echo "         Move it aside:  mv ~/.aerospace.toml ~/.aerospace.toml.old"
fi
echo "Config in place. Edit it any time: $DEST/aerospace.toml  (then ⌥⇧R to reload)"

# 4. Launch + reload ----------------------------------------------------------
step "Launch"
open -a AeroSpace
i=0
until pgrep -x AeroSpace >/dev/null || [ $i -ge 20 ]; do sleep 1; i=$((i+1)); done
sleep 2
aerospace reload-config || true
echo "AeroSpace is running. start-at-login = true in the config registers the login item."
echo "If macOS asks for Accessibility permission, grant it: System Settings → Privacy & Security → Accessibility."

# 5. Preflight ----------------------------------------------------------------
step "Preflight"
"$DEST/bin/preflight.sh" || true

cat <<MSG

Done. To confirm reboot survival: restart the iMac, then press ⌥⇧P (or run $DEST/bin/preflight.sh).
MSG
