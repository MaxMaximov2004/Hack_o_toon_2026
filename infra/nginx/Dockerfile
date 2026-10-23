# nginx + собранный фронт. Контекст сборки — корень репозитория.
# Стадия 1: фронт собирается из ./frontend (npm ci && npm run build -> dist/)
FROM node:20-alpine AS frontend
WORKDIR /app
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Стадия 2: nginx с конфигом из infra/nginx и статикой фронта
FROM nginx:1.27-alpine
COPY infra/nginx/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=frontend /app/dist /usr/share/nginx/html
