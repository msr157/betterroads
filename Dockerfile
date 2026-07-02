# ─────────────────────────────────────────────────────
# Stage 1: Build
# Installs dependencies and builds the React website
# ─────────────────────────────────────────────────────
FROM node:20-alpine AS builder

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

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
FROM nginx:1.27-alpine

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

# Healthcheck temporarily removed for debugging 502 Bad Gateway

# nginx starts via its own default CMD — no override needed
