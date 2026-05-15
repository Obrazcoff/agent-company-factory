# Current behavior — how the factory runs today

## English

**Agent Company Factory** is an architectural MVP: in-memory data, manual orchestrator ticks (no background worker).

**Real AI (LLM) — blueprint phase**

When `LLM_PROVIDER` is `openai` or `neurohub` and the corresponding env vars are set (`OPENAI_*` / `NEUROHUB_*`), **company blueprint generation** (`generateBlueprint`) calls a **real OpenAI-compatible HTTP API** (e.g. Neurohub at `NEUROHUB_BASE_URL`). That is genuine model inference to produce structured JSON (mission, KPIs, agents, initial tasks). Preflight and optional streaming/fallback are implemented for reliability.

**Not “real” yet — task runtime**

During **orchestrator ticks**, agents run TypeScript role handlers that call **mock connectors** (`src/factory/connectors/mocks/`: Gmail, CRM, web search, sheets, calendar). So: **no real emails**, no real CRM/Google APIs — synthetic responses and small demo costs from the internal cost table. What *is* real: task state machine, approvals, budget checks, audit trail, and UI updates.

**Deployment note**

The app server must be able to open **TCP/TLS to your LLM host** (outbound HTTPS). `ConnectTimeout` means the path from the server to that host failed, not “slow thinking”.

---

## Русский

**Agent Company Factory** — архитектурный MVP: данные в RAM, тики оркестратора только вручную (фонового воркера нет).

**Реальный ИИ (LLM) — этап чертежа**

При `LLM_PROVIDER=openai` или `neurohub` и настроенных переменных окружения (`OPENAI_*` / `NEUROHUB_*`) **генерация чертежа компании** (`generateBlueprint`) ходит по **HTTP на реальный OpenAI-compatible API** (например Neurohub, `NEUROHUB_BASE_URL`). Это настоящий вызов модели для структурированного JSON (миссия, KPI, агенты, стартовые задачи). Есть preflight и опционально stream/fallback для устойчивости.

**Пока не «боевой» — выполнение задач**

На **тиках оркестратора** агенты выполняют TS-handlers и вызывают **мок-коннекторы** (`src/factory/connectors/mocks/`: Gmail, CRM, поиск, таблицы, календарь). То есть **реальных писем и внешних SaaS нет** — синтетические ответы и небольшие «цены» из внутренней таблицы. Реально работают: очередь задач, апрувы, бюджет, аудит, обновление UI.

**Про деплой**

Сервер приложения должен уметь установить **TCP/TLS до хоста LLM** (исходящий HTTPS). `ConnectTimeout` — проблема сети до шлюза, а не «долго думает модель».
