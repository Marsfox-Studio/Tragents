import {
  translatorPrompt,
  translatorPromptWithDiscussion,
  type GlossaryEntry,
  type Language,
} from '@tragents/shared';
import type { Provider } from '../types.js';
import { createDiscussionParser } from './discussion.js';

export interface TranslateOptions {
  provider: Provider;
  model: string;
  source: Language;
  target: Language;
  text: string;
  glossary?: GlossaryEntry[];
  projectName?: string;
  projectDescription?: string;
  styleNote?: string;
  /** Excerpt of text immediately before this chunk (not translated). */
  contextBefore?: string;
  /** Excerpt of text immediately after this chunk (not translated). */
  contextAfter?: string;
  temperature?: number;
  signal?: AbortSignal;
  onDelta?: (delta: string) => void;
  /**
   * When set, use the discussion-aware prompt and route the agent's public
   * remark (the <discuss>…</discuss> block) here. The translation text returned
   * from this function strips both the discuss block and the surrounding
   * <translation> wrapper so the orchestrator can keep using it directly.
   */
  discussion?: {
    /** Short label shown to other agents (e.g. "Agent 1"). */
    agentLabel?: string;
    /** Called as soon as the public remark has been fully received. */
    onRemark: (remark: string) => void;
  };
}

export async function translate(opts: TranslateOptions): Promise<string> {
  const system = opts.discussion
    ? translatorPromptWithDiscussion(
        {
          source: opts.source,
          target: opts.target,
          glossary: opts.glossary,
          projectName: opts.projectName,
          projectDescription: opts.projectDescription,
          styleNote: opts.styleNote,
          contextBefore: opts.contextBefore,
          contextAfter: opts.contextAfter,
        },
        opts.discussion.agentLabel,
      )
    : translatorPrompt({
        source: opts.source,
        target: opts.target,
        glossary: opts.glossary,
        projectName: opts.projectName,
        projectDescription: opts.projectDescription,
        styleNote: opts.styleNote,
        contextBefore: opts.contextBefore,
        contextAfter: opts.contextAfter,
      });

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
    messages: [{ role: 'user', content: opts.text }],
    temperature: opts.temperature ?? 0.3,
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

// Discussion parser lives in ./discussion.ts and is shared with reviewer.
