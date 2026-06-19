import type { AgentRole, Language, BrandPalette, ModeKey, Pipeline, PipelinePreset } from './types.js';

export const LANGUAGES: readonly Language[] = [
  { code: 'auto', name: 'Auto-detect', nativeName: 'Auto' },
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'zh', name: 'Chinese (Simplified)', nativeName: '简体中文' },
  { code: 'zh-Hant', name: 'Chinese (Traditional)', nativeName: '繁體中文' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語' },
  { code: 'ko', name: 'Korean', nativeName: '한국어' },
  { code: 'es', name: 'Spanish', nativeName: 'Español' },
  { code: 'fr', name: 'French', nativeName: 'Français' },
  { code: 'de', name: 'German', nativeName: 'Deutsch' },
  { code: 'it', name: 'Italian', nativeName: 'Italiano' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português' },
  { code: 'pt-BR', name: 'Portuguese (Brazil)', nativeName: 'Português (Brasil)' },
  { code: 'ru', name: 'Russian', nativeName: 'Русский' },
  { code: 'uk', name: 'Ukrainian', nativeName: 'Українська' },
  { code: 'pl', name: 'Polish', nativeName: 'Polski' },
  { code: 'nl', name: 'Dutch', nativeName: 'Nederlands' },
  { code: 'sv', name: 'Swedish', nativeName: 'Svenska' },
  { code: 'tr', name: 'Turkish', nativeName: 'Türkçe' },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية', rtl: true },
  { code: 'he', name: 'Hebrew', nativeName: 'עברית', rtl: true },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी' },
  { code: 'bn', name: 'Bengali', nativeName: 'বাংলা' },
  { code: 'th', name: 'Thai', nativeName: 'ไทย' },
  { code: 'vi', name: 'Vietnamese', nativeName: 'Tiếng Việt' },
  { code: 'id', name: 'Indonesian', nativeName: 'Bahasa Indonesia' },
  { code: 'la', name: 'Latin', nativeName: 'Latina' },
];

export function findLanguage(code: string): Language | undefined {
  return LANGUAGES.find((l) => l.code === code);
}

export interface BrandPaletteDef {
  id: BrandPalette;
  name: string;
  tagline: string;
  light: { primary: string; primaryFg: string; accent: string; bg: string };
  dark: { primary: string; primaryFg: string; accent: string; bg: string };
}

export const BRAND_PALETTES: readonly BrandPaletteDef[] = [
  {
    id: 'iris',
    name: 'Iris',
    tagline: 'Muted indigo — calm and professional.',
    light: { primary: '#5e63a8', primaryFg: '#ffffff', accent: '#7e84c8', bg: '#fafafa' },
    dark: { primary: '#8d92c8', primaryFg: '#0a0a0f', accent: '#a4a8db', bg: '#0b0b12' },
  },
  {
    id: 'clay',
    name: 'Clay',
    tagline: 'Warm terracotta — humane and inviting.',
    light: { primary: '#b06d52', primaryFg: '#ffffff', accent: '#cc8e74', bg: '#fbfaf8' },
    dark: { primary: '#d29882', primaryFg: '#0e0a08', accent: '#dfb195', bg: '#100c0a' },
  },
  {
    id: 'mono',
    name: 'Mono',
    tagline: 'Minimal black and white with a subtle accent.',
    light: { primary: '#1a1a1a', primaryFg: '#ffffff', accent: '#4f8cb0', bg: '#ffffff' },
    dark: { primary: '#ededed', primaryFg: '#0a0a0a', accent: '#7eb2d4', bg: '#0a0a0a' },
  },
  {
    id: 'mesh',
    name: 'Mesh',
    tagline: 'Soft violet — premium without shouting.',
    light: { primary: '#6e5cb0', primaryFg: '#ffffff', accent: '#b88a4a', bg: '#fafaff' },
    dark: { primary: '#9d85c8', primaryFg: '#0a0a0f', accent: '#d6a96f', bg: '#0a0a14' },
  },
];

export function getBrandPalette(id: BrandPalette): BrandPaletteDef {
  return BRAND_PALETTES.find((p) => p.id === id) ?? BRAND_PALETTES[0]!;
}

export const DEFAULT_AGENT_TEMPERATURE: Record<AgentRole, number> = {
  chunker: 0,
  translator: 0.3,
  reviewer: 0.2,
  consistency: 0.1,
  editor: 0.2,
  summarizer: 0.2,
};

export const DEFAULT_AGENT_COUNTS = {
  translators: 1,
  reviewers: 1,
} as const;

export interface PresetDef {
  id: PipelinePreset;
  label: string;
  description: string;
  translators: number;
  reviewers: number;
  consistency: boolean;
}

export const AGENT_PRESETS: Record<Exclude<PipelinePreset, 'custom'>, PresetDef> = {
  fast: {
    id: 'fast',
    label: 'Fast',
    description: 'Single translator pass. Lowest cost and latency.',
    translators: 1,
    reviewers: 0,
    consistency: false,
  },
  balanced: {
    id: 'balanced',
    label: 'Balanced',
    description: 'One translator + one reviewer. Recommended default.',
    translators: 1,
    reviewers: 1,
    consistency: false,
  },
  quality: {
    id: 'quality',
    label: 'Quality',
    description: 'Two translators, two reviewers, full consistency pass.',
    translators: 2,
    reviewers: 2,
    consistency: true,
  },
  literary: {
    id: 'literary',
    label: 'Literary',
    description: 'Three translators across providers, three reviewers, consistency.',
    translators: 3,
    reviewers: 3,
    consistency: true,
  },
};

export const ALL_MODE_KEYS: readonly ModeKey[] = [
  'text',
  'long-form',
  'i18n',
  'document',
  'code-docs',
  'subtitles',
  'ptp',
];

export const IMPLEMENTED_MODE_KEYS: readonly ModeKey[] = [
  'text',
  'long-form',
  'i18n',
  'document',
  'code-docs',
  'subtitles',
  'ptp',
];

let pipelineCounter = 0;

/**
 * Build a fresh Pipeline object from a preset. Generates a stable but
 * collision-resistant id when crypto.randomUUID is unavailable.
 */
export function makePipeline(
  name: string,
  preset: Exclude<PipelinePreset, 'custom'>,
): Pipeline {
  const def = AGENT_PRESETS[preset];
  const now = Date.now();
  pipelineCounter += 1;
  const id =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `pipeline-${now}-${pipelineCounter}`;
  return {
    id,
    name,
    preset,
    translators: def.translators,
    reviewers: def.reviewers,
    withConsistency: def.consistency,
    withSummarizer: false,
    createdAt: now,
    updatedAt: now,
  };
}
