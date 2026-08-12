# syntax=docker/dockerfile:1

# ====== FRONTEND BUILD ======
FROM node:20-alpine AS frontend-build
WORKDIR /app/frontend
RUN apk add --no-cache python3 make g++
COPY frontend/package.json frontend/yarn.lock ./
RUN --mount=type=cache,target=/usr/local/share/.cache/yarn \
    yarn install --frozen-lockfile --ignore-optional
ARG FRONTEND_CACHEBUST=0
COPY frontend/ .
ARG REACT_APP_API_BASE_URL
ARG REACT_APP_LOGO_BASE_URL
ENV REACT_APP_API_BASE_URL=$REACT_APP_API_BASE_URL
ENV REACT_APP_LOGO_BASE_URL=$REACT_APP_LOGO_BASE_URL
RUN yarn build

# ====== FRONTEND RUNTIME ======
FROM nginx:1.27-alpine AS frontend
COPY docker/frontend-nginx.conf /etc/nginx/conf.d/default.conf
COPY frontend/public/ /usr/share/nginx/html/
ARG FRONTEND_CACHEBUST=0
RUN echo "$FRONTEND_CACHEBUST" > /frontend-build-id
COPY --from=frontend-build /app/frontend/dist /usr/share/nginx/html
EXPOSE 80

# ====== BACKEND ======
FROM node:20-alpine AS backend
WORKDIR /app/backend
COPY backend/package.json backend/yarn.lock ./
RUN --mount=type=cache,target=/usr/local/share/.cache/yarn \
    yarn install --frozen-lockfile --ignore-optional
COPY backend/ .
EXPOSE 3000
CMD ["yarn", "start"]
