#!/bin/bash

set -eux

cd "$(dirname "$0")"

WORK_DIR=$(pwd)
TMP_DIR=$(mktemp -d)

trap "rm -rf $TMP_DIR" EXIT

# pandoc
cd "$TMP_DIR"
wget https://github.com/jgm/pandoc/releases/download/3.8.2.1/pandoc-3.8.2.1-linux-amd64.tar.gz
tar -xf pandoc-3.8.2.1-linux-amd64.tar.gz
rm -rf "$WORK_DIR/pandoc"
mv pandoc-3.8.2.1 "$WORK_DIR/pandoc"
echo "https://github.com/jgm/pandoc/releases/download/3.8.2.1/pandoc-3.8.2.1-linux-amd64.tar.gz" > "$WORK_DIR/pandoc/VERSION.txt"
