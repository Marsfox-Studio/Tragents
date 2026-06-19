import { en, type Dict } from './i18n/en.js';
import { zh } from './i18n/zh.js';

const DICTS: Record<string, Dict> = { en, zh };

export interface UILocale {
  code: string;
  label: string;
  nativeLabel: string;
}

/**
 * Interface languages tragents itself is translated into.
 * Independent of the translation source/target language list — those are
 * for content you translate; this is for the app UI.
 */
export const UI_LOCALES: readonly UILocale[] = [
  { code: 'en', label: 'English', nativeLabel: 'English' },
  { code: 'zh', label: 'Chinese (Simplified)', nativeLabel: '简体中文' },
];

function detectLocale(): string {
  if (typeof navigator === 'undefined') return 'en';
  const langs = [navigator.language, ...(navigator.languages ?? [])];
  for (const lang of langs) {
    const code = lang.toLowerCase();
    if (code.startsWith('zh')) return 'zh';
    if (code.startsWith('en')) return 'en';
  }
  return 'en';
}

function lookup(dict: Dict, key: string): string | undefined {
  const parts = key.split('.');
  let val: unknown = dict;
  for (const part of parts) {
    if (val == null || typeof val !== 'object') return undefined;
    val = (val as Record<string, unknown>)[part];
  }
  return typeof val === 'string' ? val : undefined;
}

class I18nStore {
  locale = $state<string>(detectLocale());

  t = $derived.by(() => {
    const dict = DICTS[this.locale] ?? en;
    return (key: string, vars?: Record<string, string | number>): string => {
      const raw = lookup(dict, key) ?? lookup(en, key) ?? key;
      if (!vars) return raw;
      return raw.replace(/\{(\w+)\}/g, (_match, name: string) =>
        name in vars ? String(vars[name]) : `{${name}}`,
      );
    };
  });

  setLocale(code: string) {
    if (DICTS[code]) this.locale = code;
  }

  has(code: string): boolean {
    return code in DICTS;
  }
}

export const i18n = new I18nStore();
