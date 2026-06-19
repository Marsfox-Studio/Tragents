import type {
  AgentConfig,
  GlossaryEntry,
  ModeKey,
  Pipeline,
  ProviderConfig,
  TranslationMode,
} from '@tragents/shared';
import {
  BUILT_IN_MODELS,
  runPipeline,
  detectModeAgent,
  type DetectedMode,
  type OrchestratorEvent,
} from '@tragents/core';
import { createProvider } from '@tragents/core';
import { findLanguage, type LanguageCode } from '@tragents/shared';
import { providers } from './stores/providers.svelte.js';
import { settings } from './stores/settings.svelte.js';
import { projects } from './stores/projects.svelte.js';
import { glossaries } from './stores/glossaries.svelte.js';
import { activities } from './stores/activities.svelte.js';

export interface TranslateRequest {
  text: string;
  source: LanguageCode;
  target: LanguageCode;
  mode?: TranslationMode;
  /** Explicit pipeline override; takes priority over mode→pipeline map. */
  pipelineId?: string;
  /** Active project — its glossary is passed to the prompt if set. */
  projectId?: string;
  signal?: AbortSignal;
  onDelta?: (delta: string) => void;
  onEvent?: (event: OrchestratorEvent) => void;
}

export interface TranslateResult {
  output: string;
  durationMs: number;
  mode: Exclude<TranslationMode, 'auto'>;
  pipelineName: string;
  agentCount: number;
}

export class NoProviderError extends Error {
  constructor() {
    super('No provider configured. Add an API key in Settings to start translating.');
    this.name = 'NoProviderError';
  }
}

/**
 * Resolve which Pipeline a request should use:
 *   1. Explicit `pipelineId` override → that one.
 *   2. Mode → modeAssignments[mode] → pipeline.
 *   3. First pipeline.
 */
export function resolvePipeline(
  modeKey: ModeKey,
  pipelineId?: string,
): Pipeline | undefined {
  if (pipelineId) {
    const found = settings.pipelineById(pipelineId);
    if (found) return found;
  }
  return settings.pipelineForMode(modeKey);
}

/**
 * Build the AgentConfig list a Pipeline expands into.
 * Unset role assignments fall back to the first available provider + that
 * provider's default model (or the first built-in model for its kind).
 */
export function buildAgentsFromPipeline(
  pipeline: Pipeline,
  available: ProviderConfig[],
): AgentConfig[] {
  if (available.length === 0) throw new NoProviderError();
  const fallback = available[0]!;
  const fallbackModel = fallback.defaultModel ?? BUILT_IN_MODELS[fallback.kind][0]?.id ?? '';

  const pick = (
    assignment: { providerId: string; modelId: string } | undefined,
  ): { providerId: string; modelId: string } => {
    if (assignment) {
      const p = available.find((x) => x.id === assignment.providerId);
      if (p) return { providerId: p.id, modelId: assignment.modelId || fallbackModel };
    }
    return { providerId: fallback.id, modelId: fallbackModel };
  };

  const agents: AgentConfig[] = [];
  for (let i = 0; i < pipeline.translators; i++) {
    const r = pick(pipeline.translatorAssignment);
    agents.push({ id: `translator-${i}`, role: 'translator', ...r });
  }
  for (let i = 0; i < pipeline.reviewers; i++) {
    const r = pick(pipeline.reviewerAssignment);
    agents.push({ id: `reviewer-${i}`, role: 'reviewer', ...r });
  }
  if (pipeline.withConsistency) {
    const r = pick(pipeline.consistencyAssignment);
    agents.push({ id: 'consistency', role: 'consistency', ...r });
  }
  if (pipeline.withSummarizer) {
    const r = pick(pipeline.summarizerAssignment);
    agents.push({ id: 'summarizer', role: 'summarizer', ...r });
  }
  return agents;
}

/**
 * Resolve glossary entries for a translation. If a project is active and has
 * a glossaryId, returns that glossary's entries; otherwise undefined.
 */
function resolveGlossary(projectId?: string): GlossaryEntry[] | undefined {
  if (!projectId) return undefined;
  const project = projects.list.find((p) => p.id === projectId);
  if (!project?.glossaryId) return undefined;
  return glossaries.byId(project.glossaryId)?.entries;
}

/**
 * Ask the user's first available model to classify the input into a
 * translation mode. Returns null on any failure — the caller decides what
 * to do (fall through to the heuristic detector or just stay in auto).
 *
 * Uses the first provider's `defaultModel`, falling back to the first
 * built-in model id for that provider's kind.
 */
export async function detectModeForText(
  text: string,
  signal?: AbortSignal,
): Promise<DetectedMode | null> {
  if (providers.list.length === 0) return null;
  const cfg = providers.list[0]!;
  const model = cfg.defaultModel ?? BUILT_IN_MODELS[cfg.kind][0]?.id;
  if (!model) return null;
  try {
    return await detectModeAgent({
      provider: createProvider(cfg),
      model,
      text,
      signal,
    });
  } catch {
    return null;
  }
}

export async function translateText(req: TranslateRequest): Promise<TranslateResult> {
  if (providers.list.length === 0) throw new NoProviderError();

  const sourceLang = findLanguage(req.source) ?? findLanguage('auto')!;
  const targetLang = findLanguage(req.target);
  if (!targetLang) throw new Error(`Unknown target language: ${req.target}`);

  const lookupKey: ModeKey =
    !req.mode || req.mode === 'auto' ? 'text' : (req.mode as ModeKey);
  const pipeline = resolvePipeline(lookupKey, req.pipelineId);
  if (!pipeline) {
    throw new Error('No pipeline configured. Create one in Settings → Pipelines.');
  }

  const agents = buildAgentsFromPipeline(pipeline, providers.list);
  const glossary = resolveGlossary(req.projectId);

  let resolvedMode: Exclude<TranslationMode, 'auto'> = 'text';
  const started = performance.now();

  try {
    const output = await runPipeline({
      mode: req.mode ?? 'auto',
      text: req.text,
      source: sourceLang,
      target: targetLang,
      agents,
      providers: providers.list,
      glossary,
      signal: req.signal,
      onEvent: (event) => {
        if (event.type === 'mode') resolvedMode = event.mode;
        if (event.type === 'delta') req.onDelta?.(event.delta);
        req.onEvent?.(event);
      },
    });

    const durationMs = Math.round(performance.now() - started);
    activities.record({
      projectId: req.projectId,
      inputPreview: req.text.split('\n')[0]?.slice(0, 120).trim() || req.text.slice(0, 120),
      sourceLanguage: req.source,
      targetLanguage: req.target,
      mode: resolvedMode,
      status: 'done',
      pipelineName: pipeline.name,
      agentCount: agents.length,
      durationMs,
    });

    return {
      output,
      durationMs,
      mode: resolvedMode,
      pipelineName: pipeline.name,
      agentCount: agents.length,
    };
  } catch (err) {
    const aborted = (err as Error)?.name === 'AbortError';
    activities.record({
      projectId: req.projectId,
      inputPreview: req.text.split('\n')[0]?.slice(0, 120).trim() || req.text.slice(0, 120),
      sourceLanguage: req.source,
      targetLanguage: req.target,
      mode: resolvedMode,
      status: aborted ? 'cancelled' : 'failed',
      pipelineName: pipeline.name,
      agentCount: agents.length,
      durationMs: Math.round(performance.now() - started),
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}
