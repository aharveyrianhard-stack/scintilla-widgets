#!/bin/zsh
S=/private/tmp/claude-501/-Users-alanharvey-SCINTILLA-0-5/8c6443e5-5176-4882-b987-f0299e59aa69/scratchpad
cd "/Users/alanharvey/SCINTILLA 0.5/_worktrees/station-followups-20260928"
node --test tests/ > $S/suite.tap 2>&1
grep -E "^ℹ (tests|pass|fail)" $S/suite.tap
awk '/✖ failing tests:/{f=1;next} f && /^✖ /' $S/suite.tap | sed -E 's/^✖ //; s/ \([0-9.]+ms\)$//' | sort -u > $S/fails.txt
echo "new failures vs known:"; comm -23 $S/fails.txt <(sort -u /private/tmp/claude-501/-Users-alanharvey-AlanOS-Operating-System-workspaces-scintilla/f00df467-f769-4117-af17-5b8edf2db92a/scratchpad/p1-known.txt)
echo "end"
