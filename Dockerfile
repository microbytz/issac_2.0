# syntax=docker/dockerfile:1

# ── Stage 1: build the frontend bundle ──────────────────────────────────────
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# ── Stage 2: runtime ─────────────────────────────────────────────────────────
FROM node:22-bookworm-slim
ENV NODE_ENV=production
WORKDIR /app

# Production deps only (tsx lives in dependencies — it's the runtime runner).
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Server + engine modules. server.ts imports ./src/utils/fireplexityUtils.ts,
# so src/ ships wholesale; dist/ comes from the build stage (static + OTA).
COPY server.ts searchIndex.ts crawler.ts commonCrawl.ts renderer.ts safeFetch.ts feedback.ts ranker.ts reranker.ts tsconfig.json ./
COPY src ./src
COPY --from=build /app/dist ./dist

# Persisted engine state (index, link graph, weights, embeddings, blocklists).
# Mount a volume here or every redeploy loses the catalog:
#   docker run -v isaac-data:/app/data ...
RUN mkdir -p /app/data
VOLUME ["/app/data"]

# Optional: enable JS-rendered crawling in-container by installing chromium and
# setting CHROME_PATH=/usr/bin/chromium. Without it, js_render falls back to
# plain fetch automatically.

EXPOSE 3000
ENV PORT=3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://localhost:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["npx", "tsx", "server.ts"]
