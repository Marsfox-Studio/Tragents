<script lang="ts">
  import { fly, fade } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import type { Checkpoint, Project, PtpRow } from '@tragents/shared';
  import { checkpoints, memories, projects, settings } from '$lib/stores';
  import { i18n } from '$lib/i18n.svelte';
  import { translateText, NoProviderError } from '$lib/translation';
  import Icon from './Icon.svelte';
  import Button from './Button.svelte';
  import IconButton from './IconButton.svelte';

  interface Props {
    project: Project;
    addAndTranslate?: ((source: string) => Promise<void>) | undefined;
  }

  let { project, addAndTranslate = $bindable() }: Props = $props();

  // Local mirror of project.ptpRows so edits feel instant. Persist on blur /
  // explicit save / translate completion to avoid IDB write storms.
  let rows = $state<PtpRow[]>([]);
  let saving = $state(false);
  let translatingAll = $state(false);
  let lastSnapshotTime = $state<number | null>(null);
  let showCheckpoints = $state(false);
  const targetEditStart = new Map<string, string>();

  let seedId = $state<string | undefined>();
  $effect(() => {
    if (project.id !== seedId) {
      seedId = project.id;
      rows = project.ptpRows ?? [];
    }
  });

  const projectCheckpoints = $derived(checkpoints.forProject(project.id));

  function uid() {
    return typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `row-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  async function persist() {
    saving = true;
    try {
      await projects.setPtpRows(project.id, rows);
    } finally {
      saving = false;
    }
  }

  function addRow() {
    rows = [...rows, { id: uid(), source: '', target: '', status: 'idle' }];
    queueMicrotask(persist);
  }

  async function removeRow(id: string) {
    rows = rows.filter((r) => r.id !== id);
    await persist();
  }

  function setRow(id: string, patch: Partial<PtpRow>) {
    rows = rows.map((r) => (r.id === id ? { ...r, ...patch } : r));
  }

  function rememberTargetBeforeEdit(row: PtpRow) {
    targetEditStart.set(row.id, row.target);
  }

  async function persistTargetEdit(rowId: string) {
    await persist();
    const row = rows.find((r) => r.id === rowId);
    const before = targetEditStart.get(rowId) ?? '';
    targetEditStart.delete(rowId);
    if (!row) return;
    if (row.status === 'translating') return;
    const personalization = settings.current.personalization;
    if (!personalization.enabled || !personalization.memoryEnabled) return;
    const after = row.target.trim();
    if (!row.source.trim() || !before.trim() || before.trim() === after) return;
    await memories.appendCorrection(project.id, {
      action: 'final-edit',
      sourcePreview: row.source.replace(/\s+/g, ' ').trim().slice(0, 360),
      modelOutputPreview: before.replace(/\s+/g, ' ').trim().slice(0, 360),
      userRevision: after.slice(0, 360),
      lesson: 'User manually edited this row; prefer the revised wording, terminology, and register in similar contexts.',
    });
  }

  async function translateRow(row: PtpRow) {
    const text = row.source.trim();
    if (!text) return;
    setRow(row.id, { status: 'translating', target: '', error: undefined, discussion: [] });
    await persist();

    try {
      const result = await translateText({
        text,
        source: project.sourceLanguage,
        target: project.targetLanguage,
        mode: 'text',
        projectId: project.id,
        onDelta: (delta) => {
          rows = rows.map((r) =>
            r.id === row.id ? { ...r, target: (r.target ?? '') + delta } : r,
          );
        },
        onEvent: (e) => {
          if (e.type === 'output') {
            rows = rows.map((r) => (r.id === row.id ? { ...r, target: e.output } : r));
          } else if (e.type === 'discussionTurn') {
            rows = rows.map((r) =>
              r.id === row.id
                ? {
                    ...r,
                    discussion: [
                      ...(r.discussion ?? []),
                      {
                        agentId: e.agentId,
                        agentLabel: e.agentLabel,
                        role: e.role,
                        text: e.text,
                        timestamp: Date.now(),
                      },
                    ],
                  }
                : r,
            );
          }
        },
      });
      setRow(row.id, { status: 'done', target: result.output });
      await persist();
    } catch (err) {
      if (err instanceof NoProviderError) {
        setRow(row.id, { status: 'failed', error: err.message });
        await persist();
        return;
      }
      setRow(row.id, {
        status: 'failed',
        error: err instanceof Error ? err.message : String(err),
      });
      await persist();
    }
  }

  async function translateAll() {
    if (translatingAll) return;
    translatingAll = true;
    try {
      for (const row of rows) {
        if (row.source.trim() && row.status !== 'done') {
          await translateRow(row);
        }
      }
    } finally {
      translatingAll = false;
    }
  }

  async function _addAndTranslate(source: string) {
    const trimmed = source.trim();
    if (!trimmed) return;
    const row: PtpRow = { id: uid(), source: trimmed, target: '', status: 'idle' };
    rows = [...rows, row];
    await persist();
    await translateRow(row);
  }

  $effect(() => {
    addAndTranslate = _addAndTranslate;
  });

  async function saveCheckpoint() {
    const cp = await checkpoints.save(
      project.id,
      {
        ptpRows: rows,
        sourceLanguage: project.sourceLanguage,
        targetLanguage: project.targetLanguage,
      },
      undefined,
      false,
    );
    lastSnapshotTime = cp.timestamp;
  }

  async function restoreCheckpoint(cp: Checkpoint) {
    const snapshotRows = cp.snapshot.ptpRows ?? [];
    rows = snapshotRows;
    await persist();
    showCheckpoints = false;
  }

  function formatTime(ts: number): string {
    return new Date(ts).toLocaleString();
  }

  let openDiscussionRowId = $state<string | null>(null);
  function toggleDiscussion(id: string) {
    openDiscussionRowId = openDiscussionRowId === id ? null : id;
  }
</script>

<div class="ptp">
  <header class="head">
    <div class="title-block">
      <h2>{i18n.t('ptp.title')}</h2>
      <p class="sub">{i18n.t('ptp.sub')}</p>
    </div>
    <div class="head-actions">
      <Button onclick={addRow} variant="subtle" size="sm">+ {i18n.t('ptp.addRow')}</Button>
      <Button onclick={translateAll} variant="primary" size="sm" loading={translatingAll}>
        {i18n.t('ptp.translateAll')}
      </Button>
      <Button onclick={saveCheckpoint} variant="ghost" size="sm">
        ◆ {i18n.t('ptp.saveCheckpoint')}
      </Button>
      <IconButton
        label={i18n.t('ptp.checkpointListTitle')}
        variant="ghost"
        onclick={() => (showCheckpoints = !showCheckpoints)}
      >
        <Icon name="activity" size={15} />
      </IconButton>
    </div>
  </header>

  {#if rows.length === 0}
    <div class="empty" in:fade={{ duration: 240 }}>
      <p>{i18n.t('ptp.emptyHint')}</p>
      <Button onclick={addRow} variant="primary">+ {i18n.t('ptp.addRow')}</Button>
    </div>
  {:else}
    <div class="rows">
      {#each rows as row, i (row.id)}
        <div class="row" in:fly={{ y: 8, duration: 220, delay: i * 24, easing: cubicOut }}>
          <div class="cell src">
            <textarea
              value={row.source}
              oninput={(e) =>
                setRow(row.id, { source: (e.currentTarget as HTMLTextAreaElement).value })}
              onblur={persist}
              placeholder={i18n.t('ptp.sourcePlaceholder')}
              rows="3"
            ></textarea>
          </div>
          <div class="cell tgt">
            <textarea
              value={row.target}
              onfocus={() => rememberTargetBeforeEdit(row)}
              oninput={(e) =>
                setRow(row.id, { target: (e.currentTarget as HTMLTextAreaElement).value })}
              onblur={() => persistTargetEdit(row.id)}
              placeholder={i18n.t('ptp.targetPlaceholder')}
              rows="3"
              class:streaming={row.status === 'translating'}
              disabled={row.status === 'translating'}
            ></textarea>
            {#if row.status === 'translating'}
              <span class="caret" aria-hidden="true"></span>
            {/if}
            {#if row.error}
              <p class="error">{row.error}</p>
            {/if}
          </div>
          <div class="row-actions">
            <IconButton
              label={i18n.t('ptp.translateRow')}
              variant="ghost"
              onclick={() => translateRow(row)}
              disabled={row.status === 'translating' || !row.source.trim()}
            >
              <Icon name="arrow-right" size={15} />
            </IconButton>
            {#if row.discussion && row.discussion.length > 0}
              <IconButton
                label={i18n.t('ptp.viewDiscussion', { n: row.discussion.length })}
                variant={openDiscussionRowId === row.id ? 'subtle' : 'ghost'}
                onclick={() => toggleDiscussion(row.id)}
              >
                <span class="discussion-badge">
                  <Icon name="activity" size={14} />
                  <span class="badge-num">{row.discussion.length}</span>
                </span>
              </IconButton>
            {/if}
            <IconButton
              label={i18n.t('ptp.removeRow')}
              variant="ghost"
              onclick={() => removeRow(row.id)}
            >
              <Icon name="trash" size={15} />
            </IconButton>
          </div>
          {#if openDiscussionRowId === row.id && row.discussion && row.discussion.length > 0}
            <div class="discussion-pop" in:fly={{ y: -6, duration: 220, easing: cubicOut }}>
              <header>
                <span>{i18n.t('home.discussionTitle')}</span>
                <button
                  type="button"
                  class="pop-close"
                  onclick={() => (openDiscussionRowId = null)}
                  aria-label={i18n.t('common.close')}
                >×</button>
              </header>
              <ul>
                {#each row.discussion as turn, ti (ti)}
                  <li class={turn.role}>
                    <span class="t-label">{turn.agentLabel}</span>
                    <span class="t-text">{turn.text}</span>
                  </li>
                {/each}
              </ul>
            </div>
          {/if}
        </div>
      {/each}
    </div>
  {/if}

  {#if showCheckpoints}
    <aside class="cps" in:fly={{ x: 20, duration: 240, easing: cubicOut }}>
      <h3>{i18n.t('ptp.checkpointListTitle')}</h3>
      {#if projectCheckpoints.length === 0}
        <p class="cps-empty">{i18n.t('ptp.noCheckpoints')}</p>
      {:else}
        <ul>
          {#each projectCheckpoints as cp (cp.id)}
            <li class="cp">
              <div class="cp-info">
                <strong>{cp.name}</strong>
                <span class="cp-time">{formatTime(cp.timestamp)}</span>
                <span class="cp-meta">
                  {i18n.t('ptp.rowsCount', { n: cp.snapshot.ptpRows?.length ?? 0 })}
                </span>
              </div>
              <div class="cp-actions">
                <Button size="sm" variant="subtle" onclick={() => restoreCheckpoint(cp)}>
                  {i18n.t('ptp.restoreCheckpoint')}
                </Button>
                <IconButton
                  label={i18n.t('ptp.deleteCheckpoint')}
                  variant="ghost"
                  onclick={() => checkpoints.remove(cp.id)}
                >
                  <Icon name="trash" size={14} />
                </IconButton>
              </div>
            </li>
          {/each}
        </ul>
      {/if}
    </aside>
  {/if}
</div>

<style>
  .ptp {
    position: relative;
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 8px 8px 40px;
  }

  .head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
    flex-wrap: wrap;
  }
  .title-block h2 {
    margin: 0 0 4px;
    font-size: 22px;
    font-weight: 500;
    letter-spacing: -0.01em;
  }
  .sub {
    margin: 0;
    color: var(--tg-fg-muted);
    font-size: 13px;
    max-width: 56ch;
    line-height: 1.5;
  }
  .head-actions {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
  }

  .rows {
    display: flex;
    flex-direction: column;
    gap: 12px;
    max-width: min(960px, calc(100% - 40px));
  }

  .row {
    display: grid;
    grid-template-columns: 1fr 1fr auto;
    gap: 10px;
    align-items: start;
    background: var(--tg-bg-elevated);
    border: 1px solid var(--tg-border);
    border-radius: 14px;
    padding: 12px;
    backdrop-filter: blur(20px) saturate(1.4);
    -webkit-backdrop-filter: blur(20px) saturate(1.4);
  }
  @media (max-width: 720px) {
    .row {
      grid-template-columns: 1fr;
    }
  }

  .cell {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-width: 0;
  }
  .cell textarea {
    width: 100%;
    padding: 10px 12px;
    border-radius: 10px;
    border: 1px solid var(--tg-border);
    background: var(--tg-bg-input);
    color: var(--tg-fg);
    font-family: var(--font-sans);
    font-size: 14px;
    line-height: 1.55;
    resize: vertical;
    min-height: 80px;
    transition:
      border-color 180ms,
      box-shadow 220ms;
  }
  .cell textarea:focus {
    outline: none;
    border-color: var(--tg-primary);
    box-shadow: 0 0 0 3px var(--tg-ring);
  }
  .cell textarea::placeholder {
    color: var(--tg-fg-subtle);
  }
  .cell textarea.streaming {
    border-color: color-mix(in srgb, var(--tg-primary) 30%, var(--tg-border));
  }

  .caret {
    position: absolute;
    bottom: 14px;
    right: 14px;
    width: 6px;
    height: 6px;
    background: var(--tg-primary);
    border-radius: 50%;
    animation: pulse 1.1s ease-in-out infinite;
  }
  @keyframes pulse {
    0%,
    100% {
      transform: scale(0.7);
      opacity: 0.4;
    }
    50% {
      transform: scale(1.3);
      opacity: 1;
    }
  }

  .row-actions {
    display: inline-flex;
    flex-direction: column;
    gap: 4px;
  }
  @media (max-width: 720px) {
    .row-actions {
      flex-direction: row;
      justify-content: flex-end;
    }
  }

  .discussion-badge {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
  .badge-num {
    position: absolute;
    top: -6px;
    right: -8px;
    min-width: 14px;
    height: 14px;
    padding: 0 3px;
    border-radius: 7px;
    background: var(--tg-primary);
    color: var(--tg-primary-fg);
    font-size: 9.5px;
    font-weight: 600;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    line-height: 1;
  }

  .discussion-pop {
    grid-column: 1 / -1;
    margin-top: 8px;
    background: var(--tg-bg);
    border: 1px solid var(--tg-border);
    border-radius: 12px;
    padding: 10px 12px 12px;
  }
  .discussion-pop header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;
    font-size: 10.5px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--tg-fg-subtle);
    font-weight: 600;
  }
  .pop-close {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    border: none;
    background: transparent;
    color: var(--tg-fg-subtle);
    font-size: 14px;
    line-height: 1;
    cursor: pointer;
  }
  .pop-close:hover {
    background: var(--tg-bg-input);
    color: var(--tg-fg);
  }
  .discussion-pop ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .discussion-pop li {
    display: flex;
    gap: 8px;
    align-items: flex-start;
    font-size: 12.5px;
    line-height: 1.45;
    padding: 6px 9px;
    border-radius: 10px;
    border: 1px solid var(--tg-border);
    background: var(--tg-bg-elevated);
  }
  .discussion-pop li.translator {
    border-color: color-mix(in srgb, var(--tg-primary) 28%, var(--tg-border));
    background: color-mix(in srgb, var(--tg-primary) 5%, var(--tg-bg-elevated));
  }
  .discussion-pop li.reviewer {
    border-color: color-mix(in srgb, var(--tg-accent) 28%, var(--tg-border));
    background: color-mix(in srgb, var(--tg-accent) 6%, var(--tg-bg-elevated));
  }
  .t-label {
    font-size: 10.5px;
    font-weight: 600;
    color: var(--tg-fg-subtle);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    flex-shrink: 0;
    padding-top: 1px;
  }
  .t-text {
    flex: 1;
    color: var(--tg-fg);
  }

  .error {
    margin: 0;
    padding: 6px 8px;
    border-radius: 8px;
    background: color-mix(in srgb, var(--tg-danger) 10%, transparent);
    color: var(--tg-danger);
    font-size: 12px;
  }

  .empty {
    text-align: center;
    padding: 60px 24px;
    border: 1px dashed var(--tg-border-strong);
    border-radius: 18px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    color: var(--tg-fg-muted);
  }
  .empty p {
    margin: 0;
    max-width: 48ch;
    line-height: 1.5;
  }

  .cps {
    position: absolute;
    top: 56px;
    right: 8px;
    width: min(360px, 88vw);
    background: var(--tg-bg-elevated);
    border: 1px solid var(--tg-border);
    border-radius: 14px;
    padding: 14px;
    z-index: 20;
    box-shadow: 0 14px 40px -10px rgba(0, 0, 0, 0.18);
  }
  .cps h3 {
    margin: 0 0 10px;
    font-size: 14px;
    font-weight: 500;
  }
  .cps ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
    max-height: 50vh;
    overflow-y: auto;
  }
  .cp {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 10px;
    padding: 8px 10px;
    background: var(--tg-bg-input);
    border-radius: 10px;
  }
  .cp-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }
  .cp-info strong {
    font-size: 13px;
    font-weight: 500;
  }
  .cp-time,
  .cp-meta {
    font-size: 11.5px;
    color: var(--tg-fg-muted);
  }
  .cp-actions {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    flex-shrink: 0;
  }
  .cps-empty {
    margin: 0;
    padding: 14px;
    text-align: center;
    color: var(--tg-fg-subtle);
    font-size: 13px;
  }
</style>
