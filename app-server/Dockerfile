# app-server のマルチステージビルド Dockerfile。
# ステージ1（builder）で TypeScript をコンパイルし、
# ステージ2（prod-deps）で本番用依存関係のみをインストールし、
# ステージ3（final）に dist/ と本番 node_modules のみをコピーする。

# ステージ1: TypeScript ビルド
FROM node:20 AS builder

WORKDIR /app
COPY package.json tsconfig.json ./
# package-lock.json が存在しないため npm install を使用する
RUN npm install
COPY src/ ./src/
RUN npm run build

# ステージ2: 本番依存関係のみインストール
FROM node:20 AS prod-deps

WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev

# ステージ3: 最終イメージ
FROM node:20-slim

WORKDIR /app
# node ユーザー（UID=1000）で実行するため chown を設定する
COPY --from=builder --chown=node:node /app/dist ./dist
COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node package.json ./

USER node
ENTRYPOINT ["node", "dist/index.js"]
