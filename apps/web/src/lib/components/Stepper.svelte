<script lang="ts">
  import Icon from './Icon.svelte';

  interface Props {
    value: number;
    min?: number;
    max?: number;
    onChange?: (v: number) => void;
    label?: string;
  }

  let { value = $bindable(), min = 0, max = 10, onChange, label }: Props = $props();

  function inc() {
    if (value < max) {
      value++;
      onChange?.(value);
    }
  }
  function dec() {
    if (value > min) {
      value--;
      onChange?.(value);
    }
  }
</script>

<div class="stepper" role="group" aria-label={label}>
  <button type="button" class="step" onclick={dec} disabled={value <= min} aria-label="Decrease">
    <Icon name="x" size={12} stroke={2} />
  </button>
  <span class="value">{value}</span>
  <button type="button" class="step" onclick={inc} disabled={value >= max} aria-label="Increase">
    <Icon name="plus" size={12} stroke={2} />
  </button>
</div>

<style>
  .stepper {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    background: var(--tg-bg-input);
    border: 1px solid var(--tg-border);
    border-radius: 999px;
    padding: 3px;
  }
  .step {
    width: 26px;
    height: 26px;
    border-radius: 50%;
    border: none;
    background: transparent;
    color: var(--tg-fg-muted);
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    transition:
      background 160ms,
      color 160ms,
      transform 100ms;
  }
  .step:hover:not(:disabled) {
    background: var(--tg-border);
    color: var(--tg-fg);
  }
  .step:active:not(:disabled) {
    transform: scale(0.9);
  }
  .step:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }
  .value {
    min-width: 24px;
    text-align: center;
    font-variant-numeric: tabular-nums;
    font-weight: 500;
    font-size: 14px;
    color: var(--tg-fg);
  }
</style>
