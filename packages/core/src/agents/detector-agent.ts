import type { ModeKey } from '@tragents/shared';
import { detectorPrompt } from '@tragents/shared';
import type { Provider } from '../types.js';

export interface DetectModeOptions {
  provider: Provider;
  model: string;
  text: string;
  temperature?: number;
  signal?: AbortSignal;
}

export interface DetectedMode {
  mode: ModeKey;
  confidence: number;
  reason: string;
}

/**
 * Modes the detector is allowed to suggest. We deliberately exclude
 * 'document', 'code-docs', 'subtitles', and 'ptp' until their engines land —
 * suggesting a mode the user can't pick is worse than picking text/long-form.
 */
const VALID_MODES: readonly ModeKey[] = ['text', 'long-form', 'i18n'];

/**
 * Ask a model to classify a piece of input into a translation mode. Returns
 * a typed result the orchestrator can use to optionally prompt the user.
 * On any error or unparseable response, returns null — the caller should
 * fall back to the heuristic detector in `modes/detector.ts`.
 */
export async function detectModeAgent(opts: DetectModeOptions): Promise<DetectedMode | null> {
  try {
    const sample = opts.text.length > 4000 ? opts.text.slice(0, 4000) : opts.text;
    const response = await opts.provider.complete({
      model: opts.model,
      system: detectorPrompt(),
      messages: [{ role: 'user', content: sample }],
      temperature: opts.temperature ?? 0,
      signal: opts.signal,
    });

    const obj = parseJSONObject(response.text);
    if (!obj) return null;

    const mode = obj.mode;
    if (typeof mode !== 'string' || !VALID_MODES.includes(mode as ModeKey)) return null;
    const confidence = typeof obj.confidence === 'number' ? obj.confidence : 0.5;
    const reason = typeof obj.reason === 'string' ? obj.reason : '';

    return { mode: mode as ModeKey, confidence, reason };
  } catch {
    return null;
  }
}

function parseJSONObject(text: string): Record<string, unknown> | null {
  const trimmed = text.trim();
  try {
    const v = JSON.parse(trimmed);
    if (v && typeof v === 'object' && !Array.isArray(v)) return v as Record<string, unknown>;
  } catch {
    /* fall through */
  }
  const match = trimmed.match(/\{[\s\S]*\}/);
  if (match) {
    try {
      const v = JSON.parse(match[0]);
      if (v && typeof v === 'object' && !Array.isArray(v)) return v as Record<string, unknown>;
    } catch {
      /* ignore */
    }
  }
  return null;
}
