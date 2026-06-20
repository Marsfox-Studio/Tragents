<script lang="ts">
  import type { AgentAssignment, Pipeline } from '@tragents/shared';
  import { BUILT_IN_MODELS } from '@tragents/core';
  import { providers, settings } from '$lib/stores';
  import { i18n } from '$lib/i18n.svelte';
  import Icon from './Icon.svelte';
  import Input from './Input.svelte';
  import Field from './Field.svelte';
  import Stepper from './Stepper.svelte';
  import Button from './Button.svelte';

  interface Props {
    pipeline: Pipeline;
    open: boolean;
    onClose: () => void;
  }

  let { pipeline, open, onClose }: Props = $props();

  let dialog: HTMLDialogElement | undefined = $state();
  let name = $state('');
  let translators = $state(1);
  let reviewers = $state(0);
  let withConsistency = $state(false);
  let withSummarizer = $state(false);
  let translatorAssignment = $state<AgentAssignment | undefined>(undefined);
  let reviewerAssignment = $state<AgentAssignment | undefined>(undefined);
  let consistencyAssignment = $state<AgentAssignment | undefined>(undefined);
  let summarizerAssignment = $state<AgentAssignment | undefined>(undefined);
  let saving = $state(false);

  $effect(() => {
    name = pipeline.name;
    translators = pipeline.translators;
    reviewers = pipeline.reviewers;
    withConsistency = pipeline.withConsistency;
    withSummarizer = pipeline.withSummarizer;
    translatorAssignment = pipeline.translatorAssignment;
    reviewerAssignment = pipeline.reviewerAssignment;
    consistencyAssignment = pipeline.consistencyAssignment;
    summarizerAssignment = pipeline.summarizerAssignment;
  });

  $effect(() => {
    if (open) dialog?.showModal();
    else dialog?.close();
  });

  function providerOptions() {
    return providers.list.map((p) => ({ value: p.id, label: p.name }));
  }

  function modelOptionsFor(providerId: string | undefined) {
    if (!providerId) return [];
    const p = providers.list.find((x) => x.id === providerId);
    if (!p) return [];
    return BUILT_IN_MODELS[p.kind];
  }

  function resolveAssignment(a: AgentAssignment | undefined): AgentAssignment {
    if (a && providers.list.some((p) => p.id === a.providerId)) return a;
    const fallback = providers.list[0];
    if (!fallback) return { providerId: '', modelId: '' };
    return {
      providerId: fallback.id,
      modelId: fallback.defaultModel ?? BUILT_IN_MODELS[fallback.kind][0]?.id ?? '',
    };
  }

  function changeProviderFor(
    role: 'translator' | 'reviewer' | 'consistency' | 'summarizer',
    providerId: string,
  ) {
    const p = providers.list.find((x) => x.id === providerId);
    if (!p) return;
    const modelId = p.defaultModel ?? BUILT_IN_MODELS[p.kind][0]?.id ?? '';
    const a: AgentAssignment = { providerId, modelId };
    if (role === 'translator') translatorAssignment = a;
    else if (role === 'reviewer') reviewerAssignment = a;
    else if (role === 'consistency') consistencyAssignment = a;
    else summarizerAssignment = a;
  }

  function changeModelFor(
    role: 'translator' | 'reviewer' | 'consistency' | 'summarizer',
    modelId: string,
  ) {
    if (role === 'translator' && translatorAssignment) {
      translatorAssignment = { ...translatorAssignment, modelId };
    } else if (role === 'reviewer' && reviewerAssignment) {
      reviewerAssignment = { ...reviewerAssignment, modelId };
    } else if (role === 'consistency' && consistencyAssignment) {
      consistencyAssignment = { ...consistencyAssignment, modelId };
    } else if (role === 'summarizer' && summarizerAssignment) {
      summarizerAssignment = { ...summarizerAssignment, modelId };
    }
  }

  const translatorResolved = $derived(resolveAssignment(translatorAssignment));
  const reviewerResolved = $derived(resolveAssignment(reviewerAssignment));
  const consistencyResolved = $derived(resolveAssignment(consistencyAssignment));
  const summarizerResolved = $derived(resolveAssignment(summarizerAssignment));
  const summarizerRequired = $derived(settings.current.modeAssignments.book === pipeline.id);

  $effect(() => {
    if (summarizerRequired && !withSummarizer) withSummarizer = true;
  });

  async function save() {
    saving = true;
    try {
      const nextWithSummarizer = summarizerRequired || withSummarizer;
      const structureChanged =
        translators !== pipeline.translators ||
        reviewers !== pipeline.reviewers ||
        withConsistency !== pipeline.withConsistency ||
        nextWithSummarizer !== pipeline.withSummarizer;
      await settings.updatePipeline(pipeline.id, {
        name: name.trim() || pipeline.name,
        translators,
        reviewers,
        withConsistency,
        withSummarizer: nextWithSummarizer,
        translatorAssignment,
        reviewerAssignment: reviewers > 0 ? reviewerAssignment : undefined,
        consistencyAssignment: withConsistency ? consistencyAssignment : undefined,
        summarizerAssignment: nextWithSummarizer ? summarizerAssignment : undefined,
        preset: structureChanged ? 'custom' : pipeline.preset,
      });
      onClose();
    } finally {
      saving = false;
    }
  }
