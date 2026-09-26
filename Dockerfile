# LifeOS production image (spec §7.1: provide a Dockerfile for self-hosting).
#
# Multi-stage: install + build with the whole workspace, then run Next's standalone-less output via
# `pnpm start`. Migrations run on container start so a fresh volume is usable immediately.
#
# Build needs *a* DATABASE_URL/BETTER_AUTH_SECRET because env.ts validates the contract at import
# time (the values are build-time placeholders, overridden at runtime — pass real ones with `-e`).

FROM node:24-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable && apt-get update && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
# `/data` has to exist *here* as well as in the runner. The placeholder URL below is opened at
# import time by any route that reaches the database, and `next build` collects those routes to
# gather their config — so a path whose directory does not exist fails the build with
# `ConnectionFailed: Unable to open connection to local database /data/lifeos.db`. Only the runner
# stage created it, which made the build depend on a directory it was responsible for making.
RUN mkdir -p /data
ENV DATABASE_URL="file:/data/lifeos.db" \
    BETTER_AUTH_SECRET="build-time-placeholder-not-used-at-runtime" \
    NEXT_TELEMETRY_DISABLED=1
RUN pnpm build

FROM base AS runner
ENV NODE_ENV=production \
    PORT=3000 \
    NEXT_TELEMETRY_DISABLED=1 \
    DATABASE_URL="file:/data/lifeos.db"
COPY --from=build /app ./
RUN mkdir -p /data
EXPOSE 3000
# Migrate, then serve. `sh -c` so the env-provided DATABASE_URL is used at run time.
CMD ["sh", "-c", "pnpm db:migrate && pnpm start"]
