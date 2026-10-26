#!/bin/bash

set -eu

cd "$(dirname "$0")/.."

PID_LIST="./tmp/pid-list.txt"
# start-all.sh が両サーバーの引数に渡すソケットパス。プロセスの識別に使う
PANDOC_RUNNER_SOCKET="$(realpath -m ./tmp/pandoc-runner.sock)"

if [ ! -f "$PID_LIST" ]; then
  echo "PID list not found: $PID_LIST"
  exit 1
fi

for pid in $(cat "$PID_LIST"); do
  # PID が再利用され無関係なプロセスになっている場合は kill しない。
  # このリポジトリの tmp/ にあるソケットパスを引数に持つ node プロセスのみを対象とする
  cmd="$(ps -o args= -p "$pid" || true)"
  if [ -z "$cmd" ]; then
    echo "Process $pid not found."
  elif [[ "$cmd" != *"node dist/index.js"*" $PANDOC_RUNNER_SOCKET"* ]]; then
    echo "Process $pid is not a server started by start-all.sh; skipped: $cmd"
  else
    echo "Stopping process $pid..."
    # ps の確認後に終了した場合も、PID ファイルの削除まで進める
    kill "$pid" || echo "Failed to stop process $pid."
  fi
done

rm -f "$PID_LIST"
echo "All processes stopped."
