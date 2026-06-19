import type {
  AgentConfig,
  GlossaryEntry,
  Language,
  ProviderConfig,
  TranslationMode,
} from '@tragents/shared';
import { i18nBatchPrompt } from '@tragents/shared';
import type { Provider } from '../types.js';
import { createProvider } from '../providers/registry.js';
import {
  chunk,
  detectMode,
  parseI18n,
  serializeI18n,
  batchEntries,
  validatePlaceholders,
  parseCodeDocs,
  serializeCodeDocs,
  parseSubtitles,
  serializeSubtitles,
  parseDocument,
  serializeDocument,
} from '../modes/index.js';
import { translate } from './translator.js';
import { review } from './reviewer.js';
import { consistencyCheck, applyFixes } from './consistency.js';
import { summarize } from './summarizer.js';

export type OrchestratorEvent =
  | { type: 'mode'; mode: Exclude<TranslationMode, 'auto'> }
  | {
      type: 'phase';
      phase:
        | 'chunk'
        | 'parse'
        | 'summarize'
        | 'translate'
        | 'review'
        | 'consistency'
        | 'assemble';
    }
  | { type: 'progress'; current: number; total: number; label?: string }
  | { type: 'agentStart'; agentId: string; role: AgentConfig['role']; chunkIndex?: number }
  | { type: 'delta'; agentId: string; delta: string; chunkIndex?: number }
  | { type: 'agentDone'; agentId: string; output: string; chunkIndex?: number }
  /**
   * One short public remark from a participating agent. Emitted only when the
   * pipeline includes >1 conversational agent (so the user has someone to
   * "watch chat" about). Consumers should render in a Gemini-mobile-style
   * chat stream — see apps/web/src/lib/components/DiscussionStream.svelte.
   */
  | {
      type: 'discussionTurn';
      agentId: string;
      agentLabel: string;
      role: 'translator' | 'reviewer';
      text: string;
      chunkIndex?: number;
    }
  | { type: 'done'; output: string }
  | { type: 'error'; error: string };

export interface PipelineInput {
  mode: TranslationMode;
  text: string;
  source: Language;
  target: Language;
  agents: AgentConfig[];
  providers: ProviderConfig[];
  glossary?: GlossaryEntry[];
  projectName?: string;
  projectDescription?: string;
  styleNote?: string;
  signal?: AbortSignal;
  onEvent?: (event: OrchestratorEvent) => void;
}

/**
 * Route an input through the right mode-specific pipeline and emit progress
 * events as it goes. All agents (translator, reviewer, consistency,
 * summarizer) are taken from the caller's agent list — no role is
 * hard-coded to a particular provider or model.
 */
