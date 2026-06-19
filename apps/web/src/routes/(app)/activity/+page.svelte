<script lang="ts">
  import { fly } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import Icon from '$lib/components/Icon.svelte';
  import Button from '$lib/components/Button.svelte';
  import { activities } from '$lib/stores';
  import { i18n } from '$lib/i18n.svelte';

  function formatTime(ts: number): string {
    return new Date(ts).toLocaleString();
  }

  function statusLabel(status: string): string {
    if (status === 'done') return i18n.t('activity.statusDone');
    if (status === 'cancelled') return i18n.t('activity.statusCancelled');
    return i18n.t('activity.statusFailed');
  }

  function modeLabel(mode: string): string {
    const key = mode
      .split('-')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join('');
    return i18n.t(`chat.mode${key}`);
  }
</script>

<svelte:head>
  <title>{i18n.t('pageTitle.activity')}</title>
</svelte:head>

<div class="page" in:fly={{ y: 8, duration: 280, easing: cubicOut }}>
  <header>
    <div>
      <h1>{i18n.t('activity.title')}</h1>
      <p class="sub">{i18n.t('activity.sub')}</p>
    </div>
    {#if activities.recent.length > 0}
      <Button variant="ghost" size="sm" onclick={() => activities.clear()}>
        {i18n.t('activity.clear')}
      </Button>
    {/if}
  </header>

  {#if activities.recent.length === 0}
    <div class="empty">
      <div class="empty-icon"><Icon name="activity" size={28} /></div>
      <p>{i18n.t('activity.empty')}</p>
      <p class="hint">{i18n.t('activity.emptyHint')}</p>
    </div>
  {:else}
    <ol class="list">
      {#each activities.recent as item (item.id)}
        <li class:failed={item.status === 'failed'} class:cancelled={item.status === 'cancelled'}>
          <div class="status">
            <span>{statusLabel(item.status)}</span>
            <time>{formatTime(item.createdAt)}</time>
          </div>
          <div class="main">
            <p class="preview">{item.inputPreview || modeLabel(item.mode)}</p>
            <p class="meta">
              {i18n.t('activity.meta', {
                mode: modeLabel(item.mode),
                source: item.sourceLanguage,
                target: item.targetLanguage,
                agents: item.agentCount ?? 0,
                duration: item.durationMs ?? 0,
              })}
            </p>
            {#if item.pipelineName}
              <p class="pipeline">{item.pipelineName}</p>
            {/if}
            {#if item.error}
              <p class="error">{item.error}</p>
            {/if}
          </div>
        </li>
      {/each}
    </ol>
  {/if}
</div>

<style>
  .page {
    max-width: 880px;
    margin: 0 auto;
    padding: 56px 32px 80px;
    display: flex;
    flex-direction: column;
    gap: 28px;
  }
  header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
  }
  header > div {
    min-width: 0;
  }
  h1 {
    margin: 0 0 6px;
    font-size: 32px;
    font-weight: 500;
    letter-spacing: -0.02em;
  }
  .sub {
    margin: 0;
    color: var(--tg-fg-muted);
    font-size: 14px;
  }
  .empty {
    text-align: center;
    padding: 60px 24px;
    border: 1px dashed var(--tg-border-strong);
    border-radius: 20px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
  }
  .empty-icon {
    width: 56px;
    height: 56px;
    border-radius: 16px;
    background: color-mix(in srgb, var(--tg-primary) 10%, transparent);
    color: var(--tg-primary);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 8px;
  }
  .empty p {
    margin: 0;
    color: var(--tg-fg);
    font-size: 15px;
  }
  .empty .hint {
    color: var(--tg-fg-muted);
    font-size: 13.5px;
    max-width: 420px;
    line-height: 1.5;
  }
  .list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .list li {
    display: grid;
    grid-template-columns: minmax(120px, 0.28fr) minmax(0, 1fr);
    gap: 16px;
    padding: 14px 16px;
    border: 1px solid var(--tg-border);
    border-radius: 14px;
    background: var(--tg-bg-elevated);
    backdrop-filter: blur(20px) saturate(1.35);
    -webkit-backdrop-filter: blur(20px) saturate(1.35);
  }
  .list li.failed {
    border-color: color-mix(in srgb, var(--tg-danger) 30%, var(--tg-border));
  }
  .list li.cancelled {
    opacity: 0.78;
  }
  .status {
    display: flex;
    flex-direction: column;
    gap: 4px;
    color: var(--tg-fg-muted);
    font-size: 12px;
  }
  .status span {
    color: var(--tg-fg);
    font-weight: 600;
  }
  .main {
    min-width: 0;
  }
  .preview {
    margin: 0 0 6px;
    color: var(--tg-fg);
    font-size: 14px;
    line-height: 1.45;
    overflow-wrap: anywhere;
  }
  .meta,
  .pipeline,
  .error {
    margin: 0;
    font-size: 12.5px;
    color: var(--tg-fg-muted);
    line-height: 1.45;
  }
  .pipeline {
    margin-top: 3px;
  }
  .error {
    margin-top: 6px;
    color: var(--tg-danger);
    overflow-wrap: anywhere;
  }
  @media (max-width: 640px) {
    header {
      flex-direction: column;
    }
    .list li {
      grid-template-columns: 1fr;
    }
  }
</style>
