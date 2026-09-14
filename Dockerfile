#appscan-ignore: insecure-base-image

# ── deps ──────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps

# ── builder ───────────────────────────────────────────────────────────────────
# No compile step needed (plain Express); just assemble the source tree.
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# ── runner ────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Create non-root user (uid/gid 1001)
RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 appuser

# Copy only what the app needs at runtime
COPY --from=builder --chown=appuser:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=appuser:nodejs /app/server.js    ./server.js
COPY --from=builder --chown=appuser:nodejs /app/front-end    ./front-end
COPY --from=builder --chown=appuser:nodejs /app/package.json ./package.json

USER 1001

EXPOSE 3000

CMD ["npm", "run", "start"]
