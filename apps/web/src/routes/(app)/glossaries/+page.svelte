<script lang="ts">
  import { fly, fade } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import type { Glossary, GlossaryEntry } from '@tragents/shared';
  import Icon from '$lib/components/Icon.svelte';
  import Button from '$lib/components/Button.svelte';
  import IconButton from '$lib/components/IconButton.svelte';
  import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';
  import { glossaries } from '$lib/stores';
  import { i18n } from '$lib/i18n.svelte';

  let expanded = $state<Record<string, boolean>>({});
  let newSourceFor = $state<Record<string, string>>({});
  let newTargetFor = $state<Record<string, string>>({});
  let pendingDeleteGlossaryId = $state<string | null>(null);

  // Ensure each glossary has a string entry so bind:value sees a string,
  // not the `string | undefined` that noUncheckedIndexedAccess produces.
  $effect(() => {
    for (const g of glossaries.list) {
      if (newSourceFor[g.id] === undefined) newSourceFor[g.id] = '';
      if (newTargetFor[g.id] === undefined) newTargetFor[g.id] = '';
    }
  });

  async function createGlossary() {
    const idx = glossaries.list.length + 1;
    const g = await glossaries.create(i18n.t('glossaries.untitledN', { n: idx }));
    expanded[g.id] = true;
  }

  function requestDeleteGlossary(id: string) {
    pendingDeleteGlossaryId = id;
  }

  async function confirmDeleteGlossary() {
    if (!pendingDeleteGlossaryId) return;
    await glossaries.delete(pendingDeleteGlossaryId);
    pendingDeleteGlossaryId = null;
  }

  async function renameGlossary(id: string, name: string) {
    await glossaries.rename(id, name);
  }

  async function addEntry(g: Glossary) {
    const src = newSourceFor[g.id]?.trim();
    const tgt = newTargetFor[g.id]?.trim();
    if (!src || !tgt) return;
    await glossaries.addEntry(g.id, { source: src, target: tgt });
    newSourceFor[g.id] = '';
    newTargetFor[g.id] = '';
  }

  async function removeEntry(g: Glossary, source: string) {
    await glossaries.removeEntry(g.id, source);
  }

  async function toggleDoNotTranslate(g: Glossary, entry: GlossaryEntry) {
    await glossaries.updateEntry(g.id, entry.source, {
      doNotTranslate: !entry.doNotTranslate,
    });
  }
</script>

<svelte:head>
  <title>{i18n.t('pageTitle.glossaries')}</title>
</svelte:head>

