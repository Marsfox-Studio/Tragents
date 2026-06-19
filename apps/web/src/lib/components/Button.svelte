<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    onclick?: (e: MouseEvent) => void;
    children: Snippet;
    variant?: 'primary' | 'subtle' | 'ghost' | 'outline' | 'danger';
    size?: 'sm' | 'md' | 'lg';
    full?: boolean;
    disabled?: boolean;
    loading?: boolean;
    type?: 'button' | 'submit';
  }

  let {
    onclick,
    children,
    variant = 'primary',
    size = 'md',
    full = false,
    disabled = false,
    loading = false,
    type = 'button',
  }: Props = $props();
</script>

<button
  {type}
  {disabled}
  {onclick}
  class="btn btn-{variant} btn-{size}"
  class:full
  class:loading
>
  {#if loading}
    <span class="spinner" aria-hidden="true"></span>
  {/if}
  <span class="content">{@render children()}</span>
</button>

<style>
  .btn {
    --pad-x: 14px;
    --pad-y: 9px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.5em;
    border: none;
    border-radius: 999px;
    padding: var(--pad-y) var(--pad-x);
    font-family: var(--font-sans);
    font-size: 14px;
    font-weight: 500;
    line-height: 1.1;
    cursor: pointer;
    user-select: none;
    transition:
      background-color 180ms cubic-bezier(0.4, 0, 0.2, 1),
      transform 140ms cubic-bezier(0.4, 0, 0.2, 1),
      box-shadow 180ms cubic-bezier(0.4, 0, 0.2, 1),
      color 180ms cubic-bezier(0.4, 0, 0.2, 1);
    -webkit-tap-highlight-color: transparent;
  }
  .btn:active:not(:disabled) {
    transform: scale(0.97);
  }
  .btn:disabled,
  .btn.loading {
    opacity: 0.6;
    cursor: not-allowed;
  }
  .full {
    width: 100%;
  }

  .btn-sm {
    --pad-x: 11px;
    --pad-y: 6px;
    font-size: 13px;
  }
  .btn-lg {
    --pad-x: 20px;
    --pad-y: 13px;
    font-size: 15px;
  }

  .btn-primary {
    background: var(--tg-primary);
    color: var(--tg-primary-fg);
    box-shadow:
      0 1px 0 rgba(255, 255, 255, 0.08) inset,
      0 1px 2px rgba(0, 0, 0, 0.06);
  }
  .btn-primary:hover:not(:disabled) {
    background: var(--tg-primary-hover);
  }

  .btn-subtle {
    background: var(--tg-bg-elevated);
    color: var(--tg-fg);
    border: 1px solid var(--tg-border);
  }
  .btn-subtle:hover:not(:disabled) {
    background: var(--tg-border);
  }

  .btn-ghost {
    background: transparent;
    color: var(--tg-fg-muted);
  }
  .btn-ghost:hover:not(:disabled) {
    color: var(--tg-fg);
    background: var(--tg-border);
  }

  .btn-outline {
    background: transparent;
    color: var(--tg-fg);
    border: 1px solid var(--tg-border-strong);
  }
  .btn-outline:hover:not(:disabled) {
    background: var(--tg-bg-elevated);
  }

  .btn-danger {
    background: var(--tg-danger);
    color: white;
  }
  .btn-danger:hover:not(:disabled) {
    filter: brightness(0.92);
  }

  .spinner {
    width: 1em;
    height: 1em;
    border: 2px solid currentColor;
    border-bottom-color: transparent;
    border-radius: 50%;
    animation: spin 0.65s linear infinite;
  }
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
