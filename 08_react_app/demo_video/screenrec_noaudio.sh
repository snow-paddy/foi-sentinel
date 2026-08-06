#!/bin/zsh
# Silent screen recorder for the FOI demo (NO microphone — VO added in post).
# Usage: screenrec_noaudio.sh <output.mkv> [sentinel] [screenIdx]
# Stop by: touch <sentinel>  (record_demo.mjs does this automatically at the end)
#
# DEFAULT screen index is 2 = "Capture screen 0" = the HOME SCREEN where the
# pre-authed demo Chromium lives (verified 2026-07-10). Index 3 = "Capture
# screen 1" = the Cortex Code IDE — recording that is the wrong-screen mistake.
# Re-list live before every session: ffmpeg -f avfoundation -list_devices true -i ''
OUT="${1:-demo_video/raw/body_raw.mkv}"
SENT="${2:-/tmp/foi_stop_recording}"
VID="${3:-2}"          # avfoundation screen index (2 = screen 0 / home screen)
LOG="/tmp/foi_screenrec_noaudio.log"
rm -f "$SENT" "$LOG"
mkdir -p "$(dirname "$OUT")"
echo "REC_START $OUT  video=[$VID]  (stop with: touch $SENT)"
# -pixel_format uyvy422 is the NATIVE screen-capture format on the Retina main
# display; requesting yuv420p at input makes avfoundation report
# "Configuration of video device failed, falling back to default". We take the
# native format at input and convert to yuv420p at the encoder instead.
/opt/homebrew/bin/ffmpeg -hide_banner -loglevel warning \
  -f avfoundation -capture_cursor 1 -pixel_format uyvy422 -i "${VID}:none" \
  -c:v h264_videotoolbox -b:v 10M -pix_fmt yuv420p \
  -an \
  -y "$OUT" 2>"$LOG" &
FF=$!
# Guard window: confirm ffmpeg stays alive and the file is actually growing.
for i in 1 2 3; do
  sleep 1
  if ! kill -0 $FF 2>/dev/null; then echo "REC_FFMPEG_EXITED_EARLY (see $LOG)"; cat "$LOG"; exit 4; fi
done
SZ=$(stat -f%z "$OUT" 2>/dev/null || echo 0)
if [ "$SZ" -lt 50000 ]; then
  echo "REC_NO_DATA video=[$VID] output only ${SZ}B after 3s — capture may have failed. See $LOG"; cat "$LOG"
  kill -INT $FF 2>/dev/null; wait $FF 2>/dev/null; rm -f "$OUT" "$SENT"; exit 3
fi
echo "REC_GUARD_PASSED video=[$VID] capturing (${SZ}B and growing); recording..."
while [ ! -f "$SENT" ]; do
  if ! kill -0 $FF 2>/dev/null; then echo "REC_FFMPEG_EXITED_EARLY"; break; fi
  sleep 1
done
kill -INT $FF 2>/dev/null
wait $FF 2>/dev/null
rm -f "$SENT"
echo "REC_STOPPED $OUT"
