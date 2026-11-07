# ============================================================
# Combined Dockerfile: NestJS (port 3000) + FastAPI (port 8000)
# managed by supervisord for Render free-tier single service
# ============================================================

# ---- Stage 1: Build NestJS ----
FROM node:22-alpine AS nestjs-builder
WORKDIR /build/apps/api
# Install API dependencies independently (no monorepo hoisting)
COPY apps/api/package.json ./
RUN npm install
# Copy source and generate Prisma client + compile TypeScript
COPY apps/api/ ./
RUN npx prisma generate && npm run build

# ---- Stage 2: Combined runtime ----
FROM python:3.12-slim AS runtime

# Install Node.js 22 LTS
RUN apt-get update && apt-get install -y \
    curl \
    supervisor \
    && curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get install -y nodejs \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# ---- Python AI service ----
WORKDIR /ai-service
COPY ai-service/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY ai-service/ .

# ---- NestJS API ----
WORKDIR /api
# Copy built artifacts and production node_modules from builder
COPY --from=nestjs-builder /build/apps/api/node_modules ./node_modules
COPY --from=nestjs-builder /build/apps/api/dist ./dist
COPY --from=nestjs-builder /build/apps/api/prisma ./prisma
# Minimal package.json so prisma CLI can run migrations
COPY apps/api/package.json ./package.json

# ---- Supervisor config ----
COPY Dockerfile.supervisor.conf /etc/supervisor/conf.d/app.conf

# ---- Startup script ----
COPY start.sh /start.sh
RUN chmod +x /start.sh

# Expose NestJS port (Render uses PORT env var)
EXPOSE 3000

CMD ["/start.sh"]
