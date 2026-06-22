---
name: design-js-ts
description: JavaScript/TypeScript を使用したアプリケーションの設計・構築に関する知識
---


## ファイル名

React コンポーネントは PascalCase とする。例: `FooBar.tsx`
Nodejsなどその他のスクリプトは kebab-case とする。例: `foo-bar.ts`, `foo-bar.mts`

## クラス命名

- インターフェース: `FooBar`
- テスト用: `FooBarStub`
- 実装: `FooBarImpl`

## ディレクトリ構成

ディレクトリはドメイン・ファイルはレイヤー単位で分ける。
エントリーポイントは、src 直下に置く。モジュールは、src/app/ 以下などに配置する。
ユニットテストは実装と同じディレクトリに置く。

```
user/
  foobar/
    types.ts 構造体、enum等の型定義
    foobar.ts インターフェース
    foobar-impl.ts 実装
    foobar-stub.ts テスト用のスタブ
```

node + react:

```
src/
├── app/                # サーバーサイドアプリケーションのコード
│   ├── index.ts        # エントリーポイント
│   ├── controllers/    # ルーティングのコントローラー
│   ├── models/         # データモデル
│   ├── routes/         # ルーティング
│   ├── web/            # ビュー・ミドルウェア
│   └── services/       # ビジネスロジック
├── interfaces/         # サーバ・クライアント共通データ型
├── lib/                # サーバ・クライアント共通ライブラリ
├── tests/              # テストコード
│   ├── app/            # サーバーサイドのテスト
│   └── web/            # クライアントサイドのテスト
└── web/                # クライアントサイドアプリケーションのコード
    ├── components/     # 汎用 UI 部品（Button, TextInput など。状態を持たない）
    ├── widgets/        # アプリ固有の構成要素（フォーム、タイムラインなど。状態・副作用を持つ）
    ├── hooks/          # カスタムフック
    ├── pages/          # ルーティング単位のページ。レイアウト+widgets の配置のみ
    ├── services/       # API通信などのサービス
    ├── stores/         # Jotai atoms
    └── styles/         # スタイルシート
```
