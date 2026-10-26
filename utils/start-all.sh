#!/bin/bash

set -eu

cd "$(dirname "$0")/.."

mkdir -p ./tmp

PID_LIST="./tmp/pid-list.txt"
PANDOC_RUNNER_SOCKET="./tmp/pandoc-runner.sock"
PANDOC_RUNNER_LOG="./tmp/pandoc-runner.log"
APP_SERVER_LOG="./tmp/app-server.log"
# runner がソケットを作成するまでの最大待ち時間
SOCKET_WAIT_TIMEOUT_SEC=10

# stop-all.sh はこの絶対パスでプロセスを識別するため、同じ方法（realpath -m）で解決する
PANDOC_RUNNER_SOCKET="$(realpath -m "$PANDOC_RUNNER_SOCKET")"
PANDOC_RUNNER_LOG="$(realpath "$PANDOC_RUNNER_LOG")"
APP_SERVER_LOG="$(realpath "$APP_SERVER_LOG")"

# 以前は PID を追記していたため、停止に失敗すると古い PID が残り、
# PID 再利用時に stop-all.sh が無関係なプロセスを kill する恐れがあった
if [ -f "$PID_LIST" ]; then
  echo "PID list already exists: $PID_LIST"
  echo "Run utils/stop-all.sh first."
  exit 1
fi

# フィルタ（dist/src/ToRedmine.js）・app-server・pandoc-runner をビルド
pnpm build
pnpm pandoc-runner:build

# 古いソケットが残っていると、起動待ちが即座に成功してしまう
rm -f "$PANDOC_RUNNER_SOCKET"

# Start pandoc-runner server
(cd pandoc-runner && exec node dist/index.js --socket "$PANDOC_RUNNER_SOCKET" >> "$PANDOC_RUNNER_LOG" 2>&1) &
PANDOC_RUNNER_PID=$!
echo "$PANDOC_RUNNER_PID" > "$PID_LIST"

# runner のソケット作成を待つ
waited_sec=0
until [ -S "$PANDOC_RUNNER_SOCKET" ]; do
  if ! kill -0 "$PANDOC_RUNNER_PID" 2> /dev/null; then
    echo "pandoc-runner exited. See $PANDOC_RUNNER_LOG"
    rm -f "$PID_LIST"
    exit 1
  fi
  if [ "$waited_sec" -ge "$SOCKET_WAIT_TIMEOUT_SEC" ]; then
    echo "Timed out waiting for $PANDOC_RUNNER_SOCKET. See $PANDOC_RUNNER_LOG"
    kill "$PANDOC_RUNNER_PID" || true
    rm -f "$PID_LIST"
    exit 1
  fi
  sleep 1
  waited_sec=$((waited_sec + 1))
done

# Start app-server
(cd app-server && exec node dist/index.js --pandoc-socket-path "$PANDOC_RUNNER_SOCKET" >> "$APP_SERVER_LOG" 2>&1) &
APP_SERVER_PID=$!
echo "$APP_SERVER_PID" >> "$PID_LIST"

echo "Started servers with PIDs:"
echo "Pandoc Runner PID: $PANDOC_RUNNER_PID"
echo "App Server PID: $APP_SERVER_PID"
echo "PID list saved to $PID_LIST"
