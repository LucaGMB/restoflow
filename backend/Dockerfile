FROM node:22-alpine AS base

RUN apk add --no-cache openssl \
  && corepack enable \
  && corepack prepare pnpm@11.1.2 --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY backend/package.json ./backend/
COPY backend/prisma ./backend/prisma

RUN pnpm install --frozen-lockfile --filter restoflow-backend...

COPY backend/tsconfig.json ./backend/
COPY backend/src ./backend/src
COPY backend/entrypoint.sh ./backend/entrypoint.sh

RUN chmod +x /app/backend/entrypoint.sh \
  && pnpm --filter restoflow-backend db:generate \
  && pnpm --filter restoflow-backend build

ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

ENTRYPOINT ["/app/backend/entrypoint.sh"]
