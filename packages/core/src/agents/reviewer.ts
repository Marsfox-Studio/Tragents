import {
  reviewerPrompt,
  reviewerPromptWithDiscussion,
  type GlossaryEntry,
  type Language,
} from '@tragents/shared';
import type { Provider } from '../types.js';
import { createDiscussionParser } from './discussion.js';

export interface ReviewOptions {
  provider: Provider;
  model: string;
  source: Language;
  target: Language;
  /** The original source text the candidate was translated from. */
  original: string;
  /** The candidate translation produced by a Translator agent. */
  candidate: string;
  glossary?: GlossaryEntry[];
  projectName?: string;
  projectDescription?: string;
  styleNote?: string;
  temperature?: number;
  signal?: AbortSignal;
  onDelta?: (delta: string) => void;
  /** Optional discussion-mode hook — same contract as translator.ts. */
  discussion?: {
    agentLabel?: string;
    onRemark: (remark: string) => void;
  };
}

/**
 * Have a reviewer agent inspect a candidate translation and return either the
 * unchanged candidate (if good) or a corrected version. Reviewer output
 * replaces the candidate downstream.
 */
export async function review(opts: ReviewOptions): Promise<string> {
  const system = opts.discussion
    ? reviewerPromptWithDiscussion(
        {
          source: opts.source,
          target: opts.target,
          glossary: opts.glossary,
          projectName: opts.projectName,
          projectDescription: opts.projectDescription,
          styleNote: opts.styleNote,
        },
        opts.discussion.agentLabel,
      )
    : reviewerPrompt({
        source: opts.source,
        target: opts.target,
        glossary: opts.glossary,
        projectName: opts.projectName,
        projectDescription: opts.projectDescription,
        styleNote: opts.styleNote,
      });

  const userMessage =
    `SOURCE:\n${opts.original}\n\nCANDIDATE TRANSLATION:\n${opts.candidate}\n\nReturn only the final translation text.`;

  let raw = '';
  const parser = opts.discussion
    ? createDiscussionParser({
        onRemark: opts.discussion.onRemark,
        onTranslationDelta: opts.onDelta,
      })
    : null;

  for await (const chunk of opts.provider.stream({
    model: opts.model,
    system,
    messages: [{ role: 'user', content: userMessage }],
    temperature: opts.temperature ?? 0.2,
    signal: opts.signal,
  })) {
    if (chunk.delta) {
      raw += chunk.delta;
      if (parser) {
        parser.push(chunk.delta);
      } else {
        opts.onDelta?.(chunk.delta);
      }
    }
  }
  if (parser) {
    parser.end();
    return parser.translation().trim();
  }
  return raw.trim();
}
