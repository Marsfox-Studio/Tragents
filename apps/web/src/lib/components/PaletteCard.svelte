<script lang="ts">
  import type { BrandPaletteDef } from '@tragents/shared';
  import { getBrandPalette } from '@tragents/shared';
  import Icon from './Icon.svelte';
  import { i18n } from '$lib/i18n.svelte';

  interface Props {
    palette: BrandPaletteDef['id'];
    selected: boolean;
    mode: 'light' | 'dark';
    onclick: () => void;
  }

  let { palette, selected, mode, onclick }: Props = $props();
  const def = $derived(getBrandPalette(palette));
  const tones = $derived(def[mode]);
  const tagline = $derived(i18n.t(`palettes.${palette}.tagline`));
</script>

<button
  class="card"
  class:selected
  data-mode={mode}
  onclick={onclick}
  style:--card-bg={tones.bg}
  style:--card-primary={tones.primary}
  style:--card-accent={tones.accent}
  style:--card-fg={mode === 'dark' ? '#f4f4f6' : '#0a0a0f'}
  type="button"
>
  <div class="preview">
    <div class="logo-mark">
      <span class="dot d1"></span>
      <span class="dot d2"></span>
      <span class="dot d3"></span>
      <span class="dot d4"></span>
      <span class="core"></span>
    </div>
    <div class="lines">
      <span class="line l1"></span>
      <span class="line l2"></span>
    </div>
  </div>
  <div class="meta">
    <h3>{def.name}</h3>
    <p>{tagline}</p>
  </div>
  {#if selected}
    <span class="check" aria-hidden="true">
      <Icon name="check" size={14} />
    </span>
  {/if}
</button>

<style>
  .card {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 14px;
    padding: 18px;
    border: 1px solid var(--tg-border);
    border-radius: 18px;
    background: var(--tg-bg-elevated);
    cursor: pointer;
    text-align: left;
    transition:
      transform 220ms cubic-bezier(0.4, 0, 0.2, 1),
      border-color 220ms cubic-bezier(0.4, 0, 0.2, 1),
      box-shadow 280ms cubic-bezier(0.4, 0, 0.2, 1);
    font-family: inherit;
    color: inherit;
  }
  .card:hover {
    transform: translateY(-2px);
    border-color: var(--tg-border-strong);
    box-shadow: 0 12px 32px -18px rgba(0, 0, 0, 0.18);
  }
  .card.selected {
    border-color: var(--tg-primary);
    box-shadow: 0 0 0 3px var(--tg-ring);
  }

  .preview {
    position: relative;
    height: 120px;
    border-radius: 12px;
    background: var(--card-bg);
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .logo-mark {
    position: relative;
    width: 60px;
    height: 60px;
  }
  .core {
    position: absolute;
    inset: 22px;
    border-radius: 50%;
    background: linear-gradient(135deg, var(--card-primary), var(--card-accent));
    box-shadow: 0 0 18px -4px var(--card-accent);
  }
  .dot {
    position: absolute;
    width: 9px;
    height: 9px;
    border-radius: 50%;
    background: linear-gradient(135deg, var(--card-primary), var(--card-accent));
  }
  .d1 {
    top: 0;
    left: 50%;
    transform: translateX(-50%);
  }
  .d2 {
    right: 0;
    top: 50%;
    transform: translateY(-50%);
  }
  .d3 {
    bottom: 0;
    left: 50%;
    transform: translateX(-50%);
  }
  .d4 {
    left: 0;
    top: 50%;
    transform: translateY(-50%);
  }
  .lines {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }
  .line {
    position: absolute;
    background: var(--card-primary);
    opacity: 0.18;
  }
  .l1 {
    left: 50%;
    top: 30%;
    bottom: 30%;
    width: 1px;
  }
  .l2 {
    top: 50%;
    left: 30%;
    right: 30%;
    height: 1px;
  }

  .meta h3 {
    margin: 0 0 4px;
    font-size: 16px;
    font-weight: 500;
    color: var(--tg-fg);
  }
  .meta p {
    margin: 0;
    font-size: 12.5px;
    color: var(--tg-fg-muted);
    line-height: 1.4;
  }

  .check {
    position: absolute;
    top: 12px;
    right: 12px;
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
