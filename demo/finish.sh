#!/usr/bin/env bash
# Put the brand poster in front of each rendered video as a title card.
# Input: <role>/video.raw.mp4 and <role>/poster.jpg. Output: <role>/video.mp4.
# The poster holds for 2.9 s, then crossfades into the video over 0.6 s; the video's sound starts with it.
set -euo pipefail
cd "$(dirname "$0")"
for role in doctor patient; do
  ffmpeg -y -loglevel error -loop 1 -framerate 30 -t 3.5 -i "$role/poster.jpg" -i "$role/video.raw.mp4" \
    -filter_complex "[0:v]format=yuv420p,setsar=1,settb=AVTB[p];[1:v]fps=30,format=yuv420p,setsar=1,settb=AVTB[v];[p][v]xfade=transition=fade:duration=0.6:offset=2.9[outv];[1:a]adelay=2900|2900[outa]" \
    -map "[outv]" -map "[outa]" -c:v libx264 -crf 18 -preset slow -pix_fmt yuv420p -c:a aac -b:a 192k -movflags +faststart "$role/video.mp4"
  echo "$role: $(ffprobe -v error -show_entries format=duration -of csv=p=0 "$role/video.mp4") s"
done
