FROM node:24.18.1-bookworm-slim AS build

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build:css \
    && npm prune --omit=dev

FROM node:24.18.1-bookworm-slim AS runtime

ENV NODE_ENV=production \
    PORT=3000 \
    UPLOAD_ROOT=/app/data/uploads \
    ARCHIVE_DIRECTORY=/app/data/archives

WORKDIR /app
COPY --from=build --chown=node:node /app /app
RUN mkdir -p /app/data/uploads /app/data/archives \
    && chown -R node:node /app/data

USER node
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD ["node", "scripts/healthcheck.js"]

CMD ["node", "server.js"]
