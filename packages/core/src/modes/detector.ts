import type { TranslationMode } from '@tragents/shared';
import { estimateTokens } from './tokens.js';

/**
 * Pick a translation mode automatically when the user leaves mode = 'auto'.
 *
 * v0.6: this only returns `text` or `long-form` — structural detection
 * (i18n / document / code-docs / subtitles) was too eager and would route
 * a README with a JSON code block to i18n. Those modes now require an
 * explicit user pick from the mode chip.
 */
export function detectMode(text: string): Exclude<TranslationMode, 'auto'> {
  const trimmed = text.trim();
  if (!trimmed) return 'text';

  // Only escalate to long-form for genuinely big inputs.
  if (estimateTokens(trimmed) > 4000) return 'long-form';

  return 'text';
}
