import { consistencyPrompt, type GlossaryEntry, type Language } from '@tragents/shared';
import type { Provider } from '../types.js';

export interface ConsistencyFix {
  find: string;
  replace: string;
  note?: string;
}

export interface ConsistencyOptions {
  provider: Provider;
  model: string;
  source: Language;
  target: Language;
  /** The full assembled translation across all chunks. */
  assembled: string;
  glossary?: GlossaryEntry[];
  projectName?: string;
  projectDescription?: string;
  signal?: AbortSignal;
}

/**
 * Run a global consistency pass over an assembled translation.
 * Looks for terminology drift, character/place names, and register shifts.
 * Returns either:
 *  - a list of find/replace fixes (preferred — minimal surgery), or
 *  - the entire rewritten assembled text if the model chose to rewrite.
 *
 * We try strict-JSON first; if that fails, fall back to treating the response
 * as a rewrite.
 */
export async function consistencyCheck(
  opts: ConsistencyOptions,
): Promise<{ fixes?: ConsistencyFix[]; rewrite?: string }> {
  const system = consistencyPrompt({
    source: opts.source,
    target: opts.target,
    glossary: opts.glossary,
    projectName: opts.projectName,
    projectDescription: opts.projectDescription,
  });

  const response = await opts.provider.complete({
    model: opts.model,
    system,
    messages: [{ role: 'user', content: opts.assembled }],
    temperature: 0.1,
    signal: opts.signal,
  });

  const text = response.text.trim();
  // Try strict JSON first.
  try {
    const parsed = JSON.parse(text) as { fixes?: ConsistencyFix[] };
    if (Array.isArray(parsed.fixes)) return { fixes: parsed.fixes };
  } catch {
    // try to extract { ... fixes ... }
    const match = text.match(/\{[\s\S]*"fixes"[\s\S]*\}/);
    if (match) {
      try {
        const parsed = JSON.parse(match[0]) as { fixes?: ConsistencyFix[] };
        if (Array.isArray(parsed.fixes)) return { fixes: parsed.fixes };
      } catch {
        /* fall through */
      }
    }
  }

  // No structured fixes — treat as a rewrite if non-empty.
  return text ? { rewrite: text } : {};
}

/** Apply a list of find/replace fixes to the assembled text. */
export function applyFixes(text: string, fixes: ConsistencyFix[]): string {
  let out = text;
  for (const fix of fixes) {
    if (!fix.find) continue;
    out = out.split(fix.find).join(fix.replace);
  }
  return out;
}
