import { estimateTokens } from './tokens.js';

export interface I18nEntry {
  /** Dotted path into the JSON tree. */
  key: string;
  source: string;
  /** Optional hint inferred from the key path (e.g. "menu.file.open"). */
  context?: string;
}

/**
 * Parse a JSON i18n document into a flat list of (key, source) tuples
 * plus a template that preserves the original shape for re-serialization.
 *
 * Numbers, booleans, and `null` are left untouched in the template.
 * Only strings become translatable entries.
 */
export function parseJSONi18n(text: string): { entries: I18nEntry[]; template: unknown } {
  const obj = JSON.parse(text);
  const entries: I18nEntry[] = [];

  const walk = (node: unknown, path: string) => {
    if (typeof node === 'string') {
      entries.push({ key: path, source: node, context: prettifyContext(path) });
      return;
    }
    if (Array.isArray(node)) {
      node.forEach((item, i) => walk(item, `${path}[${i}]`));
      return;
    }
    if (node && typeof node === 'object') {
      for (const [k, v] of Object.entries(node)) {
        walk(v, path ? `${path}.${k}` : k);
      }
    }
  };

  walk(obj, '');
  return { entries, template: obj };
}

function prettifyContext(path: string): string | undefined {
  if (!path) return undefined;
  // Strip array indices and split into words. "menu.file.openRecent" → "menu file open recent"
  return path
    .replace(/\[\d+\]/g, '')
    .split('.')
    .flatMap((part) => part.split(/(?=[A-Z])|_|-/))
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

/**
 * Group entries into batches that fit within a token budget so each batch is
 * a single LLM call. Per-string token overhead accounts for key + JSON quoting.
 */
export function batchEntries(entries: I18nEntry[], maxBatchTokens = 4000): I18nEntry[][] {
  const batches: I18nEntry[][] = [];
  let current: I18nEntry[] = [];
  let tokens = 0;
  for (const entry of entries) {
    const cost = estimateTokens(entry.source) + estimateTokens(entry.key) + 6;
    if (current.length > 0 && tokens + cost > maxBatchTokens) {
      batches.push(current);
      current = [];
      tokens = 0;
    }
    current.push(entry);
    tokens += cost;
  }
  if (current.length > 0) batches.push(current);
  return batches;
}

/**
 * Walk a JSON template and set values from a translations map.
 * Missing keys keep their source value (translator may have skipped them).
 */
export function serializeJSONi18n(
  template: unknown,
  translations: Record<string, string>,
  indent = 2,
): string {
  const cloned = structuredClone(template);
  applyTranslations(cloned, '', translations);
  return JSON.stringify(cloned, null, indent);
}

function applyTranslations(node: unknown, path: string, translations: Record<string, string>): unknown {
  if (typeof node === 'string') {
    return Object.prototype.hasOwnProperty.call(translations, path) ? translations[path] : node;
  }
  if (Array.isArray(node)) {
    for (let i = 0; i < node.length; i++) {
      node[i] = applyTranslations(node[i], `${path}[${i}]`, translations);
    }
    return node;
  }
  if (node && typeof node === 'object') {
    const record = node as Record<string, unknown>;
    for (const key of Object.keys(record)) {
      const childPath = path ? `${path}.${key}` : key;
      record[key] = applyTranslations(record[key], childPath, translations);
    }
  }
  return node;
}

/**
 * Strict placeholder validator. If the source had `{0}`, `%s`, `{{name}}`,
 * `<a>`, etc., the translation must contain the same set (order can vary).
 *
 * Returns the list of missing placeholders, empty if OK.
 */
export function validatePlaceholders(source: string, translation: string): string[] {
  const patterns = [
    /\{[a-zA-Z_$][\w$]*\}/g, // {name}
    /\{\{[^}]+\}\}/g, // {{var}}
    /\{\d+\}/g, // {0}
    /%[sd]/g, // %s %d
    /%\d+\$[sd]/g, // %1$s
    /<\/?[a-zA-Z][\w-]*[^>]*>/g, // <tag>
    /<xliff:g[^>]*>[^<]*<\/xliff:g>/g, // Android xliff
  ];

  const missing: string[] = [];
  for (const re of patterns) {
    const srcMatches = source.match(re) ?? [];
    const trnMatches = translation.match(re) ?? [];
    const srcMap = new Map<string, number>();
    const trnMap = new Map<string, number>();
    for (const s of srcMatches) srcMap.set(s, (srcMap.get(s) ?? 0) + 1);
    for (const t of trnMatches) trnMap.set(t, (trnMap.get(t) ?? 0) + 1);
    for (const [k, n] of srcMap) {
      if ((trnMap.get(k) ?? 0) < n) missing.push(k);
    }
  }
  return missing;
}
