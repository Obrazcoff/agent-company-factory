# Деплой на nova-02 (`c-fab.nova01.click`)

VPS: **nova-02** (`95.215.206.161`), приложение в **`/opt/c-fab-app`**, systemd **`c-fab-app`**, upstream **`127.0.0.1:3010`**, nginx vhost **`c-fab.nova01.click`** (TLS через Let’s Encrypt, автообновление certbot).

## Node 20 и другие проекты

- **Системный** Node в `/usr/bin` по-прежнему **18.x** — мы его не трогали.
- **nvm** держит несколько версий параллельно (18, 20 и т.д.); установка **20.19.5** не удаляет 18.
- Сервис **c-fab-app** запускает `next` через **явный путь**:  
  `/root/.nvm/versions/node/v20.19.5/bin/npx` — на остальные unit’ы и **PM2** (например `n8n`) это не влияет, пока у них свой `ExecStart` / интерпретатор в ecosystem.
- Сборка на сервере делается только в интерактивных/скриптовых сессиях с `nvm use 20` (как в `scripts/deploy-nova02.sh`).

## Порядок деплоя (рекомендуемый)

1. **Локально** — коммит, `npm run verify` (по желанию).
2. **Секреты только на сервере** — файл **`/opt/c-fab-app/.env`** в rsync **не** входит. Меняй там `DATABASE_URL`, ключи LLM, при смене домена — `AUTH_URL`.
3. **Выгрузка кода** — из корня репо:
   ```bash
   ./scripts/deploy-nova02.sh
   ```
   Скрипт: `rsync` → на сервере `nvm use 20` → `npm ci` → `prisma generate` → `next build` → `systemctl restart c-fab-app`.
4. **Миграции БД** (если менялся `prisma/schema.prisma`) — один раз после деплоя на сервере:
   ```bash
   ssh nova-02 'export NVM_DIR=/root/.nvm && . "$NVM_DIR/nvm.sh" && nvm use 20 && cd /opt/c-fab-app && set -a && . ./.env && set +a && npx prisma migrate deploy'
   ```
   Либо `db push` только для dev/stage, если так договорились.
5. **Проверка** — `ssh nova-02 'systemctl status c-fab-app --no-pager'`, затем в браузере `https://c-fab.nova01.click/`.

## Откат

- Предыдущей версии кода на диске нет, если не делал бэкап каталога. Быстрый вариант: локально откатить коммит и снова `./scripts/deploy-nova02.sh`.
- Откат **только конфига**: заранее копия `cp /opt/c-fab-app/.env /root/c-fab-app.env.bak`.

## SSL

Уже настроено certbot’ом. Продление — штатный таймер certbot на сервере. Новый поддомен — отдельный выпуск сертификата по тому же шаблону, что для `bot.nova01.click`.
