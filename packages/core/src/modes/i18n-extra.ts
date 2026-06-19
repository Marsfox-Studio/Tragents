import type { I18nEntry } from './i18n-json.js';

type Quote = '"' | "'";

interface Location {
  key: string;
  source: string;
  start: number;
  end: number;
  format: 'xml' | 'strings' | 'properties' | 'fluent';
}

export interface ParsedExtraI18n {
  entries: I18nEntry[];
  locations: Location[];
  original: string;
}

export function isAndroidXMLi18n(text: string): boolean {
  return /<resources[\s>]/.test(text) && /<(?:string|plurals|string-array)\b/.test(text);
}

export function parseAndroidXMLi18n(text: string): ParsedExtraI18n {
  const locations: Location[] = [];

  const stringRe = /<string\b([^>]*)>([\s\S]*?)<\/string>/g;
  let m: RegExpExecArray | null;
  while ((m = stringRe.exec(text)) !== null) {
    const attrs = m[1] ?? '';
    const name = attr(attrs, 'name');
    if (!name || /translatable\s*=\s*["']false["']/.test(attrs)) continue;
    const raw = m[2] ?? '';
    const start = m.index + m[0].indexOf(raw);
    locations.push({
      key: name,
      source: unescapeXml(raw),
      start,
      end: start + raw.length,
      format: 'xml',
    });
  }

  const pluralRe = /<plurals\b([^>]*)>([\s\S]*?)<\/plurals>/g;
  while ((m = pluralRe.exec(text)) !== null) {
    const name = attr(m[1] ?? '', 'name');
    if (!name) continue;
    const body = m[2] ?? '';
    const bodyStart = m.index + m[0].indexOf(body);
    const itemRe = /<item\b([^>]*)>([\s\S]*?)<\/item>/g;
    let item: RegExpExecArray | null;
    while ((item = itemRe.exec(body)) !== null) {
      const quantity = attr(item[1] ?? '', 'quantity') ?? String(locations.length);
      const raw = item[2] ?? '';
      const start = bodyStart + item.index + item[0].indexOf(raw);
      locations.push({
        key: `${name}.${quantity}`,
        source: unescapeXml(raw),
        start,
        end: start + raw.length,
        format: 'xml',
      });
    }
  }

  const arrayRe = /<string-array\b([^>]*)>([\s\S]*?)<\/string-array>/g;
  while ((m = arrayRe.exec(text)) !== null) {
    const name = attr(m[1] ?? '', 'name');
    if (!name) continue;
    const body = m[2] ?? '';
    const bodyStart = m.index + m[0].indexOf(body);
    const itemRe = /<item\b([^>]*)>([\s\S]*?)<\/item>/g;
    let idx = 0;
    let item: RegExpExecArray | null;
    while ((item = itemRe.exec(body)) !== null) {
      const raw = item[2] ?? '';
      const start = bodyStart + item.index + item[0].indexOf(raw);
      locations.push({
        key: `${name}[${idx}]`,
        source: unescapeXml(raw),
        start,
        end: start + raw.length,
        format: 'xml',
      });
      idx += 1;
    }
  }

  return toParsed(text, locations);
}

export function isIOSStringsI18n(text: string): boolean {
  return /^\s*"((?:\\.|[^"\\])*)"\s*=\s*"((?:\\.|[^"\\])*)"\s*;/m.test(text);
}

export function parseIOSStringsI18n(text: string): ParsedExtraI18n {
  const locations: Location[] = [];
  const re = /"((?:\\.|[^"\\])*)"\s*=\s*"((?:\\.|[^"\\])*)"\s*;/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const rawValue = m[2] ?? '';
    const valueStartInMatch = m[0].lastIndexOf(`"${rawValue}"`) + 1;
    const start = m.index + valueStartInMatch;
    locations.push({
      key: unescapeQuoted(m[1] ?? ''),
      source: unescapeQuoted(rawValue),
      start,
      end: start + rawValue.length,
      format: 'strings',
    });
  }
  return toParsed(text, locations);
}

export function isPropertiesI18n(text: string): boolean {
  return /^(?!\s*[#!])\s*[^:=\s][^:=]*\s*[:=]\s*.+$/m.test(text);
}

export function parsePropertiesI18n(text: string): ParsedExtraI18n {
  const locations: Location[] = [];
  for (const { line, start: lineStart } of splitLinesWithStart(text)) {
    if (!line.trim() || /^\s*[#!]/.test(line)) continue;
    const sep = findPropertiesSeparator(line);
    if (sep < 0) continue;
    const key = line.slice(0, sep).trim();
    let valueStart = sep + 1;
    while (line[valueStart] === ' ' || line[valueStart] === '\t') valueStart += 1;
    const raw = line.slice(valueStart);
    if (!key || !raw) continue;
    locations.push({
      key: unescapeProperties(key),
      source: unescapeProperties(raw),
      start: lineStart + valueStart,
      end: lineStart + line.length,
      format: 'properties',
    });
  }
  return toParsed(text, locations);
}

export function isFluentI18n(text: string): boolean {
  return /^(?!\s*[#.])\s*[A-Za-z][\w-]*\s*=\s*.+$/m.test(text);
}

export function parseFluentI18n(text: string): ParsedExtraI18n {
  const lines = splitLinesWithStart(text);
  const locations: Location[] = [];
  let currentMessage: string | undefined;

  for (let i = 0; i < lines.length; i++) {
    const { line, start } = lines[i]!;
    const attrMsg = line.match(/^(\s+)\.([\w-]+)\s*=\s*(.*)$/);
    const topMsg = line.match(/^(-?[A-Za-z][\w-]*)\s*=\s*(.*)$/);
    const msg = attrMsg ?? topMsg;
    if (!msg) {
      if (!/^\s/.test(line) && !/^\s*[#.]/.test(line)) currentMessage = undefined;
      continue;
    }

    const key =
      attrMsg && currentMessage ? `${currentMessage}.${attrMsg[2]!}` : (topMsg?.[1] ?? '');
    if (!key) continue;
    if (topMsg) currentMessage = topMsg[1]!;

    const value = attrMsg ? attrMsg[3]! : topMsg![2]!;
    const valueOffset = line.indexOf(value, line.indexOf('=') + 1);
    if (valueOffset < 0) continue;

    let endLine = i;
    while (endLine + 1 < lines.length) {
      const next = lines[endLine + 1]!.line;
      if (/^\s+/.test(next) && !/^\s*[#.]/.test(next) && !/^\s+\.[\w-]+\s*=/.test(next)) {
        endLine += 1;
      }
      else break;
    }

    const end = lines[endLine]!.start + lines[endLine]!.line.length;
    const range = trimRange(text, start + valueOffset, end);
    if (!range) continue;
    locations.push({
      key,
      source: text.slice(range.start, range.end),
      start: range.start,
      end: range.end,
      format: 'fluent',
    });
    i = endLine;
  }

  return toParsed(text, locations);
}

export function serializeExtraI18n(
  parsed: ParsedExtraI18n,
  translations: Record<string, string>,
): string {
  let result = parsed.original;
  for (const loc of [...parsed.locations].sort((a, b) => b.start - a.start)) {
    const t = translations[loc.key];
    if (t === undefined) continue;
    const value =
      loc.format === 'xml'
        ? escapeXml(t)
        : loc.format === 'strings'
          ? escapeQuoted(t, '"')
          : loc.format === 'properties'
            ? escapeProperties(t)
            : formatFluent(t, result.slice(loc.start, loc.end));
    result = result.slice(0, loc.start) + value + result.slice(loc.end);
  }
  return result;
}

function toParsed(text: string, locations: Location[]): ParsedExtraI18n {
  return {
    entries: locations.map((l) => ({
      key: l.key,
      source: l.source,
      context: l.key.replace(/[._-]/g, ' '),
    })),
    locations,
    original: text,
  };
}

function attr(attrs: string, name: string): string | undefined {
  const re = new RegExp(`${name}\\s*=\\s*(["'])(.*?)\\1`);
  return attrs.match(re)?.[2];
}

function splitLinesWithStart(text: string): Array<{ line: string; start: number }> {
  const lines: Array<{ line: string; start: number }> = [];
  let start = 0;
  while (start < text.length) {
    let end = start;
    while (end < text.length && text[end] !== '\n' && text[end] !== '\r') end++;
    lines.push({ line: text.slice(start, end), start });
    if (end >= text.length) break;
    start = end + (text[end] === '\r' && text[end + 1] === '\n' ? 2 : 1);
  }
  if (text.length === 0) lines.push({ line: '', start: 0 });
  return lines;
}

function trimRange(text: string, start: number, end: number): { start: number; end: number } | null {
  while (start < end && /\s/.test(text[start]!)) start++;
  while (end > start && /\s/.test(text[end - 1]!)) end--;
  return start < end ? { start, end } : null;
}

function findPropertiesSeparator(line: string): number {
  let escaped = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === '\\') escaped = true;
    else if (ch === '=' || ch === ':') return i;
  }
  return -1;
}

function unescapeXml(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function unescapeQuoted(s: string): string {
  return s
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .replace(/\\"/g, '"')
    .replace(/\\'/g, "'")
    .replace(/\\\\/g, '\\');
}

function escapeQuoted(s: string, quote: Quote): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(new RegExp(`\\${quote}`, 'g'), `\\${quote}`)
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
}

function unescapeProperties(s: string): string {
  return s.replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\\:/g, ':').replace(/\\=/g, '=');
}

function escapeProperties(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/\r/g, '\\r');
}

function formatFluent(value: string, original: string): string {
  if (!value.includes('\n')) return value;
  const indent = original.match(/\n(\s+)/)?.[1] ?? '    ';
  return value
    .split('\n')
    .map((line, i) => (i === 0 ? line : `${indent}${line}`))
    .join('\n');
}
