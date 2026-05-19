#!/usr/bin/env bash
# capture-demo-videos.sh
#
# Records short WebM demo clips of the running ArtBastard frontend for the
# public showcase page (website/videos/).
#
# Pipeline (no external services required):
#   1. Make sure backend at $BASE_URL is reachable, otherwise spin one up.
#   2. Start an Xvfb virtual X server on $DISPLAY_NUM.
#   3. For each clip, launch google-chrome on that display, optionally drive
#      synthetic input via xdotool, and capture the screen with ffmpeg
#      (x11grab) into a VP9 WebM file.
#   4. Extract a JPEG poster from the first frame of each WebM.
#
# Usage:
#   bash scripts/capture-demo-videos.sh [out_dir] [base_url]
#
# Environment overrides:
#   CAPTURE_FRAMERATE       (default 24)
#   CAPTURE_VBITRATE        (default 800k)
#   CAPTURE_DURATION_SEC    (default per-clip; overrides all clips)
#   CAPTURE_CLIP_LIST       (comma list of clip names to render; empty = all)
#   CAPTURE_DISPLAY_NUM     (default 99)
#   CAPTURE_KEEP_SERVER     (1 to skip starting the backend even if missing)

set -euo pipefail

OUT_DIR="${1:-website/videos}"
BASE_URL="${2:-http://127.0.0.1:3030}"

FRAMERATE="${CAPTURE_FRAMERATE:-24}"
VBITRATE="${CAPTURE_VBITRATE:-800k}"
DURATION_OVERRIDE="${CAPTURE_DURATION_SEC:-}"
CLIP_LIST_FILTER="${CAPTURE_CLIP_LIST:-}"
DISPLAY_NUM="${CAPTURE_DISPLAY_NUM:-99}"
KEEP_SERVER="${CAPTURE_KEEP_SERVER:-0}"

WORK_ROOT="$(mktemp -d -t artbastard-demo-videos.XXXXXX)"
RESULTS_FILE="${OUT_DIR}/capture-results.txt"
SERVER_LOG="${WORK_ROOT}/server.log"
XVFB_LOG="${WORK_ROOT}/xvfb.log"

mkdir -p "$OUT_DIR"
: > "$RESULTS_FILE"

log() { printf '[capture-videos] %s\n' "$*"; }

cleanup() {
  local rc=$?
  set +e
  if [[ -n "${SERVER_PID:-}" ]] && [[ "$KEEP_SERVER" != "1" ]]; then
    kill "$SERVER_PID" 2>/dev/null || true
  fi
  if [[ -n "${XVFB_PID:-}" ]]; then
    kill "$XVFB_PID" 2>/dev/null || true
  fi
  rm -rf "$WORK_ROOT" 2>/dev/null || true
  exit "$rc"
}
trap cleanup EXIT

require_bin() {
  if ! command -v "$1" >/dev/null 2>&1; then
    log "ERROR: required binary '$1' not found in PATH"
    exit 2
  fi
}

require_bin google-chrome
require_bin ffmpeg
require_bin Xvfb
require_bin xdotool
require_bin curl

wait_for_server() {
  for _ in $(seq 1 30); do
    code="$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}/api/health" || true)"
    if [[ "$code" == "200" ]]; then
      return 0
    fi
    sleep 1
  done
  return 1
}

ensure_server() {
  if wait_for_server; then
    log "using existing server at $BASE_URL"
    return 0
  fi
  if [[ "$KEEP_SERVER" == "1" ]]; then
    log "ERROR: backend not reachable and CAPTURE_KEEP_SERVER=1; aborting"
    exit 3
  fi
  if [[ ! -f "dist/server.js" ]]; then
    log "ERROR: dist/server.js missing - run 'npm run build' first"
    exit 4
  fi
  log "starting backend at $BASE_URL"
  node dist/server.js > "$SERVER_LOG" 2>&1 &
  SERVER_PID=$!
  if ! wait_for_server; then
    log "ERROR: backend did not become healthy; see $SERVER_LOG"
    tail -n 40 "$SERVER_LOG" || true
    exit 5
  fi
}