export async function runPipeline(input: PipelineInput): Promise<string> {
  const emit = (e: OrchestratorEvent) => input.onEvent?.(e);

  try {
    const resolved =
      input.mode === 'auto' ? detectMode(input.text) : (input.mode as Exclude<TranslationMode, 'auto'>);
    emit({ type: 'mode', mode: resolved });

    switch (resolved) {
      case 'text':
        return await runText(input, emit);
      case 'long-form':
        return await runLongForm(input, emit);
      case 'i18n':
        return await runI18n(input, emit);
      case 'document':
        return await runDocument(input, emit);
      case 'code-docs':
        return await runCodeDocs(input, emit);
      case 'subtitles':
        return await runSubtitles(input, emit);
      case 'ptp':
        return await runLongForm(input, emit);
      default: {
        const exhaustive: never = resolved;
        throw new Error(`Unknown mode: ${String(exhaustive)}`);
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    emit({ type: 'error', error: message });
    throw err;
  }
}

function getProvider(input: PipelineInput, providerId: string): Provider {
  const cfg = input.providers.find((p) => p.id === providerId);
  if (!cfg) throw new Error(`Provider "${providerId}" is not configured.`);
  return createProvider(cfg);
}

function getAgentsByRole(input: PipelineInput, role: AgentConfig['role']): AgentConfig[] {
  return input.agents.filter((a) => a.role === role);
}

function requireFirstAgent(input: PipelineInput, role: AgentConfig['role']): AgentConfig {
  const list = getAgentsByRole(input, role);
  const first = list[0];
  if (!first) throw new Error(`No agent configured for role "${role}".`);
  return first;
}

/**
 * Decide whether this pipeline has enough participants to render a
 * discussion panel. Fast mode (1 translator + 0 reviewer) skips discussion
 * entirely — there's nobody to talk to.
 */
function isConversational(input: PipelineInput): boolean {
  const translators = getAgentsByRole(input, 'translator').length;
  const reviewers = getAgentsByRole(input, 'reviewer').length;
  return translators + reviewers > 1;
}

/**
 * Friendly label for an agent in the discussion stream. Stable per role,
 * 1-indexed so users see "Translator 1", "Reviewer 2", etc.
 */
function labelFor(input: PipelineInput, agent: AgentConfig): string {
  const sameRole = getAgentsByRole(input, agent.role);
  const idx = sameRole.findIndex((a) => a.id === agent.id);
  const roleName =
    agent.role === 'translator'
      ? 'Translator'
      : agent.role === 'reviewer'
        ? 'Reviewer'
        : agent.role.charAt(0).toUpperCase() + agent.role.slice(1);
  return sameRole.length > 1 ? `${roleName} ${idx + 1}` : roleName;
}

const MAX_PARALLEL_CHUNKS = 4;
const MAX_PARALLEL_PER_PROVIDER = 2;

class ProviderLimiter {
  private active = new Map<string, number>();
  private queues = new Map<string, Array<() => void>>();

  async run<T>(providerId: string, fn: () => Promise<T>): Promise<T> {
    await this.acquire(providerId);
    try {
      return await fn();
    } finally {
      this.release(providerId);
    }
  }

  private acquire(providerId: string): Promise<void> {
    const count = this.active.get(providerId) ?? 0;
    if (count < MAX_PARALLEL_PER_PROVIDER) {
      this.active.set(providerId, count + 1);
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      const q = this.queues.get(providerId) ?? [];
      q.push(() => {
        this.active.set(providerId, (this.active.get(providerId) ?? 0) + 1);
        resolve();
      });
      this.queues.set(providerId, q);
    });
  }

  private release(providerId: string): void {
    const count = this.active.get(providerId) ?? 0;
    if (count <= 1) this.active.delete(providerId);
    else this.active.set(providerId, count - 1);

    const q = this.queues.get(providerId);
    const next = q?.shift();
    if (next) {
      if (q && q.length > 0) this.queues.set(providerId, q);
      else this.queues.delete(providerId);
      next();
    }
  }
}

async function mapConcurrent<T>(
  count: number,
  concurrency: number,
  worker: (index: number) => Promise<T>,
): Promise<T[]> {
  const out: T[] = new Array(count);
  let next = 0;
  const workers = Array.from({ length: Math.min(concurrency, count) }, async () => {
    while (next < count) {
      const i = next;
      next += 1;
      out[i] = await worker(i);
    }
  });
  await Promise.all(workers);
  return out;
}

async function runText(input: PipelineInput, emit: (e: OrchestratorEvent) => void): Promise<string> {
  const translatorCfg = requireFirstAgent(input, 'translator');
  const provider = getProvider(input, translatorCfg.providerId);
  const conversational = isConversational(input);

  emit({ type: 'phase', phase: 'translate' });
  emit({ type: 'agentStart', agentId: translatorCfg.id, role: 'translator' });

  const translatorLabel = labelFor(input, translatorCfg);
  let current = await translate({
    provider,
    model: translatorCfg.modelId,
    source: input.source,
    target: input.target,
    text: input.text,
    glossary: input.glossary,
    projectName: input.projectName,
    projectDescription: input.projectDescription,
    styleNote: input.styleNote,
    temperature: translatorCfg.temperature,
    signal: input.signal,
    onDelta: (delta) => emit({ type: 'delta', agentId: translatorCfg.id, delta }),
    discussion: conversational
      ? {
          agentLabel: translatorLabel,
          onRemark: (text) =>
            emit({
              type: 'discussionTurn',
              agentId: translatorCfg.id,
              agentLabel: translatorLabel,
              role: 'translator',
              text,
            }),
        }
      : undefined,
  });
  emit({ type: 'agentDone', agentId: translatorCfg.id, output: current });

  const reviewers = getAgentsByRole(input, 'reviewer');
  if (reviewers.length > 0) {
    emit({ type: 'phase', phase: 'review' });
    for (let i = 0; i < reviewers.length; i++) {
      const cfg = reviewers[i]!;
      const reviewProvider = getProvider(input, cfg.providerId);
      const reviewerLabel = labelFor(input, cfg);
      emit({ type: 'agentStart', agentId: cfg.id, role: 'reviewer' });
      current = await review({
        provider: reviewProvider,
        model: cfg.modelId,
        source: input.source,
        target: input.target,
        original: input.text,
        candidate: current,
        glossary: input.glossary,
        projectName: input.projectName,
        projectDescription: input.projectDescription,
        styleNote: input.styleNote,
        temperature: cfg.temperature,
        signal: input.signal,
        onDelta: (delta) => emit({ type: 'delta', agentId: cfg.id, delta }),
        discussion: conversational
          ? {
              agentLabel: reviewerLabel,
              onRemark: (text) =>
                emit({
                  type: 'discussionTurn',
                  agentId: cfg.id,
                  agentLabel: reviewerLabel,
                  role: 'reviewer',
                  text,
                }),
            }
          : undefined,
      });
      emit({ type: 'agentDone', agentId: cfg.id, output: current });
    }
  }

  emit({ type: 'done', output: current });
  return current;
}

async function runLongForm(
  input: PipelineInput,
  emit: (e: OrchestratorEvent) => void,
): Promise<string> {
  emit({ type: 'phase', phase: 'chunk' });
  const chunks = chunk(input.text);
  if (chunks.length === 0) {
    emit({ type: 'done', output: '' });
    return '';
  }

  const translatorCfgs = getAgentsByRole(input, 'translator');
  if (translatorCfgs.length === 0) {
    throw new Error('No agent configured for role "translator".');
  }
  const conversational = isConversational(input);
  const limiter = new ProviderLimiter();

  let summaries: string[] = [];
  const summarizerCfg = input.agents.find((a) => a.role === 'summarizer');
  if (summarizerCfg && chunks.length > 1) {
    emit({ type: 'phase', phase: 'summarize' });
    emit({ type: 'progress', current: 0, total: chunks.length });
    const provider = getProvider(input, summarizerCfg.providerId);
    let summarized = 0;
    summaries = await mapConcurrent(chunks.length, MAX_PARALLEL_CHUNKS, async (i) => {
      const c = chunks[i]!;
      emit({ type: 'agentStart', agentId: summarizerCfg.id, role: 'summarizer', chunkIndex: i });
      const result = await limiter.run(summarizerCfg.providerId, () =>
        summarize({
          provider,
          model: summarizerCfg.modelId,
          source: input.source,
          target: input.target,
          text: c.text,
          projectName: input.projectName,
          projectDescription: input.projectDescription,
          signal: input.signal,
        }),
      );
      summarized += 1;
      emit({ type: 'progress', current: summarized, total: chunks.length });
      emit({ type: 'agentDone', agentId: summarizerCfg.id, output: result, chunkIndex: i });
      return result;
    });
  }

  emit({ type: 'phase', phase: 'translate' });
  emit({ type: 'progress', current: 0, total: chunks.length });

  let translatedDone = 0;
  const translated = await mapConcurrent(chunks.length, MAX_PARALLEL_CHUNKS, async (i) => {
    const c = chunks[i]!;
    const cfg = translatorCfgs[i % translatorCfgs.length]!;
    const provider = getProvider(input, cfg.providerId);
    const translatorLabel = labelFor(input, cfg);
    emit({ type: 'agentStart', agentId: cfg.id, role: 'translator', chunkIndex: i });
    const summaryContext = summaries[i]
      ? `Section context summary for this chunk: ${summaries[i]}`
      : undefined;
    const result = await limiter.run(cfg.providerId, () =>
      translate({
        provider,
        model: cfg.modelId,
        source: input.source,
        target: input.target,
        text: c.text,
        glossary: input.glossary,
        projectName: input.projectName,
        projectDescription: input.projectDescription,
        contextBefore: c.context?.before,
        contextAfter: c.context?.after,
        temperature: cfg.temperature,
        signal: input.signal,
        styleNote: [input.styleNote, summaryContext].filter(Boolean).join('\n\n') || undefined,
        onDelta:
          chunks.length === 1
            ? (delta) => emit({ type: 'delta', agentId: cfg.id, delta, chunkIndex: i })
            : undefined,
        discussion: conversational
          ? {
              agentLabel: translatorLabel,
              onRemark: (text) =>
                emit({
                  type: 'discussionTurn',
                  agentId: cfg.id,
                  agentLabel: translatorLabel,
                  role: 'translator',
                  text,
                  chunkIndex: i,
                }),
            }
          : undefined,
      }),
    );
    emit({ type: 'agentDone', agentId: cfg.id, output: result, chunkIndex: i });
    translatedDone += 1;
    emit({ type: 'progress', current: translatedDone, total: chunks.length });
    return result;
  });

  let assembled = translated.join('\n\n');

  const reviewerCfgs = getAgentsByRole(input, 'reviewer');
  if (reviewerCfgs.length > 0) {
    emit({ type: 'phase', phase: 'review' });
    emit({ type: 'progress', current: 0, total: chunks.length });
    let reviewedDone = 0;
    const reviewed = await mapConcurrent(chunks.length, MAX_PARALLEL_CHUNKS, async (i) => {
      const cfg = reviewerCfgs[i % reviewerCfgs.length]!;
      const provider = getProvider(input, cfg.providerId);
      const reviewerLabel = labelFor(input, cfg);
      emit({ type: 'agentStart', agentId: cfg.id, role: 'reviewer', chunkIndex: i });
      const result = await limiter.run(cfg.providerId, () =>
        review({
          provider,
          model: cfg.modelId,
          source: input.source,
          target: input.target,
          original: chunks[i]!.text,
          candidate: translated[i]!,
          glossary: input.glossary,
          projectName: input.projectName,
          projectDescription: input.projectDescription,
          styleNote: input.styleNote,
          temperature: cfg.temperature,
          signal: input.signal,
          onDelta:
            chunks.length === 1
              ? (delta) => emit({ type: 'delta', agentId: cfg.id, delta, chunkIndex: i })
              : undefined,
          discussion: conversational
            ? {
                agentLabel: reviewerLabel,
                onRemark: (text) =>
                  emit({
                    type: 'discussionTurn',
                    agentId: cfg.id,
                    agentLabel: reviewerLabel,
                    role: 'reviewer',
                    text,
                    chunkIndex: i,
                  }),
              }
            : undefined,
        }),
      );
      emit({ type: 'agentDone', agentId: cfg.id, output: result, chunkIndex: i });
      reviewedDone += 1;
      emit({ type: 'progress', current: reviewedDone, total: chunks.length });
      return result;
    });
    assembled = reviewed.join('\n\n');
  }

  const consistencyCfg = input.agents.find((a) => a.role === 'consistency');
  if (consistencyCfg) {
    emit({ type: 'phase', phase: 'consistency' });
    const provider = getProvider(input, consistencyCfg.providerId);
    emit({ type: 'agentStart', agentId: consistencyCfg.id, role: 'consistency' });
    const result = await consistencyCheck({
      provider,
      model: consistencyCfg.modelId,
      source: input.source,
      target: input.target,
      assembled,
      glossary: input.glossary,
      projectName: input.projectName,
      projectDescription: input.projectDescription,
      signal: input.signal,
    });
    if (result.rewrite) {
      assembled = result.rewrite;
    } else if (result.fixes && result.fixes.length > 0) {
      assembled = applyFixes(assembled, result.fixes);
    }
    emit({ type: 'agentDone', agentId: consistencyCfg.id, output: assembled });
  }

  emit({ type: 'phase', phase: 'assemble' });
  emit({ type: 'done', output: assembled });
  return assembled;
}

async function runI18n(input: PipelineInput, emit: (e: OrchestratorEvent) => void): Promise<string> {
  emit({ type: 'phase', phase: 'parse' });

  let parsed: ReturnType<typeof parseI18n>;
  try {
    parsed = parseI18n(input.text);
  } catch (err) {
    throw new Error(
      err instanceof Error
        ? err.message
        : 'i18n mode could not detect format. Supported: JSON, YAML, .po, Android XML, iOS .strings, .properties, Fluent.',
    );
  }

  return await runEntryTranslation(input, emit, parsed.entries, (translations) =>
    serializeI18n(parsed, translations),
  );
}

async function runCodeDocs(
  input: PipelineInput,
  emit: (e: OrchestratorEvent) => void,
): Promise<string> {
  emit({ type: 'phase', phase: 'parse' });
  const parsed = parseCodeDocs(input.text);
  return await runEntryTranslation(input, emit, parsed.entries, (translations) =>
    serializeCodeDocs(parsed, translations),
  );
}

async function runDocument(
  input: PipelineInput,
  emit: (e: OrchestratorEvent) => void,
): Promise<string> {
  emit({ type: 'phase', phase: 'parse' });
  const parsed = parseDocument(input.text);
  return await runEntryTranslation(input, emit, parsed.entries, (translations) =>
    serializeDocument(parsed, translations),
  );
}

async function runSubtitles(
  input: PipelineInput,
  emit: (e: OrchestratorEvent) => void,
): Promise<string> {
  emit({ type: 'phase', phase: 'parse' });
  const parsed = parseSubtitles(input.text);
  return await runEntryTranslation(input, emit, parsed.entries, (translations) =>
    serializeSubtitles(parsed, translations),
  );
}

async function runEntryTranslation(
  input: PipelineInput,
  emit: (e: OrchestratorEvent) => void,
  entries: Array<{ key: string; source: string }>,
  serialize: (translations: Record<string, string>) => string,
): Promise<string> {
  if (entries.length === 0) {
    emit({ type: 'done', output: input.text });
    return input.text;
  }

  const batches = batchEntries(entries);
  const translatorCfgs = getAgentsByRole(input, 'translator');
  if (translatorCfgs.length === 0) {
    throw new Error('No agent configured for role "translator".');
  }

  emit({ type: 'phase', phase: 'translate' });
  emit({ type: 'progress', current: 0, total: entries.length });

  const out: Record<string, string> = {};
  let done = 0;

  const limiter = new ProviderLimiter();
  await mapConcurrent(batches.length, MAX_PARALLEL_CHUNKS, async (bi) => {
    const batch = batches[bi]!;
    const cfg = translatorCfgs[bi % translatorCfgs.length]!;
    const provider = getProvider(input, cfg.providerId);

    const obj: Record<string, string> = {};
    for (const e of batch) obj[e.key] = e.source;

    const system = i18nBatchPrompt({
      source: input.source,
      target: input.target,
      glossary: input.glossary,
      projectName: input.projectName,
      projectDescription: input.projectDescription,
    });

    emit({
      type: 'agentStart',
      agentId: cfg.id,
      role: 'translator',
      chunkIndex: bi,
    });

    const response = await limiter.run(cfg.providerId, () =>
      provider.complete({
        model: cfg.modelId,
        system,
        messages: [{ role: 'user', content: JSON.stringify(obj, null, 2) }],
        temperature: cfg.temperature ?? 0.2,
        signal: input.signal,
      }),
    );

    const translations = tryParseJSONObject(response.text);
    if (translations) {
      for (const e of batch) {
        const t = translations[e.key];
        if (typeof t === 'string') {
          const missing = validatePlaceholders(e.source, t);
          out[e.key] = missing.length === 0 ? t : e.source;
        } else {
          out[e.key] = e.source;
        }
      }
    } else {
      for (const e of batch) out[e.key] = e.source;
    }

    done += batch.length;
    emit({ type: 'progress', current: done, total: entries.length });
    emit({
      type: 'agentDone',
      agentId: cfg.id,
      output: `batch ${bi + 1}/${batches.length}`,
      chunkIndex: bi,
    });
  });

  emit({ type: 'phase', phase: 'assemble' });
  const finalText = serialize(out);
  emit({ type: 'done', output: finalText });
  return finalText;
}

function tryParseJSONObject(text: string): Record<string, string> | null {
  const trimmed = text.trim();
  try {
    const v = JSON.parse(trimmed);
    if (v && typeof v === 'object' && !Array.isArray(v)) return v as Record<string, string>;
  } catch {
    /* fall through */
  }
  // Try to extract first {...} block (model might have wrapped in markdown)
  const match = trimmed.match(/\{[\s\S]*\}/);
  if (match) {
    try {
      const v = JSON.parse(match[0]);
      if (v && typeof v === 'object' && !Array.isArray(v)) return v as Record<string, string>;
    } catch {
      /* ignore */
    }
  }
  return null;
}
