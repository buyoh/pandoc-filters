# Web Simple - Pandoc Converter

シンプルなマークダウンからRedmine Textile変換Webアプリケーションです。

## 機能

- **左右レイアウト**: 左側に入力エリア、右側に出力エリア
- **リアルタイム変換**: ボタンをクリックして即座に変換
- **キーボードショートカット**:
  - `Ctrl+Enter` (Mac: `Cmd+Enter`): 変換実行
  - `Ctrl+K` (Mac: `Cmd+K`): テキストクリア
  - `Ctrl+Shift+C` (Mac: `Cmd+Shift+C`): 結果をコピー
- **レスポンシブデザイン**: モバイルデバイス対応
- **ステータス表示**: 変換状態をリアルタイム表示

## 使用方法

1. 左側のテキストエリアにMarkdownテキストを入力
2. 「Convert」ボタンをクリックまたは`Ctrl+Enter`
3. 右側のテキストエリアに変換結果が表示される
4. 「Copy Result」ボタンで結果をクリップボードにコピー

## ファイル構成

```
web-simple/
├── index.html          # メインHTMLファイル
├── style.css           # スタイルシート
├── script.js           # JavaScript機能
└── README.md          # このファイル
```

## 技術仕様

- **フレームワークなし**: バニラHTML/CSS/JavaScript
- **API通信**: Fetch APIを使用してREST APIと通信
- **エラーハンドリング**: 通信エラーと変換エラーを適切に表示
- **アクセシビリティ**: キーボードナビゲーション対応

## 開発

このWebアプリケーションは`app-server`のExpressサーバーから静的ファイルとして提供されます。

```bash
# サーバー起動
yarn app-server:dev

# ブラウザでアクセス
http://localhost:3000
```