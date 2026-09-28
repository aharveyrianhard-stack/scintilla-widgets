#!/bin/zsh
# runset.sh <root> <label>  — sequential headless measurements
S=/private/tmp/claude-501/-Users-alanharvey-SCINTILLA-0-5/8c6443e5-5176-4882-b987-f0299e59aa69/scratchpad
R=$1; L=$2
cd $S
node pd.mjs $R "/deck/?scene=intraday30m" 125 out/$L-i30 --pauseLap=1 --sample=500 --cpuFrom=5
node pd.mjs $R "/deck/?scene=intraday1h" 125 out/$L-i1h --pauseLap=1 --sample=500 --cpuFrom=5
node pd.mjs $R "/deck/?scene=sectors3D" 150 out/$L-sec --pauseLap=1 --sample=500 --cpuFrom=30
node pd.mjs $R "/deck/?scene=sectors3D" 150 out/$L-sec4 --pauseLap=1 --sample=1000 --cpuFrom=30 --cpu=4
