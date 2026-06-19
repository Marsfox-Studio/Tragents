<script lang="ts">
  import type { HTMLInputAttributes } from 'svelte/elements';

  interface Props extends Omit<HTMLInputAttributes, 'class' | 'size'> {
    value: string;
    monospace?: boolean;
  }

  let { value = $bindable(), monospace = false, ...rest }: Props = $props();
</script>

<input class="input" class:monospace bind:value {...rest} />

<style>
  .input {
    display: block;
    width: 100%;
    padding: 9px 12px;
    border-radius: 10px;
    border: 1px solid var(--tg-border);
    background: var(--tg-bg-input);
    color: var(--tg-fg);
    font-family: var(--font-sans);
    font-size: 14px;
    line-height: 1.4;
    transition:
      border-color 180ms cubic-bezier(0.4, 0, 0.2, 1),
      box-shadow 180ms cubic-bezier(0.4, 0, 0.2, 1),
      background 180ms cubic-bezier(0.4, 0, 0.2, 1);
  }
  .input.monospace {
    font-family: var(--font-mono);
    font-size: 13px;
  }
  .input::placeholder {
    color: var(--tg-fg-subtle);
  }
  .input:hover:not(:disabled) {
    border-color: var(--tg-border-strong);
  }
  .input:focus {
    border-color: var(--tg-primary);
    box-shadow: 0 0 0 3px var(--tg-ring);
    outline: none;
  }
  .input:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
</style>
