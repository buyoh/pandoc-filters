# pandoc-runner-go のマルチステージビルド Dockerfile。
# ステージ1（builder）で Go バイナリをビルドし、
# ステージ2（final）の pandoc/core:3-debian イメージにバイナリのみをコピーする。

# ステージ1: Go バイナリのビルド
FROM golang:1.21-alpine AS builder

WORKDIR /build
COPY . .

# CGO_ENABLED=0: Alpine (musl libc) でビルドしたバイナリを
# Debian (glibc) ベースの最終イメージで実行するため、完全スタティックリンクでビルドする
RUN CGO_ENABLED=0 GOOS=linux go build -o pandoc-runner ./cmd/pandoc-runner

# ステージ2: 最終イメージ（pandoc 同梱）
FROM pandoc/core:3-debian

COPY --from=builder /build/pandoc-runner /usr/local/bin/pandoc-runner

ENTRYPOINT ["/usr/local/bin/pandoc-runner"]
