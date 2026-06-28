# docker-compose.go.yml 設計詳細

## 全体方針

- 既存の `docker-compose.yml`（TypeScript 版）を参考に、pandoc-runner を Go 版に差し替える
- 各サービスはマルチステージビルドの Dockerfile を使用し、最終イメージに不要なビルドツールを残さない
- Unix ソケット経由の IPC は既存と同様に `common` ボリュームで共有する

## サービス構成

### pandoc-runner（Go 版）

| 項目 | 内容 |
|------|------|
| ビルド | `pandoc-runner-go/Dockerfile`（マルチステージ） |
| 最終ベースイメージ | `pandoc/core:3-debian` |
| バイナリパス | `/usr/local/bin/pandoc-runner` |
| ソケットパス | `/var/opt/common/pandoc-runner.sock` |
| 環境変数 | `PF_PANDOC_PATH: pandoc`（ベースイメージに pandoc 同梱のため） |

### app-server

| 項目 | 内容 |
|------|------|
| ビルド | `app-server/Dockerfile`（マルチステージ） |
| 最終ベースイメージ | `node:20-slim` |
| ポート | `3000:3000` |
| ソケットパス | `/var/opt/common/pandoc-runner.sock`（共有ボリューム） |

## Dockerfile 設計

### `pandoc-runner-go/Dockerfile`

```
ステージ1（builder）: golang:1.21-alpine
  - COPY pandoc-runner-go のソースコード
  - CGO_ENABLED=0 でスタティックリンクビルド
  - go build -o pandoc-runner ./cmd/pandoc-runner

ステージ2（final）: pandoc/core:3-debian
  - バイナリのみを /usr/local/bin/pandoc-runner にコピー
  - ENTRYPOINT: /usr/local/bin/pandoc-runner
```

**CGO_ENABLED=0 の理由**: Alpine ビルダー（musl libc）で生成したバイナリを glibc ベースの Debian イメージ上で実行するため、完全スタティックリンクが必要。

### `app-server/Dockerfile`

```
ステージ1（builder）: node:20
  - npm ci（全依存関係インストール）
  - npm run build（TypeScript → JavaScript コンパイル）

ステージ2（prod-deps）: node:20
  - npm ci --omit=dev（本番依存関係のみ）

ステージ3（final）: node:20-slim
  - dist/ を builder からコピー
  - node_modules/ を prod-deps からコピー
  - ENTRYPOINT: node dist/index.js
```

## docker-compose.go.yml 設計

```yaml
services:
  pandoc-runner:
    build:
      context: ./pandoc-runner-go
      dockerfile: Dockerfile
    container_name: pandoc-runner-go
    volumes:
      - common:/var/opt/common
    environment:
      PF_PANDOC_PATH: pandoc
    command: ["-socket", "/var/opt/common/pandoc-runner.sock"]
    restart: unless-stopped

  app-server:
    build:
      context: ./app-server
      dockerfile: Dockerfile
    container_name: app-server
    volumes:
      - common:/var/opt/common
    ports:
      - "3000:3000"
    environment:
      NODE_ENV: production
    command: ["--pandoc-socket-path", "/var/opt/common/pandoc-runner.sock"]
    depends_on:
      - pandoc-runner
    restart: unless-stopped

volumes:
  common:
```

## 既存 docker-compose.yml との差分

| 項目 | docker-compose.yml（TS版） | docker-compose.go.yml（Go版） |
|------|--------------------------|-------------------------------|
| pandoc-runner イメージ | `node:20`（ランタイム） | `pandoc/core:3-debian`（最終ステージ） |
| pandoc-runner ビルド | ホスト側でビルド済み `dist/` をマウント | Docker マルチステージビルド |
| pandoc バイナリ | `./third_party/pandoc` マウント | ベースイメージに同梱 |
| app-server イメージ | `node:20` | `node:20-slim`（最終ステージ） |
| app-server ビルド | ホスト側でビルド済み `dist/` をマウント | Docker マルチステージビルド |
| 環境 | development | production |

## テスト方針

Dockerfile および docker-compose は設定ファイルのためユニットテストは不要。
以下のコマンドで手動動作確認を行う：

```bash
# ビルド＆起動
docker compose -f docker-compose.go.yml up --build

# 動作確認（別ターミナル）
curl -X POST http://localhost:3000/convert \
  -H "Content-Type: application/json" \
  -d '{"from":"markdown","to":"redmine-textile","content":"# Hello"}'

# 停止・クリーンアップ
docker compose -f docker-compose.go.yml down
```
