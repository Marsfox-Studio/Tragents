<script lang="ts">
  import Icon from './Icon.svelte';
  import { i18n } from '$lib/i18n.svelte';

  interface Props {
    open: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    danger?: boolean;
    onConfirm: () => void | Promise<void>;
    onCancel: () => void;
  }

  let {
    open,
    title,
    message,
    confirmLabel = i18n.t('common.delete'),
    cancelLabel = i18n.t('common.cancel'),
    danger = true,
    onConfirm,
    onCancel,
  }: Props = $props();

  let busy = $state(false);
  let dialog: HTMLDialogElement | undefined = $state();

  $effect(() => {
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  });

  async function confirmAction() {
    if (busy) return;
    busy = true;
    try {
      await onConfirm();
    } finally {
      busy = false;
    }
  }

  function handleKey(e: KeyboardEvent) {
    if (!open || busy) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    }
  }

  function handleCancel(e: Event) {
    e.preventDefault();
    if (!busy) onCancel();
  }
</script>

<svelte:window onkeydown={handleKey} />

<dialog bind:this={dialog} class="dialog" aria-label={title} oncancel={handleCancel}>
  <div class="icon" class:danger>
    <Icon name="trash" size={18} />
  </div>
  <div class="copy">
    <h2>{title}</h2>
    <p>{message}</p>
  </div>
  <div class="actions">
    <button type="button" class="btn ghost" onclick={onCancel} disabled={busy}>
      {cancelLabel}
    </button>
    <button type="button" class="btn confirm" class:danger onclick={confirmAction} disabled={busy}>
      {confirmLabel}
    </button>
  </div>
</dialog>

<style>
  .dialog {
    width: min(420px, 100%);
    max-width: calc(100vw - 40px);
    background: var(--tg-bg-elevated);
    border: 1px solid var(--tg-border);
    border-radius: 18px;
    box-shadow: 0 24px 80px -28px rgba(0, 0, 0, 0.55);
    padding: 18px;
    display: none;
    grid-template-columns: auto 1fr;
    gap: 14px;
    position: fixed;
    inset: 0;
    margin: auto;
    color: var(--tg-fg);
    opacity: 0;
    transform: translateY(10px) scale(0.96);
    transition:
      opacity 180ms cubic-bezier(0.4, 0, 0.2, 1),
      transform 180ms cubic-bezier(0.4, 0, 0.2, 1),
      overlay 180ms cubic-bezier(0.4, 0, 0.2, 1) allow-discrete,
      display 180ms cubic-bezier(0.4, 0, 0.2, 1) allow-discrete;
  }
  .dialog[open] {
    display: grid;
    opacity: 1;
    transform: translateY(0) scale(1);
  }
  @starting-style {
    .dialog[open] {
      opacity: 0;
      transform: translateY(10px) scale(0.96);
    }
  }
  .dialog::backdrop {
    background: color-mix(in srgb, var(--tg-bg) 44%, rgba(0, 0, 0, 0.44));
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    opacity: 1;
  }

  .icon {
    width: 38px;
    height: 38px;
    border-radius: 12px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: var(--tg-primary);
    background: color-mix(in srgb, var(--tg-primary) 12%, transparent);
  }
  .icon.danger {
    color: var(--tg-danger);
    background: color-mix(in srgb, var(--tg-danger) 12%, transparent);
  }

  .copy {
    min-width: 0;
  }
  h2 {
    margin: 1px 0 6px;
    font-size: 16px;
    line-height: 1.3;
    font-weight: 600;
    color: var(--tg-fg);
  }
  p {
    margin: 0;
    color: var(--tg-fg-muted);
    font-size: 13.5px;
    line-height: 1.55;
    overflow-wrap: anywhere;
  }

  .actions {
    grid-column: 1 / -1;
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 8px;
  }
  .btn {
    height: 34px;
    border-radius: 999px;
    padding: 0 14px;
    font: inherit;
    font-size: 13.5px;
    cursor: pointer;
    border: 1px solid transparent;
    transition:
      background 160ms,
      border-color 160ms,
      color 160ms,
      transform 120ms;
  }
  .btn:active:not(:disabled) {
    transform: scale(0.98);
  }
  .btn:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }
  .ghost {
    background: transparent;
    border-color: var(--tg-border);
    color: var(--tg-fg-muted);
  }
  .ghost:hover:not(:disabled) {
    background: var(--tg-bg-input);
    color: var(--tg-fg);
  }
  .confirm {
    background: var(--tg-primary);
    color: var(--tg-primary-fg);
  }
  .confirm:hover:not(:disabled) {
    background: var(--tg-primary-hover);
  }
  .confirm.danger {
    background: var(--tg-danger);
    color: #fff;
  }
  .confirm.danger:hover:not(:disabled) {
    background: color-mix(in srgb, var(--tg-danger) 86%, black);
  }
</style>
