# ============================================================
# Combined Dockerfile: NestJS (port 3000) + FastAPI (port 8000)
# managed by supervisord for Render free-tier single service
# ============================================================

# ---- Stage 1: Build NestJS ----
FROM node:20-alpine AS nestjs-builder
WORKDIR /build
COPY package*.json ./
COPY apps/api/package.json apps/api/package.json
RUN npm install --workspaces=false --prefix . || true
WORKDIR /build/apps/api
COPY apps/api/package.json .
RUN npm install
COPY apps/api/ .
RUN npx prisma generate && npm run build

# ---- Stage 2: Combined runtime ----
FROM python:3.12-slim AS runtime

# Install Node.js 20
RUN apt-get update && apt-get install -y \
    curl \
    supervisor \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
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
# Copy node_modules from builder
COPY --from=nestjs-builder /build/apps/api/node_modules ./node_modules
COPY --from=nestjs-builder /build/apps/api/dist ./dist
COPY --from=nestjs-builder /build/apps/api/prisma ./prisma
# Need prisma CLI for migrations
RUN npm install prisma @prisma/client --no-save

# ---- Supervisor config ----
COPY Dockerfile.supervisor.conf /etc/supervisor/conf.d/app.conf

# ---- Startup script ----
COPY start.sh /start.sh
RUN chmod +x /start.sh

# Expose NestJS port (Render uses PORT env var)
EXPOSE 3000

CMD ["/start.sh"]
