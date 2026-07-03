# ── Stage 1: Build ────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy package files (from the backend context)
COPY package.json ./
# Attempt to copy lockfile if it exists, otherwise it will just use package.json
# (In a monorepo, the lockfile is at the root, so it might not be in the backend context. We can just run pnpm install without frozen-lockfile if it's missing)
COPY package.json ./

# Install dependencies
RUN pnpm install

# Copy backend source
COPY . .

# Build: bundle to a single file
RUN pnpm run build


# ── Stage 2: Runtime ──────────────────────────────────────────────────────────
FROM node:20-alpine AS runtime

WORKDIR /app

# We bundle everything with esbuild, but copy the built file only.
COPY --from=builder /app/dist/index.js ./index.js

# Copy migrations folder for automatic startup migrations
COPY --from=builder /app/migrations ./migrations

# Health endpoint is on /health at the PORT below.
ENV PORT=3000
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/health || exit 1

CMD ["node", "index.js"]
