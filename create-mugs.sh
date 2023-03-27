#!/bin/bash

set -e

TEMPLATE="ME Mug 1 - DFTBA template.jpg"
OUTDIR="mugs"

mkdir -p $OUTDIR

for STICK in *.png; do
  convert "$TEMPLATE" \( "$STICK" -flop -resize 45% -colorspace CMYK -geometry +1728+310 \) -composite -geometry 100% "$OUTDIR/MUG-$STICK"
done