<script lang="ts">
  import { fly, fade } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';

  export interface QuestionOption {
    id: string;
    label: string;
    hint?: string;
    primary?: boolean;
  }

  interface Props {
    question: string;
    options: QuestionOption[];
    onAnswer: (id: string) => void;
    onDismiss?: () => void;
    eyebrow?: string;
    disabled?: boolean;
  }

  let { question, options, onAnswer, onDismiss, eyebrow, disabled = false }: Props = $props();

  function handleKey(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault();
      onDismiss?.();
    }
  }
</script>

<svelte:window onkeydown={handleKey} />

<div
  class="card"
  role="dialog"
  aria-label={question}
  in:fly={{ y: 14, duration: 280, easing: cubicOut }}
  out:fade={{ duration: 160 }}
>
  <div class="head">
    {#if eyebrow}<span class="eyebrow">{eyebrow}</span>{/if}
    {#if onDismiss}
      <button
        type="button"
        class="close"
        onclick={onDismiss}
        aria-label="Dismiss"
        disabled={disabled}
      >
        ×
      </button>
    {/if}
  </div>
  <p class="question">{question}</p>
  <div class="options">
    {#each options as opt (opt.id)}
      <button
        type="button"
        class="opt"
        class:primary={opt.primary}
        onclick={() => onAnswer(opt.id)}
        disabled={disabled}
      >
        <span class="opt-label">{opt.label}</span>
        {#if opt.hint}<span class="opt-hint">{opt.hint}</span>{/if}
      </button>
    {/each}
  </div>
</div>

<style>
  .card {
    width: 100%;
    background: var(--tg-bg-elevated);
    border: 1px solid var(--tg-border);
    border-radius: 20px 20px 14px 14px;
    padding: 14px 16px 14px;
    backdrop-filter: blur(22px) saturate(1.4);
    -webkit-backdrop-filter: blur(22px) saturate(1.4);
    box-shadow:
      0 1px 0 color-mix(in srgb, var(--tg-fg) 4%, transparent),
      0 12px 32px -16px color-mix(in srgb, var(--tg-fg) 18%, transparent);
  }

  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    min-height: 18px;
    margin-bottom: 4px;
  }
  .eyebrow {
    font-size: 10.5px;
    text-transform: uppercase;
    letter-spacing: 0.09em;
    color: var(--tg-fg-subtle);
    font-weight: 600;
  }
  .close {
    margin-left: auto;
    width: 22px;
    height: 22px;
    border-radius: 50%;
    border: none;
    background: transparent;
    color: var(--tg-fg-subtle);
    font-size: 16px;
    line-height: 1;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    transition:
      background 160ms,
      color 160ms;
  }
  .close:hover:not(:disabled) {
    background: var(--tg-bg-input);
    color: var(--tg-fg);
  }
  .close:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .question {
    margin: 2px 0 12px;
    font-size: 14.5px;
    line-height: 1.5;
    color: var(--tg-fg);
  }

  .options {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .opt {
    flex: 1 1 calc(50% - 4px);
    min-width: 0;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 2px;
    padding: 10px 14px;
    border-radius: 14px;
    border: 1px solid var(--tg-border);
    background: var(--tg-bg);
    color: var(--tg-fg);
    font-family: inherit;
    font-size: 13.5px;
    text-align: left;
    cursor: pointer;
    transition:
      background 160ms,
      border-color 160ms,
      transform 120ms cubic-bezier(0.4, 0, 0.2, 1),
      box-shadow 200ms;
  }
  .opt:hover:not(:disabled) {
    background: var(--tg-bg-elevated);
    border-color: var(--tg-border-strong);
    transform: translateY(-1px);
  }
  .opt:active:not(:disabled) {
    transform: translateY(0);
  }
  .opt.primary {
    background: var(--tg-primary);
    color: var(--tg-primary-fg);
    border-color: transparent;
  }
  .opt.primary:hover:not(:disabled) {
    background: var(--tg-primary-hover);
  }
  .opt:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }

  .opt-label {
    font-weight: 500;
  }
  .opt-hint {
    font-size: 11.5px;
    color: color-mix(in srgb, currentColor 70%, transparent);
  }

  @media (max-width: 520px) {
    .opt {
      flex: 1 1 100%;
    }
  }
</style>
