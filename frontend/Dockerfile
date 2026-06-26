# Build stage
FROM node:20-alpine AS build

WORKDIR /app

# Install deps in two passes for better layer caching:
#   1. Only production deps (rarely change).
#   2. Add dev deps (vite/tailwind/postcss) needed for the build.
# This way, code-only changes don't bust the deps cache layer.
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev --no-audit --no-fund
RUN npm ci --no-audit --no-fund

# Copy source and build
COPY . .
RUN npm run build

# Runtime stage: Nginx serves the static bundle
FROM nginx:1.27-alpine

# Nginx config: SPA fallback + /api reverse proxy to FastAPI services
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Static assets from Vite build
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]