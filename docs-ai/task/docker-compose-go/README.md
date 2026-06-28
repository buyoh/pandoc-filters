# docker-compose.go.yml 作成タスク

## 概要

Go 版 pandoc-runner (`pandoc-runner-go`) を使用する `docker-compose.go.yml` を新規作成する。
各サービスの Docker イメージはマルチステージビルドの Dockerfile でビルドし、最終イメージにはバイナリのみを残す。

## ドキュメント一覧

| ファイル | 内容 |
|---------|------|
| [README.md](./README.md) | このファイル（概要・一覧） |
| [design.md](./design.md) | 設計詳細・ファイル構成 |

## ステータス

- [x] 設計ドキュメント作成
- [ ] `pandoc-runner-go/Dockerfile` 作成
- [ ] `app-server/Dockerfile` 作成
- [ ] `docker-compose.go.yml` 作成
- [ ] 動作確認

## 作成ファイル一覧

| ファイル | 説明 |
|---------|------|
| `pandoc-runner-go/Dockerfile` | Go 版 pandoc-runner のマルチステージビルド Dockerfile |
| `app-server/Dockerfile` | app-server のマルチステージビルド Dockerfile |
| `docker-compose.go.yml` | Go 版 pandoc-runner を使用する Docker Compose 設定 |

## 完了条件

- `docker compose -f docker-compose.go.yml up --build` で全サービスが起動すること
- pandoc-runner-go の最終イメージが `pandoc/core:3-debian` ベースであること
- ビルド済みバイナリのみが最終イメージに含まれること
- app-server が Unix ソケット経由で pandoc-runner-go と通信できること
