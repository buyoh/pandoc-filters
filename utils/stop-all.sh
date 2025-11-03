#!/bin/bash

cd "$(dirname "$0")/.."

PID_LIST="./tmp/pid-list.txt"

if [ ! -f "$PID_LIST" ]; then
  echo "PID list not found: $PID_LIST"
  exit 1
fi

for pid in $(cat "$PID_LIST"); do
  if ps -p "$pid" > /dev/null; then
    echo "Stopping process $pid..."
    kill "$pid"
  else
    echo "Process $pid not found."
  fi
done

rm "$PID_LIST"
echo "All processes stopped."

