<script lang="ts">
  import { onMount } from 'svelte';
  import { fly, fade } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import { page } from '$app/state';
  import { replaceState } from '$app/navigation';
  import type {
    BrandPalette,
    ModeKey,
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
  import { providers, settings } from '$lib/stores';
  import { applyTheme, listPalettes } from '@tragents/ui';
  import { i18n, UI_LOCALES } from '$lib/i18n.svelte';

  type SectionId = 'appearance' | 'providers' | 'pipelines' | 'modes' | 'about';

  const SECTIONS: Array<{ id: SectionId; icon: 'sun' | 'key' | 'sliders' | 'languages' | 'sparkles' }> = [
    { id: 'appearance', icon: 'sun' },
    { id: 'providers', icon: 'key' },
    { id: 'pipelines', icon: 'sliders' },
    { id: 'modes', icon: 'languages' },
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
          <span>{i18n.t(`settings.sections.${s.id === 'modes' ? 'modeAssignments' : s.id}`)}</span>
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

  .about {
    color: var(--tg-fg-muted);
    font-size: 14px;
    line-height: 1.65;
    margin: 0;
  }
</style>
