---
name: react-scss-style
description: React コンポーネントのスタイルを設計・あるいはSCSSを記述するためのスキル
---

デザインはなるべくシンプルに保つために統一されたスタイルにする。

- 色は全て src/web/components/styles/colors.scss に定義し、他のスタイルはそれを参照して使用する
- デザインを統一するため、 button や input などの基本的な部品ごとに  Button, InputText のような React コンポーネントを作成し、スタイルはそれぞれのコンポーネントに対応する SCSS ファイルに記述する
