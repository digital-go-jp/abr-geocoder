ARG env_dataset_url=null

FROM node:20-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

# 必要なファイルだけをコピー
WORKDIR /app
COPY src/ /app/src/
COPY package.json .
COPY tsconfig.json .
COPY tsconfig.build.json .
COPY schema.sql .

# ビルドに必要なものをインストール
RUN apt update && \
  apt install -y sqlite3 && \
  apt clean && \
  rm -rf /var/lib/apt/lists

# install product dependencies
FROM base AS prod-deps
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --prod --no-frozen-lockfile

# product build
FROM base AS build
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --no-frozen-lockfile
RUN pnpm run build

FROM base
COPY --from=prod-deps /app/node_modules /app/node_modules
COPY --from=build /app/build /app/build

# 環境変数
ENV DATASET_URL $env_dataset_url

# ポートを開く
EXPOSE 3000

# サービス起動
CMD ["node","/app/build/interface/api-server/index.js"]