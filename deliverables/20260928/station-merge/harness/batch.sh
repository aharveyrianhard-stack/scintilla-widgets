#!/bin/zsh
# headless shot batch for I3 (every browser headless; closed by shot.mjs)
R="/Users/alanharvey/SCINTILLA 0.5/_worktrees/station-merge-zoom-20260928"; O="/Users/alanharvey/SCINTILLA 0.5/_worktrees/station-merge-zoom-20260928/deliverables/20260928/station-merge/shots"
run(){ n=$1; shift; node shot.mjs "$R" "$O/$n.png" "$@" > "$n.json" 2>&1; echo "$n done"; }
run sectors3D-1680 "/deck/?scene=sectors3D" --settle=22000
run sectors3D-390 "/deck/?scene=sectors3D" --settle=22000 --w=390
run ai1-1680 "/deck/?scene=ai1" --settle=22000
run targets1D-1680 "/deck/?scene=targets1D" --settle=22000
run targets1D-390 "/deck/?scene=targets1D" --settle=22000 --w=390
run otherIndexes1D-1680 "/deck/?scene=otherIndexes1D" --settle=22000
run spyQqq1D-insession-1680 "/deck/?scene=spyQqq1D" --settle=20000
run spyQqq1D-insession-390 "/deck/?scene=spyQqq1D" --settle=20000 --w=390
run spyQqq1D-outofsession-1680 "/deck/?scene=spyQqq1D" --settle=20000 --clock=2026-09-28T10:00:00Z
run spyQqq1D-outofsession-390 "/deck/?scene=spyQqq1D" --settle=20000 --clock=2026-09-28T10:00:00Z --w=390
run mainIndexes3D-1680 "/deck/?scene=mainIndexes3D" --settle=20000
run spyQqq1D-zoomedout-1680 "/deck/?scene=spyQqq1D" --settle=20000 --zoomout=6
run rot-intraday1h-1680 "/deck/?scene=intraday1h" --midrot=1
run rot-intraday30m-390 "/deck/?scene=intraday30m" --midrot=1 --w=390
