export type LanguageCode = string;

export interface Language {
  code: LanguageCode;
  name: string;
  nativeName: string;
  rtl?: boolean;
}

export type TranslationMode =
  | 'auto'
  | 'text'
  | 'long-form'
  | 'book'
  | 'i18n'
  | 'document'
  | 'code-docs'
  | 'subtitles'
  | 'ptp';

export type I18nFormat = 'json' | 'yaml' | 'po' | 'android-xml' | 'ios-strings' | 'properties' | 'fluent';

export interface ModeOptions {
  mode: TranslationMode;
  chunkSize?: number;
  format?: I18nFormat;
}

export type PipelinePreset = 'fast' | 'balanced' | 'quality' | 'literary' | 'book' | 'custom';

export interface AgentAssignment {
  providerId: string;
  modelId: string;
}

/**
 * A reusable pipeline. The user can have many of these and assign different
 * pipelines to different translation modes.
 */
export interface Pipeline {
  id: string;
  name: string;
  preset: PipelinePreset;

  translators: number;
  reviewers: number;
  withConsistency: boolean;
  withSummarizer: boolean;

  translatorAssignment?: AgentAssignment;
  reviewerAssignment?: AgentAssignment;
  consistencyAssignment?: AgentAssignment;
  summarizerAssignment?: AgentAssignment;

  createdAt: number;
  updatedAt: number;
}

export type ModeKey = Exclude<TranslationMode, 'auto'>;

export type ModeAssignments = Partial<Record<ModeKey, string>>;

export type ProviderKind = 'anthropic' | 'openai' | 'openai-compat';

export interface ProviderConfig {
  id: string;
  kind: ProviderKind;
  name: string;
  baseURL?: string;
  apiKey: string;
  defaultModel?: string;
  createdAt: number;
  updatedAt: number;
}

export interface ModelDescriptor {
  id: string;
  label: string;
  providerKind: ProviderKind;
  context?: number;
  pricing?: { in: number; out: number };
  capabilities?: { streaming?: boolean; thinking?: boolean; cache?: boolean };
}

export type AgentRole =
  | 'chunker'
  | 'translator'
  | 'reviewer'
  | 'consistency'
  | 'editor'
  | 'summarizer';

export interface AgentConfig {
  id: string;
  role: AgentRole;
  providerId: string;
  modelId: string;
  prompt?: string;
  temperature?: number;
  label?: string;
}

export interface AgentPreset {
  id: string;
  name: string;
  description?: string;
  agents: AgentConfig[];
}

export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface TranslationTask {
  id: string;
  projectId?: string;
  sourceLanguage: LanguageCode;
  targetLanguage: LanguageCode;
  input: string;
  output?: string;
  status: TaskStatus;
  agents: AgentConfig[];
  startedAt?: number;
  finishedAt?: number;
  error?: string;
  chunks?: TranslationChunk[];
}

export interface TranslationChunk {
  index: number;
  source: string;
  target?: string;
  reviewed?: boolean;
  notes?: string;
}

/** One row in PTP (point-to-point) mode — a source paragraph paired with
 *  its AI translation. Persisted on the parent project. */
export interface PtpRow {
  id: string;
  source: string;
  target: string;
  status: 'idle' | 'translating' | 'done' | 'failed';
  /** Error message if status === 'failed'. */
  error?: string;
  /** Short public remarks from each agent during translation, captured for
   *  the per-row discussion popover when the pipeline is conversational. */
  discussion?: Array<{
    agentId: string;
    agentLabel: string;
    role: 'translator' | 'reviewer';
    text: string;
    timestamp: number;
  }>;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  sourceLanguage: LanguageCode;
  targetLanguage: LanguageCode;
  agentPresetId?: string;
  glossaryId?: string;
  pinned?: boolean;
  ptpRows?: PtpRow[];
  createdAt: number;
  updatedAt: number;
}

