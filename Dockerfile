# ── Stage 1: Alpine builder ──────────────────
FROM alpine:3.20 AS builder
WORKDIR /build
COPY src/ ./

# ── Stage 2: Production nginx ────────────────
FROM nginx:1.27-alpine
LABEL maintainer="betterroads"
LABEL org.opencontainers.image.title="betterroads"
LABEL org.opencontainers.image.description="BetterRoads — AI-Powered Road Condition Monitoring"
LABEL org.opencontainers.image.licenses="MIT"
RUN rm -rf /usr/share/nginx/html/*
COPY --from=builder /build/ /usr/share/nginx/html/
COPY nginx.conf /etc/nginx/nginx.conf
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost/health || exit 1
