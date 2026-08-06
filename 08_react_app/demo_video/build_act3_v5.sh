#!/bin/sh
# Act 3 full-res recut v5 — work from v3, replace payoff tail with user-chosen span.
# Base = v3 structure (kept SharePoint upload sequence, 2x). Redaction spinner 3x (user liked it).
# Payoff = raw 664-703 (phase3 11:04-11:43): 6 sources -> live reload -> 7 sources ->
# open ASC file note -> scroll masked records + disclosure bundle. Straight concat, NO dissolve.
# Dropped v3's redundant 6-source beat (raw 293-298) since 664-703 carries its own 6->7 reveal.
cd "/Users/pgardner/Desktop/Finito/FOI/foi_sentinel_v2/08_react_app/demo_video" || exit 1

FF=/opt/homebrew/bin/ffmpeg
IN=raw/phase3.mp4
OUT=out/ACT3_phase3_v5_fullres.mp4
mkdir -p out

"$FF" -y -i "$IN" -filter_complex "\
[0:v]trim=110:186,setpts=PTS-STARTPTS[s1];\
[0:v]trim=186:201,setpts=(PTS-STARTPTS)/3.0[s2];\
[0:v]trim=201:243,setpts=PTS-STARTPTS[s3];\
[0:v]trim=247:251,setpts=PTS-STARTPTS[s4];\
[0:v]trim=251:266,setpts=(PTS-STARTPTS)/2.0[s5];\
[0:v]trim=266:290,setpts=PTS-STARTPTS[s6];\
[0:v]trim=664:703,setpts=PTS-STARTPTS[s7];\
[s1][s2][s3][s4][s5][s6][s7]concat=n=7:v=1:a=0[out]" \
-map "[out]" -r 30 -c:v libx264 -crf 20 -preset veryfast -pix_fmt yuv420p -an -movflags +faststart "$OUT" 2>/tmp/act3v5_ffmpeg.log

echo "EXIT=$?"
/opt/homebrew/bin/ffprobe -v error -show_entries format=duration -show_entries stream=width,height -select_streams v:0 -of default=noprint_wrappers=1 "$OUT" 2>/dev/null
ls -lh "$OUT"
