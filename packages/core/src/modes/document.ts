import type { I18nEntry } from './i18n-json.js';

interface DocLocation {
  key: string;
  source: string;
  start: number;
  end: number;
}

export interface ParsedDocument {
  format: 'markdown' | 'html' | 'latex';
  entries: I18nEntry[];
  locations: DocLocation[];
  original: string;
}

export function parseDocument(text: string): ParsedDocument {
  const trimmed = text.trim();
  if (/<[A-Za-z][\w:-]*(?:\s[^>]*)?>[\s\S]*<\/[A-Za-z][\w:-]*>/.test(trimmed)) {
    return parseHtmlDocument(text);
  }
  if (/\\(?:section|subsection|chapter|begin|end|textbf|emph)\b/.test(trimmed)) {
    return parseLatexDocument(text);
  }
  return parseMarkdownDocument(text);
}

export function serializeDocument(
  parsed: ParsedDocument,
  translations: Record<string, string>,
): string {
  let result = parsed.original;
  for (const loc of [...parsed.locations].sort((a, b) => b.start - a.start)) {
    const t = translations[loc.key];
    if (t === undefined) continue;
    result = result.slice(0, loc.start) + t + result.slice(loc.end);
  }
  return result;
}

function parseMarkdownDocument(text: string): ParsedDocument {
  const locations: DocLocation[] = [];
  const fenceRe = /```[\s\S]*?```|~~~[\s\S]*?~~~/g;
  const protectedRanges = ranges(fenceRe, text);
  const blockRe = /(^|\n)([^\n][\s\S]*?)(?=\n\s*\n|$)/g;
  let m: RegExpExecArray | null;
  while ((m = blockRe.exec(text)) !== null) {
    const block = m[2] ?? '';
    const start = m.index + (m[1]?.length ?? 0);
    const end = start + block.length;
    if (overlaps(start, end, protectedRanges)) continue;
    if (!block.trim() || /^[\s|:=-]+$/.test(block.trim())) continue;

    const lines = block.split('\n');
    if (lines.every((line) => /^\s*\|.*\|\s*$/.test(line))) {
      addMarkdownTable(locations, text, start, block);
      continue;
    }
    add(locations, start, end, block);
  }
  return toParsed('markdown', text, locations);
}

function addMarkdownTable(locations: DocLocation[], text: string, blockStart: number, block: string): void {
  let cursor = blockStart;
  for (const line of block.split('\n')) {
    const cells = [...line.matchAll(/(?<=\|)([^|]+)(?=\|)/g)];
    for (const cell of cells) {
      const raw = cell[1] ?? '';
      if (!raw.trim() || /^[-:\s]+$/.test(raw)) continue;
      const start = cursor + (cell.index ?? 0) + raw.search(/\S/);
      const source = raw.trim();
      add(locations, start, start + source.length, source);
    }
    cursor += line.length + newlineLengthAt(text, cursor + line.length);
  }
}

function parseHtmlDocument(text: string): ParsedDocument {
  const locations: DocLocation[] = [];
  const protectedRanges = ranges(/<(script|style|pre|code)\b[\s\S]*?<\/\1>/gi, text);
  const textNodeRe = />[^<]+</g;
  let m: RegExpExecArray | null;
  while ((m = textNodeRe.exec(text)) !== null) {
    if (overlaps(m.index, m.index + m[0].length, protectedRanges)) continue;
    const raw = m[0].slice(1, -1);
    if (!raw.trim()) continue;
    const leading = raw.search(/\S/);
    const trailing = raw.length - raw.trimEnd().length;
    const source = raw.trim();
    add(locations, m.index + 1 + leading, m.index + 1 + raw.length - trailing, source);
  }
  return toParsed('html', text, locations);
}

function parseLatexDocument(text: string): ParsedDocument {
  const locations: DocLocation[] = [];
  const commandArgRe = /\\(?:chapter|section|subsection|subsubsection|paragraph|textbf|emph)\*?\{([^{}]+)\}/g;
  let m: RegExpExecArray | null;
  while ((m = commandArgRe.exec(text)) !== null) {
    const source = m[1] ?? '';
    add(locations, m.index + m[0].indexOf(source), m.index + m[0].indexOf(source) + source.length, source);
  }

  const protectedRanges = ranges(/\\[A-Za-z]+\*?(?:\[[^\]]*])?(?:\{[^{}]*})?|\\.|%[^\n]*/g, text);
  const paraRe = /(^|\n)([^\n\\%][\s\S]*?)(?=\n\s*\n|$)/g;
  while ((m = paraRe.exec(text)) !== null) {
    const source = m[2] ?? '';
    const start = m.index + (m[1]?.length ?? 0);
    const end = start + source.length;
    if (!source.trim() || overlaps(start, end, protectedRanges)) continue;
    add(locations, start, end, source.trim());
  }

  return toParsed('latex', text, locations);
}

function add(locations: DocLocation[], start: number, end: number, source: string): void {
  const trimmed = source.trim();
  if (!trimmed || /^https?:\/\//.test(trimmed)) return;
  locations.push({
    key: `doc-${locations.length + 1}`,
    source: trimmed,
    start,
    end,
  });
}

function toParsed(format: ParsedDocument['format'], text: string, locations: DocLocation[]): ParsedDocument {
  return {
    format,
    entries: locations.map((l) => ({ key: l.key, source: l.source, context: `${format} document` })),
    locations,
    original: text,
  };
}

function ranges(re: RegExp, text: string): Array<{ start: number; end: number }> {
  const out: Array<{ start: number; end: number }> = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    out.push({ start: m.index, end: m.index + m[0].length });
  }
  return out;
}

function overlaps(start: number, end: number, rs: Array<{ start: number; end: number }>): boolean {
  return rs.some((r) => start < r.end && end > r.start);
}

function newlineLengthAt(text: string, index: number): number {
  if (text[index] === '\r' && text[index + 1] === '\n') return 2;
  if (text[index] === '\r' || text[index] === '\n') return 1;
  return 0;
}
