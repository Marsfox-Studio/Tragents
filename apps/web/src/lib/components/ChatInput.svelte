<script lang="ts">
  import {
    LANGUAGES,
    findLanguage,
    type LanguageCode,
    type ModeKey,
    type Pipeline,
    type TranslationMode,
  } from '@tragents/shared';
  import Icon from './Icon.svelte';
  import Chip from './Chip.svelte';
  import { base } from '$app/paths';
  import { i18n } from '$lib/i18n.svelte';
  import { settings } from '$lib/stores';

  interface Props {
    value?: string;
    placeholder?: string;
    disabled?: boolean;
    source: LanguageCode;
    target: LanguageCode;
    mode?: TranslationMode;
    pipelineId?: string | undefined;
    compact?: boolean;
    queueing?: boolean;
    queuedCount?: number;
    onSubmit: (text: string) => void;
  }

  let {
    value = $bindable(''),
    placeholder,
    disabled = false,
    source = $bindable(),
    target = $bindable(),
    mode = $bindable('auto'),
    pipelineId = $bindable(undefined),
    compact = false,
    queueing = false,
    queuedCount = 0,
    onSubmit,
  }: Props = $props();

  let textarea: HTMLTextAreaElement | undefined = $state();
  let langDialog: HTMLDialogElement | undefined = $state();
  let modeDialog: HTMLDialogElement | undefined = $state();
  let pipelineDialog: HTMLDialogElement | undefined = $state();
  let focused = $state(false);
  let dragOver = $state(false);
  let dropError = $state<string | null>(null);

  const sourceShort = $derived(findLanguage(source)?.code.toUpperCase() ?? '?');
  const targetShort = $derived(findLanguage(target)?.nativeName ?? findLanguage(target)?.code ?? '?');
  const targetLanguages = $derived(LANGUAGES.filter((l) => l.code !== 'auto'));

  const MODES: Array<{ id: TranslationMode }> = [
    { id: 'auto' },
    { id: 'text' },
    { id: 'long-form' },
    { id: 'i18n' },
    { id: 'document' },
    { id: 'code-docs' },
    { id: 'subtitles' },
    { id: 'ptp' },
  ];

  const modeLabel = $derived(i18n.t(`chat.mode${capitalize(mode)}`));

  const activePipeline = $derived.by<Pipeline | undefined>(() => {
    if (pipelineId) {
      const found = settings.pipelineById(pipelineId);
      if (found) return found;
    }
    const lookupKey: ModeKey = mode === 'auto' ? 'text' : (mode as ModeKey);
    return settings.pipelineForMode(lookupKey);
  });

  const hasValue = $derived(value.trim().length > 0);
  const expanded = $derived(focused || hasValue);

  function capitalize(s: string): string {
    return s
      .split('-')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join('');
  }

  function autoresize() {
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, compact ? 180 : 320) + 'px';
  }

  function submit() {
    const text = value.trim();
    if (!text || disabled) return;
    onSubmit(text);
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.isComposing) {
      e.preventDefault();
      submit();
    }
  }

  function swapLangs() {
    if (source === 'auto') return;
    const s = source;
    source = target;
    target = s;
  }

  function languageLabel(code: LanguageCode): string {
    const lang = findLanguage(code);
    if (!lang) return code;
    return lang.nativeName === lang.name ? lang.name : `${lang.name} · ${lang.nativeName}`;
  }

  function selectSource(code: LanguageCode) {
    source = code;
  }

  function selectTarget(code: LanguageCode) {
    target = code;
  }

  function selectMode(m: TranslationMode) {
    mode = m;
    modeDialog?.close();
  }

  function selectPipeline(id: string) {
    pipelineId = id;
    pipelineDialog?.close();
  }

  function clearPipelineOverride() {
    pipelineId = undefined;
    pipelineDialog?.close();
  }

  const EXT_TO_MODE: Record<string, TranslationMode> = {
    json: 'i18n',
    jsonc: 'i18n',
    yaml: 'i18n',
    yml: 'i18n',
    po: 'i18n',
    pot: 'i18n',
    md: 'document',
    markdown: 'document',
    html: 'document',
    htm: 'document',
    txt: 'auto',
    rst: 'document',
    tex: 'document',
    ts: 'code-docs',
    tsx: 'code-docs',
    js: 'code-docs',
    jsx: 'code-docs',
    py: 'code-docs',
    go: 'code-docs',
    rs: 'code-docs',
    srt: 'subtitles',
    vtt: 'subtitles',
  };

  const MAX_DROP_BYTES = 5 * 1024 * 1024;

  function modeFromFilename(name: string): TranslationMode | undefined {
    const ext = name.toLowerCase().split('.').pop();
    if (!ext) return undefined;
    return EXT_TO_MODE[ext];
  }

  async function handleFile(file: File) {
    dropError = null;
    if (file.size > MAX_DROP_BYTES) {
      dropError = i18n.t('chat.dropTooLarge', {
        mb: Math.round(file.size / 1024 / 1024),
      });
      return;
    }
    try {
      const text = await file.text();
      value = text;
      const detected = modeFromFilename(file.name);
      if (detected) mode = detected;
      queueMicrotask(() => textarea?.focus());
    } catch (err) {
      dropError = err instanceof Error ? err.message : String(err);
    }
  }

  function handleDragOver(e: DragEvent) {
    if (!e.dataTransfer?.types.includes('Files')) return;
    e.preventDefault();
    dragOver = true;
  }

  function handleDragLeave(e: DragEvent) {
    if (e.currentTarget === e.target) dragOver = false;
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    dragOver = false;
    const file = e.dataTransfer?.files?.[0];
    if (file) handleFile(file);
  }

  async function handleFilePick(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (file) await handleFile(file);
    input.value = '';
  }

  $effect(() => {
    value;
    queueMicrotask(autoresize);
  });

  const resolvedPlaceholder = $derived(
    placeholder ?? (queueing ? i18n.t('chat.queuePlaceholder') : i18n.t('home.placeholder')),
  );
