#!/bin/zsh
S=/private/tmp/claude-501/-Users-alanharvey-SCINTILLA-0-5/8c6443e5-5176-4882-b987-f0299e59aa69/scratchpad
cd $S
for sc in intraday30m intraday1h; do
  node pd.mjs $S/base "/deck/?scene=$sc" 300 out/calls-$sc-base --pauseLap=1 --sample=2000 --cpuFrom=5 > out/calls-$sc-base.log 2>&1 &
  node pd.mjs $S/fin "/deck/?scene=$sc" 300 out/calls-$sc-fin --pauseLap=1 --sample=2000 --cpuFrom=5 > out/calls-$sc-fin.log 2>&1 &
  wait
done
for r in 1 2; do for v in base fin; do
  node pd.mjs $S/$v "/deck/?scene=sectors3D" 150 out/cpu-sec-$v-$r --pauseLap=1 --sample=1000 --cpuFrom=30 > out/cpu-sec-$v-$r.log 2>&1
done; done
for v in base fin; do
  node pd.mjs $S/$v "/deck/?scene=sectors3D" 150 out/cpu4-sec-$v --pauseLap=1 --sample=2000 --cpuFrom=30 --cpu=4 > out/cpu4-sec-$v.log 2>&1
done
echo ALLDONE
