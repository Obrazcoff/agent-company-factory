#!/usr/bin/env bash
# Локальная проверка перед деплоем (без SSH): синтаксис скрипта + tsc.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
echo "==> bash -n scripts/deploy-nova02.sh"
bash -n scripts/deploy-nova02.sh
echo "==> npm run check"
npm run check
echo "==> preflight OK — деплой: ./scripts/deploy-nova02.sh (с Mac; при необходимости PROXY_JUMP=ubuntu@nova-03)"
