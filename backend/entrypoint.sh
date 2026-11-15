#!/bin/sh
set -e

mkdir -p /app/data
pnpm --filter restoflow-backend exec prisma db push --skip-generate

exec node /app/backend/dist/server.js
