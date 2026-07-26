FROM node:20-alpine AS frontend-build
WORKDIR /app/frontend
RUN corepack enable
COPY frontend/package.json frontend/yarn.lock ./
RUN yarn install --frozen-lockfile --ignore-optional
COPY frontend/ ./
ARG REACT_APP_API_BASE_URL=https://api.dashboard.stoeff.xyz/api
ARG REACT_APP_LOGO_BASE_URL=https://api.dashboard.stoeff.xyz/logos/
ENV REACT_APP_API_BASE_URL=${REACT_APP_API_BASE_URL}
ENV REACT_APP_LOGO_BASE_URL=${REACT_APP_LOGO_BASE_URL}
RUN yarn webpack --mode production

FROM nginx:1.27-alpine AS frontend
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=frontend-build /app/frontend/dist /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD wget -q -O /dev/null http://127.0.0.1:8080/ || exit 1

FROM node:20-alpine AS backend
WORKDIR /app/backend
RUN corepack enable
COPY backend/package.json backend/yarn.lock ./
RUN yarn install --frozen-lockfile --production --ignore-optional
COPY --chown=node:node backend/ ./
ENV NODE_ENV=production
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD wget -q -O /dev/null http://127.0.0.1:3000/healthz || exit 1
CMD ["yarn", "start"]
