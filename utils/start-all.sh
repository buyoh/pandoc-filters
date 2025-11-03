#!/bin/bash

set -eu

cd "$(dirname "$0")/.."

mkdir -p ./tmp

PID_LIST="./tmp/pid-list.txt"
PANDOC_RUNNER_SOCKET="./tmp/pandoc-runner.sock"
PANDOC_RUNNER_LOG="./tmp/pandoc-runner.log"
APP_SERVER_LOG="./tmp/app-server.log"

PANDOC_RUNNER_SOCKET="$(realpath "$PANDOC_RUNNER_SOCKET")"
PANDOC_RUNNER_LOG="$(realpath "$PANDOC_RUNNER_LOG")"
APP_SERVER_LOG="$(realpath "$APP_SERVER_LOG")"

# Start pandoc-runner server
ruby pandoc-runner/pandoc-runner.rb --socket "$PANDOC_RUNNER_SOCKET" >> "$PANDOC_RUNNER_LOG" 2>&1 &
PANDOC_RUNNER_PID=$!
echo $PANDOC_RUNNER_PID >> "$PID_LIST"

# Start app-server
yarn app-server:build
(cd app-server && exec node dist/index.js --pandoc-socket-path "$PANDOC_RUNNER_SOCKET" >> "$APP_SERVER_LOG" 2>&1) &
APP_SERVER_PID=$!
echo $APP_SERVER_PID >> "$PID_LIST"

echo "Started servers with PIDs:"
echo "Pandoc Runner PID: $PANDOC_RUNNER_PID"
echo "App Server PID: $APP_SERVER_PID"
echo "PID list saved to $PID_LIST"
