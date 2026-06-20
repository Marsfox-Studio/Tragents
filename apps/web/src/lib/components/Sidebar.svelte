<script lang="ts">
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import Brand from './Brand.svelte';
  import Logo from './Logo.svelte';
  import Icon from './Icon.svelte';
  import ProjectRow from './ProjectRow.svelte';
  import { projects, settings } from '$lib/stores';
  import { i18n } from '$lib/i18n.svelte';

  let search = $state('');
  let creating = $state(false);

  const collapsed = $derived(settings.sidebarCollapsed);
  const activeProjectId = $derived(page.url.searchParams.get('p') ?? '');
  const pinned = $derived(projects.pinned);
  const recent = $derived(projects.recent);

  const filtered = $derived.by(() => {
    const q = search.trim().toLowerCase();
    if (!q) return null;
    return projects.list.filter((p) => p.name.toLowerCase().includes(q));
  });

  async function newProject() {
    if (creating) return;
    creating = true;
    try {
      const idx = projects.list.length + 1;
      const project = await projects.create({
        name: i18n.t('sidebar.untitledN', { n: idx }),
        sourceLanguage: settings.current.defaultSourceLanguage,
        targetLanguage: settings.current.defaultTargetLanguage,
      });
      await goto(`/?p=${project.id}`);
    } finally {
      creating = false;
    }
  }

  function toggleCollapsed() {
    void settings.toggleSidebar();
  }

  /**
   * Settings nav is a toggle:
   *  - on /settings → go back to the last non-settings route (or /).
   *  - otherwise → remember current path, then navigate to /settings.
   * Stored in sessionStorage so it survives reloads within the tab.
   */
  const LAST_NON_SETTINGS_KEY = 'tg:lastNonSettingsPath';

  function handleSettingsClick(e: MouseEvent) {
    e.preventDefault();
    const path = page.url.pathname;
    if (path === '/settings') {
      const back = (typeof sessionStorage !== 'undefined'
        ? sessionStorage.getItem(LAST_NON_SETTINGS_KEY)
        : null) ?? '/';
      goto(back);
    } else {
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem(LAST_NON_SETTINGS_KEY, page.url.pathname + page.url.search);
      }
      goto('/settings');
    }
  }
</script>

