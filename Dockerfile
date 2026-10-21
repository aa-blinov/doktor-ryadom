FROM node:25-bookworm-slim AS build
WORKDIR /app
COPY app/package.json app/package-lock.json ./
RUN npm ci
COPY app/ ./
RUN npm run build:docker

FROM node:25-bookworm-slim AS runtime
ENV NODE_ENV=production PORT=3000 DATABASE_PATH=/data/ryadom.sqlite
WORKDIR /app
COPY --from=build --chown=node:node /app/dist/client ./dist/client
COPY --from=build --chown=node:node /app/dist/node ./dist/node
COPY --from=build --chown=node:node /app/drizzle ./drizzle
COPY --from=build --chown=node:node /app/scripts/verify-specialist.mjs ./scripts/verify-specialist.mjs
COPY --from=build --chown=node:node /app/scripts/make-admin.mjs ./scripts/make-admin.mjs
COPY --from=build --chown=node:node /app/scripts/check-backup.mjs ./scripts/check-backup.mjs
COPY --from=build --chown=node:node /app/scripts/backup.mjs ./scripts/backup.mjs
COPY --from=build --chown=node:node /app/scripts/offsite.mjs ./scripts/offsite.mjs
# Pull Debian security fixes, and drop npm and corepack: the runtime only runs node, and their bundled packages carry CVEs.
RUN apt-get update && apt-get upgrade -y --no-install-recommends && rm -rf /var/lib/apt/lists/* \
 && rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack \
 && mkdir /data /backups && chown node:node /data /backups
USER node
EXPOSE 3000
CMD ["node", "dist/node/server.mjs"]
