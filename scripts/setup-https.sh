#!/usr/bin/env bash
# setup-https.sh — one-shot script to put a Docker host behind HTTPS
# using a self-signed cert and a host-level nginx reverse proxy.
#
# Run on the VM as root (or with sudo):
#
#     sudo bash scripts/setup-https.sh
#
# After it finishes, https://18.142.228.5/ works (browser will warn
# the first time because the cert is self-signed — click through once).
#
# The script is idempotent: safe to re-run.

set -euo pipefail

NGINX_CONF_SRC="$(cd "$(dirname "$0")/.." && pwd)/nginx/nginx.conf"
NGINX_SSL_DIR="/etc/nginx/ssl"
CERT_FILE="${NGINX_SSL_DIR}/selfsigned.crt"
KEY_FILE="${NGINX_SSL_DIR}/selfsigned.key"
SITE_AVAIL="/etc/nginx/sites-available/docker-microservices"
SITE_ENABLED="/etc/nginx/sites-enabled/docker-microservices"
SITE_NAME="18.142.228.5"

echo "==> Installing nginx"
apt-get update -qq
apt-get install -y -qq nginx openssl >/dev/null
systemctl enable nginx >/dev/null

echo "==> Generating self-signed cert for ${SITE_NAME} (valid 10 years)"
mkdir -p "${NGINX_SSL_DIR}"
if [ ! -f "${CERT_FILE}" ] || [ ! -f "${KEY_FILE}" ]; then
  openssl req -x509 -nodes -days 3650 \
    -newkey rsa:2048 \
    -keyout "${KEY_FILE}" \
    -out    "${CERT_FILE}" \
    -subj "/CN=${SITE_NAME}" \
    -addext "subjectAltName=IP:${SITE_NAME}" >/dev/null 2>&1
  chmod 600 "${KEY_FILE}"
  echo "    cert -> ${CERT_FILE}"
else
  echo "    cert already exists, skipping generation"
fi

echo "==> Installing nginx site config"
cp "${NGINX_CONF_SRC}" "${SITE_AVAIL}"
# Remove any conflicting default site symlinks (Debian/Ubuntu ships one)
rm -f /etc/nginx/sites-enabled/default
ln -sf "${SITE_AVAIL}" "${SITE_ENABLED}"

echo "==> Opening firewall ports 80 and 443 (ufw)"
if command -v ufw >/dev/null 2>&1; then
  ufw allow 80/tcp  >/dev/null || true
  ufw allow 443/tcp >/dev/null || true
  echo "    ufw rules added (or already present)"
else
  echo "    ufw not installed; make sure 80/443 are open in your firewall/security group"
fi

echo "==> Testing and reloading nginx"
nginx -t
systemctl reload nginx

echo
echo "Done."
echo "  Visit: https://${SITE_NAME}/"
echo "  The browser will warn about the self-signed cert — click 'Advanced'"
echo "  then 'Proceed to 18.142.228.5 (unsafe)' to continue. The connection"
echo "  is still encrypted."
echo
echo "Optional hardening: stop exposing backend ports publicly:"
echo "  sudo ufw deny 3000/tcp  sudo ufw deny 8010/tcp  sudo ufw deny 8001/tcp"
echo "  sudo ufw deny 8002/tcp  sudo ufw deny 8003/tcp"