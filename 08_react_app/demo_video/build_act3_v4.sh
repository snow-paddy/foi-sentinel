#!/bin/sh
# Act 3 full-res recut v4 — salvage-based, per user feedback on v3.
# Changes vs v3: (1) cut pre-click settle 178-182; (2) redaction spinner 3x (186-201);
# (3) cut static SharePoint upload wait, jump Uploading->Uploaded; (4) cross-dissolve
# from SharePoint into the 7-source working reload to kill the "tabs change" jump.
# Source: raw/phase3.mp4 (3420x2214, 30fps). All times in raw-phase3 seconds.
cd "/Users/pgardner/Desktop/Finito/FOI/foi_sentinel_v2/08_react_app/demo_video" || exit 1

FF=/opt/homebrew/bin/ffmpeg
IN=raw/phase3.mp4
OUT=out/ACT3_phase3_v4_fullres.mp4
mkdir -p out

# pre-payoff duration = 68 + 4 + (15/3=5) + 42 + 3 + 4 = 126.0 ; xfade offset = 126.0 - 0.5 = 125.5
"$FF" -y -i "$IN" -filter_complex "\
[0:v]trim=110:178,setpts=PTS-STARTPTS[a];\
[0:v]trim=182:186,setpts=PTS-STARTPTS[b];\
[0:v]trim=186:201,setpts=(PTS-STARTPTS)/3.0[c];\
[0:v]trim=201:243,setpts=PTS-STARTPTS[d];\
[0:v]trim=249:252,setpts=PTS-STARTPTS[e1];\
[0:v]trim=268:272,setpts=PTS-STARTPTS[e2];\
[a][b][c][d][e1][e2]concat=n=6:v=1:a=0,fps=30,format=yuv420p,settb=AVTB[pre];\
[0:v]trim=694:711,setpts=PTS-STARTPTS,fps=30,format=yuv420p,settb=AVTB[pay];\
[pre][pay]xfade=transition=fade:duration=0.5:offset=125.5[out]" \
-map "[out]" -r 30 -c:v libx264 -crf 20 -preset veryfast -pix_fmt yuv420p -an -movflags +faststart "$OUT" 2>/tmp/act3v4_ffmpeg.log

echo "EXIT=$?"
/opt/homebrew/bin/ffprobe -v error -show_entries format=duration -show_entries stream=width,height -select_streams v:0 -of default=noprint_wrappers=1 "$OUT" 2>/dev/null
ls -lh "$OUT"
