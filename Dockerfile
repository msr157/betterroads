# ─────────────────────────────────────────────────────
# Stage 1: Build
# Installs dependencies and builds the React website
# ─────────────────────────────────────────────────────
FROM node:22-alpine AS builder

# Install pnpm (pin to v9 to avoid strict build approval errors in v10+)
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

WORKDIR /build
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY website/package.json ./website/

# Install dependencies (frozen-lockfile if it exists, otherwise normal install)
RUN pnpm install

# Copy source code
COPY website/ ./website/

# Build the website
RUN pnpm --filter website build

# ─────────────────────────────────────────────────────
# Stage 2: Production runtime (nginx on Alpine)
# ─────────────────────────────────────────────────────
FROM nginx:alpine

LABEL maintainer="betterroads"
LABEL org.opencontainers.image.title="betterroads"
LABEL org.opencontainers.image.description="BetterRoads — AI-Powered Road Condition Monitoring"
LABEL org.opencontainers.image.licenses="MIT"

# Remove default nginx placeholder content and install curl for healthcheck
RUN apk add --no-cache curl && \
    rm -rf /usr/share/nginx/html/*

# Copy built files from the website workspace
COPY --from=builder /build/website/dist/ /usr/share/nginx/html/

# Copy custom nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Expose HTTP only — TLS is terminated upstream (Dokploy / Traefik)
EXPOSE 80

# Healthcheck — curl is available on nginx:alpine
# Probes the /health endpoint added in nginx.conf
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD curl -fs http://127.0.0.1/health || exit 1

# nginx starts via its own default CMD — no override needed
