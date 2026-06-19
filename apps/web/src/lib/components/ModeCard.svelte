<script lang="ts">
  import type { ThemeMode } from '@tragents/shared';
  import Icon from './Icon.svelte';
  import { i18n } from '$lib/i18n.svelte';

  interface Props {
    mode: ThemeMode;
    selected: boolean;
    onclick: () => void;
  }

  let { mode, selected, onclick }: Props = $props();

  const ICONS = {
    light: 'sun' as const,
    dark: 'moon' as const,
    system: 'monitor' as const,
  };
</script>

<button class="card" class:selected onclick={onclick} type="button">
  <span class="icon"><Icon name={ICONS[mode]} size={20} /></span>
  <span class="content">
    <span class="label">{i18n.t(`modes.${mode}`)}</span>
    <span class="tagline">{i18n.t(`modes.${mode}Tagline`)}</span>
  </span>
  {#if selected}
    <span class="check"><Icon name="check" size={14} /></span>
  {/if}
</button>

<style>
  .card {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 14px 16px;
    width: 100%;
    border: 1px solid var(--tg-border);
    border-radius: 14px;
    background: var(--tg-bg-elevated);
    cursor: pointer;
    text-align: left;
    color: inherit;
    font-family: inherit;
    transition:
      border-color 200ms cubic-bezier(0.4, 0, 0.2, 1),
      box-shadow 240ms cubic-bezier(0.4, 0, 0.2, 1),
      transform 200ms cubic-bezier(0.4, 0, 0.2, 1);
  }
  .card:hover {
    border-color: var(--tg-border-strong);
    transform: translateY(-1px);
  }
  .card.selected {
    border-color: var(--tg-primary);
    box-shadow: 0 0 0 3px var(--tg-ring);
  }
  .icon {
    width: 38px;
    height: 38px;
    flex-shrink: 0;
    border-radius: 10px;
    background: color-mix(in srgb, var(--tg-primary) 10%, transparent);
    color: var(--tg-primary);
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
  .content {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .label {
    font-weight: 500;
    color: var(--tg-fg);
    font-size: 14.5px;
  }
  .tagline {
    color: var(--tg-fg-muted);
    font-size: 12.5px;
    line-height: 1.4;
  }
  .check {
    width: 22px;
    height: 22px;
    border-radius: 50%;
    background: var(--tg-primary);
    color: var(--tg-primary-fg);
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
</style>
