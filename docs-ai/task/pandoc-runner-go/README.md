# pandoc-runner Go 版 設計・実装計画

## 概要

TypeScript で実装された `pandoc-runner` と同一の挙動を持つ Go 言語版を新規作成する。

- **対象ディレクトリ**: `pandoc-runner-go/`
- **参照実装**: `pandoc-runner/`（TypeScript 版）

## ドキュメント一覧

| ファイル | 内容 |
|---------|------|
| [README.md](./README.md) | このファイル（概要・一覧） |
| [architecture.md](./architecture.md) | アーキテクチャ設計 |
| [implementation.md](./implementation.md) | 実装詳細・進捗 |

## ステータス

- [x] 設計ドキュメント作成
- [x] 実装
- [x] テスト

## 完了条件

- `pandoc-runner`（TypeScript 版）と同一の Unix ソケット通信プロトコルで動作すること
- JSON リクエスト/レスポンスの形式が TypeScript 版と互換性があること
- 単体テスト・統合テストが揃っていること
