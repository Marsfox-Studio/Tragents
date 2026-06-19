<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    onclick?: (e: MouseEvent) => void;
    label: string;
    children: Snippet;
    variant?: 'ghost' | 'subtle' | 'primary' | 'danger';
    size?: 'sm' | 'md' | 'lg';
    disabled?: boolean;
    type?: 'button' | 'submit';
  }

  let {
    onclick,
    label,
    children,
    variant = 'ghost',
    size = 'md',
    disabled = false,
    type = 'button',
  }: Props = $props();
</script>

<button
  {type}
  aria-label={label}
  title={label}
  {disabled}
  {onclick}
  class="iconbtn iconbtn-{variant} iconbtn-{size}"
>
  {@render children()}
</button>

<style>
  .iconbtn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: none;
    background: transparent;
    cursor: pointer;
    border-radius: 10px;
    transition:
      background-color 180ms cubic-bezier(0.4, 0, 0.2, 1),
      transform 140ms cubic-bezier(0.4, 0, 0.2, 1),
      color 180ms cubic-bezier(0.4, 0, 0.2, 1),
      box-shadow 180ms cubic-bezier(0.4, 0, 0.2, 1);
    color: var(--tg-fg-muted);
    flex-shrink: 0;
    -webkit-tap-highlight-color: transparent;
  }
  .iconbtn:hover:not(:disabled) {
    background: var(--tg-border);
    color: var(--tg-fg);
  }
  .iconbtn:active:not(:disabled) {
    transform: scale(0.92);
  }
  .iconbtn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .iconbtn-sm {
    width: 28px;
    height: 28px;
  }
  .iconbtn-md {
    width: 34px;
    height: 34px;
  }
  .iconbtn-lg {
    width: 42px;
    height: 42px;
  }

  .iconbtn-primary {
    background: var(--tg-primary);
    color: var(--tg-primary-fg);
    box-shadow: 0 1px 0 rgba(255, 255, 255, 0.08) inset;
  }
  .iconbtn-primary:hover:not(:disabled) {
    background: var(--tg-primary-hover);
    color: var(--tg-primary-fg);
  }

  .iconbtn-subtle {
    background: var(--tg-bg-elevated);
    border: 1px solid var(--tg-border);
  }
  .iconbtn-subtle:hover:not(:disabled) {
    background: var(--tg-border);
  }

  .iconbtn-danger {
    color: var(--tg-danger);
  }
  .iconbtn-danger:hover:not(:disabled) {
    background: color-mix(in srgb, var(--tg-danger) 12%, transparent);
  }
</style>
