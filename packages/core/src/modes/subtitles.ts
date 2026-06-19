import type { I18nEntry } from './i18n-json.js';

interface CueLocation {
  key: string;
  source: string;
  start: number;
  end: number;
}

export interface ParsedSubtitles {
  format: 'srt' | 'vtt';
  entries: I18nEntry[];
  locations: CueLocation[];
  original: string;
}

export function isSubtitles(text: string): boolean {
  return /-->\s*\d{2}:\d{2}/.test(text) || /\d{2}:\d{2}:\d{2}[,.]\d{3}\s*-->/.test(text);
}

export function parseSubtitles(text: string): ParsedSubtitles {
  const format = /^\s*WEBVTT\b/.test(text) ? 'vtt' : 'srt';
  const lines = splitLinesWithStart(text);
  const locations: CueLocation[] = [];
  let i = 0;
  let cue = 0;

  while (i < lines.length) {
    if (!lines[i]!.line.includes('-->')) {
      i++;
      continue;
    }

    let textStartLine = i + 1;
    if (textStartLine >= lines.length) break;
    let textEndLine = textStartLine;
    while (textEndLine < lines.length && lines[textEndLine]!.line.trim() !== '') {
      textEndLine++;
    }
    if (textEndLine === textStartLine) {
      i = textEndLine + 1;
      continue;
    }

    const start = lines[textStartLine]!.start;
    const last = lines[textEndLine - 1]!;
    const end = last.start + last.line.length;
    const source = text.slice(start, end).trim();
    if (source) {
      cue += 1;
      locations.push({ key: `cue-${cue}`, source, start, end });
    }
    i = textEndLine + 1;
  }

  return {
    format,
    entries: locations.map((l) => ({ key: l.key, source: l.source, context: 'subtitle cue' })),
    locations,
    original: text,
  };
}

export function serializeSubtitles(
  parsed: ParsedSubtitles,
  translations: Record<string, string>,
): string {
  let result = parsed.original;
  for (const loc of [...parsed.locations].sort((a, b) => b.start - a.start)) {
    const t = translations[loc.key];
    if (t === undefined) continue;
    result = result.slice(0, loc.start) + t.trim() + result.slice(loc.end);
  }
  return result;
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

