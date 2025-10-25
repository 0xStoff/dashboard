# ====== FRONTEND ======
FROM node:20-alpine AS frontend
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN yarn install --frozen-lockfile
COPY frontend/ .
RUN yarn build

# ====== BACKEND ======
FROM node:20-alpine AS backend
WORKDIR /app/backend
COPY backend/package*.json ./
RUN yarn install
COPY backend/ .
EXPOSE 3000
CMD ["yarn", "start"]