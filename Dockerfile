# ==============================
# Stage 1: build the Vite frontend
# ==============================
FROM node:22-bookworm-slim AS frontend

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY index.html tsconfig.json tsconfig.app.json tsconfig.node.json vite.config.ts .oxlintrc.json ./
COPY public ./public
COPY src ./src

RUN npm run build

# ==============================
# Stage 2: build the server (needs deps with native bindings)
# ==============================
FROM node:22-bookworm-slim AS server

# better-sqlite3 compiles from source; install build toolchain
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*

WORKDIR /app/server

COPY server/package.json server/package-lock.json ./
RUN npm ci

COPY server/tsconfig.json ./
COPY server/src ./src
COPY server/data/corpus.csv ./data/corpus.csv

# tsc only emits JS; the model/metrics/data assets live next to src, so relocate them
RUN npm run build \
  && cp src/model/*.json dist/model/ \
  && mkdir -p dist/data \
  && cp data/corpus.csv dist/data/corpus.csv

# ==============================
# Stage 3: runtime image
# ==============================
FROM node:22-bookworm-slim

WORKDIR /app

# ---- backend ----
COPY --from=server /app/server/dist ./server/dist
COPY --from=server /app/server/node_modules ./server/node_modules
COPY --from=server /app/server/package.json ./server/package.json

# ---- frontend static build ----
COPY --from=frontend /app/dist ./dist

ENV NODE_ENV=production
ENV PORT=8080
ENV DATABASE_PATH=/app/server/data/merchantshield.db
ENV MODEL_PATH=/app/server/dist/model/risk_model_v1.json
ENV METRICS_REPORT_PATH=/app/server/dist/model/metrics_report.json

# Seed a fresh database on first boot, then start the server.
COPY docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

EXPOSE 8080
CMD ["/app/docker-entrypoint.sh"]