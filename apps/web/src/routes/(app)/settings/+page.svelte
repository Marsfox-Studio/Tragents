<script lang="ts">
  import { onMount } from 'svelte';
  import { fly, fade } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import { page } from '$app/state';
  import { replaceState } from '$app/navigation';
  import type {
    BrandPalette,
    ModeKey,
    PersonalizationSettings,
    Pipeline,
    PipelinePreset,
    ProviderKind,
    ThemeMode,
  } from '@tragents/shared';
  import { AGENT_PRESETS, IMPLEMENTED_MODE_KEYS } from '@tragents/shared';
  import Button from '$lib/components/Button.svelte';
  import Icon from '$lib/components/Icon.svelte';
  import IconButton from '$lib/components/IconButton.svelte';
  import PaletteCard from '$lib/components/PaletteCard.svelte';
  import ModeCard from '$lib/components/ModeCard.svelte';
  import ProviderForm from '$lib/components/ProviderForm.svelte';
  import PipelineEditor from '$lib/components/PipelineEditor.svelte';
  import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';
  import { memories, projects, providers, settings } from '$lib/stores';
  import { applyTheme, listPalettes } from '@tragents/ui';
  import { i18n, UI_LOCALES } from '$lib/i18n.svelte';
  import {
    clearGitHubBackupToken,
    downloadLocalBackup,
    importLocalBackup,
    pushBackupToGitHub,
    readLocalBackup,
    restoreBackupFromGitHub,
    saveGitHubBackupToken,
    type BackupImportSummary,
    type GitHubBackupResult,
    type LocalBackupPayload,
  } from '$lib/backup';

  type SectionId = 'appearance' | 'providers' | 'pipelines' | 'modes' | 'personalization' | 'backup' | 'about';

  const SECTIONS: Array<{ id: SectionId; icon: 'sun' | 'key' | 'sliders' | 'languages' | 'sparkles' | 'book' }> = [
    { id: 'appearance', icon: 'sun' },
    { id: 'providers', icon: 'key' },
    { id: 'pipelines', icon: 'sliders' },
    { id: 'modes', icon: 'languages' },
    { id: 'personalization', icon: 'sparkles' },
    { id: 'backup', icon: 'book' },
    { id: 'about', icon: 'sparkles' },
  ];

  let active = $state<SectionId>('appearance');

  onMount(() => {
    const requested = page.url.searchParams.get('section');
    if (requested && SECTIONS.some((s) => s.id === requested)) {
      active = requested as SectionId;
    }
  });

  function selectSection(id: SectionId) {
    active = id;
    const url = new URL(page.url);
    url.searchParams.set('section', id);
    replaceState(url, page.state);
  }

  const palettes = listPalettes();
  const modes: ThemeMode[] = ['system', 'light', 'dark'];
  const paletteIds: BrandPalette[] = ['iris', 'clay', 'mono', 'mesh'];
  const previewMode = $derived(settings.current.theme.mode === 'dark' ? 'dark' : 'light');
  const toneIds: PersonalizationSettings['tone'][] = [
    'natural',
    'formal',
    'academic',
    'literary',
    'game',
    'technical',
  ];
  const strategyIds: PersonalizationSettings['strategy'][] = [
    'balanced',
    'faithful',
    'localized',
  ];

  async function selectPalette(p: BrandPalette) {
    await settings.setTheme(p, settings.current.theme.mode);
    applyTheme(p, settings.current.theme.mode);
  }
  async function selectThemeMode(m: ThemeMode) {
    await settings.setTheme(settings.current.theme.palette, m);
    applyTheme(settings.current.theme.palette, m);
  }
  async function selectLanguage(code: string) {
    i18n.setLocale(code);
    await settings.setUILanguage(code);
  }

  let showAdd = $state(false);
  let pendingProviderDeleteId = $state<string | null>(null);
  async function addProvider(data: {
    kind: ProviderKind;
    name: string;
    baseURL?: string;
    apiKey: string;
    defaultModel?: string;
  }) {
    await providers.add(data);
    showAdd = false;
  }

  function requestDeleteProvider(id: string) {
    pendingProviderDeleteId = id;
  }

  async function confirmDeleteProvider() {
    if (!pendingProviderDeleteId) return;
    await providers.remove(pendingProviderDeleteId);
    pendingProviderDeleteId = null;
  }

  const presetIds: Exclude<PipelinePreset, 'custom'>[] = ['fast', 'balanced', 'quality', 'literary'];

  let editingPipeline = $state<Pipeline | null>(null);
  let creatingFromPreset = $state(false);
  let pendingPipelineDeleteId = $state<string | null>(null);

  async function createPipelineFromPreset(preset: Exclude<PipelinePreset, 'custom'>) {
    if (creatingFromPreset) return;
    creatingFromPreset = true;
    try {
      const def = AGENT_PRESETS[preset];
      const p = await settings.createPipeline(def.label, preset);
      editingPipeline = p;
    } finally {
      creatingFromPreset = false;
    }
  }

  function requestDeletePipeline(p: Pipeline) {
    if (settings.current.pipelines.length <= 1) return;
    pendingPipelineDeleteId = p.id;
  }

  async function confirmDeletePipeline() {
    if (!pendingPipelineDeleteId) return;
    if (settings.current.pipelines.length <= 1) {
      pendingPipelineDeleteId = null;
      return;
    }
    await settings.deletePipeline(pendingPipelineDeleteId);
    pendingPipelineDeleteId = null;
  }

  async function duplicatePipeline(p: Pipeline) {
    const copy = await settings.duplicatePipeline(p.id);
    if (copy) editingPipeline = copy;
  }

  function pipelineSummary(p: Pipeline): string {
    return i18n.t('pipelines.summary', {
      translators: p.translators,
      reviewers: p.reviewers,
      cons: p.withConsistency ? i18n.t('pipelines.consistencySuffix') : '',
    });
  }

  function pipelineUsages(p: Pipeline): ModeKey[] {
    return IMPLEMENTED_MODE_KEYS.filter((m) => settings.current.modeAssignments[m] === p.id);
  }

  const pendingProvider = $derived(
    pendingProviderDeleteId
      ? providers.list.find((p) => p.id === pendingProviderDeleteId)
      : undefined,
  );
  const pendingPipeline = $derived(
    pendingPipelineDeleteId
      ? settings.current.pipelines.find((p) => p.id === pendingPipelineDeleteId)
      : undefined,
  );

  async function setModeAssignment(mode: ModeKey, pipelineId: string) {
    await settings.setModeAssignment(mode, pipelineId);
  }

  let selectedBackup = $state<LocalBackupPayload | null>(null);
  let backupError = $state('');
  let backupImported = $state<BackupImportSummary | null>(null);
  let importingBackup = $state(false);
  let githubToken = $state('');
  let githubBusy = $state(false);
  let githubResult = $state<GitHubBackupResult | null>(null);
  let githubImported = $state<BackupImportSummary | null>(null);

  function sectionLabel(id: SectionId): string {
    return i18n.t(`settings.sections.${id === 'modes' ? 'modeAssignments' : id}`);
  }

  async function updatePersonalization(patch: Partial<PersonalizationSettings>) {
    await settings.updatePersonalization(patch);
  }

  async function handleBackupFile(event: Event) {
    const file = (event.currentTarget as HTMLInputElement).files?.[0];
    selectedBackup = null;
    backupImported = null;
    backupError = '';
    if (!file) return;
    try {
      selectedBackup = await readLocalBackup(file);
    } catch (err) {
      backupError = err instanceof Error ? err.message : String(err);
    }
  }

  async function confirmImportBackup() {
    if (!selectedBackup || importingBackup) return;
    importingBackup = true;
    backupError = '';
    try {
      backupImported = await importLocalBackup(selectedBackup);
      selectedBackup = null;
    } catch (err) {
      backupError = err instanceof Error ? err.message : String(err);
    } finally {
      importingBackup = false;
    }
  }

  async function updateGitHubBackup(
    field: 'owner' | 'repo' | 'branch' | 'path',
    value: string,
  ) {
    await settings.updateGitHubBackup({ [field]: value });
  }

  async function saveGitHubToken() {
    backupError = '';
    try {
      await saveGitHubBackupToken(githubToken);
      githubToken = '';
    } catch (err) {
      backupError = err instanceof Error ? err.message : String(err);
    }
  }

  async function clearGitHubToken() {
    backupError = '';
    try {
      await clearGitHubBackupToken();
    } catch (err) {
      backupError = err instanceof Error ? err.message : String(err);
    }
  }

  async function pushGitHubBackup() {
    if (githubBusy) return;
    githubBusy = true;
    backupError = '';
    githubResult = null;
    try {
      githubResult = await pushBackupToGitHub();
    } catch (err) {
      backupError = err instanceof Error ? err.message : String(err);
    } finally {
      githubBusy = false;
    }
  }

  async function restoreGitHubBackup() {
    if (githubBusy) return;
    githubBusy = true;
    backupError = '';
    githubImported = null;
    try {
      githubImported = await restoreBackupFromGitHub();
    } catch (err) {
      backupError = err instanceof Error ? err.message : String(err);
    } finally {
      githubBusy = false;
    }
  }
