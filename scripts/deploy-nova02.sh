#!/usr/bin/env bash
# Деплой на nova-02 → https://c-fab.nova01.click
# Требуется: SSH Host `nova-02` в ~/.ssh/config, каталог на сервере /opt/c-fab-app.
#
# Порядок (см. deploy/nova02.md):
#   1) rsync исходников (без .env — секреты только на сервере)
#   2) Node 20 (nvm) — нужен для Next 15 + Tailwind v4 / @tailwindcss/oxide
#   3) npm ci → prisma generate → next build
#   4) systemctl restart c-fab-app
#
# После смены схемы Prisma один раз на сервере:
#   npx prisma migrate deploy   # см. deploy/nova02.md

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REMOTE_DIR=/opt/c-fab-app
NODE_VER=20

echo "==> 1/4 rsync → nova-02:${REMOTE_DIR}"
rsync -az --delete \
  --exclude node_modules \
  --exclude .next \
  --exclude .git \
  --exclude tsconfig.tsbuildinfo \
  --exclude .env \
  --exclude .cursor \
  "$ROOT/" "nova-02:${REMOTE_DIR}/"

echo "==> 2–4/4 build + restart (Node ${NODE_VER})"
ssh nova-02 "export NVM_DIR=/root/.nvm && . \"\$NVM_DIR/nvm.sh\" && nvm use ${NODE_VER} && cd ${REMOTE_DIR} && npm ci && npx prisma generate && npm run build && systemctl restart c-fab-app"

echo "==> OK. Проверка: ssh nova-02 'systemctl is-active c-fab-app && curl -sI -o /dev/null -w %{http_code} http://127.0.0.1:3010/'"
