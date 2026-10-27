# app-server のマルチステージビルド Dockerfile。
# ルートの pnpm-lock.yaml で依存を固定するため、ビルドコンテキストはリポジトリルートとする。
#   docker build -f app-server/Dockerfile .
# コンテキストに含めるファイルは app-server/Dockerfile.dockerignore で限定する
# （<Dockerfile名>.dockerignore は BuildKit のみが解釈するため、BuildKit が必要）。
# ステージ1（builder）で TypeScript をコンパイルし、
# ステージ2（prod-deps）で本番用依存関係のみを pnpm deploy で切り出し、
# ステージ3（final）に dist/ と本番 node_modules のみをコピーする。

# ステージ1: TypeScript ビルド
FROM node:20 AS builder

# ルート package.json の packageManager と同じバージョンに固定する
RUN npm install -g pnpm@12.15.0

WORKDIR /repo
# lockfile の importers と一致させるため、ワークスペースの全 package.json をコピーする
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY app-server/package.json ./app-server/
COPY pandoc-runner/package.json ./pandoc-runner/
# ルート（workspace root）の依存も併せてインストールされるが、builder ステージ内に限られ最終イメージには含まれない
RUN pnpm install --frozen-lockfile --filter app-server
COPY app-server/tsconfig.json ./app-server/
COPY app-server/src/ ./app-server/src/
RUN pnpm --filter app-server build

# ステージ2: 本番依存関係のみ切り出し
FROM builder AS prod-deps

RUN pnpm --filter app-server deploy --prod /prod/app-server

# ステージ3: 最終イメージ
FROM node:20-slim

WORKDIR /app
# node ユーザー（UID=1000）で実行するため chown を設定する
COPY --from=builder --chown=node:node /repo/app-server/dist ./dist
COPY --from=prod-deps --chown=node:node /prod/app-server/node_modules ./node_modules
COPY --chown=node:node app-server/package.json ./
COPY --chown=node:node app-server/web-simple ./web-simple

USER node
ENTRYPOINT ["node", "dist/index.js"]