<aside class="sidebar" class:collapsed={collapsed} aria-label="Primary">
  <div class="head">
    {#if collapsed}
      <a href="/" class="brand-link" aria-label={i18n.t('brand.name')}>
        <Logo size={28} animate={false} />
      </a>
    {:else}
      <a href="/" class="brand-link" aria-label={i18n.t('brand.name')}>
        <Brand size="md" />
      </a>
    {/if}
    <button
      type="button"
      class="collapse-toggle"
      onclick={toggleCollapsed}
      aria-label={collapsed ? i18n.t('sidebar.expand') : i18n.t('sidebar.collapse')}
      title={collapsed ? i18n.t('sidebar.expand') : i18n.t('sidebar.collapse')}
    >
      <Icon name={collapsed ? 'chevron-right' : 'arrow-left'} size={14} />
    </button>
  </div>

  {#if !collapsed}
    <div class="search">
      <span class="search-icon"><Icon name="search" size={15} /></span>
      <input
        bind:value={search}
        placeholder={i18n.t('sidebar.search')}
        type="search"
        aria-label={i18n.t('sidebar.search')}
      />
      {#if search}
        <button
          class="clear"
          onclick={() => (search = '')}
          aria-label={i18n.t('sidebar.clearSearch')}
        >
          <Icon name="x" size={13} />
        </button>
      {/if}
    </div>
  {/if}

  <button
    type="button"
    class="new-btn"
    class:compact={collapsed}
    onclick={newProject}
    disabled={creating}
    aria-label={i18n.t('sidebar.newProject')}
    title={collapsed ? i18n.t('sidebar.newProject') : undefined}
  >
    <Icon name="plus" size={15} />
    {#if !collapsed}<span>{i18n.t('sidebar.newProject')}</span>{/if}
  </button>

  {#if !collapsed}
    <div class="lists">
      {#if filtered}
        <section class="group">
          <h3 class="title">{i18n.t('sidebar.results')}</h3>
          {#if filtered.length === 0}
            <p class="empty-line">{i18n.t('sidebar.noMatches')}</p>
          {:else}
            {#each filtered as p (p.id)}
              <ProjectRow project={p} active={activeProjectId === p.id} />
            {/each}
          {/if}
        </section>
      {:else}
        {#if pinned.length > 0}
          <section class="group">
            <h3 class="title">{i18n.t('sidebar.pinned')}</h3>
            {#each pinned as p (p.id)}
              <ProjectRow project={p} active={activeProjectId === p.id} />
            {/each}
          </section>
        {/if}

        {#if recent.length > 0}
          <section class="group">
            <h3 class="title">{i18n.t('sidebar.recent')}</h3>
            {#each recent as p (p.id)}
              <ProjectRow project={p} active={activeProjectId === p.id} />
            {/each}
          </section>
        {/if}

        {#if pinned.length === 0 && recent.length === 0}
          <div class="empty">
            <p>{i18n.t('sidebar.empty')}</p>
            <p class="hint">{i18n.t('sidebar.emptyHint')}</p>
          </div>
        {/if}
      {/if}
    </div>
  {:else}
    <div class="spacer"></div>
  {/if}

  <div class="bottom">
    <a
      class="bottom-item"
      class:active={page.url.pathname === '/activity'}
      href="/activity"
      title={collapsed ? i18n.t('nav.activity') : undefined}
    >
      <Icon name="activity" size={16} />
      {#if !collapsed}<span>{i18n.t('nav.activity')}</span>{/if}
    </a>
    <a
      class="bottom-item"
      class:active={page.url.pathname === '/glossaries'}
      href="/glossaries"
      title={collapsed ? i18n.t('nav.glossaries') : undefined}
    >
      <Icon name="book" size={16} />
      {#if !collapsed}<span>{i18n.t('nav.glossaries')}</span>{/if}
    </a>
    <a
      class="bottom-item"
      class:active={page.url.pathname === '/settings'}
      href="/settings"
      onclick={handleSettingsClick}
      title={collapsed ? i18n.t('nav.settings') : undefined}
    >
      <Icon name="settings" size={16} />
      {#if !collapsed}<span>{i18n.t('nav.settings')}</span>{/if}
    </a>
  </div>
</aside>

<style>
  .sidebar {
    width: 240px;
    height: 100dvh;
    display: flex;
    flex-direction: column;
    padding: 14px 10px 10px;
    background: var(--tg-bg-sidebar);
    backdrop-filter: blur(22px) saturate(1.4);
    -webkit-backdrop-filter: blur(22px) saturate(1.4);
    border-right: 1px solid var(--tg-border);
    flex-shrink: 0;
    overflow: hidden;
    transition:
      width 320ms cubic-bezier(0.4, 0, 0.2, 1),
      padding 320ms cubic-bezier(0.4, 0, 0.2, 1);
  }
  .sidebar.collapsed {
    width: 64px;
    padding: 14px 8px 10px;
  }

  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 4px 6px 12px;
    gap: 6px;
    min-height: 40px;
  }
  .sidebar.collapsed .head {
    flex-direction: column;
    gap: 10px;
    padding: 4px 0 12px;
  }
  .brand-link {
    text-decoration: none;
    display: inline-flex;
    min-width: 0;
    flex: 1;
  }
  .sidebar.collapsed .brand-link {
    flex: initial;
    justify-content: center;
  }

  /* Prominent collapse toggle — always visible, in the header. */
  .collapse-toggle {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: 8px;
    border: 1px solid var(--tg-border);
    background: var(--tg-bg-elevated);
    color: var(--tg-fg-muted);
    cursor: pointer;
    transition:
      background 160ms,
      color 160ms,
      transform 160ms;
    flex-shrink: 0;
  }
  .collapse-toggle:hover {
    background: var(--tg-bg-input);
    color: var(--tg-fg);
    transform: translateX(-1px);
  }
  .sidebar.collapsed .collapse-toggle:hover {
    transform: translateX(1px);
  }

  .search {
    position: relative;
    display: flex;
    align-items: center;
    margin: 0 4px 8px;
  }
  .search input {
    width: 100%;
    padding: 8px 28px 8px 30px;
    background: var(--tg-bg-input);
    border: 1px solid transparent;
    border-radius: 9px;
    color: var(--tg-fg);
    font-size: 13px;
    transition:
      background 160ms,
      border-color 160ms;
  }
  .search input::placeholder {
    color: var(--tg-fg-subtle);
  }
  .search input:hover {
    background: var(--tg-bg-elevated);
  }
  .search input:focus {
    outline: none;
    background: var(--tg-bg-elevated);
    border-color: var(--tg-border-strong);
  }
  .search-icon {
    position: absolute;
    left: 9px;
    pointer-events: none;
    color: var(--tg-fg-subtle);
  }
  .clear {
    position: absolute;
    right: 6px;
    background: transparent;
    border: none;
    color: var(--tg-fg-subtle);
    cursor: pointer;
    padding: 4px;
    border-radius: 4px;
    display: flex;
  }
  .clear:hover {
    color: var(--tg-fg);
  }

  .new-btn {
    margin: 4px 4px 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 9px 12px;
    border: none;
    border-radius: 10px;
    background: var(--tg-primary);
    color: var(--tg-primary-fg);
    font-family: var(--font-sans);
    font-size: 13.5px;
    font-weight: 500;
    cursor: pointer;
    transition:
      background 160ms,
      transform 120ms;
  }
  .new-btn.compact {
    margin: 4px auto 12px;
    padding: 8px;
    width: 40px;
    height: 36px;
  }
  .new-btn:hover:not(:disabled) {
    background: var(--tg-primary-hover);
  }
  .new-btn:active:not(:disabled) {
    transform: scale(0.97);
  }
  .new-btn:disabled {
    opacity: 0.6;
    cursor: wait;
  }

  .lists {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 0 4px;
  }
  .spacer {
    flex: 1;
  }
  .group {
    margin-bottom: 14px;
  }
  .title {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--tg-fg-subtle);
    margin: 8px 9px 4px;
    font-weight: 600;
  }
  .empty-line {
    margin: 4px 9px;
    font-size: 12px;
    color: var(--tg-fg-subtle);
  }
  .empty {
    margin: 12px 9px;
    color: var(--tg-fg-subtle);
    font-size: 12.5px;
    line-height: 1.5;
  }
  .empty .hint {
    margin-top: 4px;
    font-size: 11.5px;
  }

  .bottom {
    border-top: 1px solid var(--tg-border);
    padding: 6px 4px 2px;
    margin-top: 6px;
    display: flex;
    flex-direction: column;
    gap: 1px;
  }
  .bottom-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 9px;
    border-radius: 8px;
    text-decoration: none;
    color: var(--tg-fg-muted);
    font-size: 13px;
    transition:
      background 160ms,
      color 160ms;
  }
  .sidebar.collapsed .bottom-item {
    justify-content: center;
    padding: 8px;
  }
  .bottom-item:hover {
    background: var(--tg-bg-elevated);
    color: var(--tg-fg);
  }
  .bottom-item.active {
    background: color-mix(in srgb, var(--tg-primary) 10%, transparent);
    color: var(--tg-fg);
  }

  @media (max-width: 720px) {
    .sidebar,
    .sidebar.collapsed {
      width: 100%;
      height: auto;
      display: grid;
      grid-template-columns: auto 1fr;
      align-items: center;
      gap: 10px;
      padding: 10px 12px;
      border-right: none;
      border-bottom: 1px solid var(--tg-border);
    }
    .head,
    .sidebar.collapsed .head {
      flex-direction: row;
      min-height: 0;
      padding: 0;
    }
    .brand-link,
    .sidebar.collapsed .brand-link {
      flex: initial;
      justify-content: flex-start;
    }
    .collapse-toggle,
    .search,
    .new-btn,
    .lists,
    .spacer {
      display: none;
    }
    .bottom {
      justify-self: end;
      flex-direction: row;
      align-items: center;
      border-top: none;
      padding: 0;
      margin: 0;
      gap: 4px;
    }
    .bottom-item,
    .sidebar.collapsed .bottom-item {
      padding: 8px;
      justify-content: center;
    }
    .bottom-item span {
      display: none;
    }
  }
</style>
