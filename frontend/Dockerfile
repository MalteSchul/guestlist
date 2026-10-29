FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# The commit, for the settings page; CI passes it (there's no .git in this context).
ARG GIT_SHA=""
RUN npm run build

FROM nginx:1.30-alpine
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
# Overridden per environment; this matches the compose service name.
ENV BACKEND_URL=http://backend:8000
