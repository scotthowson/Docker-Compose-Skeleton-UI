#!/bin/sh
# =============================================================================
# DCS-UI Container Entrypoint
# =============================================================================
# Substitutes environment variables into the nginx config at runtime.
# DCS_API_HOST and DCS_API_PORT are injected via docker-compose environment.
# =============================================================================

set -e

DCS_API_HOST="${DCS_API_HOST:-host.docker.internal}"
DCS_API_PORT="${DCS_API_PORT:-9876}"

# Replace placeholders in the nginx config
sed -i \
  -e "s|DCS_API_HOST_PLACEHOLDER|${DCS_API_HOST}|g" \
  -e "s|DCS_API_PORT_PLACEHOLDER|${DCS_API_PORT}|g" \
  /etc/nginx/conf.d/default.conf

exec "$@"
