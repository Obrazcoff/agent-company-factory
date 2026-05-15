import type { Locale } from '@/i18n/constants';

/** Funny status lines while the LLM drafts a blueprint (EN). */
export const BLUEPRINT_LOADING_PHRASES_EN: readonly string[] = [
  'Warming up the processors…',
  'Assembling the dream team…',
  'Bribing the tokenizer with extra FLOPs…',
  'Convincing the CEO agent they are not middle management…',
  'Drawing boxes on a whiteboard at lightspeed…',
  'Spinning up a parallel universe where deadlines exist…',
  'Teaching Outreach not to @everyone…',
  'Negotiating KPIs with a spreadsheet zealot…',
  'Running `git blame` on the universe…',
  'Hydrating caffeinated tensors…',
  'Scheduling a meeting about meetings…',
  'Polishing the mission statement until it shines…',
  'Herding stochastic cats toward JSON…',
  'Calibrating sarcasm levels for the PM…',
  'Researcher is already three tabs deep…',
  'Ops is labeling cables nobody will ever unplug…',
  'Drafting tasks that respect your sleep schedule (maybe)…',
  'Aligning synergies in low Earth orbit…',
  'Convincing the model that “JSON only” is not a suggestion…',
  'Counting tokens so you do not have to…',
  'Backpropagating good vibes…',
  'Spinning the wheel of “who owns this task”…',
  'Linting the org chart…',
  'Running stand-up in latent space…',
  'Caching optimism, invalidating doubt…',
  'Patching reality to v1.1…',
  'Asking Legal for permission to think out loud…',
  'Compressing chaos into bullet points…',
  'Routing neurons through the scenic path…',
  'Almost there — the hamsters picked up the pace…',
  'Teaching agents the difference between Slack and sleep…',
  'Blue-sky thinking, literally…',
  'Forking timelines, merging the boring one…',
  'Stapling cloud strategy to the roadmap…',
  'Reticulating splines (classic)…',
  'Spinning up rubber ducks for debugging later…',
  'Making sure “done” means the same thing twice…',
  'Queueing brilliance… please hold…',
  'Your blueprint is loading — agents are arguing politely…',
  'Swapping buzzwords for actual deliverables…',
  'One more layer of abstraction, for flavor…',
  'Still faster than a quarterly planning cycle…',
];

/** Funny status lines while the LLM drafts a blueprint (RU). */
export const BLUEPRINT_LOADING_PHRASES_RU: readonly string[] = [
  'Прогреваем процессоры…',
  'Собираем команду мечты…',
  'Подкупаем токенайзер дополнительными FLOP-ами…',
  'Убеждаем CEO-агента, что он не middle management…',
  'Рисуем квадратики на доске со скоростью света…',
  'Поднимаем параллельную вселенную, где дедлайны реальны…',
  'Учим Outreach не писать @all…',
  'Торгуемся о KPI с фанатом таблиц…',
  'Запускаем git blame на вселенную…',
  'Гидратируем кофеиновые тензоры…',
  'Назначаем встречу про встречи…',
  'Полируем миссию, пока не блестит…',
  'Стадо стохастических котов — в сторону JSON…',
  'Калибруем сарказм для PM…',
  'Researcher уже в трёх вкладках…',
  'Ops подписывает кабели, которые никто не отключит…',
  'Чертим задачи с уважением ко сну (наверное)…',
  'Синергии на низкой орбите…',
  'Объясняем модели, что «только JSON» — не просьба…',
  'Считаем токены за вас…',
  'Бэкпропагируем хорошее настроение…',
  'Крутим колесо «чья это задача»…',
  'Линтим оргчарт…',
  'Стендап в латентном пространстве…',
  'Кэшируем оптимизм, инвалидируем сомнения…',
  'Патчим реальность до v1.1…',
  'Спрашиваем Legal, можно ли думать вслух…',
  'Сжимаем хаос в буллеты…',
  'Ведём нейроны по живописному маршруту…',
  'Почти там — хомяки ускорились…',
  'Учим агентов отличать Slack от сна…',
  'Blue-sky thinking — буквально…',
  'Форкаем таймлайны, мёржим скучный…',
  'Степлером прикрепляем облачную стратегию к роадмапу…',
  'Ретикулируем сплайны (классика)…',
  'Поднимаем резиновых уточек под будущий дебаг…',
  'Проверяем, что «готово» значит одно и то же дважды…',
  'В очереди: блеск. Подождите…',
  'Чертёж грузится — агенты спорят вежливо…',
  'Меняем buzzword-ы на что-то доставляемое…',
  'Ещё один слой абстракции — для вкуса…',
  'Всё равно быстрее квартального планирования…',
];

export function shuffleInPlace<T>(arr: T[]): void {
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const a = arr[i]!;
    const b = arr[j]!;
    arr[i] = b;
    arr[j] = a;
  }
}

/** Returns next phrase each call; shuffles again after full cycle without repeats inside a cycle. */
export function createNoRepeatPhrasePicker(locale: Locale): () => string {
  const source = locale === 'ru' ? [...BLUEPRINT_LOADING_PHRASES_RU] : [...BLUEPRINT_LOADING_PHRASES_EN];
  let order = [...source];
  shuffleInPlace(order);
  let idx = 0;
  return () => {
    if (idx >= order.length) {
      order = [...source];
      shuffleInPlace(order);
      idx = 0;
    }
    return order[idx++]!;
  };
}
