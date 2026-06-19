import type {
  AgentAssignment,
  AppSettings,
  BrandPalette,
  LanguageCode,
  ModeKey,
  Pipeline,
  PipelinePreset,
  ThemeMode,
} from '@tragents/shared';
import { ALL_MODE_KEYS, AGENT_PRESETS, makePipeline } from '@tragents/shared';
import { STORES, idbGet, idbPut } from '../storage/db.js';

const SETTINGS_KEY = 'app-settings';

const SEED_PIPELINE_NAME = 'Balanced';

function freshDefaults(): AppSettings {
  const seed = makePipeline(SEED_PIPELINE_NAME, 'balanced');
  const modeAssignments: AppSettings['modeAssignments'] = {};
  for (const mode of ALL_MODE_KEYS) modeAssignments[mode] = seed.id;
  return {
    theme: { palette: 'iris', mode: 'system' },
    onboardingCompleted: false,
    uiLanguage: 'en',
    defaultSourceLanguage: 'auto',
    defaultTargetLanguage: 'zh',
    pipelines: [seed],
    modeAssignments,
  };
}

/**
 * Migrate stored settings from any prior shape into the current AppSettings.
 * Covers v0.1 (no pipeline field) and v0.2-pre (single `pipeline: PipelineConfig`).
 */