</script>

<svelte:head>
  <title>{i18n.t('pageTitle.settings')}</title>
</svelte:head>

<div class="settings-shell">
  <aside class="rail">
    <h1 class="rail-title">{i18n.t('settings.title')}</h1>
    <nav class="rail-nav">
      {#each SECTIONS as s (s.id)}
        <button
          type="button"
          class="rail-item"
          class:active={active === s.id}
          onclick={() => selectSection(s.id)}
        >
          <Icon name={s.icon} size={15} />
          <span>{sectionLabel(s.id)}</span>
        </button>
      {/each}
    </nav>
  </aside>

  <main class="content">
    {#key active}
      <div class="section-wrap" in:fly={{ y: 8, duration: 240, easing: cubicOut }}>
        {#if active === 'appearance'}
          <section class="section">
            <header>
              <h2>{i18n.t('settings.appearance')}</h2>
              <p class="sub">{i18n.t('settings.sub')}</p>
            </header>

            <h3 class="subhead">{i18n.t('settings.interfaceLanguage')}</h3>
            <p class="section-hint">{i18n.t('settings.interfaceLanguageHint')}</p>
            <div class="lang-grid">
              {#each UI_LOCALES as loc (loc.code)}
                <button
                  type="button"
                  class="lang-btn"
                  class:selected={i18n.locale === loc.code}
                  onclick={() => selectLanguage(loc.code)}
                >
                  <span class="lang-native">{loc.nativeLabel}</span>
                  {#if loc.label !== loc.nativeLabel}
                    <span class="lang-en">{loc.label}</span>
                  {/if}
                </button>
              {/each}
            </div>

            <h3 class="subhead">{i18n.t('settings.theme')}</h3>
            <div class="mode-grid">
              {#each modes as m (m)}
                <ModeCard
                  mode={m}
                  selected={settings.current.theme.mode === m}
                  onclick={() => selectThemeMode(m)}
                />
              {/each}
            </div>
          </section>
        {:else if active === 'providers'}
          <section class="section">
            <header class="sec-head">
              <div>
                <h2>{i18n.t('settings.providers')}</h2>
                <p class="sub">{i18n.t('settings.sub')}</p>
              </div>
              <Button
                onclick={() => (showAdd = !showAdd)}
                variant={showAdd ? 'ghost' : 'subtle'}
                size="sm"
              >
                {showAdd ? i18n.t('common.close') : i18n.t('settings.addProvider')}
              </Button>
            </header>

            {#if showAdd}
              <div class="add-form" in:fly={{ y: 6, duration: 220, easing: cubicOut }}>
                <ProviderForm onSave={addProvider} onCancel={() => (showAdd = false)} />
              </div>
            {/if}

            {#if providers.list.length === 0 && !showAdd}
              <div class="empty">
                <p>{i18n.t('settings.noProviders')}</p>
                <p class="hint">{i18n.t('settings.noProvidersHint')}</p>
                <Button onclick={() => (showAdd = true)} variant="primary">
                  {i18n.t('settings.addFirst')}
                </Button>
              </div>
            {:else if providers.list.length > 0}
              <ul class="prov-list">
                {#each providers.list as p (p.id)}
                  <li class="prov">
                    <div class="prov-info">
                      <div class="prov-name">
                        <strong>{p.name}</strong>
                        <span class="prov-kind">{p.kind}</span>
                      </div>
                      <div class="prov-sub">
                        {#if p.defaultModel}<span>{p.defaultModel}</span>{/if}
                        {#if p.baseURL}<span class="url">{p.baseURL}</span>{/if}
                      </div>
                    </div>
                    <IconButton
                      label={i18n.t('settings.removeProvider')}
                      variant="ghost"
                      onclick={() => requestDeleteProvider(p.id)}
                    >
                      <Icon name="trash" size={16} />
                    </IconButton>
                  </li>
                {/each}
              </ul>
            {/if}
          </section>
        {:else if active === 'pipelines'}
          <section class="section">
            <header class="sec-head">
              <div>
                <h2>{i18n.t('pipelines.title')}</h2>
                <p class="sub">{i18n.t('pipelines.sub')}</p>
              </div>
            </header>

            <h3 class="subhead">{i18n.t('pipelines.startFromPreset')}</h3>
            <div class="preset-row">
              {#each presetIds as presetId (presetId)}
                {@const preset = AGENT_PRESETS[presetId]}
                <button
                  type="button"
                  class="preset-pill"
                  onclick={() => createPipelineFromPreset(presetId)}
                  disabled={creatingFromPreset}
                >
                  <span class="preset-name">{preset.label}</span>
                  <span class="preset-desc">{preset.description}</span>
                </button>
              {/each}
            </div>

            <h3 class="subhead" style="margin-top:24px">
              {i18n.t('pipelines.title')} ({settings.current.pipelines.length})
            </h3>
            <ul class="pipe-list">
              {#each settings.current.pipelines as p (p.id)}
                {@const usages = pipelineUsages(p)}
                <li class="pipe">
                  <div class="pipe-info">
                    <strong>{p.name}</strong>
                    <span class="pipe-summary">{pipelineSummary(p)}</span>
                    <span class="pipe-usages">
                      {#if usages.length === 0}
                        <span class="usage-none">{i18n.t('pipelines.noUsages')}</span>
                      {:else}
                        <span class="usage-label">{i18n.t('pipelines.usedBy')}:</span>
                        {#each usages as m (m)}
                          <span class="usage-pill">{i18n.t(`modeAssignments.modes.${m}`)}</span>
                        {/each}
                      {/if}
                    </span>
                  </div>
                  <div class="pipe-actions">
                    <Button size="sm" variant="subtle" onclick={() => (editingPipeline = p)}>
                      {i18n.t('pipelines.edit')}
                    </Button>
                    <IconButton
                      label={i18n.t('pipelines.duplicate')}
                      variant="ghost"
                      onclick={() => duplicatePipeline(p)}
                    >
                      <Icon name="plus" size={15} />
                    </IconButton>
                    <IconButton
                      label={i18n.t('pipelines.delete')}
                      variant="ghost"
                      disabled={settings.current.pipelines.length <= 1}
                      onclick={() => requestDeletePipeline(p)}
                    >
                      <Icon name="trash" size={15} />
                    </IconButton>
                  </div>
                </li>
              {/each}
            </ul>

            {#if editingPipeline}
              <PipelineEditor
                pipeline={editingPipeline}
                open
                onClose={() => (editingPipeline = null)}
              />
            {/if}
          </section>
        {:else if active === 'modes'}
          <section class="section">
            <header>
              <h2>{i18n.t('modeAssignments.title')}</h2>
              <p class="sub">{i18n.t('modeAssignments.sub')}</p>
            </header>

            <div class="mode-table">
              <div class="mode-head">
                <span>{i18n.t('modeAssignments.modeColumn')}</span>
                <span>{i18n.t('modeAssignments.pipelineColumn')}</span>
              </div>
              {#each IMPLEMENTED_MODE_KEYS as m (m)}
                {@const assigned = settings.current.modeAssignments[m] ?? settings.current.pipelines[0]?.id ?? ''}
                <div class="mode-row">
                  <span class="mode-label">
                    {i18n.t(`modeAssignments.modes.${m}`)}
                  </span>
                  <select
                    value={assigned}
                    onchange={(e: Event) =>
                      setModeAssignment(m, (e.currentTarget as HTMLSelectElement).value)}
                  >
                    {#each settings.current.pipelines as p (p.id)}
                      <option value={p.id}>{p.name}</option>
                    {/each}
                  </select>
                </div>
              {/each}
            </div>
          </section>
        {:else if active === 'personalization'}
          <section class="section">
            <header>
              <h2>{i18n.t('personalization.title')}</h2>
              <p class="sub">{i18n.t('personalization.sub')}</p>
            </header>

            <div class="toggle-list">
              <label class="toggle-row">
                <span>
                  <strong>{i18n.t('personalization.enabled')}</strong>
                  <small>{i18n.t('personalization.enabledHint')}</small>
                </span>
                <input
                  type="checkbox"
                  checked={settings.current.personalization.enabled}
                  onchange={(e) =>
                    updatePersonalization({
                      enabled: (e.currentTarget as HTMLInputElement).checked,
                    })}
                />
              </label>
              <label class="toggle-row">
                <span>
                  <strong>{i18n.t('personalization.memoryEnabled')}</strong>
                  <small>{i18n.t('personalization.memoryEnabledHint')}</small>
                </span>
                <input
                  type="checkbox"
                  checked={settings.current.personalization.memoryEnabled}
                  onchange={(e) =>
                    updatePersonalization({
                      memoryEnabled: (e.currentTarget as HTMLInputElement).checked,
                    })}
                />
              </label>
              <label class="toggle-row">
                <span>
                  <strong>{i18n.t('personalization.autoUpdateMemory')}</strong>
                  <small>{i18n.t('personalization.autoUpdateMemoryHint')}</small>
                </span>
                <input
                  type="checkbox"
                  checked={settings.current.personalization.autoUpdateMemory}
                  onchange={(e) =>
                    updatePersonalization({
                      autoUpdateMemory: (e.currentTarget as HTMLInputElement).checked,
                    })}
                />
              </label>
            </div>

            <div class="form-grid">
              <label>
                <span>{i18n.t('personalization.tone')}</span>
                <select
                  value={settings.current.personalization.tone}
                  onchange={(e) =>
                    updatePersonalization({
                      tone: (e.currentTarget as HTMLSelectElement)
                        .value as PersonalizationSettings['tone'],
                    })}
                >
                  {#each toneIds as tone (tone)}
                    <option value={tone}>{i18n.t(`personalization.tones.${tone}`)}</option>
                  {/each}
                </select>
              </label>

              <label>
                <span>{i18n.t('personalization.strategy')}</span>
                <select
                  value={settings.current.personalization.strategy}
                  onchange={(e) =>
                    updatePersonalization({
                      strategy: (e.currentTarget as HTMLSelectElement)
                        .value as PersonalizationSettings['strategy'],
                    })}
                >
                  {#each strategyIds as strategy (strategy)}
                    <option value={strategy}>
                      {i18n.t(`personalization.strategies.${strategy}`)}
                    </option>
                  {/each}
                </select>
              </label>
            </div>

            <div class="textarea-stack">
              <label>
                <span>{i18n.t('personalization.scenario')}</span>
                <input
                  value={settings.current.personalization.scenario ?? ''}
                  placeholder={i18n.t('personalization.scenarioPlaceholder')}
                  oninput={(e) =>
                    updatePersonalization({
                      scenario: (e.currentTarget as HTMLInputElement).value,
                    })}
                />
              </label>
              <label>
                <span>{i18n.t('personalization.audience')}</span>
                <input
                  value={settings.current.personalization.audience ?? ''}
                  placeholder={i18n.t('personalization.audiencePlaceholder')}
                  oninput={(e) =>
                    updatePersonalization({
                      audience: (e.currentTarget as HTMLInputElement).value,
                    })}
                />
              </label>
              <label>
                <span>{i18n.t('personalization.styleNote')}</span>
                <textarea
                  rows="4"
                  value={settings.current.personalization.styleNote ?? ''}
                  placeholder={i18n.t('personalization.styleNotePlaceholder')}
                  oninput={(e) =>
                    updatePersonalization({
                      styleNote: (e.currentTarget as HTMLTextAreaElement).value,
                    })}
                ></textarea>
              </label>
              <label>
                <span>{i18n.t('personalization.constraints')}</span>
                <textarea
                  rows="3"
                  value={settings.current.personalization.constraints ?? ''}
                  placeholder={i18n.t('personalization.constraintsPlaceholder')}
                  oninput={(e) =>
                    updatePersonalization({
                      constraints: (e.currentTarget as HTMLTextAreaElement).value,
                    })}
                ></textarea>
              </label>
            </div>

            <h3 class="subhead">{i18n.t('personalization.projectMemory')}</h3>
            {#if memories.list.length === 0}
              <p class="section-hint">{i18n.t('personalization.noMemory')}</p>
            {:else}
              <ul class="memory-list">
                {#each memories.list as memory (memory.projectId)}
                  {@const project = projects.byId(memory.projectId)}
                  <li>
                    <div>
                      <strong>{project?.name ?? memory.projectId}</strong>
                      <span>
                        {memory.styleDecisions.length + memory.terminologyDecisions.length + memory.voiceNotes.length}
                        {i18n.t('personalization.memoryItems')}
                      </span>
                    </div>
                    <Button size="sm" variant="ghost" onclick={() => memories.remove(memory.projectId)}>
                      {i18n.t('common.remove')}
                    </Button>
                  </li>
                {/each}
              </ul>
            {/if}
          </section>
        {:else if active === 'backup'}
          <section class="section">
            <header>
              <h2>{i18n.t('backup.title')}</h2>
              <p class="sub">{i18n.t('backup.sub')}</p>
            </header>

            <div class="backup-actions">
              <Button variant="primary" onclick={downloadLocalBackup}>
                {i18n.t('backup.export')}
              </Button>
              <label class="file-pick">
                <input type="file" accept="application/json,.json" onchange={handleBackupFile} />
                <span>{i18n.t('backup.chooseFile')}</span>
              </label>
            </div>
            <p class="section-hint">{i18n.t('backup.keyHint')}</p>

            {#if selectedBackup}
              <div class="backup-preview">
                <strong>{i18n.t('backup.ready')}</strong>
                <span>
                  {selectedBackup.projects.length} {i18n.t('backup.projects')} ·
                  {selectedBackup.glossaries.length} {i18n.t('backup.glossaries')} ·
                  {selectedBackup.memories.length} {i18n.t('backup.memories')}
                </span>
                <Button
                  size="sm"
                  variant="subtle"
                  onclick={confirmImportBackup}
                  disabled={importingBackup}
                >
                  {importingBackup ? i18n.t('common.loading') : i18n.t('backup.import')}
                </Button>
              </div>
            {/if}

            {#if backupImported}
              <p class="backup-ok">
                {i18n.t('backup.imported', {
                  projects: backupImported.projects,
                  memories: backupImported.memories,
                })}
              </p>
            {/if}

            <div class="backup-card">
              <div class="backup-card-head">
                <div>
                  <h3>{i18n.t('backup.githubTitle')}</h3>
                  <p>{i18n.t('backup.githubSub')}</p>
                </div>
                <span class="token-chip" class:saved={settings.current.githubBackup.tokenSaved}>
                  {settings.current.githubBackup.tokenSaved
                    ? i18n.t('backup.tokenSaved')
                    : i18n.t('backup.tokenMissing')}
                </span>
              </div>

              <div class="backup-grid">
                <label>
                  <span>{i18n.t('backup.githubOwner')}</span>
                  <input
                    value={settings.current.githubBackup.owner}
                    placeholder="Marsfox-Studio"
                    oninput={(e) =>
                      updateGitHubBackup('owner', (e.currentTarget as HTMLInputElement).value)}
                  />
                </label>
                <label>
                  <span>{i18n.t('backup.githubRepo')}</span>
                  <input
                    value={settings.current.githubBackup.repo}
                    placeholder="tragents-backup"
                    oninput={(e) =>
                      updateGitHubBackup('repo', (e.currentTarget as HTMLInputElement).value)}
                  />
                </label>
                <label>
                  <span>{i18n.t('backup.githubBranch')}</span>
                  <input
                    value={settings.current.githubBackup.branch}
                    placeholder="main"
                    oninput={(e) =>
                      updateGitHubBackup('branch', (e.currentTarget as HTMLInputElement).value)}
                  />
                </label>
                <label>
                  <span>{i18n.t('backup.githubPath')}</span>
                  <input
                    value={settings.current.githubBackup.path}
                    placeholder="tragents/backup.json"
                    oninput={(e) =>
                      updateGitHubBackup('path', (e.currentTarget as HTMLInputElement).value)}
                  />
                </label>
              </div>

              <label class="token-row">
                <span>{i18n.t('backup.githubToken')}</span>
                <div>
                  <input
                    type="password"
                    value={githubToken}
                    placeholder={i18n.t('backup.githubTokenPlaceholder')}
                    oninput={(e) => (githubToken = (e.currentTarget as HTMLInputElement).value)}
                  />
                  <Button
                    size="sm"
                    variant="subtle"
                    onclick={saveGitHubToken}
                    disabled={!githubToken.trim()}
                  >
                    {i18n.t('backup.saveToken')}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onclick={clearGitHubToken}
                    disabled={!settings.current.githubBackup.tokenSaved}
                  >
                    {i18n.t('backup.clearToken')}
                  </Button>
                </div>
              </label>

              <div class="backup-actions">
                <Button
                  variant="primary"
                  onclick={pushGitHubBackup}
                  disabled={githubBusy || !settings.current.githubBackup.tokenSaved}
                >
                  {githubBusy ? i18n.t('common.loading') : i18n.t('backup.githubPush')}
                </Button>
                <Button
                  variant="subtle"
                  onclick={restoreGitHubBackup}
                  disabled={githubBusy || !settings.current.githubBackup.tokenSaved}
                >
                  {i18n.t('backup.githubRestore')}
                </Button>
              </div>

              {#if settings.current.githubBackup.lastBackupAt}
                <p class="section-hint">
                  {i18n.t('backup.lastBackup', {
                    time: new Date(settings.current.githubBackup.lastBackupAt).toLocaleString(),
                  })}
                </p>
              {/if}
              {#if githubResult}
                <p class="backup-ok">
                  {i18n.t('backup.githubPushed')}
                  <a href={githubResult.url} target="_blank" rel="noreferrer">
                    {githubResult.sha.slice(0, 7)}
                  </a>
                </p>
              {/if}
              {#if githubImported}
                <p class="backup-ok">
                  {i18n.t('backup.imported', {
                    projects: githubImported.projects,
                    memories: githubImported.memories,
                  })}
                </p>
              {/if}
            </div>
            {#if backupError}
              <p class="backup-error">{backupError}</p>
            {/if}
          </section>
        {:else if active === 'about'}
          <section class="section">
            <header>
              <h2>{i18n.t('settings.about')}</h2>
            </header>
            <p class="about">{i18n.t('settings.aboutText')}</p>
          </section>
        {/if}
      </div>
    {/key}
  </main>
</div>

<ConfirmDialog
  open={pendingProvider !== undefined}
  title={i18n.t('settings.removeProvider')}
  message={i18n.t('settings.removeProviderConfirm', { name: pendingProvider?.name ?? '' })}
  onConfirm={confirmDeleteProvider}
  onCancel={() => (pendingProviderDeleteId = null)}
/>

<ConfirmDialog
  open={pendingPipeline !== undefined}
  title={i18n.t('pipelines.delete')}
  message={i18n.t('pipelines.deleteConfirm', { name: pendingPipeline?.name ?? '' })}
  onConfirm={confirmDeletePipeline}
  onCancel={() => (pendingPipelineDeleteId = null)}
/>

<style>
  .settings-shell {
    display: grid;
    grid-template-columns: 220px 1fr;
    min-height: 100dvh;
    background: var(--tg-bg);
  }
  @media (max-width: 720px) {
    .settings-shell {
      grid-template-columns: 1fr;
    }
  }

  .rail {
    padding: 32px 12px 20px;
    border-right: 1px solid var(--tg-border);
    background: color-mix(in srgb, var(--tg-bg) 95%, var(--tg-bg-sidebar));
    position: sticky;
    top: 0;
    align-self: start;
    height: 100dvh;
    overflow-y: auto;
  }
  @media (max-width: 720px) {
    .rail {
      position: relative;
      height: auto;
      border-right: none;
      border-bottom: 1px solid var(--tg-border);
      padding: 16px;
    }
  }
  .rail-title {
    margin: 0 8px 14px;
    font-size: 13px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--tg-fg-subtle);
    font-weight: 600;
  }
  .rail-nav {
    display: flex;
    flex-direction: column;
    gap: 1px;
  }
  @media (max-width: 720px) {
    .rail-nav {
      flex-direction: row;
      overflow-x: auto;
      gap: 4px;
    }
  }
  .rail-item {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    padding: 9px 12px;
    border: none;
    background: transparent;
    color: var(--tg-fg-muted);
    border-radius: 8px;
    cursor: pointer;
    text-align: left;
    font-family: inherit;
    font-size: 13.5px;
    transition:
      background 160ms,
      color 160ms;
  }
  .rail-item:hover {
    background: var(--tg-bg-elevated);
    color: var(--tg-fg);
  }
  .rail-item.active {
    background: color-mix(in srgb, var(--tg-primary) 12%, transparent);
    color: var(--tg-fg);
    font-weight: 500;
  }

  .content {
    padding: 48px 40px 80px;
    overflow-x: hidden;
  }
  @media (max-width: 720px) {
    .content {
      padding: 24px 20px 80px;
    }
  }
  .section-wrap {
    max-width: 740px;
    margin: 0 auto;
  }

  .section header {
    margin-bottom: 28px;
  }
  .section h2 {
    font-size: 26px;
    font-weight: 500;
    margin: 0 0 4px;
    letter-spacing: -0.02em;
  }
  .section .sub {
    margin: 0;
    color: var(--tg-fg-muted);
    font-size: 14px;
    line-height: 1.5;
  }
  .sec-head {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 16px;
    margin-bottom: 24px;
  }

  .subhead {
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    color: var(--tg-fg-subtle);
    margin: 22px 0 8px;
    font-weight: 600;
  }
  .section-hint {
    margin: 0 0 10px;
    color: var(--tg-fg-muted);
    font-size: 13px;
  }

  .lang-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 10px;
    margin-bottom: 20px;
  }
  .lang-btn {
    display: flex;
    flex-direction: column;
    gap: 4px;
    align-items: flex-start;
    padding: 12px 14px;
    border-radius: 12px;
    border: 1px solid var(--tg-border);
    background: var(--tg-bg-elevated);
    cursor: pointer;
    text-align: left;
    color: var(--tg-fg);
    font-family: inherit;
    transition:
      border-color 200ms cubic-bezier(0.4, 0, 0.2, 1),
      transform 200ms cubic-bezier(0.4, 0, 0.2, 1),
      box-shadow 240ms cubic-bezier(0.4, 0, 0.2, 1);
  }
  .lang-btn:hover {
    border-color: var(--tg-border-strong);
    transform: translateY(-1px);
  }
  .lang-btn.selected {
    border-color: var(--tg-primary);
    box-shadow: 0 0 0 3px var(--tg-ring);
  }
  .lang-native {
    font-size: 15px;
    font-weight: 500;
  }
  .lang-en {
    font-size: 11.5px;
    color: var(--tg-fg-subtle);
  }
  .mode-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 8px;
  }
  @media (min-width: 720px) {
    .mode-grid {
      grid-template-columns: 1fr 1fr 1fr;
    }
  }

  .add-form {
    background: var(--tg-bg-elevated);
    border: 1px solid var(--tg-border);
    border-radius: 16px;
    padding: 20px;
    margin-bottom: 16px;
  }
  .empty {
    text-align: center;
    padding: 36px 24px;
    border: 1px dashed var(--tg-border-strong);
    border-radius: 16px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
  }
  .empty p {
    margin: 0;
    color: var(--tg-fg);
  }
  .empty .hint {
    color: var(--tg-fg-muted);
    font-size: 13.5px;
    margin-bottom: 12px;
    max-width: 380px;
    line-height: 1.5;
  }
  .prov-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .prov {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 14px 16px;
    background: var(--tg-bg-elevated);
    border: 1px solid var(--tg-border);
    border-radius: 14px;
  }
  .prov-info {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
  }
  .prov-name {
    display: flex;
    align-items: baseline;
    gap: 8px;
  }
  .prov-kind {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    padding: 2px 7px;
    border-radius: 999px;
    background: var(--tg-border);
    color: var(--tg-fg-muted);
    font-weight: 500;
  }
  .prov-sub {
    display: flex;
    gap: 10px;
    font-size: 12.5px;
    color: var(--tg-fg-muted);
  }
  .prov-sub .url {
    font-family: var(--font-mono);
    font-size: 11.5px;
  }

  .preset-row {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 8px;
  }
  .preset-pill {
    display: flex;
    flex-direction: column;
    gap: 4px;
    align-items: flex-start;
    padding: 12px 14px;
    border-radius: 12px;
    border: 1px dashed var(--tg-border-strong);
    background: transparent;
    color: var(--tg-fg);
    font-family: inherit;
    cursor: pointer;
    text-align: left;
    transition:
      background 160ms,
      border-color 160ms,
      transform 200ms;
  }
  .preset-pill:hover:not(:disabled) {
    border-style: solid;
    background: var(--tg-bg-elevated);
    transform: translateY(-1px);
  }
  .preset-pill:disabled {
    opacity: 0.6;
    cursor: wait;
  }
  .preset-name {
    font-weight: 500;
    font-size: 14px;
  }
  .preset-desc {
    font-size: 12.5px;
    color: var(--tg-fg-muted);
    line-height: 1.4;
  }

  .pipe-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .pipe {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    padding: 16px 18px;
    background: var(--tg-bg-elevated);
    border: 1px solid var(--tg-border);
    border-radius: 14px;
  }
  .pipe-info {
    display: flex;
    flex-direction: column;
    gap: 5px;
    min-width: 0;
  }
  .pipe-info strong {
    font-weight: 500;
    font-size: 15px;
  }
  .pipe-summary {
    font-size: 12.5px;
    color: var(--tg-fg-muted);
  }
  .pipe-usages {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
    margin-top: 4px;
    font-size: 12px;
  }
  .usage-label {
    color: var(--tg-fg-subtle);
  }
  .usage-pill {
    padding: 1px 8px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--tg-primary) 10%, transparent);
    color: var(--tg-primary);
    font-weight: 500;
  }
  .usage-none {
    color: var(--tg-fg-subtle);
    font-style: italic;
  }
  .pipe-actions {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
  }

  .mode-table {
    border: 1px solid var(--tg-border);
    border-radius: 14px;
    overflow: hidden;
    background: var(--tg-bg-elevated);
  }
  .mode-head,
  .mode-row {
    display: grid;
    grid-template-columns: 1fr 1.5fr;
    gap: 12px;
    padding: 14px 16px;
    align-items: center;
  }
  .mode-head {
    background: var(--tg-bg-input);
    border-bottom: 1px solid var(--tg-border);
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    color: var(--tg-fg-subtle);
    font-weight: 600;
  }
  .mode-row + .mode-row {
    border-top: 1px solid var(--tg-border);
  }
  .mode-label {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
  }
  .mode-row select {
    width: 100%;
    padding: 8px 12px;
    border-radius: 10px;
    border: 1px solid var(--tg-border);
    background: var(--tg-bg-input);
    color: var(--tg-fg);
    font-family: inherit;
    font-size: 13.5px;
    cursor: pointer;
  }
  .mode-row select:focus {
    outline: none;
    border-color: var(--tg-primary);
    box-shadow: 0 0 0 3px var(--tg-ring);
  }

  .toggle-list,
  .textarea-stack,
  .memory-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .toggle-row {
    display: flex;
    justify-content: space-between;
    gap: 16px;
    align-items: center;
    padding: 14px 16px;
    border: 1px solid var(--tg-border);
    border-radius: 14px;
    background: var(--tg-bg-elevated);
  }
  .toggle-row span {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .toggle-row strong {
    font-size: 14px;
    font-weight: 500;
  }
  .toggle-row small {
    color: var(--tg-fg-muted);
    font-size: 12.5px;
    line-height: 1.45;
  }
  .toggle-row input {
    width: 18px;
    height: 18px;
    accent-color: var(--tg-primary);
  }
  .form-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    margin-top: 18px;
  }
  @media (max-width: 720px) {
    .form-grid {
      grid-template-columns: 1fr;
    }
  }
  .form-grid label,
  .textarea-stack label {
    display: flex;
    flex-direction: column;
    gap: 7px;
  }
  .form-grid label > span,
  .textarea-stack label > span {
    color: var(--tg-fg-subtle);
    font-size: 11.5px;
    font-weight: 600;
    letter-spacing: 0.07em;
    text-transform: uppercase;
  }
  .form-grid select,
  .textarea-stack input,
  .textarea-stack textarea {
    width: 100%;
    border: 1px solid var(--tg-border);
    border-radius: 12px;
    background: var(--tg-bg-input);
    color: var(--tg-fg);
    font: inherit;
    font-size: 13.5px;
    padding: 10px 12px;
  }
  @media (max-width: 720px) {
    .rail-item {
      flex: 0 0 auto;
      white-space: nowrap;
    }
  }
  .textarea-stack {
    margin-top: 12px;
  }
  .textarea-stack textarea {
    resize: vertical;
    min-height: 86px;
    line-height: 1.5;
  }
  .form-grid select:focus,
  .textarea-stack input:focus,
  .textarea-stack textarea:focus {
    outline: none;
    border-color: var(--tg-primary);
    box-shadow: 0 0 0 3px var(--tg-ring);
  }
  .memory-list {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .memory-list li {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    padding: 13px 15px;
    background: var(--tg-bg-elevated);
    border: 1px solid var(--tg-border);
    border-radius: 14px;
  }
  .memory-list li > div {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }
  .memory-list strong {
    font-size: 14px;
    font-weight: 500;
  }
  .memory-list span {
    color: var(--tg-fg-muted);
    font-size: 12.5px;
  }
  .backup-card {
    margin-top: 24px;
    padding: 18px;
    border: 1px solid var(--tg-border);
    border-radius: 14px;
    background: var(--tg-bg-elevated);
  }
  .backup-card-head {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 16px;
    margin-bottom: 16px;
  }
  .backup-card-head h3 {
    margin: 0 0 4px;
    font-size: 15px;
    font-weight: 550;
  }
  .backup-card-head p {
    margin: 0;
    color: var(--tg-fg-muted);
    font-size: 12.5px;
    line-height: 1.5;
    max-width: 540px;
  }
  .token-chip {
    flex: 0 0 auto;
    padding: 4px 9px;
    border-radius: 999px;
    border: 1px solid var(--tg-border);
    color: var(--tg-fg-muted);
    background: var(--tg-bg-input);
    font-size: 11.5px;
    font-weight: 600;
  }
  .token-chip.saved {
    border-color: color-mix(in srgb, var(--tg-accent) 26%, var(--tg-border));
    color: var(--tg-accent);
    background: color-mix(in srgb, var(--tg-accent) 9%, transparent);
  }
  .backup-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
    margin-bottom: 14px;
  }
  .backup-grid label,
  .token-row {
    display: flex;
    flex-direction: column;
    gap: 7px;
  }
  .backup-grid label > span,
  .token-row > span {
    color: var(--tg-fg-subtle);
    font-size: 11.5px;
    font-weight: 600;
    letter-spacing: 0.07em;
    text-transform: uppercase;
  }
  .backup-grid input,
  .token-row input {
    width: 100%;
    min-width: 0;
    border: 1px solid var(--tg-border);
    border-radius: 12px;
    background: var(--tg-bg-input);
    color: var(--tg-fg);
    font: inherit;
    font-size: 13.5px;
    padding: 10px 12px;
  }
  .backup-grid input:focus,
  .token-row input:focus {
    outline: none;
    border-color: var(--tg-primary);
    box-shadow: 0 0 0 3px var(--tg-ring);
  }
  .token-row {
    margin-bottom: 14px;
  }
  .token-row > div {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto auto;
    gap: 8px;
    align-items: center;
  }
  .backup-ok a {
    color: inherit;
    font-family: var(--font-mono);
    font-weight: 600;
  }
  @media (max-width: 720px) {
    .backup-card {
      padding: 16px;
    }
    .backup-card-head {
      flex-direction: column;
      align-items: stretch;
    }
    .token-chip {
      width: fit-content;
    }
    .backup-grid,
    .token-row > div {
      grid-template-columns: 1fr;
    }
  }
  .backup-actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px;
    margin-bottom: 10px;
  }
  .file-pick {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 34px;
    padding: 7px 13px;
    border-radius: 999px;
    border: 1px solid var(--tg-border);
    background: var(--tg-bg-elevated);
    color: var(--tg-fg);
    cursor: pointer;
    font-size: 13px;
    font-weight: 500;
  }
  .file-pick input {
    position: absolute;
    inset: 0;
    opacity: 0;
    cursor: pointer;
  }
  .backup-preview {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 14px 16px;
    border-radius: 14px;
    border: 1px solid var(--tg-border);
    background: var(--tg-bg-elevated);
    margin-top: 18px;
  }
  .backup-preview strong {
    font-size: 14px;
    font-weight: 500;
  }
  .backup-preview span {
    flex: 1;
    color: var(--tg-fg-muted);
    font-size: 12.5px;
  }
  .backup-ok,
  .backup-error {
    margin: 14px 0 0;
    padding: 9px 11px;
    border-radius: 10px;
    font-size: 12.5px;
    line-height: 1.45;
  }
  .backup-ok {
    background: color-mix(in srgb, var(--tg-accent) 10%, transparent);
    color: var(--tg-accent);
  }
  .backup-error {
    background: color-mix(in srgb, var(--tg-danger) 10%, transparent);
    color: var(--tg-danger);
  }

  .about {
    color: var(--tg-fg-muted);
    font-size: 14px;
    line-height: 1.65;
    margin: 0;
  }
</style>