<div class="page" in:fly={{ y: 8, duration: 280, easing: cubicOut }}>
  <header class="head">
    <div>
      <h1>{i18n.t('glossaries.title')}</h1>
      <p class="sub">{i18n.t('glossaries.sub')}</p>
    </div>
    <Button onclick={createGlossary} variant="primary" size="sm">
      + {i18n.t('glossaries.create')}
    </Button>
  </header>

  <p class="integration" in:fade={{ duration: 320 }}>
    <Icon name="sparkles" size={14} />
    <span>{i18n.t('glossaries.integrationHint')}</span>
  </p>

  {#if glossaries.list.length === 0}
    <div class="empty" in:fade={{ duration: 320 }}>
      <div class="empty-icon"><Icon name="book" size={28} /></div>
      <p>{i18n.t('glossaries.empty')}</p>
      <p class="hint">{i18n.t('glossaries.emptyHint')}</p>
      <Button onclick={createGlossary} variant="primary">
        {i18n.t('glossaries.create')}
      </Button>
    </div>
  {:else}
    <ul class="g-list">
      {#each glossaries.list as g (g.id)}
        <li class="g-card">
          <header class="g-head">
            <button
              class="expand-btn"
              onclick={() => (expanded[g.id] = !expanded[g.id])}
              aria-label={expanded[g.id] ? 'Collapse' : 'Expand'}
            >
              <Icon name={expanded[g.id] ? 'chevron-down' : 'chevron-right'} size={14} />
            </button>
            <input
              class="g-name"
              value={g.name}
              onchange={(e: Event) =>
                renameGlossary(g.id, (e.currentTarget as HTMLInputElement).value)}
            />
            <span class="g-count">{i18n.t('glossaries.entriesCount', { count: g.entries.length })}</span>
            <IconButton
              label={i18n.t('glossaries.deleteGlossary')}
              variant="ghost"
              onclick={() => requestDeleteGlossary(g.id)}
            >
              <Icon name="trash" size={15} />
            </IconButton>
          </header>

          {#if expanded[g.id]}
            <div class="g-body" in:fly={{ y: -4, duration: 220, easing: cubicOut }}>
              {#if g.entries.length > 0}
                <div class="entries">
                  <div class="entry-head">
                    <span>{i18n.t('glossaries.sourceCol')}</span>
                    <span>{i18n.t('glossaries.targetCol')}</span>
                    <span></span>
                  </div>
                  {#each g.entries as e (e.source)}
                    <div class="entry">
                      <span class="cell src">{e.source}</span>
                      <span class="cell">
                        {#if e.doNotTranslate}
                          <em class="dnt">{i18n.t('glossaries.dontTranslate')}</em>
                        {:else}
                          {e.target}
                        {/if}
                      </span>
                      <span class="entry-actions">
                        <button
                          class="dnt-toggle"
                          class:on={e.doNotTranslate}
                          onclick={() => toggleDoNotTranslate(g, e)}
                          title={i18n.t('glossaries.dontTranslate')}
                        >
                          <Icon name={e.doNotTranslate ? 'eye-off' : 'eye'} size={14} />
                        </button>
                        <IconButton
                          label={i18n.t('common.delete')}
                          variant="ghost"
                          size="sm"
                          onclick={() => removeEntry(g, e.source)}
                        >
                          <Icon name="x" size={13} />
                        </IconButton>
                      </span>
                    </div>
                  {/each}
                </div>
              {/if}

              <form
                class="add-row"
                onsubmit={(e: SubmitEvent) => {
                  e.preventDefault();
                  addEntry(g);
                }}
              >
                <input
                  class="add-input"
                  value={newSourceFor[g.id] ?? ''}
                  oninput={(e) => (newSourceFor[g.id] = (e.currentTarget as HTMLInputElement).value)}
                  placeholder={i18n.t('glossaries.sourceCol')}
                />
                <input
                  class="add-input"
                  value={newTargetFor[g.id] ?? ''}
                  oninput={(e) => (newTargetFor[g.id] = (e.currentTarget as HTMLInputElement).value)}
                  placeholder={i18n.t('glossaries.targetCol')}
                />
                <Button type="submit" size="sm" variant="subtle">
                  {i18n.t('glossaries.addEntry')}
                </Button>
              </form>
            </div>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}
</div>

<ConfirmDialog
  open={pendingDeleteGlossaryId !== null}
  title={i18n.t('glossaries.deleteGlossary')}
  message={i18n.t('glossaries.deleteConfirm')}
  onConfirm={confirmDeleteGlossary}
  onCancel={() => (pendingDeleteGlossaryId = null)}
/>

<style>
  .page {
    max-width: 880px;
    margin: 0 auto;
    padding: 56px 32px 80px;
    display: flex;
    flex-direction: column;
    gap: 20px;
  }
  .head {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    gap: 16px;
    flex-wrap: wrap;
  }
  h1 {
    margin: 0 0 6px;
    font-size: 32px;
    font-weight: 500;
    letter-spacing: -0.02em;
  }
  .sub {
    margin: 0;
    color: var(--tg-fg-muted);
    font-size: 14px;
  }
  .integration {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    margin: 0;
    padding: 10px 14px;
    background: var(--tg-bg-input);
    border: 1px solid var(--tg-border);
    border-radius: 12px;
    color: var(--tg-fg-muted);
    font-size: 13px;
  }
  .integration :global(svg) {
    color: var(--tg-primary);
  }

  .empty {
    text-align: center;
    padding: 60px 24px;
    border: 1px dashed var(--tg-border-strong);
    border-radius: 20px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
  }
  .empty-icon {
    width: 56px;
    height: 56px;
    border-radius: 16px;
    background: color-mix(in srgb, var(--tg-primary) 10%, transparent);
    color: var(--tg-primary);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 6px;
  }
  .empty p {
    margin: 0;
    color: var(--tg-fg);
    font-size: 15px;
  }
  .empty .hint {
    color: var(--tg-fg-muted);
    font-size: 13.5px;
    max-width: 420px;
    line-height: 1.5;
    margin-bottom: 6px;
  }

  .g-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .g-card {
    background: var(--tg-bg-elevated);
    border: 1px solid var(--tg-border);
    border-radius: 14px;
    overflow: hidden;
  }
  .g-head {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 14px;
  }
  .expand-btn {
    background: transparent;
    border: none;
    color: var(--tg-fg-muted);
    padding: 4px;
    cursor: pointer;
    display: inline-flex;
    border-radius: 6px;
  }
  .expand-btn:hover {
    background: var(--tg-border);
    color: var(--tg-fg);
  }
  .g-name {
    flex: 1;
    min-width: 0;
    background: transparent;
    border: 1px solid transparent;
    border-radius: 8px;
    padding: 6px 10px;
    color: var(--tg-fg);
    font-family: inherit;
    font-size: 15px;
    font-weight: 500;
  }
  .g-name:hover {
    background: var(--tg-bg-input);
  }
  .g-name:focus {
    outline: none;
    background: var(--tg-bg-input);
    border-color: var(--tg-border-strong);
  }
  .g-count {
    color: var(--tg-fg-subtle);
    font-size: 12px;
    padding: 2px 8px;
    background: var(--tg-bg-input);
    border-radius: 999px;
  }

  .g-body {
    padding: 6px 14px 14px;
    border-top: 1px solid var(--tg-border);
  }

  .entries {
    display: flex;
    flex-direction: column;
    margin: 8px 0 12px;
  }
  .entry-head,
  .entry {
    display: grid;
    grid-template-columns: 1fr 1fr 80px;
    gap: 12px;
    align-items: center;
    padding: 8px 4px;
  }
  .entry-head {
    color: var(--tg-fg-subtle);
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    border-bottom: 1px solid var(--tg-border);
    font-weight: 600;
  }
  .entry {
    border-bottom: 1px solid var(--tg-border);
    font-size: 13.5px;
  }
  .entry:last-child {
    border-bottom: none;
  }
  .cell {
    word-break: break-word;
    color: var(--tg-fg);
  }
  .cell.src {
    font-family: var(--font-mono);
    font-size: 13px;
  }
  .dnt {
    color: var(--tg-fg-subtle);
    font-style: italic;
    font-size: 12.5px;
  }
  .entry-actions {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    justify-content: flex-end;
  }
  .dnt-toggle {
    background: transparent;
    border: none;
    color: var(--tg-fg-subtle);
    cursor: pointer;
    padding: 4px;
    border-radius: 6px;
    display: inline-flex;
  }
  .dnt-toggle:hover {
    background: var(--tg-border);
    color: var(--tg-fg);
  }
  .dnt-toggle.on {
    color: var(--tg-primary);
  }

  .add-row {
    display: grid;
    grid-template-columns: 1fr 1fr auto;
    gap: 8px;
    padding-top: 6px;
  }
  .add-input {
    display: block;
    width: 100%;
    padding: 9px 12px;
    border-radius: 10px;
    border: 1px solid var(--tg-border);
    background: var(--tg-bg-input);
    color: var(--tg-fg);
    font-family: var(--font-sans);
    font-size: 13.5px;
    transition: border-color 180ms cubic-bezier(0.4, 0, 0.2, 1);
  }
  .add-input::placeholder {
    color: var(--tg-fg-subtle);
  }
  .add-input:focus {
    outline: none;
    border-color: var(--tg-primary);
    box-shadow: 0 0 0 3px var(--tg-ring);
  }
  @media (max-width: 600px) {
    .add-row {
      grid-template-columns: 1fr;
    }
    .entry-head,
    .entry {
      grid-template-columns: 1fr;
      gap: 4px;
    }
  }
</style>
