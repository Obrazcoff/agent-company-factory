#!/usr/bin/env bash
# Деплой на nova-02 → https://c-fab.nova01.click
# Требуется: SSH Host `nova-02` в ~/.ssh/config (порт 22), на сервере каталог /opt/c-fab-app и unit c-fab-app.
#
# Переменные окружения (опционально):
#   VERIFY=1      — перед rsync выполнить локально `npm run verify` (дольше).
#   MIGRATE=1     — на сервере после `prisma generate` выполнить `prisma migrate deploy` (нужен DATABASE_URL в .env на сервере).
#   PROXY_JUMP=…  — если прямой SSH на nova-02 недоступен: например PROXY_JUMP=ubuntu@57.131.31.52
#
# См. deploy/nova02.md и deploy/c-fab-app.service.example

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SSH_HOST="${SSH_HOST:-nova-02}"
REMOTE_DIR="${REMOTE_DIR:-/opt/c-fab-app}"
NODE_VER="${NODE_VER:-20}"
RSYNC_SSH='ssh -o ConnectTimeout=30'
SSH_CMD=(ssh -o ConnectTimeout=30)
if [[ -n "${PROXY_JUMP:-}" ]]; then
  RSYNC_SSH="ssh -J ${PROXY_JUMP} -o ConnectTimeout=30"
  SSH_CMD=(ssh -J "${PROXY_JUMP}" -o ConnectTimeout=30)
fi

if [[ "${VERIFY:-0}" == "1" ]]; then
  echo "==> 0/4 npm run verify (VERIFY=1)"
  (cd "$ROOT" && npm run verify)
fi

echo "==> 1/4 rsync → ${SSH_HOST}:${REMOTE_DIR}/"
rsync -az --delete -e "$RSYNC_SSH" \
  --exclude node_modules \
  --exclude .next \
  --exclude .git \
  --exclude tsconfig.tsbuildinfo \
  --exclude .env \
  --exclude .cursor \
  --exclude .vercel \
  --exclude .planning \
  --exclude coverage \
  --exclude playwright-report \
  --exclude test-results \
  "$ROOT/" "${SSH_HOST}:${REMOTE_DIR}/"

MIGRATE_PART=""
if [[ "${MIGRATE:-0}" == "1" ]]; then
  MIGRATE_PART='set -a && . ./.env && set +a && npx prisma migrate deploy && '
fi

echo "==> 2–4/4 build + restart (Node ${NODE_VER})"
# shellcheck disable=SC2029
"${SSH_CMD[@]}" "$SSH_HOST" "export NVM_DIR=/root/.nvm && . \"\$NVM_DIR/nvm.sh\" && nvm use ${NODE_VER} && cd ${REMOTE_DIR} && npm ci && npx prisma generate && ${MIGRATE_PART}npm run build && systemctl restart c-fab-app"

echo "==> OK."
echo "    Проверка: ${SSH_CMD[*]} ${SSH_HOST} 'systemctl is-active c-fab-app && curl -sI -o /dev/null -w %{http_code} http://127.0.0.1:3010/'"
echo "    Сайт: https://c-fab.nova01.click/"
