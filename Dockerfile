# syntax=docker/dockerfile:1

# ── Build stage: install, build shared+server+client, prune to prod bundle ──
FROM node:22-alpine AS build
RUN corepack enable && corepack prepare pnpm@10.29.2 --activate
WORKDIR /app

# Install with a warm cache: only re-runs when a manifest or the lockfile changes.
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY shared/package.json shared/
COPY server/package.json server/
COPY client/package.json client/
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

# Self-contained server bundle (server dist + prod deps + injected @apseline/shared).
RUN pnpm --filter @apseline/server deploy --prod --legacy /prod

# ── Runtime stage ───────────────────────────────────────────────────────────
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3001 \
    CLIENT_DIST=/app/public \
    CONFIG_PATH=/app/config.yaml

COPY --from=build /prod ./
COPY --from=build /app/client/dist ./public
# Default config; mount your own over /app/config.yaml to override.
COPY --from=build /app/config.yaml ./config.yaml

EXPOSE 3001
CMD ["node", "dist/index.js"]
