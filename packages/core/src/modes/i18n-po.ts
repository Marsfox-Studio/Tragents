import type { I18nEntry } from './i18n-json.js';

/**
 * Gettext .po parser — supports the common subset used in real localization
 * workflows:
 *
 *   msgctxt "optional context"
 *   msgid "source string"
 *   msgstr "existing translation (we replace this)"
 *
 *   # Continuation strings are concatenated:
 *   msgid ""
 *   "first line\n"
 *   "second line"
 *
 *   # Comments (lines starting with `#`) are preserved verbatim.
 *
 * Plural forms are recognized, but only msgstr[0] is translated for now.
 */

export interface POEntry {
  key: string;
  msgid: string;
  msgstr: string;
  msgctxt?: string;
  msgidPlural?: string;
  startLine: number;
  endLine: number;
}

interface ParsedPO {
  entries: I18nEntry[];
  /** Original lines, used to splice translations back in. */
  lines: string[];
  /** Raw PO entries with their line ranges. */
  poEntries: POEntry[];
}

export function parsePOi18n(text: string): ParsedPO {
  const lines = text.split(/\r?\n/);
  const poEntries: POEntry[] = [];

  let i = 0;
  while (i < lines.length) {
    const line = lines[i]!;
    const trimmed = line.trim();

    if (trimmed.startsWith('msgctxt ') || trimmed.startsWith('msgid ')) {
      const entry = parseEntry(lines, i);
      if (entry) {
        poEntries.push(entry);
        i = entry.endLine + 1;
        continue;
      }
    }
    i++;
  }

  const entries: I18nEntry[] = poEntries
    .filter((p) => p.msgid !== '') // skip the gettext header entry
    .map((p) => ({
      key: p.msgctxt ? `${p.msgctxt}${p.msgid}` : p.msgid,
      source: p.msgid,
      context: p.msgctxt ?? undefined,
    }));

  return { entries, lines, poEntries };
}

function parseEntry(lines: string[], start: number): POEntry | null {
  let msgctxt: string | undefined;
  let msgid = '';
  let msgstr = '';
  let msgidPlural: string | undefined;
  let i = start;

  if (lines[i]?.trim().startsWith('msgctxt ')) {
    const parsed = parseQuotedField(lines, i, 'msgctxt');
    if (parsed) {
      msgctxt = parsed.value;
      i = parsed.endLine + 1;
    } else {
      return null;
    }
  }

  if (!lines[i]?.trim().startsWith('msgid ')) return null;
  const idParsed = parseQuotedField(lines, i, 'msgid');
  if (!idParsed) return null;
  msgid = idParsed.value;
  i = idParsed.endLine + 1;

  if (lines[i]?.trim().startsWith('msgid_plural ')) {
    const plParsed = parseQuotedField(lines, i, 'msgid_plural');
    if (plParsed) {
      msgidPlural = plParsed.value;
      i = plParsed.endLine + 1;
    }
  }

  let strParsed:
    | { value: string; endLine: number }
    | null = null;
  if (lines[i]?.trim().startsWith('msgstr ')) {
    strParsed = parseQuotedField(lines, i, 'msgstr');
  } else if (lines[i]?.trim().startsWith('msgstr[0] ')) {
    strParsed = parseQuotedField(lines, i, 'msgstr[0]');
  }
  if (!strParsed) return null;
  msgstr = strParsed.value;
  i = strParsed.endLine + 1;

  while (lines[i]?.trim().match(/^msgstr\[\d+\]\s/)) {
    const more = parseQuotedField(lines, i, lines[i]!.trim().match(/^(msgstr\[\d+\])/)![1]!);
    if (!more) break;
    i = more.endLine + 1;
  }

  return {
    key: msgctxt ? `${msgctxt}${msgid}` : msgid,
    msgid,
    msgstr,
    msgctxt,
    msgidPlural,
    startLine: start,
    endLine: i - 1,
  };
}

function parseQuotedField(
  lines: string[],
  startLine: number,
  fieldName: string,
): { value: string; endLine: number } | null {
  const first = lines[startLine];
  if (!first) return null;
  const prefix = first.trim().match(new RegExp(`^${escapeRe(fieldName)}\\s+`));
  if (!prefix) return null;
  const rest = first.trim().slice(prefix[0].length);
  if (!rest.startsWith('"')) return null;

  // First-line value
  let value = unquote(rest);
  let i = startLine + 1;

  // Continuation lines: each starts with "..."
  while (i < lines.length && lines[i]?.trim().startsWith('"')) {
    value += unquote(lines[i]!.trim());
    i++;
  }
  return { value, endLine: i - 1 };
}

function unquote(s: string): string {
  // s starts with " and ends with "
  if (!s.startsWith('"') || !s.endsWith('"')) return s;
  const inner = s.slice(1, -1);
  return inner
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, '\\');
}

function quote(s: string): string {
  return `"${s
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t')}"`;
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function serializePOi18n(
  parsed: ParsedPO,
  translations: Record<string, string>,
): string {
  // Process bottom-up so line indices stay valid.
  const lines = [...parsed.lines];
  const sorted = [...parsed.poEntries].sort((a, b) => b.startLine - a.startLine);

  for (const entry of sorted) {
    if (entry.msgid === '') continue;
    const t = translations[entry.key];
    if (t === undefined) continue;

    // Find the msgstr lines within this entry's range and replace them.
    let msgstrStart = -1;
    let msgstrEnd = -1;
    for (let i = entry.startLine; i <= entry.endLine; i++) {
      const line = lines[i]!;
      const trimmed = line.trim();
      if (trimmed.startsWith('msgstr ') || trimmed.startsWith('msgstr[0] ')) {
        msgstrStart = i;
        msgstrEnd = i;
        // Find continuation
        let j = i + 1;
        while (j <= entry.endLine && lines[j]!.trim().startsWith('"')) {
          msgstrEnd = j;
          j++;
        }
        break;
      }
    }
    if (msgstrStart < 0) continue;
    const prefix = lines[msgstrStart]!.trim().startsWith('msgstr[0] ')
      ? 'msgstr[0] '
      : 'msgstr ';
    const newLine = `${prefix}${quote(t)}`;
    lines.splice(msgstrStart, msgstrEnd - msgstrStart + 1, newLine);
  }

  return lines.join('\n');
}

export function isPOi18n(text: string): boolean {
  return /^\s*msgid\s+"/m.test(text) && /^\s*msgstr\s*(?:\[\d+\])?\s+"/m.test(text);
}
