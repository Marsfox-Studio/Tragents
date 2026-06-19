<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    label?: string;
    hint?: string;
    error?: string;
    children: Snippet;
    optional?: boolean;
  }

  let { label, hint, error, children, optional = false }: Props = $props();
</script>

<label class="field">
  {#if label}
    <span class="label">
      {label}
      {#if optional}<span class="optional">— optional</span>{/if}
    </span>
  {/if}
  {@render children()}
  {#if error}
    <span class="error">{error}</span>
  {:else if hint}
    <span class="hint">{hint}</span>
  {/if}
</label>

<style>
  .field {
    display: flex;
    flex-direction: column;
    gap: 6px;
    width: 100%;
  }
  .label {
    font-size: 13px;
    font-weight: 500;
    color: var(--tg-fg);
    display: flex;
    align-items: baseline;
    gap: 6px;
  }
  .optional {
    color: var(--tg-fg-subtle);
    font-weight: 400;
    font-size: 12px;
  }
  .hint {
    font-size: 12px;
    color: var(--tg-fg-subtle);
    line-height: 1.4;
  }
  .error {
    font-size: 12px;
    color: var(--tg-danger);
  }
</style>
