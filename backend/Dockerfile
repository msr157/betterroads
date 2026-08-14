# ── Stage 1: Build ────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

# Install pnpm (pin to v9 to avoid strict build approval errors in v10+)
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

WORKDIR /app

# Copy package files (from the backend context)
COPY package.json ./

# Install dependencies
RUN pnpm install --no-frozen-lockfile

# Copy backend source
COPY . .

# Build: bundle to a single file
RUN pnpm run build


# ── Stage 2: Runtime ──────────────────────────────────────────────────────────
FROM node:22-alpine AS runtime

WORKDIR /app

# We bundle everything with esbuild, but copy the built file only.
COPY --from=builder /app/dist/index.cjs ./index.cjs

# Copy migrations folder for automatic startup migrations
COPY --from=builder /app/migrations ./migrations

# Health endpoint is on /health at the PORT below.
ENV PORT=3000
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/health || exit 1

CMD ["node", "index.cjs"]
