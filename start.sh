#!/bin/sh
# Startup script: run Prisma migrations then launch supervisord

set -e

echo "==> Running Prisma migrations..."
cd /api
npx prisma migrate deploy 2>&1 || {
  echo "Migration failed — trying db push..."
  npx prisma db push --accept-data-loss 2>&1
}

echo "==> Starting supervisord (NestJS + FastAPI)..."
exec /usr/bin/supervisord -c /etc/supervisor/supervisord.conf
