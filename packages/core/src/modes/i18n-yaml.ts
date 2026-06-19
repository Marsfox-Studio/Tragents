import type { I18nEntry } from './i18n-json.js';
import { estimateTokens } from './tokens.js';

/**
 * Minimal YAML i18n parser. Supports the subset that real-world i18n files
 * use: nested mappings, scalar string values, single/double quoted strings,
 * unquoted strings, line comments (`#`), and the `key: value` form.
 *
 * Out of scope (intentionally — these are rare in i18n files):
 * - YAML anchors / aliases
 * - flow style ([..], {..})
 * - block scalars (|, >)
 * - multi-document files (---)
 * - non-string scalars (numbers, booleans, null)
 *
 * For complex YAML, the user can convert to JSON first; the orchestrator
 * will route i18n mode to the right parser based on detection.
 */

interface Entry {
  key: string;
  source: string;
  /** byte-range in the original text we'll splice translations into. */
  start: number;
  end: number;
  /** Quote style used by the original value, preserved on serialize. */
  quote: '"' | "'" | '';
}

interface ParsedYAML {
  entries: I18nEntry[];
  /** Internal: list of locations to splice translations back into. */
  locations: Entry[];
  /** Original text used as the splice template. */
  original: string;
}

export function parseYAMLi18n(text: string): ParsedYAML {
  const lines = splitLinesWithStart(text);
  const locations: Entry[] = [];
  const stack: Array<{ indent: number; path: string }> = [];

  for (let li = 0; li < lines.length; li++) {
    const { line, start: lineStart } = lines[li]!;

    if (/^\s*$/.test(line)) continue;
    if (/^\s*#/.test(line)) continue;

    const indentMatch = line.match(/^(\s*)/);
    const indent = indentMatch ? indentMatch[1]!.length : 0;

    while (stack.length > 0 && stack[stack.length - 1]!.indent >= indent) {
      stack.pop();
    }

    const m = line.match(/^\s*([^:#\s][^:#]*?)\s*:\s*(.*?)(?:\s+#.*)?$/);
    if (!m) continue;
    const rawKey = m[1]!.trim();
    const rawVal = m[2] ?? '';

    const parentPath = stack.length > 0 ? stack[stack.length - 1]!.path : '';
    const fullPath = parentPath ? `${parentPath}.${rawKey}` : rawKey;

    if (rawVal === '') {
      stack.push({ indent, path: fullPath });
      continue;
    }

    let valStr = rawVal;
    let quote: '"' | "'" | '' = '';
    if (valStr.startsWith('"') && valStr.endsWith('"') && valStr.length >= 2) {
      quote = '"';
      valStr = unescape(valStr.slice(1, -1));
    } else if (valStr.startsWith("'") && valStr.endsWith("'") && valStr.length >= 2) {
      quote = "'";
      valStr = valStr.slice(1, -1).replace(/''/g, "'");
    }

    const valIdxInLine = line.indexOf(rawVal, line.indexOf(':') + 1);
    if (valIdxInLine < 0) continue;
    const start = lineStart + valIdxInLine;
    const end = start + rawVal.length;

    locations.push({ key: fullPath, source: valStr, start, end, quote });
  }

  const entries: I18nEntry[] = locations.map((l) => ({
    key: l.key,
    source: l.source,
    context: prettifyContext(l.key),
  }));

  return { entries, locations, original: text };
}

function splitLinesWithStart(text: string): Array<{ line: string; start: number }> {
  const lines: Array<{ line: string; start: number }> = [];
  let start = 0;

  while (start < text.length) {
    let end = start;
    while (end < text.length && text[end] !== '\n' && text[end] !== '\r') {
      end++;
    }

    const line = text.slice(start, end);
    lines.push({ line, start });

    if (end >= text.length) break;
    const newlineLength = text[end] === '\r' && text[end + 1] === '\n' ? 2 : 1;
    start = end + newlineLength;
  }

  if (text.length === 0) lines.push({ line: '', start: 0 });
  return lines;
}

export function serializeYAMLi18n(
  parsed: ParsedYAML,
  translations: Record<string, string>,
): string {
  // Process from end to start so earlier offsets stay valid.
  const sorted = [...parsed.locations].sort((a, b) => b.start - a.start);
  let result = parsed.original;
  for (const loc of sorted) {
    const t = translations[loc.key];
    if (t === undefined) continue;
    const formatted =
      loc.quote === '"'
        ? `"${escape(t)}"`
        : loc.quote === "'"
          ? `'${t.replace(/'/g, "''")}'`
          : t;
    result = result.slice(0, loc.start) + formatted + result.slice(loc.end);
  }
  return result;
}

function unescape(s: string): string {
  return s
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, '\\');
}

function escape(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '\\r');
}

function prettifyContext(path: string): string | undefined {
  if (!path) return undefined;
  return path
    .split('.')
    .flatMap((part) => part.split(/(?=[A-Z])|_|-/))
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

export function isYAMLi18n(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  if (/^[{[]/.test(trimmed)) return false;
  if (/^msgid\s/m.test(trimmed)) return false;
  return /^\s*[A-Za-z_][\w.-]*\s*:\s*/m.test(trimmed);
}

export type { Entry as YAMLEntry };
export { estimateTokens };
