# AeroSpace on the iMac — Sprint B kit

Pair of Sprint A (AeroSpace on the MacBook Pro). Everything the iMac needs is in this folder.

```
aerospace.toml         the editable config (lands at ~/.config/aerospace/aerospace.toml)
bin/size.sh            ⌥B big · ⌥H half · ⌥P park   — manual sizing, nothing automatic
bin/set-the-table.sh   ⌥T   — makes the three empty workspaces exist, lands on alan-personal
bin/show-titles.sh     ⌥L   — plain list of window titles on this workspace (for when they are parked small)
bin/preflight.sh       ⌥⇧P  — plain-English health check, incl. "did it survive the reboot"
install.sh             one command, run on the iMac
INTAKE_RECEIPT.md      config path + hotkeys
```

## On the iMac

```bash
git clone https://github.com/aharveyrianhard-stack/scintilla-widgets.git ~/scintilla-widgets
cd ~/scintilla-widgets/desk/aerospace/imac
./install.sh                    # or:  ./install.sh --version <what `aerospace --version` says on the MacBook>
```

Then restart the iMac once and press **⌥⇧P**. The preflight says in words whether AeroSpace came back on its own.

## Deliberately not done here

- Slot contents. The workspaces are empty on purpose.
- Any `on-window-detected` rule. New windows are never demoted automatically.
- Anything on the MacBook.