function migrate(stored: unknown): AppSettings {
  const fresh = freshDefaults();
  if (!stored || typeof stored !== 'object') return fresh;
  const s = stored as Record<string, unknown>;

  const next: AppSettings = {
    ...fresh,
    ...(s as Partial<AppSettings>),
    theme: { ...fresh.theme, ...((s.theme as Partial<typeof fresh.theme>) ?? {}) },
  };

  // Migrate legacy single-pipeline shape.
  const legacy = s.pipeline as
    | {
        preset?: PipelinePreset;
        translator?: AgentAssignment;
        reviewer?: AgentAssignment;
        consistency?: AgentAssignment;
        summarizer?: AgentAssignment;
      }
    | undefined;

  if (
    legacy &&
    (!('pipelines' in s) || !Array.isArray((s as { pipelines?: unknown }).pipelines))
  ) {
    const preset =
      legacy.preset && legacy.preset !== 'custom' ? legacy.preset : 'balanced';
    const def = AGENT_PRESETS[preset as Exclude<PipelinePreset, 'custom'>];
    const migrated: Pipeline = {
      id:
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `pipeline-${Date.now()}`,
      name: def.label,
      preset: legacy.preset ?? 'balanced',
      translators: def.translators,
      reviewers: def.reviewers,
      withConsistency: def.consistency,
      withSummarizer: false,
      translatorAssignment: legacy.translator,
      reviewerAssignment: legacy.reviewer,
      consistencyAssignment: legacy.consistency,
      summarizerAssignment: legacy.summarizer,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    next.pipelines = [migrated];
    next.modeAssignments = {};
    for (const mode of ALL_MODE_KEYS) next.modeAssignments[mode] = migrated.id;
  }

  if (!Array.isArray(next.pipelines) || next.pipelines.length === 0) {
    next.pipelines = fresh.pipelines;
    next.modeAssignments = fresh.modeAssignments;
  }
  if (!next.modeAssignments || typeof next.modeAssignments !== 'object') {
    next.modeAssignments = fresh.modeAssignments;
  }

  return next;
}

class SettingsStore {
  current = $state<AppSettings>(freshDefaults());
  sidebarCollapsed = $state(false);
  loaded = $state(false);

  async load() {
    try {
      const stored = await idbGet<unknown>(STORES.settings, SETTINGS_KEY);
      if (stored) this.current = migrate(stored);
      const collapsed = await idbGet<boolean>(STORES.settings, 'sidebar-collapsed');
      if (typeof collapsed === 'boolean') this.sidebarCollapsed = collapsed;
    } catch (err) {
      console.error('Failed to load settings', err);
    } finally {
      this.loaded = true;
    }
  }

  private async save() {
    await idbPut(STORES.settings, $state.snapshot(this.current), SETTINGS_KEY);
  }

  async setTheme(palette: BrandPalette, mode: ThemeMode) {
    this.current.theme = { palette, mode };
    await this.save();
  }

  async setLanguages(source: LanguageCode, target: LanguageCode) {
    this.current.defaultSourceLanguage = source;
    this.current.defaultTargetLanguage = target;
    await this.save();
  }

  async setUILanguage(code: LanguageCode) {
    this.current.uiLanguage = code;
    await this.save();
  }

  async toggleSidebar() {
    this.sidebarCollapsed = !this.sidebarCollapsed;
    await idbPut(STORES.settings, this.sidebarCollapsed, 'sidebar-collapsed');
  }

  async completeOnboarding() {
    this.current.onboardingCompleted = true;
    await this.save();
  }

  pipelineById(id: string): Pipeline | undefined {
    return this.current.pipelines.find((p) => p.id === id);
  }

  /** Resolve which pipeline backs a given mode, falling back to the first. */
  pipelineForMode(mode: ModeKey): Pipeline | undefined {
    const assigned = this.current.modeAssignments[mode];
    if (assigned) {
      const found = this.pipelineById(assigned);
      if (found) return found;
    }
    return this.current.pipelines[0];
  }

  async createPipeline(
    name: string,
    preset: Exclude<PipelinePreset, 'custom'> = 'balanced',
  ): Promise<Pipeline> {
    const p = makePipeline(name, preset);
    this.current.pipelines = [...this.current.pipelines, p];
    await this.save();
    return p;
  }

  async updatePipeline(id: string, patch: Partial<Omit<Pipeline, 'id' | 'createdAt'>>) {
    const idx = this.current.pipelines.findIndex((p) => p.id === id);
    if (idx < 0) return;
    const existing = this.current.pipelines[idx]!;
    const updated: Pipeline = {
      ...existing,
      ...patch,
      updatedAt: Date.now(),
    };
    this.current.pipelines = [
      ...this.current.pipelines.slice(0, idx),
      updated,
      ...this.current.pipelines.slice(idx + 1),
    ];
    await this.save();
  }

  async deletePipeline(id: string) {
    if (this.current.pipelines.length <= 1) return;
    this.current.pipelines = this.current.pipelines.filter((p) => p.id !== id);
    const replacement = this.current.pipelines[0]!.id;
    const next = { ...this.current.modeAssignments };
    for (const m of ALL_MODE_KEYS) {
      if (next[m] === id) next[m] = replacement;
    }
    this.current.modeAssignments = next;
    await this.save();
  }

  async duplicatePipeline(id: string): Promise<Pipeline | undefined> {
    const src = this.pipelineById(id);
    if (!src) return undefined;
    const copy: Pipeline = {
      ...src,
      id:
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `pipeline-${Date.now()}`,
      name: `${src.name} (copy)`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    this.current.pipelines = [...this.current.pipelines, copy];
    await this.save();
    return copy;
  }

  async setRoleAssignment(
    pipelineId: string,
    role: 'translator' | 'reviewer' | 'consistency' | 'summarizer',
    assignment: AgentAssignment | undefined,
  ) {
    const idx = this.current.pipelines.findIndex((p) => p.id === pipelineId);
    if (idx < 0) return;
    const p = this.current.pipelines[idx]!;
    const key =
      role === 'translator'
        ? 'translatorAssignment'
        : role === 'reviewer'
          ? 'reviewerAssignment'
          : role === 'consistency'
            ? 'consistencyAssignment'
            : 'summarizerAssignment';
    const updated: Pipeline = { ...p, [key]: assignment, updatedAt: Date.now() };
    this.current.pipelines = [
      ...this.current.pipelines.slice(0, idx),
      updated,
      ...this.current.pipelines.slice(idx + 1),
    ];
    await this.save();
  }

  async setModeAssignment(mode: ModeKey, pipelineId: string | undefined) {
    if (pipelineId === undefined) {
      const next = { ...this.current.modeAssignments };
      delete next[mode];
      this.current.modeAssignments = next;
    } else {
      this.current.modeAssignments = { ...this.current.modeAssignments, [mode]: pipelineId };
    }
    await this.save();
  }

  async reset() {
    this.current = freshDefaults();
    await this.save();
  }
}

export const settings = new SettingsStore();
