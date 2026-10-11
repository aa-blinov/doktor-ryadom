FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY app/package.json app/package-lock.json ./
RUN npm ci
COPY app/ ./
RUN npm run build:docker

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production PORT=3000 DATABASE_PATH=/data/ryadom.sqlite
WORKDIR /app
COPY --from=build --chown=node:node /app/dist/client ./dist/client
COPY --from=build --chown=node:node /app/dist/node ./dist/node
COPY --from=build --chown=node:node /app/drizzle ./drizzle
COPY --from=build --chown=node:node /app/scripts/verify-specialist.mjs ./scripts/verify-specialist.mjs
COPY --from=build --chown=node:node /app/scripts/make-admin.mjs ./scripts/make-admin.mjs
COPY --from=build --chown=node:node /app/scripts/check-backup.mjs ./scripts/check-backup.mjs
COPY --from=build --chown=node:node /app/scripts/backup.mjs ./scripts/backup.mjs
RUN mkdir /data /backups && chown node:node /data /backups
USER node
EXPOSE 3000
CMD ["node", "dist/node/server.mjs"]
