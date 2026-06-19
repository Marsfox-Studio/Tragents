<script lang="ts">
  import type { Project } from '@tragents/shared';
  import { findLanguage } from '@tragents/shared';
  import Icon from './Icon.svelte';
  import ConfirmDialog from './ConfirmDialog.svelte';
  import { projects } from '$lib/stores';
  import { i18n } from '$lib/i18n.svelte';

  interface Props {
    project: Project;
    active?: boolean;
  }

  let { project, active = false }: Props = $props();

  let editing = $state(false);
  let editName = $state('');
  let inputEl: HTMLInputElement | undefined = $state();
  let confirmDelete = $state(false);

  const sub = $derived(
    `${findLanguage(project.sourceLanguage)?.code ?? '?'} → ${findLanguage(project.targetLanguage)?.code ?? '?'}`,
  );

  async function togglePin(e: MouseEvent | KeyboardEvent) {
    e.stopPropagation();
    e.preventDefault();
    await projects.togglePin(project.id);
  }

  function startRename(e: MouseEvent | KeyboardEvent) {
    e.stopPropagation();
    e.preventDefault();
    editName = project.name;
    editing = true;
    queueMicrotask(() => {
      inputEl?.focus();
      inputEl?.select();
    });
  }

  async function commitRename() {
    if (!editing) return;
    const next = editName.trim();
    if (next && next !== project.name) {
      await projects.update(project.id, { name: next });
    }
    editing = false;
  }

  function cancelRename() {
    editing = false;
  }

  function onEditKey(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitRename();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancelRename();
    }
  }

  function requestDeleteProject(e: MouseEvent | KeyboardEvent) {
    e.stopPropagation();
    e.preventDefault();
    confirmDelete = true;
  }

  async function deleteProject() {
    await projects.remove(project.id);
    confirmDelete = false;
  }
</script>

{#if editing}
  <div class="row editing" class:active>
    <span class="dot" aria-hidden="true"></span>
    <input
      bind:this={inputEl}
      bind:value={editName}
      onkeydown={onEditKey}
      onblur={commitRename}
      class="name-input"
      aria-label={i18n.t('sidebar.rename')}
    />
  </div>
{:else}
  <a class="row" class:active href={`/?p=${project.id}`} ondblclick={startRename}>
    <span class="dot" aria-hidden="true"></span>
    <span class="text">
      <span class="name">{project.name}</span>
      <span class="sub">{sub}</span>
    </span>
    <span class="actions">
      <button
        type="button"
        class="act pin"
        class:pinned={project.pinned}
        onclick={togglePin}
        onkeydown={(e: KeyboardEvent) => {
          if (e.key === 'Enter' || e.key === ' ') togglePin(e);
        }}
        aria-label={project.pinned ? i18n.t('sidebar.unpin') : i18n.t('sidebar.pin')}
        title={project.pinned ? i18n.t('sidebar.unpin') : i18n.t('sidebar.pin')}
      >
        <Icon name={project.pinned ? 'star-filled' : 'star'} size={13} />
      </button>
      <button
        type="button"
        class="act"
        onclick={startRename}
        aria-label={i18n.t('sidebar.rename')}
        title={i18n.t('sidebar.rename')}
      >
        <Icon name="pencil" size={12} />
      </button>
      <button
        type="button"
        class="act danger"
        onclick={requestDeleteProject}
        aria-label={i18n.t('sidebar.delete')}
        title={i18n.t('sidebar.delete')}
      >
        <Icon name="trash" size={12} />
      </button>
    </span>
  </a>
{/if}

<ConfirmDialog
  open={confirmDelete}
  title={i18n.t('sidebar.delete')}
  message={i18n.t('sidebar.deleteConfirm', { name: project.name })}
  onConfirm={deleteProject}
  onCancel={() => (confirmDelete = false)}
/>

<style>
  .row {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 7px 9px;
    color: var(--tg-fg-muted);
    border-radius: 8px;
    font-size: 13px;
    font-family: inherit;
    text-align: left;
    cursor: pointer;
    text-decoration: none;
    transition:
      background 160ms cubic-bezier(0.4, 0, 0.2, 1),
      color 160ms cubic-bezier(0.4, 0, 0.2, 1);
  }
  .row:hover {
    background: var(--tg-bg-elevated);
    color: var(--tg-fg);
  }
  .row.active {
    background: color-mix(in srgb, var(--tg-primary) 10%, transparent);
    color: var(--tg-fg);
  }
  .row.editing {
    background: var(--tg-bg-elevated);
  }
  .dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--tg-primary);
    opacity: 0.55;
    flex-shrink: 0;
  }
  .text {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 1px;
  }
  .name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-weight: 450;
  }
  .sub {
    font-size: 11px;
    color: var(--tg-fg-subtle);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .name-input {
    flex: 1;
    min-width: 0;
    border: 1px solid var(--tg-border-strong);
    background: var(--tg-bg-input);
    border-radius: 6px;
    padding: 4px 8px;
    color: var(--tg-fg);
    font: inherit;
    font-size: 13px;
  }
  .name-input:focus {
    outline: none;
    border-color: var(--tg-primary);
    box-shadow: 0 0 0 2px var(--tg-ring);
  }

  .actions {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    opacity: 0;
    transition: opacity 160ms;
  }
  .row:hover .actions,
  .row:focus-within .actions {
    opacity: 1;
  }
  .act {
    width: 22px;
    height: 22px;
    border-radius: 6px;
    border: none;
    background: transparent;
    color: var(--tg-fg-subtle);
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    transition:
      background 160ms,
      color 160ms;
  }
  .act:hover {
    background: var(--tg-border);
    color: var(--tg-fg);
  }
  .act.pinned {
    color: var(--tg-primary);
    opacity: 1;
  }
  .act.pinned:not(:hover) {
    opacity: 1;
  }
  .actions:has(.pinned) .pinned {
    opacity: 1;
  }
  .act.danger:hover {
    background: color-mix(in srgb, var(--tg-danger) 14%, transparent);
    color: var(--tg-danger);
  }
</style>
