#!/bin/bash

set -eux

cd "$(dirname "$0")"

WORK_DIR=$(pwd)
TMP_DIR=$(mktemp -d)

trap "rm -rf $TMP_DIR" EXIT

# pandoc
PANDOC_VERSION="3.8.2.1"
PANDOC_ARCHIVE="pandoc-${PANDOC_VERSION}-linux-amd64.tar.gz"
PANDOC_URL="https://github.com/jgm/pandoc/releases/download/${PANDOC_VERSION}/${PANDOC_ARCHIVE}"
# ダウンロードしたバイナリの改ざん・差し替えを検出するための期待値。
# GitHub Releases の asset digest と一致することを確認済み。バージョン更新時は併せて更新する
PANDOC_SHA256="b362815e21d8ad3629c124aa92baf54558da086ad72374b4f6fdd97b9f3275b0"

cd "$TMP_DIR"
wget "$PANDOC_URL"
echo "${PANDOC_SHA256}  ${PANDOC_ARCHIVE}" | sha256sum -c -
tar -xf "$PANDOC_ARCHIVE"
rm -rf "$WORK_DIR/pandoc"
mv "pandoc-${PANDOC_VERSION}" "$WORK_DIR/pandoc"
echo "$PANDOC_URL" > "$WORK_DIR/pandoc/VERSION.txt"
