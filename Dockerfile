# ── Build stage ───────────────────────────────────────────────────────────
FROM node:18-alpine AS builder

WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --production

# ── Runtime stage ─────────────────────────────────────────────────────────
FROM node:18-alpine

LABEL maintainer="Reminder Bot"
LABEL description="Production-grade Google Sheets Reminder Bot"

# Security: run as non-root
RUN addgroup -S botgroup && adduser -S botuser -G botgroup

WORKDIR /app

# Copy dependencies from builder
COPY --from=builder /app/node_modules ./node_modules

# Copy source
COPY package.json ./
COPY src/ ./src/

# Create logs directory
RUN mkdir -p logs && chown -R botuser:botgroup /app

USER botuser

# Hugging Face Spaces default port
EXPOSE 7860

# Health check for container orchestrators
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:7860/health || exit 1

CMD ["node", "src/index.js"]
