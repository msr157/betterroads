# ─────────────────────────────────────────────────────
# Stage 1: Build
# Copies static source files — no compilation needed
# ─────────────────────────────────────────────────────
FROM alpine:3.20 AS builder

WORKDIR /build
COPY src/ ./

# ─────────────────────────────────────────────────────
# Stage 2: Production runtime (nginx on Alpine)
# ─────────────────────────────────────────────────────
FROM nginx:1.27-alpine

LABEL maintainer="betterroads"
LABEL org.opencontainers.image.title="betterroads"
LABEL org.opencontainers.image.description="BetterRoads — AI-Powered Road Condition Monitoring"
LABEL org.opencontainers.image.licenses="MIT"

# Remove default nginx placeholder content
RUN rm -rf /usr/share/nginx/html/*

# Copy static files from builder stage
COPY --from=builder /build/ /usr/share/nginx/html/

# Copy custom nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Expose HTTP only — TLS is terminated upstream (Dokploy / Traefik)
EXPOSE 80

# Healthcheck — curl is available on nginx:alpine
# Probes the /health endpoint added in nginx.conf
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD curl -fs http://localhost/health || exit 1

# nginx starts via its own default CMD — no override needed
