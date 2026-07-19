# Production image for the NestJS API (@tahkeem/api) built from the pnpm
# monorepo. Deploys cleanly on Coolify / any Docker host.
#
# Debian-slim (glibc + openssl 3) is used deliberately: Prisma's default
# engine target `debian-openssl-3.0.x` works out of the box, no musl/Alpine
# engine juggling. Build and runtime share the same base so the engine
# generated at build time matches at run time.
FROM node:20-slim AS builder

# Prisma needs openssl present to generate/run its query engine.
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate

WORKDIR /app

# Copy everything (the .dockerignore keeps node_modules/dist/assets out) so the
# frozen-lockfile install sees every workspace package.json it expects.
COPY . .

RUN pnpm install --frozen-lockfile
RUN pnpm shared:build
RUN pnpm --filter @tahkeem/api prisma:generate
RUN pnpm --filter @tahkeem/api build

ENV NODE_ENV=production
# main.ts reads PORT (default 3001) and listens on 0.0.0.0.
ENV PORT=3001
EXPOSE 3001

# On every boot: apply any pending Prisma migrations, then start the API.
# `migrate deploy` is a no-op when the schema is already up to date, so this is
# safe to run on each restart. Seeding (Quran verses, admin, competitions) is a
# one-off you run manually from Coolify's Terminal — see the deploy notes.
CMD ["sh", "-c", "pnpm --filter @tahkeem/api prisma:migrate && pnpm --filter @tahkeem/api start:prod"]