export interface GlossaryEntry {
  source: string;
  target: string;
  context?: string;
  doNotTranslate?: boolean;
}

export interface Glossary {
  id: string;
  projectId?: string;
  name: string;
  entries: GlossaryEntry[];
  createdAt: number;
  updatedAt: number;
}

export interface CheckpointSnapshot {
  ptpRows?: PtpRow[];
  sourceLanguage?: LanguageCode;
  targetLanguage?: LanguageCode;
}

export interface Checkpoint {
  id: string;
  projectId: string;
  name: string;
  timestamp: number;
  auto: boolean;
  snapshot: CheckpointSnapshot;
}

export type ChatRole = 'user' | 'assistant' | 'system';

export interface ChatMessage {
  id: string;
  role: ChatRole;
  text: string;
  timestamp: number;

  sourceLanguage?: LanguageCode;
  targetLanguage?: LanguageCode;
  mode?: string;
  pipelineName?: string;
  agentCount?: number;
  durationMs?: number;

  phase?: string;
  progress?: { current: number; total: number };

  streaming?: boolean;
  error?: string;
}

export interface ChatSession {
  id: string;
  projectId?: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}

export interface DiscussionTurn {
  id: string;
  agentId: string;
  agentLabel: string;
  role: 'translator' | 'reviewer';
  text: string;
  chunkIndex?: number;
  timestamp: number;
}

export interface ActivityRecord {
  id: string;
  projectId?: string;
  inputPreview: string;
  sourceLanguage: LanguageCode;
  targetLanguage: LanguageCode;
  mode: Exclude<TranslationMode, 'auto'> | TranslationMode;
  status: 'done' | 'failed' | 'cancelled';
  pipelineName?: string;
  agentCount?: number;
  durationMs?: number;
  error?: string;
  createdAt: number;
}

export type ThemeMode = 'light' | 'dark' | 'system';
export type BrandPalette = 'iris' | 'clay' | 'mono' | 'mesh';
export type TranslationTone =
  | 'natural'
  | 'formal'
  | 'academic'
  | 'literary'
  | 'game'
  | 'technical';
export type TranslationStrategy = 'faithful' | 'balanced' | 'localized';

export interface ThemeSettings {
  mode: ThemeMode;
  palette: BrandPalette;
}

export interface PersonalizationSettings {
  enabled: boolean;
  memoryEnabled: boolean;
  projectOnlyMemory: boolean;
  autoUpdateMemory: boolean;
  tone: TranslationTone;
  strategy: TranslationStrategy;
  audience?: string;
  scenario?: string;
  styleNote?: string;
  constraints?: string;
}

export interface GitHubBackupSettings {
  owner: string;
  repo: string;
  branch: string;
  path: string;
  tokenSaved: boolean;
  lastBackupAt?: string;
}

export type CorrectionAction = 'correction' | 'rejection' | 'rewrite-request' | 'final-edit';

export interface ProjectCorrectionMemory {
  id: string;
  createdAt: number;
  action: CorrectionAction;
  sourcePreview: string;
  modelOutputPreview: string;
  userRevision?: string;
  lesson: string;
}

export interface ProjectMemory {
  projectId: string;
  styleDecisions: string[];
  terminologyDecisions: string[];
  correctionDecisions: string[];
  correctionHistory: ProjectCorrectionMemory[];
  contextSummary?: string;
  voiceNotes: string[];
  updatedAt: number;
}

export interface TranslationContextPack {
  personalization: PersonalizationSettings;
  memory?: ProjectMemory;
  inherited: string[];
  promptText: string;
}

export interface AppSettings {
  theme: ThemeSettings;
  onboardingCompleted: boolean;
  uiLanguage: LanguageCode;
  defaultSourceLanguage: LanguageCode;
  defaultTargetLanguage: LanguageCode;
  pipelines: Pipeline[];
  modeAssignments: ModeAssignments;
  personalization: PersonalizationSettings;
  githubBackup: GitHubBackupSettings;
}
