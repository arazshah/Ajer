FROM node:22-bookworm-slim AS base

WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1

RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*


FROM base AS dependencies

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund


FROM dependencies AS production-dependencies

RUN npm prune --omit=dev --no-audit --no-fund


FROM base AS builder

ARG NEXT_SERVER_ACTIONS_ENCRYPTION_KEY
ENV NEXT_SERVER_ACTIONS_ENCRYPTION_KEY=$NEXT_SERVER_ACTIONS_ENCRYPTION_KEY

COPY --from=dependencies /app/node_modules ./node_modules
COPY . .
RUN ./node_modules/.bin/prisma generate --schema=prisma/schema.prisma \
    && npm run build


FROM base AS runner

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

RUN groupadd --system --gid 1001 nodejs \
    && useradd --system --uid 1001 --gid 1001 nextjs

COPY --from=production-dependencies --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/scripts/bootstrap.ts ./scripts/bootstrap.ts
COPY --from=builder --chown=nextjs:nodejs /app/package.json /app/package-lock.json ./
COPY --chown=nextjs:nodejs docker-entrypoint.sh ./docker-entrypoint.sh

RUN mkdir -p /app/uploads \
    && chown nextjs:nodejs /app/uploads \
    && chmod 0755 /app/docker-entrypoint.sh

USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health/ready').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

ENTRYPOINT ["/app/docker-entrypoint.sh"]
