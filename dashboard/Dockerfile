# ─────────────────────────────────────────────────────
# Stage 1: Build
# Installs dependencies and builds the admin dashboard
# (standalone npm project — build context is dashboard/)
# ─────────────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /build
COPY package.json package-lock.json ./
RUN npm ci

# Copy source code
COPY . .

# API base URL baked in at build time. Leave empty for same-origin /api
# (Traefik routes /api on the dashboard host to the backend); set it in
# Dokploy build args when the API lives on another host.
ARG VITE_API_URL=
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build

# ─────────────────────────────────────────────────────
# Stage 2: Production runtime (nginx on Alpine)
# ─────────────────────────────────────────────────────
FROM nginx:alpine

LABEL maintainer="betterroads"
LABEL org.opencontainers.image.title="betterroads-dashboard"
LABEL org.opencontainers.image.description="BetterRoads — internal admin dashboard"
LABEL org.opencontainers.image.licenses="MIT"

# Remove default nginx placeholder content and install curl for healthcheck
RUN apk add --no-cache curl && \
    rm -rf /usr/share/nginx/html/*

# Copy built files
COPY --from=builder /build/dist/ /usr/share/nginx/html/

# Copy custom nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Expose HTTP only — TLS is terminated upstream (Dokploy / Traefik / Cloudflare)
EXPOSE 80

# Healthcheck — explicitly IPv4 (see docs/DEPLOYMENT_KB.md, Issue 2)
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD curl -fs http://127.0.0.1/health || exit 1

# nginx starts via its own default CMD — no override needed
