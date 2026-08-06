#!/bin/zsh
# Sentinel-stop screen+mic recorder for live demo segments.
# Usage: screenrec.sh <output.mkv> [sentinel] [screenIdx] [audioIdx]
# Defaults: sentinel=/tmp/foi_stop_recording  screen=2 (Capture screen 0 = HOME SCREEN / demo Chromium)  audio=1 (MacBook Air Microphone)
#
# SCREEN INDEX (2026-07-10): default 2 = "Capture screen 0" = HOME SCREEN where
# the pre-authed demo Chromium lives (verified). Index 3 = "Capture screen 1" =
# the Cortex Code IDE — recording that is the wrong-screen mistake. Re-list live
# before every session: ffmpeg -f avfoundation -list_devices true -i ''
# The guard below confirms ffmpeg stays alive and the file grows; it does NOT
# grep for "falling back to default" any more, because on this setup screen 0 IS
# the default display, so that warning is benign here.
OUT="${1:?output path required}"
SENT="${2:-/tmp/foi_stop_recording}"
VID="${3:-2}"
AUD="${4:-1}"
LOG="/tmp/foi_screenrec_ffmpeg.log"
rm -f "$SENT" "$LOG"
echo "REC_START $OUT  video=[$VID] audio=[$AUD]  (stop with: touch $SENT)"
# -pixel_format uyvy422 = native screen-capture format (Retina main display);
# requesting yuv420p at input triggers "Configuration of video device failed".
/opt/homebrew/bin/ffmpeg -hide_banner -loglevel warning \
  -f avfoundation -capture_cursor 1 -pixel_format uyvy422 -i "${VID}:${AUD}" \
  -c:v h264_videotoolbox -b:v 8M -pix_fmt yuv420p \
  -c:a aac -b:a 192k -async 1 \
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
