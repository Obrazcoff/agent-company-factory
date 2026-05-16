# Current behavior — how the factory runs today

## English

**Agent Company Factory** is an architectural MVP: in-memory data, manual orchestrator ticks (no background worker).

**Real AI (LLM) — blueprint phase**

When `LLM_PROVIDER` is `openai` or `neurohub` and the corresponding env vars are set (`OPENAI_*` / `NEUROHUB_*`), **company blueprint generation** (`generateBlueprint`) calls a **real OpenAI-compatible HTTP API** (e.g. Neurohub at `NEUROHUB_BASE_URL`). That is genuine model inference to produce structured JSON (mission, KPIs, agents, initial tasks). Preflight and optional streaming/fallback are implemented for reliability.

**Not “real” yet — task runtime (default)**

During **orchestrator ticks**, agents run TypeScript role handlers. Most steps call **mock connectors** (`src/factory/connectors/mocks/`: Gmail, CRM, web search, sheets, calendar): **no real emails** or external SaaS — synthetic responses and small demo costs. What _is_ real: task state machine, approvals, budget checks, audit trail, and UI updates.

**Real LLM again — optional content tasks**

Two task kinds invoke **`ctx.llmGenerate`** (same provider as blueprint): **`llm_market_research`** (Researcher) and **`llm_social_posts`** (Outreach), usually chained with `dependsOnIndex`. Use them for missions like “analyze the cosmetics market and write 5 social posts”. The blueprint system prompt documents these kinds; the mock blueprint switches to this chain when the mission matches a simple heuristic (`isContentStudioStyleMission`). If the model returns invalid JSON, handlers use a **fallback** so runs still complete (especially with `LLM_PROVIDER=mock`).

**Deployment note**

The app server must be able to open **TCP/TLS to your LLM host** (outbound HTTPS). `ConnectTimeout` means the path from the server to that host failed, not “slow thinking”.

---

## Русский

**Agent Company Factory** — архитектурный MVP: данные в RAM, тики оркестратора только вручную (фонового воркера нет).

**Реальный ИИ (LLM) — этап чертежа**

При `LLM_PROVIDER=openai` или `neurohub` и настроенных переменных окружения (`OPENAI_*` / `NEUROHUB_*`) **генерация чертежа компании** (`generateBlueprint`) ходит по **HTTP на реальный OpenAI-compatible API** (например Neurohub, `NEUROHUB_BASE_URL`). Это настоящий вызов модели для структурированного JSON (миссия, KPI, агенты, стартовые задачи). Есть preflight и опционально stream/fallback для устойчивости.

**Пока не «боевой» — тики (по умолчанию)**

На **тиках оркестратора** агенты выполняют TS-handlers. Большинство шагов — **мок-коннекторы** (без реальных писем и внешних SaaS) — синтетика и небольшие «цены» из таблицы. Реально: очередь, апрувы, бюджет, аудит, UI.

**Снова реальный LLM — опциональные контент-задачи**

Два типа задач вызывают **`llmGenerate`** (тот же провайдер, что и чертёж): **`llm_market_research`** (Researcher) и **`llm_social_posts`** (Outreach), часто в цепочке через `dependsOnIndex` — под цели вроде «рынок косметики + 5 постов». В системном промпте чертежа эти kind описаны; mock-чертёж переключается на эту цепочку по эвристике `isContentStudioStyleMission`. При невалидном JSON от модели — **fallback**, чтобы прогон не падал (особенно при `LLM_PROVIDER=mock`).

**Про деплой**

Сервер приложения должен уметь установить **TCP/TLS до хоста LLM** (исходящий HTTPS). `ConnectTimeout` — проблема сети до шлюза, а не «долго думает модель».
