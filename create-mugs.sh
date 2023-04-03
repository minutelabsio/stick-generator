#!/bin/bash

set -e

PROFILE="USWebCoatedSWOP.icc"
TEMPLATE="ME Mug 1 - DFTBA template.jpg"
OUTDIR="mugs"

mkdir -p $OUTDIR

for STICK in *.png; do
  magick "$TEMPLATE" \( "$STICK" -flop -resize 45% +profile sRGB -colorspace CMYK -black-point-compensation -intent Perceptual -profile "$PROFILE"  -geometry +1728+310 \) -composite -geometry 100% "$OUTDIR/MUG-${STICK%.png}.png"
  convert -colorspace CMYK -intent Perceptual "$OUTDIR/MUG-${STICK%.png}.png" "$OUTDIR/MUG-${STICK%.png}.jpg"
done
