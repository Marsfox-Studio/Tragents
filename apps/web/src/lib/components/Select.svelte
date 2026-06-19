<script lang="ts">
  import Icon from './Icon.svelte';

  interface Option {
    value: string;
    label: string;
    disabled?: boolean;
  }

  interface Props {
    value: string;
    options: Option[];
    placeholder?: string;
    disabled?: boolean;
    size?: 'sm' | 'md';
  }

  let {
    value = $bindable(),
    options,
    placeholder,
    disabled = false,
    size = 'md',
  }: Props = $props();
</script>

<div class="wrap size-{size}">
  <select bind:value {disabled}>
    {#if placeholder}<option value="" disabled>{placeholder}</option>{/if}
    {#each options as opt (opt.value)}
      <option value={opt.value} disabled={opt.disabled}>{opt.label}</option>
    {/each}
  </select>
  <span class="chevron"><Icon name="chevron-down" size={14} /></span>
</div>

<style>
  .wrap {
    position: relative;
    display: inline-flex;
    align-items: center;
    width: 100%;
  }
  select {
    appearance: none;
    -webkit-appearance: none;
    width: 100%;
    padding: 9px 32px 9px 12px;
    border-radius: 10px;
    border: 1px solid var(--tg-border);
    background: var(--tg-bg-input);
    color: var(--tg-fg);
    font-family: var(--font-sans);
    font-size: 14px;
    cursor: pointer;
    transition:
      border-color 180ms cubic-bezier(0.4, 0, 0.2, 1),
      box-shadow 180ms cubic-bezier(0.4, 0, 0.2, 1);
  }
  .size-sm select {
    padding: 6px 28px 6px 10px;
    font-size: 13px;
    border-radius: 8px;
  }
  select:hover:not(:disabled) {
    border-color: var(--tg-border-strong);
  }
  select:focus {
    outline: none;
    border-color: var(--tg-primary);
    box-shadow: 0 0 0 3px var(--tg-ring);
  }
  select:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  .chevron {
    position: absolute;
    right: 10px;
    pointer-events: none;
    color: var(--tg-fg-muted);
    display: inline-flex;
  }
  .size-sm .chevron {
    right: 8px;
  }
</style>
