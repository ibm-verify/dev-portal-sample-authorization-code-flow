# ── deps ──────────────────────────────────────────────────────────────────────
# registry.access.redhat.com is the public UBI mirror (no auth required).
# :1 pins to the v1 major stream and floats on security patches within it —
# the Red Hat-recommended strategy for UBI images.
FROM registry.access.redhat.com/ubi9/nodejs-20:1 AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps

# ── builder ───────────────────────────────────────────────────────────────────
# No compile step needed (plain Express); just assemble the source tree.
FROM registry.access.redhat.com/ubi9/nodejs-20:1 AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# ── runner ────────────────────────────────────────────────────────────────────
# nodejs-20-minimal is the smallest runtime-only UBI image.
FROM registry.access.redhat.com/ubi9/nodejs-20-minimal:1 AS runner
WORKDIR /app

ENV NODE_ENV=development

# UBI images already run as a non-root user (uid 1001) by default.
USER 1001

# Copy only what the app needs at runtime
COPY --from=builder --chown=1001 /app/node_modules ./node_modules
COPY --from=builder --chown=1001 /app/server.js    ./server.js
COPY --from=builder --chown=1001 /app/front-end    ./front-end
COPY --from=builder --chown=1001 /app/package.json ./package.json

EXPOSE 3000

CMD ["npm", "run", "start"]
