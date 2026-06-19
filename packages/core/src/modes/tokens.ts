/**
 * Rough token estimator — used to pick chunk size without calling a real
 * tokenizer. Errs on the high side so chunks stay safely within context.
 *
 * Heuristic:
 * - CJK / Hiragana / Katakana / Hangul codepoint: ~1.3 tokens each
 * - Latin / punctuation: ~0.27 tokens per char
 * - Whitespace: ~0.05 tokens per char
 *
 * Real tokenizers vary by model, but for chunk-size decisions this is good
 * enough — never trust this for billing or hard cutoffs.
 */
export function estimateTokens(text: string): number {
  let cjk = 0;
  let other = 0;
  let whitespace = 0;
  for (const ch of text) {
    const code = ch.codePointAt(0);
    if (code === undefined) continue;
    if (
      // CJK Unified Ideographs + extension blocks
      (code >= 0x3400 && code <= 0x9fff) ||
      (code >= 0x20000 && code <= 0x2ffff) ||
      // Hiragana, Katakana, half/full-width forms, CJK symbols & punctuation
      (code >= 0x3000 && code <= 0x33ff) ||
      (code >= 0xff00 && code <= 0xffef) ||
      // Hangul syllables
      (code >= 0xac00 && code <= 0xd7af)
    ) {
      cjk++;
    } else if (/\s/.test(ch)) {
      whitespace++;
    } else {
      other++;
    }
  }
  return Math.ceil(cjk * 1.3 + other * 0.27 + whitespace * 0.05);
}

/** Context window fraction we're willing to fill with input + system prompt. */
export const SAFE_CONTEXT_FRACTION = 0.4;

/** Conservative model context defaults when we don't have descriptor info. */
export const FALLBACK_CONTEXT = 128_000;
