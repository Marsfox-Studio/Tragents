import { summarizerPrompt, type Language } from '@tragents/shared';
import type { Provider } from '../types.js';

export interface SummarizeOptions {
  provider: Provider;
  model: string;
  source: Language;
  target: Language;
  text: string;
  projectName?: string;
  projectDescription?: string;
  signal?: AbortSignal;
}

/**
 * Have a summarizer agent compress a long section into a short context note,
 * used as background for the translator when handling hierarchical inputs
 * larger than the model context window.
 *
 * The user picks which provider + model fills this role — never assumed.
 */
export async function summarize(opts: SummarizeOptions): Promise<string> {
  const system = summarizerPrompt({
    source: opts.source,
    target: opts.target,
    projectName: opts.projectName,
    projectDescription: opts.projectDescription,
  });

  const response = await opts.provider.complete({
    model: opts.model,
    system,
    messages: [{ role: 'user', content: opts.text }],
    temperature: 0.2,
    signal: opts.signal,
  });
  return response.text.trim();
}
