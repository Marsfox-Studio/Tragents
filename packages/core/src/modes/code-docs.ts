import type { I18nEntry } from './i18n-json.js';

interface DocLocation {
  key: string;
  source: string;
  start: number;
  end: number;
}

export interface ParsedCodeDocs {
  entries: I18nEntry[];
  locations: DocLocation[];
  original: string;
}

export function parseCodeDocs(text: string): ParsedCodeDocs {
  const locations: DocLocation[] = [];
  const taken: Array<{ start: number; end: number }> = [];

  const add = (start: number, end: number, source: string) => {
    if (!source.trim()) return;
    if (taken.some((r) => start < r.end && end > r.start)) return;
    taken.push({ start, end });
    locations.push({
      key: `doc-${locations.length + 1}`,
      source,
      start,
      end,
    });
  };

  for (const re of [/"""([\s\S]*?)"""/g, /'''([\s\S]*?)'''/g]) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const source = m[1] ?? '';
      add(m.index + 3, m.index + 3 + source.length, source);
    }
  }

  const blockRe = /\/\*([\s\S]*?)\*\//g;
  let block: RegExpExecArray | null;
  while ((block = blockRe.exec(text)) !== null) {
    const openerLength = block[0].startsWith('/**') || block[0].startsWith('/*!') ? 3 : 2;
    const source = text.slice(block.index + openerLength, block.index + block[0].length - 2);
    add(block.index + openerLength, block.index + openerLength + source.length, source);
  }

  const lineRe = /(^|[ \t])((?:\/\/!|\/\/\/|\/\/|#!?|#|--)[^\r\n]*)/gm;
  let line: RegExpExecArray | null;
  while ((line = lineRe.exec(text)) !== null) {
    const raw = line[2] ?? '';
    if (raw.startsWith('#!')) continue;
    const marker = raw.match(/^(\/\/!|\/\/\/|\/\/|#|--)\s?/)?.[0] ?? '';
    const start = line.index + (line[1]?.length ?? 0) + marker.length;
    const source = raw.slice(marker.length);
    add(start, start + source.length, source);
  }

  locations.sort((a, b) => a.start - b.start);
  return {
    entries: locations.map((l) => ({ key: l.key, source: l.source.trim(), context: 'code comment' })),
    locations,
    original: text,
  };
}

export function serializeCodeDocs(
  parsed: ParsedCodeDocs,
  translations: Record<string, string>,
): string {
  let result = parsed.original;
  for (const loc of [...parsed.locations].sort((a, b) => b.start - a.start)) {
    const t = translations[loc.key];
    if (t === undefined) continue;
    const formatted = preserveOuterWhitespace(preserveIndent(t, loc.source), loc.source);
    result = result.slice(0, loc.start) + formatted + result.slice(loc.end);
  }
  return result;
}

function preserveIndent(value: string, original: string): string {
  const indent = original.match(/\n([ \t]*\*?\s*)/)?.[1];
  if (!indent || !value.includes('\n')) return value;
  return value
    .split('\n')
    .map((line, i) => (i === 0 ? line : `${indent}${line}`))
    .join('\n');
}

function preserveOuterWhitespace(value: string, original: string): string {
  const leading = original.match(/^[ \t]+/)?.[0] ?? '';
  const trailing = original.match(/[ \t]+$/)?.[0] ?? '';
  const withLeading = leading && !/^[ \t]/.test(value) ? `${leading}${value}` : value;
  return trailing && !/[ \t]$/.test(withLeading) ? `${withLeading}${trailing}` : withLeading;
}
