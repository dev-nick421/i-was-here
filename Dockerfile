# syntax=docker/dockerfile:1.7

# Node 22 (LTS) still ships Alpine images for 32-bit ARM, so there's an image for older
# Raspberry Pis and 32-bit systems as well.
ARG NODE_VERSION=22

# ---------------------------------------------------------------------------
# Build stage: runs on the build machine's own platform. The output is plain JavaScript
# without native modules, so it works on every target platform.
# ---------------------------------------------------------------------------
FROM --platform=$BUILDPLATFORM node:${NODE_VERSION}-alpine AS build
WORKDIR /app
ENV CI=true \
    NUXT_TELEMETRY_DISABLED=1 \
    PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
# Behind a TLS-intercepting proxy? Pass its CA bundle as a build secret:
#   docker build --secret id=ca,src=/path/to/ca.pem .
# The `with-ca` helper exports it for Node only when the secret is present.
RUN printf '#!/bin/sh\n[ -f /run/secrets/ca ] && export NODE_EXTRA_CA_CERTS=/run/secrets/ca\nexec "$@"\n' > /usr/local/bin/with-ca \
 && chmod +x /usr/local/bin/with-ca

# Fetch dependencies first so this layer is cached until the lockfile changes.
COPY package.json pnpm-lock.yaml ./
RUN --mount=type=secret,id=ca,required=false \
    --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    with-ca sh -c 'corepack enable && pnpm fetch --frozen-lockfile'

COPY . .
RUN --mount=type=secret,id=ca,required=false \
    --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    with-ca sh -c 'pnpm install --offline --frozen-lockfile && pnpm build'

# ---------------------------------------------------------------------------
# Runtime stage: just Node and the self-contained Nitro output (no RUN steps, so
# building it for other platforms needs no emulation)
# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION}-alpine AS runtime
LABEL org.opencontainers.image.title="I Was Here" \
      org.opencontainers.image.description="Design minimalist map posters and export them as print-ready images." \
      org.opencontainers.image.source="https://github.com/dev-nick421/i-was-here" \
      org.opencontainers.image.licenses="MIT"
WORKDIR /app
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000
COPY --from=build --chown=node:node /app/.output ./.output
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/api/health" > /dev/null || exit 1
CMD ["node", ".output/server/index.mjs"]
