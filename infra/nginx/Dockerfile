# nginx + собранный фронт. Контекст сборки — корень репозитория.
# Стадия 1: фронт собирается из ./frontend (npm ci && npm run build -> dist/).
# Внутри образа — та же раскладка, что в репозитории (/repo/frontend, /repo/contracts/examples):
# моки фронта импортируют примеры контракта относительным путём ../../../contracts/examples/*.json,
# а tsc проверяет и их, хотя в собранном сайте моки выключены.
FROM node:22-alpine AS frontend
WORKDIR /repo/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY contracts/examples /repo/contracts/examples
COPY frontend/ ./
RUN npm run build

# Стадия 2: nginx с конфигом из infra/nginx и статикой фронта
FROM nginx:1.27-alpine
COPY infra/nginx/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=frontend /repo/frontend/dist /usr/share/nginx/html
