# Intake receipt — SPRINT B — AeroSpace on iMac

Parent: Onboarder · Pair: 2026-09-07 SPRINT A (MacBook Pro) · Written 2026-09-08

## Where things live on the iMac

| What | Path |
|---|---|
| Config (edit this) | `~/.config/aerospace/aerospace.toml` |
| Helpers | `~/.config/aerospace/bin/{size,set-the-table,show-titles,preflight}.sh` |
| Source of truth in git | `desk/aerospace/imac/` in `scintilla-widgets` |
| Installer | `desk/aerospace/imac/install.sh` (run on the iMac) |

Reload after any edit: **⌥⇧R**.

## Hotkeys (⌥ = Option)

| Key | Does |
|---|---|
| ⌥1 / ⌥2 / ⌥3 | Go to `alan-personal` / `ai-sandbox` / `vault-background` |
| ⌥⇧1 / ⌥⇧2 / ⌥⇧3 | Send the focused window there, and follow it |
| ⌥Tab | Back to the previous workspace |
| **⌥T** | **Set the table** — all three workspaces exist (empty), land on `alan-personal` |
| **⌥B** | **Big** — window fills the screen |
| **⌥H** | **Half** — half the screen width, beside its neighbours |
| **⌥P** | **Park** — narrow (640 px, editable in `bin/size.sh`), title still readable |
| ⌥L | Readable list of "App — window title" for this workspace |
| ⌥ arrows | Focus the window in that direction |
| ⌥⇧ arrows | Move the window in that direction |
| ⌥F | Float this window / tile it again |
| ⌥/ | Side-by-side ⇄ stacked |
| ⌥, | Accordion layout |
| ⌥= | Equal shares for every tiled window |
| ⌥⇧R | Reload config |
| ⌥⇧P | Preflight, in a window |

Sizing is manual only. No `on-window-detected` rules, so nothing demotes a new window.
Half and park are widths beside neighbours; a lone window always fills its workspace (float it with ⌥F to size it freely).

## Version

Homebrew installs the newest AeroSpace. To stay in the MacBook's version family, run `aerospace --version` on the MacBook and pass it: `./install.sh --version X.Y.Z`.

## Status

| Done-when item | State |
|---|---|
| Editable config + preflight exist | Done (in git, this folder) |
| Installer with auto-start (`start-at-login = true`) | Done (in git); runs on the iMac |
| Set-the-table + big/half/park bound | Done (in config) |
| Installed on the iMac, survives reboot | **Pending — needs a hand on the iMac.** Run `install.sh`, restart, press ⌥⇧P. The preflight reports reboot survival in plain words. |

This session runs in a Linux container with no access to the iMac, so the install step itself could not be executed from here.
