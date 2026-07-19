# Production image for the NestJS API (@tahkeem/api), built from the pnpm
# monorepo as a lean multi-stage build.
#
# Stage 1 (builder) installs everything and compiles. Stage 2 (runner) is a
# fresh slim image that installs ONLY the api + shared subtree (skipping the
# heavy apps/web and apps/mobile dependency trees) and copies just the built
# output. This keeps the final image small so it unpacks quickly on the deploy
# host. Debian-slim (glibc + openssl 3) is used so Prisma's default engine
# target works with no musl juggling.

# ───────────────────────── builder ─────────────────────────
FROM node:20-slim AS builder

RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate

WORKDIR /app
COPY . .

RUN pnpm install --frozen-lockfile
RUN pnpm shared:build
RUN pnpm --filter @tahkeem/api prisma:generate
RUN pnpm --filter @tahkeem/api build

# ───────────────────────── runner ─────────────────────────
FROM node:20-slim AS runner

RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate

WORKDIR /app

# All workspace manifests + the lockfile, so a frozen install validates cleanly.
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY apps/api/package.json ./apps/api/
COPY packages/shared/package.json ./packages/shared/
COPY apps/web/package.json ./apps/web/
COPY apps/mobile/package.json ./apps/mobile/

# Install only the api package and its workspace deps (shared). The `...` suffix
# pulls in dependencies; web and mobile are never installed. Dev deps are kept
# (no --prod) so `prisma` (migrate) and `ts-node` (seed scripts) work in the
# container — they're small next to the excluded web/mobile trees.
RUN pnpm install --frozen-lockfile --filter "@tahkeem/api..."

# Built outputs + the files needed at runtime.
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/apps/api/dist ./apps/api/dist
# prisma/ carries schema, migrations, and data/ (Quran JSON + workbooks the seed
# scripts read). tsconfig.seed.json is needed by the ts-node seed command.
COPY apps/api/prisma ./apps/api/prisma
COPY apps/api/tsconfig.json apps/api/tsconfig.seed.json ./apps/api/
# The app runs from dist/, but the ts-node seed scripts import a few source
# files (e.g. seed.ts → ../src/competitions/tajweed-criteria), so src/ must be
# present for `pnpm prisma:seed` to run in the container. It's small TS source.
COPY apps/api/src ./apps/api/src

# Regenerate the Prisma client into this stage's node_modules.
RUN pnpm --filter @tahkeem/api exec prisma generate

ENV NODE_ENV=production
ENV PORT=3001
EXPOSE 3001

# Apply pending migrations (no-op when already current), then start the API.
# Seeding (Quran verses, admin, competitions) is a one-off you run from the
# container Terminal:  pnpm --filter @tahkeem/api prisma:seed
CMD ["sh", "-c", "pnpm --filter @tahkeem/api prisma:migrate && pnpm --filter @tahkeem/api start:prod"]