start_xvfb() {
  log "starting Xvfb on :$DISPLAY_NUM"
  Xvfb ":$DISPLAY_NUM" -screen 0 1920x1080x24 -nolisten tcp \
    > "$XVFB_LOG" 2>&1 &
  XVFB_PID=$!
  export DISPLAY=":$DISPLAY_NUM"
  for _ in $(seq 1 20); do
    if xdpyinfo -display ":$DISPLAY_NUM" >/dev/null 2>&1; then
      return 0
    fi
    sleep 0.25
  done
  log "ERROR: Xvfb failed to start"
  tail -n 40 "$XVFB_LOG" || true
  exit 6
}

# Run interactions for a clip in the background while ffmpeg records.
# Each interaction is one of:
#   sleep:N
#   key:KEYNAME
#   keys:KEY1,KEY2,...     (sequence with 0.4s gap)
#   pgdn:N                 (Page_Down x N)
#   pgup:N
#   tab:N
#   click:X,Y
run_interactions() {
  local recipe="$1"
  if [[ -z "$recipe" ]]; then
    return 0
  fi
  IFS='|' read -r -a steps <<< "$recipe"
  for step in "${steps[@]}"; do
    case "$step" in
      sleep:*)
        sleep "${step#sleep:}"
        ;;
      pgdn:*)
        local n="${step#pgdn:}"
        for _ in $(seq 1 "$n"); do
          xdotool key --clearmodifiers Page_Down
          sleep 0.6
        done
        ;;
      pgup:*)
        local n="${step#pgup:}"
        for _ in $(seq 1 "$n"); do
          xdotool key --clearmodifiers Page_Up
          sleep 0.6
        done
        ;;
      tab:*)
        local n="${step#tab:}"
        for _ in $(seq 1 "$n"); do
          xdotool key --clearmodifiers Tab
          sleep 0.5
        done
        ;;
      key:*)
        xdotool key --clearmodifiers "${step#key:}"
        sleep 0.4
        ;;
      keys:*)
        IFS=',' read -r -a klist <<< "${step#keys:}"
        for k in "${klist[@]}"; do
          xdotool key --clearmodifiers "$k"
          sleep 0.4
        done
        ;;
      click:*)
        local xy="${step#click:}"
        local x="${xy%%,*}"
        local y="${xy##*,}"
        xdotool mousemove "$x" "$y"
        sleep 0.2
        xdotool click 1
        sleep 0.4
        ;;
      *)
        log "WARN: unknown interaction step '$step'"
        ;;
    esac
  done
}

