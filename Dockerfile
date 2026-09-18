# ==============================================================================
# Kasirio Cloud Backend Dockerfile (Production Multi-Stage Build)
# Target: api.kasirio.com (GCP Cloud Run / Render / Railway)
# ==============================================================================

FROM node:22-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat curl

# 1. Dependency Stage
FROM base AS deps
COPY package.json package-lock.json* ./
COPY prisma ./prisma/
RUN npm ci

# 2. Builder Stage
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Generate Prisma Client
RUN npx prisma generate

# 3. Runner Stage (Production)
FROM base AS runner
ENV NODE_ENV=production
ENV PORT=8080

# Create non-root user for security baseline (Blueprint 6.1)
RUN addgroup --system --gid 1001 kasirio && \
    adduser --system --uid 1001 kasirio

# Copy built dependencies and app source
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/server.ts ./server.ts
COPY --from=builder /app/src ./src
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/tsconfig.json ./tsconfig.json

# Set file ownership to non-root user
RUN chown -R kasirio:kasirio /app

USER kasirio

EXPOSE 8080

# Healthcheck endpoint for Cloud Run / Container orchestrators
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:${PORT:-8080}/api/health || exit 1

CMD ["npx", "tsx", "server.ts"]
