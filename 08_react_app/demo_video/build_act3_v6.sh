#!/bin/sh
# Act 3 full-res recut v6 = v5 with the SharePoint upload region (out 02:05-02:15,
# raw 249-266.5) collapsed from ~10s to 2s (8.75x). All other segments identical to v5.
cd "/Users/pgardner/Desktop/Finito/FOI/foi_sentinel_v2/08_react_app/demo_video" || exit 1

FF=/opt/homebrew/bin/ffmpeg
IN=raw/phase3.mp4
OUT=out/ACT3_phase3_v6_fullres.mp4
mkdir -p out

"$FF" -y -i "$IN" -filter_complex "\
[0:v]trim=110:186,setpts=PTS-STARTPTS[s1];\
[0:v]trim=186:201,setpts=(PTS-STARTPTS)/3.0[s2];\
[0:v]trim=201:243,setpts=PTS-STARTPTS[s3];\
[0:v]trim=247:249,setpts=PTS-STARTPTS[s4];\
[0:v]trim=249:266.5,setpts=(PTS-STARTPTS)/8.75[s5];\
[0:v]trim=266.5:290,setpts=PTS-STARTPTS[s6];\
[0:v]trim=664:703,setpts=PTS-STARTPTS[s7];\
[s1][s2][s3][s4][s5][s6][s7]concat=n=7:v=1:a=0[out]" \
-map "[out]" -r 30 -c:v libx264 -crf 20 -preset veryfast -pix_fmt yuv420p -an -movflags +faststart "$OUT" 2>/tmp/act3v6_ffmpeg.log

echo "EXIT=$?"
/opt/homebrew/bin/ffprobe -v error -show_entries format=duration -select_streams v:0 -show_entries stream=width,height -of default=noprint_wrappers=1 "$OUT" 2>/dev/null
ls -lh "$OUT"
