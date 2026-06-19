<script lang="ts">
  import type { ProviderKind } from '@tragents/shared';
  import { COMPAT_PRESETS } from '@tragents/core';
  import Field from './Field.svelte';
  import Input from './Input.svelte';
  import Select from './Select.svelte';
  import Button from './Button.svelte';
  import Chip from './Chip.svelte';
  import Icon from './Icon.svelte';
  import { i18n } from '$lib/i18n.svelte';

  interface Props {
    onSave: (data: {
      kind: ProviderKind;
      name: string;
      baseURL?: string;
      apiKey: string;
      defaultModel?: string;
    }) => Promise<void> | void;
    onCancel?: () => void;
    submitLabel?: string;
  }

  let { onSave, onCancel, submitLabel }: Props = $props();

  let kind = $state<ProviderKind>('anthropic');
  let name = $state('');
  let baseURL = $state('');
  let apiKey = $state('');
  let defaultModel = $state('');
  let revealKey = $state(false);
  let saving = $state(false);
  let error = $state<string | null>(null);

  const kindOptions = [
    { value: 'anthropic', label: 'Anthropic' },
    { value: 'openai', label: 'OpenAI' },
    { value: 'openai-compat', label: 'OpenAI-compatible' },
  ];

  let nameTouched = $state(false);
  $effect(() => {
    if (!nameTouched) {
      if (kind === 'anthropic') name = 'Anthropic';
      else if (kind === 'openai') name = 'OpenAI';
      else name = '';
    }
  });

  function applyPreset(presetId: string) {
    const preset = COMPAT_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    name = preset.label;
    nameTouched = true;
    baseURL = preset.baseURL;
  }

  async function save() {
    error = null;
    if (!name.trim()) {
      error = i18n.t('provider.errors.noName');
      return;
    }
    if (kind === 'openai-compat' && !baseURL.trim()) {
      error = i18n.t('provider.errors.noBaseURL');
      return;
    }
    const isOllama = kind === 'openai-compat' && baseURL.includes('localhost');
    if (!apiKey.trim() && !isOllama) {
      error = i18n.t('provider.errors.noKey');
      return;
    }
    if (!defaultModel.trim()) {
      error = i18n.t('provider.errors.noModel');
      return;
    }

    saving = true;
    try {
      await onSave({
        kind,
        name: name.trim(),
        baseURL: baseURL.trim() || undefined,
        apiKey: apiKey.trim() || 'no-key-required',
        defaultModel: defaultModel.trim(),
      });
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    } finally {
      saving = false;
    }
  }
</script>

<form
  class="form"
  onsubmit={(e: SubmitEvent) => {
    e.preventDefault();
    save();
  }}
>
  <Field label={i18n.t('provider.type')}>
    <Select bind:value={kind} options={kindOptions} />
  </Field>

  {#if kind === 'openai-compat'}
    <div class="presets">
      <p class="presets-label">{i18n.t('provider.quickPresets')}</p>
      <div class="preset-row">
        {#each COMPAT_PRESETS as preset (preset.id)}
          <Chip
            onclick={() => applyPreset(preset.id)}
            selected={baseURL === preset.baseURL}
            title={preset.hint}
          >
            <span>{preset.label}</span>
          </Chip>
        {/each}
      </div>
    </div>

    <Field label={i18n.t('provider.baseURL')} hint={i18n.t('provider.baseURLHint')}>
      <Input bind:value={baseURL} placeholder="https://api.example.com" />
    </Field>
  {/if}

  <Field label={i18n.t('provider.displayName')} hint={i18n.t('provider.displayNameHint')}>
    <Input
      bind:value={name}
      placeholder={i18n.t('provider.displayName')}
      oninput={() => (nameTouched = true)}
    />
  </Field>

  <Field
    label={i18n.t('provider.apiKey')}
    hint={kind === 'openai-compat' && baseURL.includes('localhost')
      ? i18n.t('provider.apiKeyLocalHint')
      : i18n.t('provider.apiKeyHint')}
  >
    <div class="key-row">
      <Input
        bind:value={apiKey}
        type={revealKey ? 'text' : 'password'}
        placeholder="sk-..."
        autocomplete="off"
        spellcheck={false}
        monospace
      />
      <button
        type="button"
        class="reveal"
        onclick={() => (revealKey = !revealKey)}
        aria-label={revealKey ? i18n.t('provider.hideKey') : i18n.t('provider.showKey')}
      >
        <Icon name={revealKey ? 'eye-off' : 'eye'} size={16} />
      </button>
    </div>
  </Field>

  <Field
    label={i18n.t('provider.defaultModel')}
    hint={i18n.t('provider.defaultModelHint')}
  >
    <Input bind:value={defaultModel} placeholder="model-id" monospace />
  </Field>

  {#if error}
    <p class="error">{error}</p>
  {/if}

  <div class="actions">
    {#if onCancel}
      <Button variant="ghost" onclick={onCancel}>{i18n.t('common.cancel')}</Button>
    {/if}
    <Button type="submit" disabled={saving} loading={saving}>
      {submitLabel ?? i18n.t('provider.saveProvider')}
    </Button>
  </div>
</form>

<style>
  .form {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .presets {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .presets-label {
    margin: 0;
    font-size: 12px;
    color: var(--tg-fg-muted);
  }
  .preset-row {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .key-row {
    position: relative;
    display: flex;
    align-items: center;
  }
  .reveal {
    position: absolute;
    right: 6px;
    background: transparent;
    border: none;
    color: var(--tg-fg-muted);
    cursor: pointer;
    padding: 6px;
    border-radius: 6px;
    display: inline-flex;
  }
  .reveal:hover {
    color: var(--tg-fg);
    background: var(--tg-border);
  }
  .error {
    margin: 0;
    padding: 9px 12px;
    border-radius: 10px;
    background: color-mix(in srgb, var(--tg-danger) 10%, transparent);
    color: var(--tg-danger);
    font-size: 13px;
  }
  .actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 4px;
  }
</style>