record_clip() {
  local name="$1"
  local route="$2"
  local size="$3"     # WIDTHxHEIGHT
  local duration="$4"
  local recipe="${5:-}"

  if [[ -n "$DURATION_OVERRIDE" ]]; then
    duration="$DURATION_OVERRIDE"
  fi

  local width="${size%x*}"
  local height="${size#*x}"
  local url="${BASE_URL}${route}"
  local tmp_profile="${WORK_ROOT}/profile-${name}"
  local out_video="${OUT_DIR}/${name}.webm"
  local out_poster="${OUT_DIR}/${name}.jpg"
  local clip_log="${WORK_ROOT}/${name}.log"

  log "clip ${name}: ${size} ${duration}s -> ${url}"

  rm -rf "$tmp_profile"
  mkdir -p "$tmp_profile/Default"

  # Pre-allow MIDI sysex + notifications for the app origin so chrome does not
  # show consent dialogs that obscure the recorded UI.
  local origin
  origin="${BASE_URL%/}"
  python3 - "$tmp_profile/Default/Preferences" "$origin" <<'PY'
import json, sys, pathlib
prefs_path = pathlib.Path(sys.argv[1])
origin = sys.argv[2]
key = f"{origin},*"
prefs = {
  "profile": {
    "content_settings": {
      "exceptions": {
        "midi_sysex": {key: {"setting": 1, "last_modified": "0"}},
        "notifications": {key: {"setting": 2, "last_modified": "0"}},
        "media_stream_camera": {key: {"setting": 2, "last_modified": "0"}},
        "media_stream_mic": {key: {"setting": 2, "last_modified": "0"}},
        "geolocation": {key: {"setting": 2, "last_modified": "0"}}
      }
    },
    "default_content_setting_values": {
      "notifications": 2
    }
  }
}
prefs_path.write_text(json.dumps(prefs))
PY

  google-chrome \
    --user-data-dir="$tmp_profile" \
    --no-first-run \
    --no-default-browser-check \
    --disable-gpu \
    --disable-dev-shm-usage \
    --disable-features=Translate,TranslateUI,MediaRouter \
    --autoplay-policy=no-user-gesture-required \
    --disable-notifications \
    --disable-infobars \
    --disable-popup-blocking \
    --window-position=0,0 \
    --window-size="${width},${height}" \
    --app="$url" \
    > "$clip_log" 2>&1 &
  local chrome_pid=$!

  # Give chrome time to lay out the page before recording.
  sleep 4

  # Run interactions in background while ffmpeg records.
  ( run_interactions "$recipe" ) &
  local interact_pid=$!

  set +e
  ffmpeg -y -hide_banner -loglevel error \
    -f x11grab -framerate "$FRAMERATE" \
    -video_size "${width}x${height}" \
    -draw_mouse 0 \
    -i ":${DISPLAY_NUM}.0+0,0" \
    -t "$duration" \
    -c:v libvpx-vp9 -b:v "$VBITRATE" \
    -row-mt 1 -threads 2 \
    -pix_fmt yuv420p -an \
    "$out_video"
  local ff_rc=$?
  set -e

  wait "$interact_pid" 2>/dev/null || true
  kill "$chrome_pid" 2>/dev/null || true
  wait "$chrome_pid" 2>/dev/null || true
  rm -rf "$tmp_profile" 2>/dev/null || true

  if [[ $ff_rc -ne 0 || ! -s "$out_video" ]]; then
    printf 'failed\t%s\trc=%d\n' "$name" "$ff_rc" >> "$RESULTS_FILE"
    log "FAIL clip ${name} (ffmpeg rc=$ff_rc)"
    return 0
  fi

  # Poster: extract first frame.
  ffmpeg -y -hide_banner -loglevel error \
    -i "$out_video" -vframes 1 -q:v 3 "$out_poster"

  local size_bytes
  size_bytes="$(stat -c%s "$out_video" 2>/dev/null || echo 0)"
  printf 'ok\t%s\t%db\n' "$name" "$size_bytes" >> "$RESULTS_FILE"
  log "OK clip ${name} -> ${out_video} (${size_bytes} bytes)"
}

clip_enabled() {
  local name="$1"
  if [[ -z "$CLIP_LIST_FILTER" ]]; then
    return 0
  fi
  IFS=',' read -r -a allowed <<< "$CLIP_LIST_FILTER"
  for x in "${allowed[@]}"; do
    if [[ "$x" == "$name" ]]; then
      return 0
    fi
  done
  return 1
}

# ----------------------------------------------------------------------
# Main
# ----------------------------------------------------------------------

ensure_server
start_xvfb

# Format: name|route|size|duration|recipe
CLIPS=(
  "dmx-control|/|1280x720|12|sleep:2|pgdn:3|sleep:2|pgup:2"
  "fixture-page|/#/fixture|1280x720|12|sleep:3|pgdn:3|sleep:2|pgup:2"
  "scenes-acts|/#/scenes-acts|1280x720|12|sleep:3|pgdn:3|sleep:2|pgup:2"
  "mobile|/#/mobile|430x932|10|sleep:3|pgdn:2|sleep:2"
  "settings-help|/#/settings|1280x720|12|sleep:3|pgdn:3|sleep:2|pgup:2"
)

for spec in "${CLIPS[@]}"; do
  IFS='|' read -r name route size duration recipe <<< "$spec"
  if ! clip_enabled "$name"; then
    log "skip clip ${name} (not in CAPTURE_CLIP_LIST)"
    continue
  fi
  # Each clip is best-effort; don't abort the whole run on a single failure.
  if ! record_clip "$name" "$route" "$size" "$duration" "$recipe"; then
    log "WARN: clip ${name} aborted abnormally"
  fi
done

log "done. results in $RESULTS_FILE"
ls -la "$OUT_DIR" || true