</script>

<form
  class="wrap"
  class:compact
  onsubmit={(e: SubmitEvent) => {
    e.preventDefault();
    submit();
  }}
>
  <div
    class="card"
    class:focused
    class:disabled
    class:expanded
    class:dragover={dragOver}
    class:queueing
    ondragover={handleDragOver}
    ondragleave={handleDragLeave}
    ondrop={handleDrop}
    role="region"
    aria-label={i18n.t('chat.dropHint')}
  >
    <div class="primary">
      <textarea
        bind:this={textarea}
        bind:value
        oninput={autoresize}
        onkeydown={handleKeydown}
        onfocus={() => (focused = true)}
        onblur={() => (focused = false)}
        placeholder={resolvedPlaceholder}
        {disabled}
        rows="1"
        aria-label={resolvedPlaceholder}
      ></textarea>
      <button
        type="submit"
        class="send"
        aria-label={queueing ? i18n.t('chat.queue') : i18n.t('home.submit')}
        disabled={disabled || !value.trim()}
      >
        {#if queueing}
          <Icon name="plus" size={16} />
        {:else}
          <Icon name="arrow-right" size={16} />
        {/if}
      </button>
    </div>

    <div class="chips-area">
      <div class="chips-inner">
        <div class="chips">
          <label class="file-chip" title={i18n.t('chat.attachFile')}>
            <Icon name="paperclip" size={14} />
            <input
              type="file"
              accept=".json,.jsonc,.yaml,.yml,.po,.pot,.md,.markdown,.html,.htm,.txt,.rst,.tex,.ts,.tsx,.js,.jsx,.py,.go,.rs,.srt,.vtt"
              onchange={handleFilePick}
            />
          </label>

          <Chip onclick={() => langDialog?.showModal()} title={i18n.t('chat.languages')}>
            <Icon name="globe" size={14} />
            <span>{sourceShort} → {targetShort}</span>
          </Chip>

          <Chip onclick={() => modeDialog?.showModal()} title={i18n.t('chat.mode')}>
            <Icon name="sparkles" size={14} />
            <span>{modeLabel}</span>
          </Chip>

          {#if activePipeline}
            <Chip
              onclick={() => pipelineDialog?.showModal()}
              title={i18n.t('chat.pipelineTitle')}
              selected={pipelineId !== undefined}
            >
              <Icon name="sliders" size={14} />
              <span>{activePipeline.name}</span>
            </Chip>
          {/if}

          {#if queuedCount > 0}
            <span class="queue-badge" title={i18n.t('chat.queuedHint')}>
              <Icon name="message-square" size={13} />
              <span>{queuedCount}</span>
            </span>
          {/if}
        </div>
      </div>
    </div>

    {#if dragOver}
      <div class="drop-overlay" aria-hidden="true">
        <Icon name="paperclip" size={28} />
        <span>{i18n.t('chat.dropRelease')}</span>
      </div>
    {/if}

    {#if dropError}
      <p class="drop-error">{dropError}</p>
    {/if}
  </div>
</form>

<dialog bind:this={langDialog} class="picker-dialog">
  <div class="picker-head">
    <h2>{i18n.t('chat.languagesTitle')}</h2>
    <button class="x" onclick={() => langDialog?.close()} aria-label={i18n.t('common.close')}>
      <Icon name="x" size={16} />
    </button>
  </div>
  <div class="lang-body">
    <div class="lang-col">
      <span class="lang-label">{i18n.t('chat.from')}</span>
      <div class="language-list" role="listbox" aria-label={i18n.t('chat.from')}>
        {#each LANGUAGES as l (l.code)}
          <button
            type="button"
            class="language-option"
            class:selected={source === l.code}
            role="option"
            aria-selected={source === l.code}
            onclick={() => selectSource(l.code)}
          >
            <span class="language-name">{languageLabel(l.code)}</span>
            <span class="language-code">{l.code.toUpperCase()}</span>
          </button>
        {/each}
      </div>
    </div>
    <button
      class="swap"
      onclick={swapLangs}
      aria-label={i18n.t('chat.swap')}
      disabled={source === 'auto'}
    >
      <Icon name="arrow-right" size={16} />
    </button>
    <div class="lang-col">
      <span class="lang-label">{i18n.t('chat.to')}</span>
      <div class="language-list" role="listbox" aria-label={i18n.t('chat.to')}>
        {#each targetLanguages as l (l.code)}
          <button
            type="button"
            class="language-option"
            class:selected={target === l.code}
            role="option"
            aria-selected={target === l.code}
            onclick={() => selectTarget(l.code)}
          >
            <span class="language-name">{languageLabel(l.code)}</span>
            <span class="language-code">{l.code.toUpperCase()}</span>
          </button>
        {/each}
      </div>
    </div>
  </div>
  <div class="picker-foot">
    <button class="primary-btn" onclick={() => langDialog?.close()}>{i18n.t('common.done')}</button>
  </div>
</dialog>

<dialog bind:this={modeDialog} class="picker-dialog">
  <div class="picker-head">
    <h2>{i18n.t('chat.mode')}</h2>
    <button class="x" onclick={() => modeDialog?.close()} aria-label={i18n.t('common.close')}>
      <Icon name="x" size={16} />
    </button>
  </div>
  <ul class="mode-list">
    {#each MODES as m (m.id)}
      <li>
        <button
          class="mode-row"
          class:selected={mode === m.id}
          onclick={() => selectMode(m.id)}
        >
          <span class="mode-name">{i18n.t(`chat.mode${capitalize(m.id)}`)}</span>
          <span class="mode-hint">
            {#if m.id === 'auto'}
              {i18n.t('chat.modeHintAuto')}
            {:else if m.id === 'long-form'}
              {i18n.t('chat.modeHintLongForm')}
            {:else if m.id === 'i18n'}
              {i18n.t('chat.modeHintI18n')}
            {:else if m.id === 'document'}
              {i18n.t('chat.modeHintDocument')}
            {:else if m.id === 'code-docs'}
              {i18n.t('chat.modeHintCodeDocs')}
            {:else if m.id === 'subtitles'}
              {i18n.t('chat.modeHintSubtitles')}
            {:else if m.id === 'ptp'}
              {i18n.t('chat.modeHintPtp')}
            {/if}
          </span>
          {#if mode === m.id}
            <span class="check"><Icon name="check" size={14} /></span>
          {/if}
        </button>
      </li>
    {/each}
  </ul>
  <div class="picker-foot">
    <button class="primary-btn" onclick={() => modeDialog?.close()}>{i18n.t('common.done')}</button>
  </div>
</dialog>

<dialog bind:this={pipelineDialog} class="picker-dialog">
  <div class="picker-head">
    <h2>{i18n.t('chat.pipelineTitle')}</h2>
    <button
      class="x"
      onclick={() => pipelineDialog?.close()}
      aria-label={i18n.t('common.close')}
    >
      <Icon name="x" size={16} />
    </button>
  </div>
  <p class="dialog-hint">{i18n.t('chat.pipelineHint')}</p>
  <ul class="mode-list">
    <li>
      <button
        class="mode-row"
        class:selected={pipelineId === undefined}
        onclick={clearPipelineOverride}
      >
        <span class="mode-name">{i18n.t('chat.modeAuto')}</span>
        <span class="mode-hint">{i18n.t('chat.pipelineHint')}</span>
        {#if pipelineId === undefined}
          <span class="check"><Icon name="check" size={14} /></span>
        {/if}
      </button>
    </li>
    {#each settings.current.pipelines as p (p.id)}
      <li>
        <button
          class="mode-row"
          class:selected={pipelineId === p.id ||
            (pipelineId === undefined && activePipeline?.id === p.id)}
          onclick={() => selectPipeline(p.id)}
        >
          <span class="mode-name">{p.name}</span>
          <span class="mode-hint">
            {i18n.t('pipelines.summary', {
              translators: p.translators,
              reviewers: p.reviewers,
              cons: p.withConsistency ? i18n.t('pipelines.consistencySuffix') : '',
            })}
          </span>
          {#if pipelineId === p.id}
            <span class="check"><Icon name="check" size={14} /></span>
          {/if}
        </button>
      </li>
    {/each}
  </ul>
  <div class="picker-foot">
    <a class="manage-link" href={`${base}/settings?section=pipelines`}>{i18n.t('chat.pipelineManage')}</a>
    <button class="primary-btn" onclick={() => pipelineDialog?.close()}>
      {i18n.t('common.done')}
    </button>
  </div>
</dialog>

<style>
  .wrap {
    width: 100%;
    max-width: 720px;
  }
  .wrap.compact {
    max-width: 420px;
  }

  .card {
    position: relative;
    background: var(--tg-bg-input);
    border: 1px solid var(--tg-border);
    border-radius: 999px;
    padding: 5px 5px 5px 18px;
    display: flex;
    flex-direction: column;
    backdrop-filter: blur(22px) saturate(1.4);
    -webkit-backdrop-filter: blur(22px) saturate(1.4);
    transition:
      border-radius 320ms cubic-bezier(0.4, 0, 0.2, 1),
      padding 320ms cubic-bezier(0.4, 0, 0.2, 1),
      border-color 220ms cubic-bezier(0.4, 0, 0.2, 1),
      box-shadow 320ms cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow:
      0 1px 2px rgba(0, 0, 0, 0.04),
      0 8px 24px -14px rgba(0, 0, 0, 0.1);
  }

  /* Dark theme uses a subtle light halo instead of a colored panel. */
  :global([data-theme='dark']) .card {
    background: var(--tg-bg-input);
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
    box-shadow:
      0 0 50px -10px rgba(255, 220, 180, 0.14),
      0 0 90px -20px rgba(180, 210, 255, 0.12),
      0 0 0 1px var(--tg-border),
      0 10px 32px -16px rgba(0, 0, 0, 0.5);
  }
  :global([data-theme='dark']) .card.focused {
    box-shadow:
      0 0 70px -10px rgba(255, 220, 180, 0.22),
      0 0 110px -20px rgba(180, 210, 255, 0.18),
      0 0 0 3px var(--tg-ring),
      0 12px 40px -14px rgba(0, 0, 0, 0.55);
  }
  .card.expanded {
    border-radius: 22px;
    padding: 12px 12px 8px 16px;
  }
  .card.focused {
    border-color: color-mix(in srgb, var(--tg-primary) 32%, var(--tg-border));
    box-shadow:
      0 0 0 3px var(--tg-ring),
      0 10px 32px -12px rgba(0, 0, 0, 0.14);
  }
  .card.disabled {
    opacity: 0.7;
    pointer-events: none;
  }
  .card.dragover {
    border-color: var(--tg-primary);
    box-shadow:
      0 0 0 4px var(--tg-ring),
      0 14px 40px -10px rgba(0, 0, 0, 0.18);
  }
  .card.queueing.focused {
    border-color: color-mix(in srgb, var(--tg-accent) 50%, var(--tg-border));
  }

  .primary {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    min-height: 36px;
  }

  textarea {
    flex: 1;
    border: none;
    outline: none;
    background: transparent;
    resize: none;
    font-family: var(--font-sans);
    font-size: 15px;
    line-height: 1.5;
    color: var(--tg-fg);
    padding: 6px 0;
    max-height: 320px;
  }
  textarea::placeholder {
    color: var(--tg-fg-subtle);
  }

  .send {
    flex-shrink: 0;
    background: var(--tg-primary);
    color: var(--tg-primary-fg);
    border: none;
    width: 36px;
    height: 36px;
    border-radius: 999px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition:
      background 180ms,
      transform 120ms,
      opacity 200ms;
    box-shadow: 0 1px 0 rgba(255, 255, 255, 0.08) inset;
  }
  .send:hover:not(:disabled) {
    background: var(--tg-primary-hover);
  }
  .send:active:not(:disabled) {
    transform: scale(0.92);
  }
  .send:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }

  .chips-area {
    display: grid;
    grid-template-rows: 0fr;
    margin-top: 0;
    transition:
      grid-template-rows 320ms cubic-bezier(0.4, 0, 0.2, 1),
      margin-top 320ms cubic-bezier(0.4, 0, 0.2, 1);
  }
  .card.expanded .chips-area {
    grid-template-rows: 1fr;
    margin-top: 8px;
  }
  .chips-inner {
    overflow: hidden;
    min-height: 0;
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    align-items: center;
    padding: 2px 0 0;
  }

  .file-chip {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 30px;
    border: 1px solid var(--tg-border);
    border-radius: 999px;
    color: var(--tg-fg-muted);
    cursor: pointer;
    transition:
      background 160ms,
      color 160ms,
      border-color 160ms;
  }
  .file-chip:hover {
    background: var(--tg-bg-elevated);
    color: var(--tg-fg);
    border-color: var(--tg-border-strong);
  }
  .file-chip input {
    position: absolute;
    width: 1px;
    height: 1px;
    opacity: 0;
    overflow: hidden;
  }

  .queue-badge {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 4px 9px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--tg-accent) 14%, transparent);
    color: var(--tg-fg);
    font-size: 12px;
    font-weight: 500;
    border: 1px solid color-mix(in srgb, var(--tg-accent) 30%, transparent);
  }

  .drop-overlay {
    position: absolute;
    inset: 0;
    background: color-mix(in srgb, var(--tg-primary) 8%, var(--tg-bg-input));
    border-radius: 22px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    color: var(--tg-primary);
    pointer-events: none;
    font-weight: 500;
    font-size: 13px;
  }
  .drop-error {
    margin: 6px 0 0;
    padding: 6px 10px;
    border-radius: 8px;
    background: color-mix(in srgb, var(--tg-danger) 10%, transparent);
    color: var(--tg-danger);
    font-size: 12.5px;
  }

  .picker-dialog {
    border: 1px solid var(--tg-border);
    border-radius: 20px;
    background: var(--tg-bg-elevated);
    backdrop-filter: blur(28px) saturate(1.4);
    -webkit-backdrop-filter: blur(28px) saturate(1.4);
    color: var(--tg-fg);
    padding: 0;
    width: min(520px, 92vw);
    max-height: min(80vh, 720px);
    position: fixed;
    inset: 0;
    margin: auto;
    box-shadow: 0 24px 80px -20px rgba(0, 0, 0, 0.42);
    opacity: 0;
    transform: scale(0.94) translateY(8px);
    transition:
      opacity 240ms cubic-bezier(0.4, 0, 0.2, 1),
      transform 240ms cubic-bezier(0.4, 0, 0.2, 1),
      overlay 240ms cubic-bezier(0.4, 0, 0.2, 1) allow-discrete,
      display 240ms cubic-bezier(0.4, 0, 0.2, 1) allow-discrete;
  }
  .picker-dialog[open] {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
  @starting-style {
    .picker-dialog[open] {
      opacity: 0;
      transform: scale(0.94) translateY(8px);
    }
  }
  .picker-dialog::backdrop {
    background: rgba(8, 8, 12, 0.34);
    backdrop-filter: blur(8px);
    opacity: 0;
    transition:
      opacity 240ms cubic-bezier(0.4, 0, 0.2, 1),
      backdrop-filter 240ms cubic-bezier(0.4, 0, 0.2, 1),
      overlay 240ms cubic-bezier(0.4, 0, 0.2, 1) allow-discrete,
      display 240ms cubic-bezier(0.4, 0, 0.2, 1) allow-discrete;
  }
  .picker-dialog[open]::backdrop {
    opacity: 1;
  }
  @starting-style {
    .picker-dialog[open]::backdrop {
      opacity: 0;
      backdrop-filter: blur(0);
    }
  }

  .picker-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 18px 18px 0;
  }
  .picker-head h2 {
    margin: 0;
    font-size: 17px;
    font-weight: 500;
  }
  .dialog-hint {
    margin: 8px 18px 0;
    color: var(--tg-fg-muted);
    font-size: 13px;
  }
  .x {
    background: transparent;
    border: none;
    color: var(--tg-fg-muted);
    cursor: pointer;
    padding: 6px;
    border-radius: 8px;
    display: inline-flex;
  }
  .x:hover {
    background: var(--tg-border);
    color: var(--tg-fg);
  }
  .picker-foot {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0 18px 18px;
    gap: 12px;
  }
  .picker-foot .primary-btn {
    margin-left: auto;
  }
  .manage-link {
    color: var(--tg-primary);
    text-decoration: none;
    font-size: 13px;
    padding: 8px 4px;
  }
  .manage-link:hover {
    text-decoration: underline;
  }
  .primary-btn {
    background: var(--tg-primary);
    color: var(--tg-primary-fg);
    border: none;
    padding: 8px 16px;
    border-radius: 999px;
    cursor: pointer;
    font-weight: 500;
    font-size: 14px;
    font-family: inherit;
  }
  .primary-btn:hover {
    background: var(--tg-primary-hover);
  }

  .lang-body {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
    align-items: stretch;
    gap: 10px;
    padding: 18px;
  }
  .lang-col {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .lang-label {
    font-size: 12px;
    color: var(--tg-fg-muted);
    font-weight: 500;
  }
  .language-list {
    max-height: min(42vh, 360px);
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 6px;
    border: 1px solid var(--tg-border);
    border-radius: 14px;
    background: color-mix(in srgb, var(--tg-bg-input) 82%, transparent);
  }
  .language-option {
    width: 100%;
    min-height: 38px;
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    gap: 10px;
    padding: 8px 10px;
    border-radius: 10px;
    border: 1px solid transparent;
    background: transparent;
    color: var(--tg-fg);
    font-family: inherit;
    text-align: left;
    cursor: pointer;
    transition:
      background 160ms,
      border-color 160ms,
      color 160ms;
  }
  .language-option:hover {
    background: var(--tg-bg-elevated);
    border-color: var(--tg-border);
  }
  .language-option.selected {
    background: color-mix(in srgb, var(--tg-primary) 10%, transparent);
    border-color: color-mix(in srgb, var(--tg-primary) 38%, var(--tg-border));
    color: var(--tg-fg);
  }
  .language-name {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 13.5px;
    font-weight: 500;
  }
  .language-code {
    color: var(--tg-fg-subtle);
    font-size: 10.5px;
    letter-spacing: 0.06em;
    font-weight: 650;
  }
  .swap {
    background: transparent;
    border: 1px solid var(--tg-border);
    width: 36px;
    height: 38px;
    border-radius: 10px;
    color: var(--tg-fg-muted);
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    transition:
      background 160ms,
      transform 160ms,
      color 160ms;
    align-self: center;
    margin-top: 24px;
  }
  .swap:hover:not(:disabled) {
    background: var(--tg-bg-elevated);
    color: var(--tg-fg);
  }
  .swap:active:not(:disabled) {
    transform: rotate(180deg) scale(0.94);
  }
  .swap:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  @media (max-width: 640px) {
    .lang-body {
      grid-template-columns: 1fr;
    }
    .swap {
      width: 100%;
      margin-top: 0;
      transform: rotate(90deg);
    }
    .swap:active:not(:disabled) {
      transform: rotate(270deg) scale(0.94);
    }
  }

  .mode-list {
    list-style: none;
    margin: 0;
    padding: 14px 12px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    max-height: 50vh;
    overflow-y: auto;
  }
  .mode-row {
    position: relative;
    width: 100%;
    display: grid;
    grid-template-columns: 1fr auto;
    column-gap: 10px;
    align-items: center;
    padding: 10px 12px;
    border: 1px solid transparent;
    border-radius: 10px;
    background: transparent;
    color: inherit;
    font-family: inherit;
    text-align: left;
    cursor: pointer;
    transition:
      background 160ms,
      border-color 160ms;
  }
  .mode-row:hover:not(:disabled) {
    background: var(--tg-bg-input);
  }
  .mode-row.selected {
    border-color: var(--tg-primary);
    background: color-mix(in srgb, var(--tg-primary) 7%, transparent);
  }
  .mode-name {
    font-size: 14px;
    font-weight: 500;
    color: var(--tg-fg);
  }
  .mode-hint {
    grid-column: 1 / -1;
    font-size: 12px;
    color: var(--tg-fg-subtle);
    margin-top: 2px;
  }
  .check {
    color: var(--tg-primary);
  }
</style>
