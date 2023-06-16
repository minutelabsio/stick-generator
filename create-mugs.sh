#!/bin/bash

set -e

BASEDIR=$(dirname "$0")
PROFILE="$BASEDIR/USWebCoatedSWOP.icc"
# PROFILE="$BASEDIR/USWebUnCoated.icc"
# SRGBPROFILE="$BASEDIR/sRGB_v4_ICC_preference.icc"
# SRGBPROFILE="$BASEDIR/sRGB_v4_ICC_preference_displayclass.icc"
SRGBPROFILE="$BASEDIR/sRGB2014.icc"
# SRGBPROFILE="$BASEDIR/sRGB Color Space Profile.icm"
# SRGBPROFILE="$BASEDIR/AdobeRGB1998.icc"
TEMPLATE="$BASEDIR/mug-template.jpg"
OUTDIR="mugs"
INPUTDIR="$1"

# check input directory exists
if [ ! -d "$INPUTDIR" ]; then
  echo "Input directory does not exist"
  exit 1
fi

# check other files exist
if [ ! -f "$PROFILE" ]; then
  echo "Color profile file does not exist"
  exit 1
fi

if [ ! -f "$SRGBPROFILE" ]; then
  echo "sRGB profile file does not exist"
  exit 1
fi

if [ ! -f "$TEMPLATE" ]; then
  echo "Template file does not exist"
  exit 1
fi

mkdir -p $OUTDIR

for STICK in "$INPUTDIR"/*.png; do
  echo "Processing $STICK"
  INFILENAME=$(basename "$STICK")
  # OUTFILE="$OUTDIR/MUG-${INFILENAME}"
  OUTFILEJPG="MUG-${INFILENAME%.png}.jpg"
  # magick "$TEMPLATE" \( "$STICK" -resize 45% +profile sRGB -colorspace CMYK -black-point-compensation -intent Perceptual -profile "$PROFILE" -geometry +1728+310 \) -composite -geometry 100% "$OUTFILE"
  # magick "$TEMPLATE" \( "$STICK" -resize 45% -geometry +1728+310 \) +dither -colorspace CMYK -intent Perceptual -profile "$PROFILE" -composite -geometry 100% - | \
  #   convert - "$OUTDIR/$OUTFILEJPG"
  magick "$TEMPLATE" \( "$STICK" -level '0%,100%,1' -intent perceptual -black-point-compensation -profile "$SRGBPROFILE" -profile "$PROFILE" -filter Hamming -resize 45% -geometry '+1728+310' \) -composite -geometry 100% "$OUTDIR/$OUTFILEJPG"
done
