import type { Locale } from './constants';
import en from './messages/en.json';
import ru from './messages/ru.json';

export type Messages = typeof en;

const dict: Record<Locale, Messages> = { en, ru };

export function getDictionary(locale: Locale): Messages {
  return dict[locale] ?? dict.en;
}

function getNested(obj: unknown, path: string): unknown {
  const parts = path.split('.');
  let cur: unknown = obj;
  for (const p of parts) {
    if (cur !== null && typeof cur === 'object' && p in cur) cur = (cur as Record<string, unknown>)[p];
    else return undefined;
  }
  return cur;
}

export function createTranslator(messages: Messages) {
  const root = messages as unknown as Record<string, unknown>;
  return (key: string, vars?: Record<string, string>): string => {
    const raw = getNested(root, key);
    if (typeof raw !== 'string') return key;
    let out = raw;
    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        out = out.replaceAll(`{{${k}}}`, v);
      }
    }
    return out;
  };
}

export type TranslateFn = ReturnType<typeof createTranslator>;