</script>

<dialog
  bind:this={dialog}
  class="editor"
  onclose={onClose}
>
  <div class="head">
    <h2>{i18n.t('pipelines.edit')} · {pipeline.name}</h2>
    <button class="x" onclick={onClose} aria-label={i18n.t('common.close')}>
      <Icon name="x" size={16} />
    </button>
  </div>

  <div class="body">
    <Field label={i18n.t('pipelines.pipelineName')}>
      <Input bind:value={name} />
    </Field>

    <div class="block">
      <h3>{i18n.t('pipelines.counts')}</h3>
      <div class="count-rows">
        <div class="count-row">
          <span>{i18n.t('pipelines.translatorsCount')}</span>
          <Stepper bind:value={translators} min={1} max={6} />
        </div>
        <div class="count-row">
          <span>{i18n.t('pipelines.reviewersCount')}</span>
          <Stepper bind:value={reviewers} min={0} max={5} />
        </div>
        <label class="toggle">
          <input type="checkbox" bind:checked={withConsistency} />
          <span class="toggle-text">
            <strong>{i18n.t('pipelines.withConsistency')}</strong>
            <small>{i18n.t('pipelines.withConsistencyHint')}</small>
          </span>
        </label>
        <label class="toggle">
          <input type="checkbox" bind:checked={withSummarizer} disabled={summarizerRequired} />
          <span class="toggle-text">
            <strong>{i18n.t('pipelines.withSummarizer')}</strong>
            <small>{i18n.t('pipelines.withSummarizerHint')}</small>
          </span>
        </label>
      </div>
    </div>

    {#if providers.list.length > 0}
      <div class="block">
        <h3>{i18n.t('pipelines.perRole')}</h3>
        <p class="hint">{i18n.t('pipelines.perRoleHint')}</p>

        <div class="role-grid">
          <div class="role-cell">
            <span class="role-label">{i18n.t('pipelines.role.translator')}</span>
            <span class="role-controls">
              <select
                value={translatorResolved.providerId}
                onchange={(e: Event) =>
                  changeProviderFor('translator', (e.currentTarget as HTMLSelectElement).value)}
              >
                {#each providerOptions() as o (o.value)}
                  <option value={o.value}>{o.label}</option>
                {/each}
              </select>
              <input
                type="text"
                value={translatorResolved.modelId}
                placeholder="model-id"
                oninput={(e: Event) =>
                  changeModelFor('translator', (e.currentTarget as HTMLInputElement).value)}
              />
            </span>
          </div>

          {#if reviewers > 0}
            <div class="role-cell">
              <span class="role-label">{i18n.t('pipelines.role.reviewer')}</span>
              <span class="role-controls">
                <select
                  value={reviewerResolved.providerId}
                  onchange={(e: Event) =>
                    changeProviderFor('reviewer', (e.currentTarget as HTMLSelectElement).value)}
                >
                  {#each providerOptions() as o (o.value)}
                    <option value={o.value}>{o.label}</option>
                  {/each}
                </select>
                <input
                  type="text"
                  value={reviewerResolved.modelId}
                  placeholder="model-id"
                  oninput={(e: Event) =>
                    changeModelFor('reviewer', (e.currentTarget as HTMLInputElement).value)}
                />
              </span>
            </div>
          {/if}

          {#if withConsistency}
            <div class="role-cell">
              <span class="role-label">{i18n.t('pipelines.role.consistency')}</span>
              <span class="role-controls">
                <select
                  value={consistencyResolved.providerId}
                  onchange={(e: Event) =>
                    changeProviderFor('consistency', (e.currentTarget as HTMLSelectElement).value)}
                >
                  {#each providerOptions() as o (o.value)}
                    <option value={o.value}>{o.label}</option>
                  {/each}
                </select>
                <input
                  type="text"
                  value={consistencyResolved.modelId}
                  placeholder="model-id"
                  oninput={(e: Event) =>
                    changeModelFor('consistency', (e.currentTarget as HTMLInputElement).value)}
                />
              </span>
            </div>
          {/if}

          {#if withSummarizer}
            <div class="role-cell">
              <span class="role-label">{i18n.t('pipelines.role.summarizer')}</span>
              <span class="role-controls">
                <select
                  value={summarizerResolved.providerId}
                  onchange={(e: Event) =>
                    changeProviderFor('summarizer', (e.currentTarget as HTMLSelectElement).value)}
                >
                  {#each providerOptions() as o (o.value)}
                    <option value={o.value}>{o.label}</option>
                  {/each}
                </select>
                <input
                  type="text"
                  value={summarizerResolved.modelId}
                  placeholder="model-id"
                  oninput={(e: Event) =>
                    changeModelFor('summarizer', (e.currentTarget as HTMLInputElement).value)}
                />
              </span>
            </div>
          {/if}
        </div>
      </div>
    {/if}
  </div>

  <div class="foot">
    <Button variant="ghost" onclick={onClose}>{i18n.t('pipelines.cancel')}</Button>
    <Button onclick={save} loading={saving} disabled={saving}>{i18n.t('pipelines.save')}</Button>
  </div>
</dialog>

<style>
  .editor {
    border: 1px solid var(--tg-border);
    border-radius: 20px;
    background: var(--tg-bg-elevated);
    color: var(--tg-fg);
    padding: 0;
    width: min(640px, 94vw);
    max-height: min(86vh, 820px);
    display: flex;
    flex-direction: column;

    position: fixed;
    inset: 0;
    margin: auto;

    box-shadow: 0 24px 80px -20px rgba(0, 0, 0, 0.4);

    opacity: 0;
    transform: scale(0.94) translateY(8px);
    transition:
      opacity 240ms cubic-bezier(0.4, 0, 0.2, 1),
      transform 240ms cubic-bezier(0.4, 0, 0.2, 1),
      overlay 240ms cubic-bezier(0.4, 0, 0.2, 1) allow-discrete,
      display 240ms cubic-bezier(0.4, 0, 0.2, 1) allow-discrete;
  }
  .editor[open] {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
  @starting-style {
    .editor[open] {
      opacity: 0;
      transform: scale(0.94) translateY(8px);
    }
  }
  .editor::backdrop {
    background: rgba(8, 8, 12, 0.32);
    backdrop-filter: blur(8px);
    opacity: 0;
    transition:
      opacity 240ms cubic-bezier(0.4, 0, 0.2, 1),
      backdrop-filter 240ms cubic-bezier(0.4, 0, 0.2, 1),
      overlay 240ms cubic-bezier(0.4, 0, 0.2, 1) allow-discrete,
      display 240ms cubic-bezier(0.4, 0, 0.2, 1) allow-discrete;
  }
  .editor[open]::backdrop {
    opacity: 1;
  }
  @starting-style {
    .editor[open]::backdrop {
      opacity: 0;
      backdrop-filter: blur(0);
    }
  }

  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 18px 20px 14px;
    border-bottom: 1px solid var(--tg-border);
  }
  .head h2 {
    margin: 0;
    font-size: 17px;
    font-weight: 500;
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

  .body {
    padding: 20px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 22px;
  }

  .block h3 {
    margin: 0 0 8px;
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    color: var(--tg-fg-subtle);
    font-weight: 600;
  }
  .block .hint {
    margin: 0 0 12px;
    color: var(--tg-fg-muted);
    font-size: 13px;
  }

  .count-rows {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .count-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 14px;
    background: var(--tg-bg-input);
    border-radius: 12px;
    font-size: 14px;
  }
  .toggle {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 12px 14px;
    background: var(--tg-bg-input);
    border-radius: 12px;
    cursor: pointer;
  }
  .toggle input {
    margin-top: 3px;
    width: 16px;
    height: 16px;
    accent-color: var(--tg-primary);
  }
  .toggle-text {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }
  .toggle-text strong {
    font-weight: 500;
    font-size: 14px;
  }
  .toggle-text small {
    font-size: 12.5px;
    color: var(--tg-fg-muted);
    line-height: 1.45;
  }

  .role-grid {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .role-cell {
    display: grid;
    grid-template-columns: 120px 1fr;
    gap: 12px;
    align-items: center;
    padding: 10px 14px;
    background: var(--tg-bg-input);
    border-radius: 12px;
  }
  .role-label {
    font-weight: 500;
    font-size: 14px;
  }
  .role-controls {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }
  .role-controls select,
  .role-controls input {
    padding: 8px 10px;
    border-radius: 8px;
    border: 1px solid var(--tg-border);
    background: var(--tg-bg-elevated);
    color: var(--tg-fg);
    font-family: inherit;
    font-size: 13px;
    cursor: pointer;
    width: 100%;
  }
  .role-controls input {
    font-family: var(--font-mono);
    font-size: 12.5px;
    cursor: text;
  }
  .role-controls select:focus,
  .role-controls input:focus {
    outline: none;
    border-color: var(--tg-primary);
  }
  @media (max-width: 540px) {
    .role-cell {
      grid-template-columns: 1fr;
    }
    .role-controls {
      grid-template-columns: 1fr;
    }
  }

  .foot {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    padding: 14px 20px 18px;
    border-top: 1px solid var(--tg-border);
  }
</style>
