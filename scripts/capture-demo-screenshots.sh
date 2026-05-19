#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${2:-http://127.0.0.1:3030}"
OUT_DIR="${1:-/tmp/artbastard-demo-screenshots-$(date +%Y%m%d-%H%M%S)}"
SERVER_LOG="/tmp/artbastard-demo-capture-server.log"
CAPTURE_TIMEOUT_SEC="${CAPTURE_TIMEOUT_SEC:-70}"
CAPTURE_ATTEMPTS="${CAPTURE_ATTEMPTS:-1}"

mkdir -p "$OUT_DIR"

wait_for_server() {
  for _ in $(seq 1 30); do
    code="$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}/api/health" || true)"
    if [[ "$code" == "200" ]]; then
      echo "server_ready"
      return 0
    fi
    sleep 1
  done
  echo "server_not_ready"
  return 1
}

ensure_server() {
  if wait_for_server >/dev/null 2>&1; then
    echo "using_existing_server"
    return 0
  fi

  node dist/server.js > "$SERVER_LOG" 2>&1 &
  echo "started_server_pid:$!"
  wait_for_server
}

cleanup_chrome_marker_processes() {
  local marker="$1"
  mapfile -t pids < <(ps -eo pid=,cmd= | awk -v m="$marker" 'index($0, m) { print $1 }')
  if (( ${#pids[@]} > 0 )); then
    kill "${pids[@]}" 2>/dev/null || true
  fi
}

capture_page() {
  local name="$1"
  local url="$2"
  local size="$3"
  local marker="/tmp/chrome-demo-${name}-$$"
  local screenshot="${OUT_DIR}/${name}.png"
  local log_file="${OUT_DIR}/${name}.log"

  local attempt=1
  local exit_code=1

  while [[ "$attempt" -le "$CAPTURE_ATTEMPTS" ]]; do
    rm -rf "$marker"
    rm -f "$screenshot"

    set +e
    timeout "${CAPTURE_TIMEOUT_SEC}s" /usr/local/bin/google-chrome \
      --headless \
      --disable-gpu \
      --no-sandbox \
      --virtual-time-budget=20000 \
      --user-data-dir="$marker" \
      --screenshot="$screenshot" \
      --window-size="$size" \
      "$url" > "$log_file" 2>&1
    exit_code=$?
    set -e

    cleanup_chrome_marker_processes "$marker"

    if [[ -s "$screenshot" ]]; then
      echo "${name}|attempt:${attempt}|exit:${exit_code}|path:${screenshot}" >> "${OUT_DIR}/capture-results.txt"
      return 0
    fi

    attempt=$((attempt + 1))
    sleep 2
  done

  echo "capture_failed:${name}:exit:${exit_code}" | tee -a "${OUT_DIR}/capture-results.txt"
  return 1
}

ensure_server

capture_page "dmx-control" "${BASE_URL}/" "1600,1200"
capture_page "fixture-page" "${BASE_URL}/#/fixture" "1600,1200"
capture_page "scenes-acts-page" "${BASE_URL}/#/scenes-acts" "1600,1200"
capture_page "mobile" "${BASE_URL}/#/mobile" "430,932"

file \
  "${OUT_DIR}/dmx-control.png" \
  "${OUT_DIR}/fixture-page.png" \
  "${OUT_DIR}/scenes-acts-page.png" \
  "${OUT_DIR}/mobile.png" > "${OUT_DIR}/file-types.txt"

echo "capture_output_dir:${OUT_DIR}"
