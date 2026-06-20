import type {
  GlossaryEntry,
  PersonalizationSettings,
  Project,
  ProjectMemory,
  TranslationContextPack,
} from '@tragents/shared';

const TONE_LABELS: Record<PersonalizationSettings['tone'], string> = {
  natural: 'natural and readable',
  formal: 'formal and controlled',
  academic: 'academic and precise',
  literary: 'literary and voice-sensitive',
  game: 'game-localized and character-aware',
  technical: 'technical-documentation style',
};

const STRATEGY_LABELS: Record<PersonalizationSettings['strategy'], string> = {
  faithful: 'faithful to source wording and structure',
  balanced: 'balanced between fidelity and target-language readability',
  localized: 'localized when idioms, UI copy, or cultural references need adaptation',
};

const ACTION_LABELS = {
  correction: 'user corrected the output',
  rejection: 'user rejected the output',
  'rewrite-request': 'user requested a rewrite',
  'final-edit': 'user finalized an edit',
} as const;

function lines(title: string, values: Array<string | undefined>): string {
  const clean = values.map((v) => v?.trim()).filter(Boolean) as string[];
  if (clean.length === 0) return '';
  return `${title}\n${clean.map((v) => `- ${v}`).join('\n')}`;
}

function memoryLines(memory?: ProjectMemory): string[] {
  if (!memory) return [];
  const correctionHistory = (memory.correctionHistory ?? []).slice(0, 8).map((item) => {
    const revision = item.userRevision ? ` Preferred revision: ${item.userRevision}` : '';
    return `Correction replay (${ACTION_LABELS[item.action]}): ${item.lesson} Source: ${item.sourcePreview} Previous output: ${item.modelOutputPreview}.${revision}`;
  });
  return [
    ...correctionHistory,
    ...memory.terminologyDecisions.map((v) => `Terminology: ${v}`),
    ...memory.styleDecisions.map((v) => `Style: ${v}`),
    ...memory.voiceNotes.map((v) => `Voice: ${v}`),
    memory.contextSummary ? `Context: ${memory.contextSummary}` : undefined,
  ].filter(Boolean) as string[];
}

export function buildTranslationContextPack(input: {
  personalization: PersonalizationSettings;
  project?: Project;
  memory?: ProjectMemory;
  glossary?: GlossaryEntry[];
}): TranslationContextPack | undefined {
  const { personalization, project, memory, glossary } = input;
  if (!personalization.enabled) return undefined;

  const inherited: string[] = [];
  inherited.push(`Tone: ${TONE_LABELS[personalization.tone]}`);
  inherited.push(`Strategy: ${STRATEGY_LABELS[personalization.strategy]}`);
  if (personalization.scenario?.trim()) inherited.push(`Scenario: ${personalization.scenario.trim()}`);
  if (personalization.audience?.trim()) inherited.push(`Audience: ${personalization.audience.trim()}`);
  if (personalization.styleNote?.trim()) inherited.push(`Style note: ${personalization.styleNote.trim()}`);
  if (personalization.constraints?.trim()) {
    inherited.push(`Constraints: ${personalization.constraints.trim()}`);
  }
  if (project?.description?.trim()) inherited.push(`Project brief: ${project.description.trim()}`);
  if (glossary?.length) inherited.push(`Glossary entries: ${glossary.length}`);
  if (personalization.memoryEnabled) inherited.push(...memoryLines(memory));

  const promptText = [
    'Professional translation brief:',
    lines('Project and audience', [
      project?.name ? `Project: ${project.name}` : undefined,
      project?.description ? `Project brief: ${project.description}` : undefined,
      personalization.scenario ? `Scenario: ${personalization.scenario}` : undefined,
      personalization.audience ? `Audience: ${personalization.audience}` : undefined,
    ]),
    lines('Style guide', [
      `Tone: ${TONE_LABELS[personalization.tone]}`,
      `Translation strategy: ${STRATEGY_LABELS[personalization.strategy]}`,
      personalization.styleNote,
      personalization.constraints,
    ]),
    personalization.memoryEnabled
      ? lines('Project memory from previous work', memoryLines(memory))
      : '',
    glossary?.length
      ? 'Terminology management: the glossary is authoritative. Prefer glossary decisions over model habit, and keep repeated terms consistent across chunks and tasks.'
      : '',
    memory?.correctionDecisions?.length
      ? 'User correction memory is binding: when a correction conflicts with a generic model habit, follow the correction.'
      : '',
    memory?.correctionHistory?.length
      ? 'Correction history is replayable project experience: use it to infer why earlier outputs were rejected, edited, or rewritten.'
      : '',
    'Quality priorities: preserve accuracy, terminology, target-language conventions, style, audience appropriateness, locale conventions, and markup/placeholders.',
  ]
    .filter(Boolean)
    .join('\n\n');

  return {
    personalization,
    memory,
    inherited,
    promptText,
  };
}

export function inferMemoryUpdate(input: {
  source: string;
  output: string;
  contextPack?: TranslationContextPack;
}): Pick<
  ProjectMemory,
  | 'styleDecisions'
  | 'terminologyDecisions'
  | 'correctionDecisions'
  | 'correctionHistory'
  | 'voiceNotes'
  | 'contextSummary'
> {
  const sourcePreview = input.source.replace(/\s+/g, ' ').trim().slice(0, 220);
  const outputPreview = input.output.replace(/\s+/g, ' ').trim().slice(0, 220);
  const styleDecisions: string[] = [];
  const terminologyDecisions: string[] = [];
  const voiceNotes: string[] = [];

  const styleLine = input.contextPack?.inherited.find((line) => line.startsWith('Tone: '));
  if (styleLine) styleDecisions.push(styleLine.replace(/^Tone:\s*/, ''));
  const strategyLine = input.contextPack?.inherited.find((line) => line.startsWith('Strategy: '));
  if (strategyLine) styleDecisions.push(strategyLine.replace(/^Strategy:\s*/, ''));

  return {
    styleDecisions,
    terminologyDecisions,
    correctionDecisions: [],
    correctionHistory: [],
    voiceNotes,
    contextSummary:
      sourcePreview || outputPreview
        ? `Latest task translated "${sourcePreview}" into "${outputPreview}".`
        : '',
  };
}
