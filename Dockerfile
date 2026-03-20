# =============================================================================
# DCS-UI — Multi-stage Docker Build
# =============================================================================
# Produces a minimal nginx:alpine container serving the SPA with API proxying.
# Build:  docker build -t dcs-ui .
# Run:    docker run -p 3000:3000 -e DCS_API_HOST=host.docker.internal -e DCS_API_PORT=9876 dcs-ui
# =============================================================================

# ---------------------------------------------------------------------------
# Stage 1 — Build the renderer (Vite + React)
# ---------------------------------------------------------------------------
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci --ignore-scripts
COPY . .
# Override vite.config base: './' with absolute '/' for server deployment
RUN npx vite build --base /

# ---------------------------------------------------------------------------
# Stage 2 — Serve with nginx
# ---------------------------------------------------------------------------
FROM nginx:alpine

LABEL org.opencontainers.image.title="DCS-UI" \
      org.opencontainers.image.description="Docker Compose Skeleton — Web Management Interface" \
      org.opencontainers.image.source="https://github.com/scotthowson/Docker-Compose-Skeleton-UI" \
      org.opencontainers.image.licenses="MIT"

COPY --from=build /app/dist/renderer /usr/share/nginx/html
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --retries=3 --start-period=10s \
  CMD wget -qO- http://127.0.0.1:3000/ || exit 1

ENTRYPOINT ["/entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]
