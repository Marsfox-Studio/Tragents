<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    children: Snippet;
    onclick?: (e: MouseEvent) => void;
    selected?: boolean;
    disabled?: boolean;
    title?: string;
    type?: 'button' | 'submit';
  }

  let {
    children,
    onclick,
    selected = false,
    disabled = false,
    title,
    type = 'button',
  }: Props = $props();
</script>

<button {type} {onclick} {disabled} {title} class="chip" class:selected>
  {@render children()}
</button>

<style>
  .chip {
    display: inline-flex;
    align-items: center;
    gap: 0.4em;
    padding: 6px 11px;
    border-radius: 999px;
    border: 1px solid var(--tg-border);
    background: transparent;
    color: var(--tg-fg-muted);
    font-size: 12.5px;
    font-weight: 500;
    line-height: 1;
    cursor: pointer;
    transition:
      background 180ms cubic-bezier(0.4, 0, 0.2, 1),
      color 180ms cubic-bezier(0.4, 0, 0.2, 1),
      border-color 180ms cubic-bezier(0.4, 0, 0.2, 1),
      transform 120ms cubic-bezier(0.4, 0, 0.2, 1);
    -webkit-tap-highlight-color: transparent;
    white-space: nowrap;
  }
  .chip:hover:not(:disabled) {
    color: var(--tg-fg);
    background: var(--tg-bg-elevated);
    border-color: var(--tg-border-strong);
  }
  .chip:active:not(:disabled) {
    transform: scale(0.96);
  }
  .chip.selected {
    color: var(--tg-primary);
    background: color-mix(in srgb, var(--tg-primary) 8%, transparent);
    border-color: color-mix(in srgb, var(--tg-primary) 35%, transparent);
  }
  .chip:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
</style>
