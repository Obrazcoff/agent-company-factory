# Деплой на nova-02 (`c-fab.nova01.click`)

VPS: **nova-02** (`95.215.206.161`), приложение в **`/opt/c-fab-app`**, systemd **`c-fab-app`**, upstream **`127.0.0.1:3010`**, nginx vhost **`c-fab.nova01.click`** (TLS через Let’s Encrypt, автообновление certbot).

## Node 20 и другие проекты

- **Системный** Node в `/usr/bin` по-прежнему **18.x** — мы его не трогали.
- **nvm** держит несколько версий параллельно (18, 20 и т.д.); установка **20.19.5** не удаляет 18.
- Сервис **c-fab-app** запускает `next` через **явный путь**:  
  `/root/.nvm/versions/node/v20.19.5/bin/npx` — на остальные unit’ы и **PM2** (например `n8n`) это не влияет, пока у них свой `ExecStart` / интерпретатор в ecosystem.
- Сборка на сервере делается только в интерактивных/скриптовых сессиях с `nvm use 20` (как в `scripts/deploy-nova02.sh`).

## Исходники

Публичный репозиторий: **[github.com/Obrazcoff/agent-company-factory](https://github.com/Obrazcoff/agent-company-factory)**. На новом сервере можно один раз `git clone` в `/opt/c-fab-app`, дальше деплой — `git pull` + те же шаги сборки и `systemctl restart c-fab-app` (`.env` по-прежнему не в git).

## Порядок деплоя (рекомендуемый)

1. **Локально** — коммит, `npm run verify` (по желанию).
2. **Секреты только на сервере** — файл **`/opt/c-fab-app/.env`** в rsync **не** входит. Меняй там `DATABASE_URL`, ключи LLM, при смене домена — `AUTH_URL`.
3. **Выгрузка кода** — из корня репо:
   ```bash
   ./scripts/deploy-nova02.sh
   ```
   Скрипт: `rsync` → на сервере `nvm use 20` → `npm ci` → `prisma generate` → `next build` → `systemctl restart c-fab-app`.
4. **База данных** — после первого деплоя с непустым `DATABASE_URL` см. раздел «База данных» ниже (`prisma migrate deploy`).
5. **Проверка** — `ssh nova-02 'systemctl status c-fab-app --no-pager'`, затем в браузере `https://c-fab.nova01.click/`.

## База данных (Neon / Postgres)

В репозитории есть начальная миграция **`prisma/migrations/20260514230000_init/`** (таблицы User, Workspace, Project, привязки, LlmProfile).

1. В [Neon](https://console.neon.tech) создай проект и скопируй **Connection string** (для serverless лучше **pooled** URI, с `sslmode=require` если не добавлен автоматически).
2. В **`/opt/c-fab-app/.env`** на сервере (и в локальном `.env` для разработки) задай одну строку без кавычек:
   ```bash
   DATABASE_URL=postgresql://...neon.tech/neondb?sslmode=require
   ```
3. Применить схему на базе (на сервере, после того как `DATABASE_URL` непустой):
   ```bash
   ssh nova-02 'export NVM_DIR=/root/.nvm && . "$NVM_DIR/nvm.sh" && nvm use 20 && cd /opt/c-fab-app && set -a && . ./.env && set +a && npx prisma migrate deploy'
   ```
4. Перезапуск приложения: `ssh nova-02 'systemctl restart c-fab-app'`.

Пока `DATABASE_URL` пустой, Prisma на сервере миграции не применит — это нормально.

## Проверить, что `.env` на сервере есть

С локальной машины (ничего секретного не печатает):

```bash
ssh nova-02 'test -f /opt/c-fab-app/.env && echo OK || echo MISSING'
```

Посмотреть **только имена** переменных (без значений):

```bash
ssh nova-02 "grep -E '^[A-Z_]+=' /opt/c-fab-app/.env | cut -d= -f1"
```

## Откат

- Предыдущей версии кода на диске нет, если не делал бэкап каталога. Быстрый вариант: локально откатить коммит и снова `./scripts/deploy-nova02.sh`.
- Откат **только конфига**: заранее копия `cp /opt/c-fab-app/.env /root/c-fab-app.env.bak`.

## SSL

Уже настроено certbot’ом. Продление — штатный таймер certbot на сервере. Новый поддомен — отдельный выпуск сертификата по тому же шаблону, что для `bot.nova01.click`.
