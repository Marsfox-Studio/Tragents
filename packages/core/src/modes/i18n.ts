// Unified i18n dispatcher.
//
// The orchestrator only knows "this is i18n" — this module figures out which
// concrete format (JSON / YAML / PO / …) the input is, parses with the right
// parser, batches, then re-serializes back to the original format.

import type { I18nEntry } from './i18n-json.js';
import {
  batchEntries,
  parseJSONi18n,
  serializeJSONi18n,
} from './i18n-json.js';
import { isPOi18n, parsePOi18n, serializePOi18n } from './i18n-po.js';
import {
  isYAMLi18n,
  parseYAMLi18n,
  serializeYAMLi18n,
} from './i18n-yaml.js';
import {
  isAndroidXMLi18n,
  isFluentI18n,
  isIOSStringsI18n,
  isPropertiesI18n,
  parseAndroidXMLi18n,
  parseFluentI18n,
  parseIOSStringsI18n,
  parsePropertiesI18n,
  serializeExtraI18n,
} from './i18n-extra.js';

export type I18nFormat =
  | 'json'
  | 'yaml'
  | 'po'
  | 'android-xml'
  | 'ios-strings'
  | 'properties'
  | 'fluent';

export interface I18nParseResult {
  format: I18nFormat;
  entries: I18nEntry[];
  /** Opaque per-format payload used by serialize() to splice translations back. */
  payload: unknown;
}

/** Inspect input and decide which format parser to use. */
export function detectI18nFormat(text: string): I18nFormat | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      JSON.parse(trimmed);
      return 'json';
    } catch {
      /* fall through */
    }
  }
  if (isPOi18n(trimmed)) return 'po';
  if (isAndroidXMLi18n(trimmed)) return 'android-xml';
  if (isIOSStringsI18n(trimmed)) return 'ios-strings';
  if (isFluentI18n(trimmed)) return 'fluent';
  if (isPropertiesI18n(trimmed)) return 'properties';
  if (isYAMLi18n(trimmed)) return 'yaml';
  return null;
}

export function parseI18n(text: string, format?: I18nFormat): I18nParseResult {
  const fmt = format ?? detectI18nFormat(text);
  if (!fmt) {
    throw new Error(
      'i18n mode could not detect format. Supported: JSON, YAML, .po, Android XML, iOS .strings, .properties, Fluent.',
    );
  }
  switch (fmt) {
    case 'json': {
      const r = parseJSONi18n(text);
      return { format: 'json', entries: r.entries, payload: r.template };
    }
    case 'yaml': {
      const r = parseYAMLi18n(text);
      return { format: 'yaml', entries: r.entries, payload: r };
    }
    case 'po': {
      const r = parsePOi18n(text);
      return { format: 'po', entries: r.entries, payload: r };
    }
    case 'android-xml': {
      const r = parseAndroidXMLi18n(text);
      return { format: 'android-xml', entries: r.entries, payload: r };
    }
    case 'ios-strings': {
      const r = parseIOSStringsI18n(text);
      return { format: 'ios-strings', entries: r.entries, payload: r };
    }
    case 'properties': {
      const r = parsePropertiesI18n(text);
      return { format: 'properties', entries: r.entries, payload: r };
    }
    case 'fluent': {
      const r = parseFluentI18n(text);
      return { format: 'fluent', entries: r.entries, payload: r };
    }
  }
}

export function serializeI18n(
  parsed: I18nParseResult,
  translations: Record<string, string>,
): string {
  switch (parsed.format) {
    case 'json':
      return serializeJSONi18n(parsed.payload, translations);
    case 'yaml':
      return serializeYAMLi18n(parsed.payload as ReturnType<typeof parseYAMLi18n>, translations);
    case 'po':
      return serializePOi18n(parsed.payload as ReturnType<typeof parsePOi18n>, translations);
    case 'android-xml':
    case 'ios-strings':
    case 'properties':
    case 'fluent':
      return serializeExtraI18n(
        parsed.payload as
          | ReturnType<typeof parseAndroidXMLi18n>
          | ReturnType<typeof parseIOSStringsI18n>
          | ReturnType<typeof parsePropertiesI18n>
          | ReturnType<typeof parseFluentI18n>,
        translations,
      );
  }
}

export { batchEntries };
export type { I18nEntry };
