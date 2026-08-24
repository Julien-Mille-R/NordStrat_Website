FROM node:24.18.1-bookworm-slim AS assets

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY public ./public
COPY views ./views
RUN npm run build:css

FROM nginx:1.28-alpine

COPY deploy/nginx/container.conf /etc/nginx/nginx.conf
COPY deploy/nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY deploy/nginx/production.conf.template /etc/nginx/templates-production/default.conf.template
COPY --from=assets --chown=101:101 /app/public /srv/public

USER 101:101
EXPOSE 8080 8443

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://127.0.0.1:8080/nginx-health || exit 1
