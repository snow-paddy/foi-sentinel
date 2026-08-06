#!/bin/sh
# Act 3 full-res recut v3 — salvage-based, per user feedback (2 speed-ups, 2 cuts, + stitched 7-source working reload)
# Source: raw/phase3.mp4 (3420x2214, 30fps). All times in raw-phase3 seconds.
cd "/Users/pgardner/Desktop/Finito/FOI/foi_sentinel_v2/08_react_app/demo_video" || exit 1

FF=/opt/homebrew/bin/ffmpeg
IN=raw/phase3.mp4
OUT=out/ACT3_phase3_v3_fullres.mp4
mkdir -p out

"$FF" -y -i "$IN" -filter_complex "\
[0:v]trim=110:189,setpts=PTS-STARTPTS[v1];\
[0:v]trim=189:197,setpts=(PTS-STARTPTS)/2.0[v2];\
[0:v]trim=197:243,setpts=PTS-STARTPTS[v3];\
[0:v]trim=247:251,setpts=PTS-STARTPTS[v4];\
[0:v]trim=251:266,setpts=(PTS-STARTPTS)/2.0[v5];\
[0:v]trim=266:290,setpts=PTS-STARTPTS[v6];\
[0:v]trim=293:298,setpts=PTS-STARTPTS[v7];\
[0:v]trim=694:711,setpts=PTS-STARTPTS[v8];\
[v1][v2][v3][v4][v5][v6][v7][v8]concat=n=8:v=1:a=0[out]" \
-map "[out]" -r 30 -c:v libx264 -crf 20 -preset veryfast -pix_fmt yuv420p -an -movflags +faststart "$OUT" 2>/tmp/act3v3_ffmpeg.log

echo "EXIT=$?"
/opt/homebrew/bin/ffprobe -v error -show_entries format=duration -show_entries stream=width,height -select_streams v:0 -of default=noprint_wrappers=1 "$OUT" 2>/dev/null
ls -lh "$OUT"
