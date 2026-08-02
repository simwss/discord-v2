# syntax=docker/dockerfile:1

# Multi-stage build: TypeScript and dev dependencies stay in the build stages,
# so the published image carries only the compiled output and prod deps.

ARG NODE_VERSION=22
ARG ALPINE_VERSION=3.21

# ---------------------------------------------------------------------------
# deps — production node_modules only
# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION}-alpine${ALPINE_VERSION} AS deps
WORKDIR /app

COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --omit=dev --ignore-scripts

# ---------------------------------------------------------------------------
# build — full deps, compile to dist/
# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION}-alpine${ALPINE_VERSION} AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --ignore-scripts

COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npm run build

# ---------------------------------------------------------------------------
# runtime — distroless-ish: no npm, no source, no shell tooling beyond Alpine
# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION}-alpine${ALPINE_VERSION} AS runtime

# `tini` reaps zombies and forwards SIGTERM, which Node does not do correctly
# as PID 1; without it `docker stop` waits the full 10s timeout every time.
RUN apk add --no-cache tini

ENV NODE_ENV=production \
    HEALTH_PORT=3001

WORKDIR /app

# The node image ships an unprivileged `node` user; never run as root.
COPY --chown=node:node --from=deps /app/node_modules ./node_modules
COPY --chown=node:node --from=build /app/dist ./dist
COPY --chown=node:node package.json ./

USER node

EXPOSE 3001

# Uses the bot's own readiness probe, so an image whose gateway connection has
# dropped is reported unhealthy rather than merely "running".
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:'+(process.env.HEALTH_PORT||3001)+'/ready').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/index.js"]

# OCI metadata; the image-specific values are overridden by the build workflow.
LABEL org.opencontainers.image.title="rasselbande-bot" \
      org.opencontainers.image.description="Discord Bot der Rasselbande" \
      org.opencontainers.image.licenses="MIT"
