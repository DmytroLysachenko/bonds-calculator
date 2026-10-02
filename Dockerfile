# syntax=docker/dockerfile:1.7

FROM node:24-bookworm-slim@sha256:3638d9a6fe4030bd716be989438248074489337ba3275657f93595428be4fc03 AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
WORKDIR /app
RUN corepack enable

FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
  HUSKY=0 pnpm install --frozen-lockfile --store-dir /pnpm/store

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN --mount=type=cache,id=next-cache,target=/app/.next/cache \
  pnpm build

FROM node:24-bookworm-slim@sha256:3638d9a6fe4030bd716be989438248074489337ba3275657f93595428be4fc03 AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=8080

# The pinned base digest predates Debian's fixed PCRE2 package. Patch the
# runtime package until the reviewed base digest is advanced.
RUN apt-get update && apt-get install -y --no-install-recommends --only-upgrade libpcre2-8-0 \
  && rm -rf /var/lib/apt/lists/*

# The standalone server is launched directly with Node. Removing npm keeps its
# bundled development-only dependency tree out of the production image.
RUN rm -rf /usr/local/lib/node_modules/npm

COPY --from=builder --chown=node:node /app/public ./public
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static

EXPOSE 8080
USER node
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || '8080') + '/api/health').then((response) => response.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"
CMD ["node", "server.js"]
