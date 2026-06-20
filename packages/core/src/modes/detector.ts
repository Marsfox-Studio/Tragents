import type { TranslationMode } from '@tragents/shared';
import { estimateTokens } from './tokens.js';

/**
 * Pick a translation mode automatically when the user leaves mode = 'auto'.
 */
export function detectMode(text: string): Exclude<TranslationMode, 'auto'> {
  const trimmed = text.trim();
  if (!trimmed) return 'text';

  const withoutFences = stripFencedBlocks(trimmed);

  if (looksLikeI18nResource(trimmed)) return 'i18n';
  if (looksLikeSubtitles(trimmed)) return 'subtitles';
  if (looksLikeCodeDocs(trimmed)) return 'code-docs';
  if (looksLikeDocument(trimmed, withoutFences)) return 'document';
  if (estimateTokens(trimmed) > 4000) return 'long-form';

  return 'text';
}

function stripFencedBlocks(text: string): string {
  return text.replace(/```[\s\S]*?```|~~~[\s\S]*?~~~/g, '\n');
}

function looksLikeI18nResource(text: string): boolean {
  if (/^msgid\s+"/m.test(text) && /^msgstr\s+"/m.test(text)) return true;
  if (/^<\?xml[\s\S]*<resources\b[\s\S]*<string\b/i.test(text)) return true;
  if (/^\s*"[A-Za-z0-9_.-]+"\s*=\s*".*";\s*$/m.test(text)) return true;
  if (/^[A-Za-z][\w.-]*\s*=\s*.+$/m.test(text) && countMatches(text, /^[A-Za-z][\w.-]*\s*=/gm) >= 3) {
    return true;
  }

  const parsed = parseJsonObject(text);
  if (parsed) {
    const stats = jsonStats(parsed);
    return stats.strings >= 2 && stats.objects <= Math.max(1, stats.strings * 2);
  }

  const yamlPairs = countMatches(text, /^\s*[A-Za-z_][\w.-]*\s*:\s*(["'][^"']+["']|[^\s#][^\n#]*)\s*$/gm);
  return yamlPairs >= 3 && !looksLikeMarkdown(text);
}

function looksLikeSubtitles(text: string): boolean {
  if (/^WEBVTT\b/.test(text)) return true;
  return /\d{2}:\d{2}:\d{2}[,.]\d{3}\s+-->\s+\d{2}:\d{2}:\d{2}[,.]\d{3}/.test(text);
}

function looksLikeCodeDocs(text: string): boolean {
  const codeSignals = [
    /\b(function|class|interface|type|const|let|var)\s+[A-Za-z_$][\w$]*/m,
    /\b(def|class)\s+[A-Za-z_][\w_]*\s*\(/m,
    /\b(func|package)\s+[A-Za-z_][\w_]*/m,
    /\b(fn|struct|enum|impl)\s+[A-Za-z_][\w_]*/m,
  ].filter((re) => re.test(text)).length;
  if (codeSignals === 0) return false;
  return /\/\*\*?[\s\S]*?\*\/|\/\/\s+\S|#\s+\S|"""[\s\S]*?"""|'''[\s\S]*?'''/.test(text);
}

function looksLikeDocument(text: string, withoutFences = stripFencedBlocks(text)): boolean {
  if (/```[\s\S]*?```|~~~[\s\S]*?~~~/.test(text)) return true;
  if (/<[A-Za-z][\w:-]*(?:\s[^>]*)?>[\s\S]*<\/[A-Za-z][\w:-]*>/.test(text)) return true;
  if (/\\(?:documentclass|chapter|section|subsection|begin|end|textbf|emph)\b/.test(text)) return true;
  return looksLikeMarkdown(withoutFences);
}

function looksLikeMarkdown(text: string): boolean {
  const structureLines = countMarkdownStructureLines(text);
  const signals = [
    /^#{1,6}\s+\S/m,
    /^[-*+]\s+\S/m,
    /^[-*+]\s+\[[ xX]\]\s+\S/m,
    /^\d+\.\s+\S/m,
    /^>\s+\S/m,
    /\[[^\]]+]\([^)]+\)/,
    /!\[[^\]]*]\([^)]+\)/,
    /^\s*\|.+\|\s*$/m,
    /^---\s*$/m,
  ].filter((re) => re.test(text)).length;
  return (
    signals >= 1 &&
    (signals >= 2 || structureLines >= 2 || countParagraphs(text) >= 2 || estimateTokens(text) > 600)
  );
}

function countMarkdownStructureLines(text: string): number {
  const lines = text.split(/\r?\n/);
  return lines.filter((line) =>
    /^(\s{0,3}(#{1,6}\s+|[-*+]\s+|[-*+]\s+\[[ xX]\]\s+|\d+\.\s+|>\s+|\|.*\|)|\s*---\s*$)/.test(
      line,
    ),
  ).length;
}

function countMatches(text: string, re: RegExp): number {
  return [...text.matchAll(re)].length;
}

function countParagraphs(text: string): number {
  return text.split(/\n\s*\n/).filter((p) => p.trim()).length;
}

function parseJsonObject(text: string): unknown | null {
  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function jsonStats(value: unknown): { strings: number; objects: number } {
  if (typeof value === 'string') return { strings: 1, objects: 0 };
  if (!value || typeof value !== 'object') return { strings: 0, objects: 0 };
  let strings = 0;
  let objects = 1;
  for (const child of Object.values(value as Record<string, unknown>)) {
    const stats = jsonStats(child);
    strings += stats.strings;
    objects += stats.objects;
  }
  return { strings, objects };
}
