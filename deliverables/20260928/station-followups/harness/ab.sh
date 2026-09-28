#!/bin/zsh
S=/private/tmp/claude-501/-Users-alanharvey-SCINTILLA-0-5/8c6443e5-5176-4882-b987-f0299e59aa69/scratchpad
cd $S; SC=$1; SECS=${2:-100}; shift 2
for r in 1 2; do for v in ${=VARS:-base cur}; do
  echo -n "$v r$r "; node pd.mjs $S/$v "/deck/?scene=$SC" $SECS out/ab-$SC-$v-$r --pauseLap=1 --sample=1000 --cpuFrom=20 "$@" | python3 -c "import json,sys;d=json.loads(sys.stdin.read());p=d['perf'];print(p['procCpuSec'],p['cpuBy'],p['rssMB1'],'api',d['api'])"
done; done
