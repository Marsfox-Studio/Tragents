<script lang="ts">
  import { fly, fade } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import type { ModeKey, TranslationMode } from '@tragents/shared';
  import type { OrchestratorEvent } from '@tragents/core';
  import Logo from '$lib/components/Logo.svelte';
  import Brand from '$lib/components/Brand.svelte';
  import ChatInput from '$lib/components/ChatInput.svelte';
  import Button from '$lib/components/Button.svelte';
  import Icon from '$lib/components/Icon.svelte';
  import PtpWorkspace from '$lib/components/PtpWorkspace.svelte';
  import QuestionDialog from '$lib/components/QuestionDialog.svelte';
  import DiscussionStream from '$lib/components/DiscussionStream.svelte';
  import { settings, providers, projects, tasks, taskIdFor } from '$lib/stores';
  import type { PersistedTask } from '$lib/stores';
  import {
    NoProviderError,
    detectModeForText,
    previewTranslationContext,
    translateText,
  } from '$lib/translation';
  import { i18n } from '$lib/i18n.svelte';

  const projectId = $derived(page.url.searchParams.get('p') ?? undefined);
  const currentProject = $derived(
    projectId ? projects.list.find((p) => p.id === projectId) : undefined,
  );

  let inputText = $state('');
  let cornerInputText = $state('');
  let source = $state(settings.current.defaultSourceLanguage);
  let target = $state(settings.current.defaultTargetLanguage);
  let mode = $state<TranslationMode>('auto');
  let pipelineId = $state<string | undefined>(undefined);

  let lastSyncedProjectId = $state<string | undefined | null>(null);
  $effect(() => {
    const p = currentProject;
    const id = p?.id ?? '__none__';
    if (id !== lastSyncedProjectId) {
      lastSyncedProjectId = id;
      if (p) {
        source = p.sourceLanguage;
        target = p.targetLanguage;
      } else {
        source = settings.current.defaultSourceLanguage;
        target = settings.current.defaultTargetLanguage;
      }
      pipelineId = undefined;
    }
  });

  $effect(() => {
    const s = source;
    const t = target;
    if (lastSyncedProjectId === null) return;
    const p = currentProject;
    if (p) {
      if (p.sourceLanguage !== s || p.targetLanguage !== t) {
        projects.update(p.id, { sourceLanguage: s, targetLanguage: t });
      }
    } else if (
      s !== settings.current.defaultSourceLanguage ||
      t !== settings.current.defaultTargetLanguage
    ) {
      settings.setLanguages(s, t);
    }
  });

  let task = $state<PersistedTask | null>(null);
  let aborter: AbortController | null = null;
  let lastAgentId = $state<string | undefined>(undefined);
  let persistTimer: ReturnType<typeof setTimeout> | null = null;

  function schedulePersist() {
    if (!task) return;
    if (persistTimer) return;
    persistTimer = setTimeout(() => {
      persistTimer = null;
      if (task) {
        task.updatedAt = Date.now();
        tasks.upsert($state.snapshot(task));
      }
    }, 250);
  }

  function flushPersist() {
    if (persistTimer) {
      clearTimeout(persistTimer);
      persistTimer = null;
    }
    if (task) {
      task.updatedAt = Date.now();
      tasks.upsert($state.snapshot(task));
    }
  }

  /**
   * Restore the persisted task for the active project (or free slot) when:
   *   - tasks finish loading from IDB
   *   - the user switches projects via the `?p=` query param
   *
   * Re-running on every `tasks.list` mutation would clobber the live
   * streaming task with stale snapshots, so we deliberately track only
   * `projectId` and `tasks.loaded` and use untracked reads for the rest.
   */
  let lastRestoredProjectId = $state<string | null>(null);
  $effect(() => {
    if (!tasks.loaded) return;
    const id = taskIdFor(projectId);
    if (id === lastRestoredProjectId) return;
    lastRestoredProjectId = id;
    const existing = tasks.forProject(projectId);
    if (existing) {
      task = { ...existing };
      mode = existing.mode;
    } else {
      task = null;
    }
  });

  let pendingMessages = $state<string[]>([]);

  let ptpAddAndTranslate = $state<((s: string) => Promise<void>) | undefined>(undefined);
  let ptpBusy = $state(false);
  let ptpQueue = $state<string[]>([]);

  const isPtp = $derived(mode === 'ptp' && currentProject !== undefined);
  const isBusy = $derived(task?.status === 'running' || ptpBusy);

  const hintKeys = ['games', 'books', 'papers', 'codebases'] as const;

  let sidebarWasCollapsed = $state(false);
  let restoreSidebarOnExit = $state(false);
  $effect(() => {
    if (isBusy) {
      if (!sidebarWasCollapsed && !settings.sidebarCollapsed) {
        restoreSidebarOnExit = true;
        void settings.toggleSidebar();
      }
      sidebarWasCollapsed = true;
    } else if (sidebarWasCollapsed) {
      if (restoreSidebarOnExit && settings.sidebarCollapsed) {
        void settings.toggleSidebar();
      }
      restoreSidebarOnExit = false;
      sidebarWasCollapsed = false;
    }
  });

  function handleEvent(e: OrchestratorEvent) {
    if (!task) return;
    if (e.type === 'mode') {
      task.resolvedMode = e.mode;
    } else if (e.type === 'phase') {
      task.phase = e.phase;
      // Each phase produces a fresh output that REPLACES the previous phase's
      // output. Without this reset, translator + reviewer streams concatenate
      // and the user sees duplicated translations (the "三个你好" bug).
      task.output = '';
      lastAgentId = undefined;
      if (e.phase !== 'translate' && e.phase !== 'review') task.progress = undefined;
    } else if (e.type === 'progress') {
      task.progress = { current: e.current, total: e.total };
    } else if (e.type === 'agentStart') {
      // For non-chunked text mode: each new agent (e.g. reviewer 1 → reviewer 2)
      // replaces the previous agent's output. Chunked agents (long-form) append
      // because each chunk contributes a different part of the assembled result.
      if (e.chunkIndex === undefined && e.agentId !== lastAgentId) {
        task.output = '';
      }
      lastAgentId = e.agentId;
    } else if (e.type === 'discussionTurn') {
      task.discussion = [
        ...task.discussion,
        {
          id: `${e.agentId}-${task.discussion.length}-${Date.now()}`,
          agentId: e.agentId,
          agentLabel: e.agentLabel,
          role: e.role,
          text: e.text,
          chunkIndex: e.chunkIndex,
          timestamp: Date.now(),
        },
      ];
    }
    schedulePersist();
  }

  async function runTranslation(text: string, runMode: TranslationMode) {
    const lookup: ModeKey =
      !runMode || runMode === 'auto' ? 'text' : (runMode as ModeKey);
    const pipeline = settings.pipelineForMode(lookup);
    const conversational = pipeline
      ? pipeline.translators + pipeline.reviewers > 1
      : false;
    const contextPack = previewTranslationContext(currentProject?.id);

    const now = Date.now();
    task = {
      id: taskIdFor(projectId),
      projectId: projectId ?? null,
      input: text,
      output: '',
      error: null,
      status: 'running',
      mode: runMode,
      source,
      target,
      contextInherited: contextPack?.inherited ?? [],
      discussionEnabled: conversational,
      discussion: [],
      startedAt: now,
      updatedAt: now,
    };
    flushPersist();
    aborter = new AbortController();
    lastAgentId = undefined;

    try {
      const result = await translateText({
        text,
        source,
        target,
        mode: runMode,
        pipelineId,
        projectId: currentProject?.id,
        signal: aborter.signal,
        onDelta: (delta) => {
          if (task) {
            task.output += delta;
            schedulePersist();
          }
        },
        onEvent: handleEvent,
      });
      if (task) {
        task.status = 'done';
        task.resolvedMode = result.mode;
        task.meta = {
          mode: result.mode,
          pipelineName: result.pipelineName,
          agentCount: result.agentCount,
          ms: result.durationMs,
        };
        if (result.mode === 'i18n' || !task.output) task.output = result.output;
        task.contextInherited = result.contextPack?.inherited ?? task.contextInherited ?? [];
      }
    } catch (err) {
      if (err instanceof NoProviderError) {
        goto('/settings');
        return;
      }
      if (task) {
        const aborted = (err as Error)?.name === 'AbortError';
        task.status = aborted ? 'cancelled' : 'failed';
        task.error = aborted
          ? i18n.t('home.stopped')
          : err instanceof Error
            ? err.message
            : String(err);
      }
    } finally {
      aborter = null;
      flushPersist();
    }

    if (pendingMessages.length > 0) {
      const next = pendingMessages[0]!;
      pendingMessages = pendingMessages.slice(1);
      setTimeout(() => runTranslation(next, mode), 250);
    }
  }

  interface PendingDetect {
    text: string;
    detecting: boolean;
    suggested?: Exclude<TranslationMode, 'auto'>;
    reason?: string;
  }
  let pendingDetect = $state<PendingDetect | null>(null);
  let detectAborter: AbortController | null = null;

  function modeLabel(m: TranslationMode | undefined): string {
    if (!m) return '';
    const key = m
      .split('-')
      .map((p, i) => (i === 0 ? p : p.charAt(0).toUpperCase() + p.slice(1)))
      .join('');
    return i18n.t(`chat.mode${key.charAt(0).toUpperCase() + key.slice(1)}`);
  }

  function startDetectThenRun(text: string) {
    pendingDetect = { text, detecting: true };
    detectAborter?.abort();
    detectAborter = new AbortController();
    detectModeForText(text, detectAborter.signal).then((detected) => {
      if (!pendingDetect || pendingDetect.text !== text) return;
      if (!detected) {
        pendingDetect = null;
        runTranslation(text, 'auto');
        return;
      }
      if (detected.mode === 'text') {
        pendingDetect = null;
        runTranslation(text, 'text');
        return;
      }
      pendingDetect = {
        text,
        detecting: false,
        suggested: detected.mode,
        reason: detected.reason,
      };
    });
  }

  function answerSwitch() {
    if (!pendingDetect || !pendingDetect.suggested) return;
    const t = pendingDetect.text;
    const m = pendingDetect.suggested;
    mode = m;
    pendingDetect = null;
    runTranslation(t, m);
  }

  function answerKeep() {
    if (!pendingDetect) return;
    const t = pendingDetect.text;
    pendingDetect = null;
    runTranslation(t, 'text');
  }

  function dismissDetect() {
    detectAborter?.abort();
    detectAborter = null;
    pendingDetect = null;
  }

  async function handleSubmit(text: string) {
    if (providers.list.length === 0) {
      goto('/settings');
      return;
    }

    if (isPtp && ptpAddAndTranslate) {
      cornerInputText = '';
      if (ptpBusy) {
        ptpQueue = [...ptpQueue, text];
        return;
      }
      ptpBusy = true;
      try {
        await ptpAddAndTranslate(text);
        while (ptpQueue.length > 0) {
          const next = ptpQueue[0]!;
          ptpQueue = ptpQueue.slice(1);
          await ptpAddAndTranslate(next);
        }
      } finally {
        ptpBusy = false;
      }
      return;
    }

    if (isBusy) {
      pendingMessages = [...pendingMessages, text];
      inputText = '';
      cornerInputText = '';
      return;
    }

    inputText = '';
    cornerInputText = '';

    if (mode === 'auto') {
      startDetectThenRun(text);
      return;
    }

    await runTranslation(text, mode);
  }

  async function clearTask() {
    aborter?.abort();
    aborter = null;
    const id = taskIdFor(projectId);
    await tasks.remove(id);
    task = null;
    pendingMessages = [];
  }

  function stop() {
    aborter?.abort();
    if (task) {
      task.status = 'cancelled';
      flushPersist();
    }
  }

  function modeKey(m: string): string {
    return m
      .split('-')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join('');
  }

  const phaseLabel = $derived(task?.phase ? i18n.t(`home.phase.${task.phase}`) : '');
  const showTask = $derived(task !== null);

  const detectQuestion = $derived.by(() => {
    if (!pendingDetect || pendingDetect.detecting) return '';
    const m = modeLabel(pendingDetect.suggested);
    return i18n.t('questionDialog.detectQuestion', { mode: m });
  });
</script>

<svelte:head>
  <title>
    {currentProject ? `${currentProject.name} · ${i18n.t('brand.name')}` : i18n.t('pageTitle.home')}
  </title>
</svelte:head>

<div class="page" class:active={showTask} class:ptp={isPtp}>
  {#if task?.status === 'running'}
    <div class="progress" in:fade={{ duration: 180 }} out:fade={{ duration: 280 }}>
      <div class="progress-fill"></div>
    </div>
  {/if}

  {#if currentProject && !showTask && !isPtp}
    <div class="project-bar" in:fade={{ duration: 220 }}>
      <Icon name="sparkles" size={14} />
      <span>{currentProject.name}</span>
      <a href="/" class="exit-project" aria-label="Exit project">
        <Icon name="x" size={14} />
      </a>
    </div>
  {/if}

  {#if isPtp && currentProject && !showTask}
    <div class="ptp-shell" in:fade={{ duration: 280 }}>
      <div class="ptp-main">
        <PtpWorkspace project={currentProject} bind:addAndTranslate={ptpAddAndTranslate} />
      </div>
      <div class="ptp-corner" in:fly={{ x: 60, y: 30, duration: 360, easing: cubicOut, delay: 80 }}>
        <ChatInput
          bind:value={cornerInputText}
          bind:source
          bind:target
          bind:mode
          bind:pipelineId
          compact
          queueing={ptpBusy}
          queuedCount={ptpQueue.length}
          onSubmit={handleSubmit}
        />
      </div>
    </div>
  {:else if !showTask}
    <div class="hero" in:fade={{ duration: 260 }} out:fly={{ y: -20, duration: 220 }}>
      <div class="logo-wrap"><Logo size={88} /></div>
      <div class="wordmark"><Brand size="xl" showDot={false} /></div>
      <p class="subtitle">{i18n.t('brand.tagline')}</p>

      {#if pendingDetect}
        <div class="dialog-wrap" in:fly={{ y: 8, duration: 260, easing: cubicOut }}>
          {#if pendingDetect.detecting}
            <div class="detecting-card">
              <span class="dot" aria-hidden="true"></span>
              <span>{i18n.t('home.detecting')}</span>
            </div>
          {:else if pendingDetect.suggested}
            <QuestionDialog
              eyebrow={i18n.t('questionDialog.autoEyebrow')}
              question={detectQuestion}
              options={[
                {
                  id: 'switch',
                  label: i18n.t('questionDialog.switchYes', {
                    mode: modeLabel(pendingDetect.suggested),
                  }),
                  hint: pendingDetect.reason,
                  primary: true,
                },
                {
                  id: 'keep',
                  label: i18n.t('questionDialog.switchNo', { keep: modeLabel('text') }),
                },
              ]}
              onAnswer={(id) => (id === 'switch' ? answerSwitch() : answerKeep())}
              onDismiss={dismissDetect}
            />
          {/if}
        </div>
      {/if}

      <div class="input-wrap">
        <ChatInput
          bind:value={inputText}
          bind:source
          bind:target
          bind:mode
          bind:pipelineId
          queueing={isBusy}
          queuedCount={pendingMessages.length}
          onSubmit={handleSubmit}
        />
      </div>
      <div class="hints">
        {#each hintKeys as h, i (h)}
          <span class="hint">{i18n.t(`home.hints.${h}`)}</span>
          {#if i < hintKeys.length - 1}<span class="sep" aria-hidden="true">·</span>{/if}
        {/each}
      </div>
    </div>
  {:else if task}
    <div class="trans" class:has-discussion={task.discussionEnabled}>
      <section class="output-col">
        <article class="output-card">
          <h3 class="card-title">
            <span>{i18n.t('home.paneTitleTarget', { lang: task.target })}</span>
            {#if task.status === 'running'}
              <span class="dot-pulse" aria-label={i18n.t('home.streaming')}></span>
            {/if}
          </h3>
          <div class="card-body">
            {#if task.error && !task.output}
              <p class="error">{task.error}</p>
            {:else if task.output}
              {task.output}{#if task.status === 'running'}<span class="caret"></span>{/if}
            {:else if task.status === 'running'}
              <p class="placeholder">{phaseLabel || i18n.t('home.streaming')}…</p>
            {:else}
              <p class="placeholder">{i18n.t('home.emptyOutput')}</p>
            {/if}
          </div>
        </article>

        <article class="source-card">
          <h4>{i18n.t('home.paneTitleSource', { lang: task.source })}</h4>
          <div class="source-body">{task.input}</div>
        </article>
      </section>

      <aside class="side-col" in:fly={{ x: 40, duration: 320, easing: cubicOut, delay: 80 }}>
        <section class="status-panel" aria-label={i18n.t('home.progress')}>
          <header class="status-head">
            <span class="status-title">{i18n.t('home.progress')}</span>
            {#if task.status === 'running'}
              <span class="chip status running">
                <span class="dot-pulse"></span>{phaseLabel || i18n.t('home.streaming')}
              </span>
            {:else if task.status === 'done'}
              <span class="chip status done">{i18n.t('home.statusDone')}</span>
            {:else if task.status === 'cancelled'}
              <span class="chip status cancelled">{i18n.t('home.statusCancelled')}</span>
            {:else if task.status === 'failed'}
              <span class="chip status failed">{i18n.t('home.statusFailed')}</span>
            {/if}
          </header>

          <dl class="status-kv">
            {#if task.resolvedMode}
              <dt>{i18n.t('chat.mode')}</dt>
              <dd>{i18n.t(`chat.mode${modeKey(task.resolvedMode)}`)}</dd>
            {/if}
            {#if task.meta?.pipelineName}
              <dt>{i18n.t('home.pipelineLabel')}</dt>
              <dd>{task.meta.pipelineName}</dd>
              <dt>{i18n.t('home.agentsLabel')}</dt>
              <dd>{task.meta.agentCount}</dd>
            {/if}
            {#if task.progress}
              <dt>{i18n.t('home.chunkLabel')}</dt>
              <dd>{task.progress.current}/{task.progress.total}</dd>
            {/if}
            {#if task.meta?.ms}
              <dt>{i18n.t('home.durationLabel')}</dt>
              <dd>{task.meta.ms} ms</dd>
            {/if}
            {#if pendingMessages.length > 0}
              <dt>{i18n.t('home.queuedLabel')}</dt>
              <dd class="queued">+{pendingMessages.length}</dd>
            {/if}
          </dl>

          {#if task.error && task.output}
            <p class="status-error">{task.error}</p>
          {/if}

          {#if task.contextInherited?.length}
            <div class="memory-strip">
              <span class="memory-title">{i18n.t('home.contextTitle')}</span>
              <ul>
                {#each task.contextInherited.slice(0, 6) as item}
                  <li>{item}</li>
                {/each}
              </ul>
            </div>
          {/if}

          <div class="status-actions">
            {#if task.status === 'running'}
              <Button variant="subtle" size="sm" onclick={stop}>
                {i18n.t('common.stop')}
              </Button>
            {:else}
              <button
                type="button"
                class="ghost-btn"
                onclick={clearTask}
                title={i18n.t('home.clearTask')}
              >
                <Icon name="trash" size={14} />
                <span>{i18n.t('home.clearTask')}</span>
              </button>
            {/if}
          </div>
        </section>

        {#if task.discussionEnabled}
          <div class="side-discussion">
            <DiscussionStream
              turns={task.discussion}
              title={i18n.t('home.discussionTitle')}
              emptyHint={i18n.t('home.discussionEmpty')}
              streaming={task.status === 'running'}
            />
          </div>
        {:else}
          <div class="side-hint">
            <p>{i18n.t('home.fastModeHint')}</p>
          </div>
        {/if}

        <div class="side-input">
          {#if pendingDetect}
            <div class="side-dialog">
              {#if pendingDetect.detecting}
                <div class="detecting-card">
                  <span class="dot" aria-hidden="true"></span>
                  <span>{i18n.t('home.detecting')}</span>
                </div>
              {:else if pendingDetect.suggested}
                <QuestionDialog
                  eyebrow={i18n.t('questionDialog.autoEyebrow')}
                  question={detectQuestion}
                  options={[
                    {
                      id: 'switch',
                      label: i18n.t('questionDialog.switchYes', {
                        mode: modeLabel(pendingDetect.suggested),
                      }),
                      hint: pendingDetect.reason,
                      primary: true,
                    },
                    {
                      id: 'keep',
                      label: i18n.t('questionDialog.switchNo', { keep: modeLabel('text') }),
                    },
                  ]}
                  onAnswer={(id) => (id === 'switch' ? answerSwitch() : answerKeep())}
                  onDismiss={dismissDetect}
                />
              {/if}
            </div>
          {/if}
          <ChatInput
            bind:value={cornerInputText}
            bind:source
            bind:target
            bind:mode
            bind:pipelineId
            compact
            queueing={isBusy}
            queuedCount={pendingMessages.length}
            onSubmit={handleSubmit}
            placeholder={i18n.t('home.placeholder')}
          />
        </div>
      </aside>
    </div>
  {/if}
</div>

<style>
  .page {
    position: relative;
    min-height: 100dvh;
    display: flex;
    flex-direction: column;
    align-items: stretch;
    justify-content: center;
    padding: 56px 32px 40px;
    transition: padding 280ms cubic-bezier(0.4, 0, 0.2, 1);
  }
  .page.active {
    padding: 18px 18px 18px;
    align-items: stretch;
    justify-content: flex-start;
    height: 100dvh;
    min-height: 100dvh;
    overflow: hidden;
  }
  .page.ptp {
    padding: 24px 24px 24px;
    align-items: stretch;
    justify-content: flex-start;
  }

  .progress {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 2.5px;
    background: color-mix(in srgb, var(--tg-primary) 10%, transparent);
    overflow: hidden;
    z-index: 10;
  }
  .progress-fill {
    position: absolute;
    inset: 0;
    width: 35%;
    background: linear-gradient(
      90deg,
      transparent 0%,
      var(--tg-primary) 30%,
      var(--tg-accent) 70%,
      transparent 100%
    );
    animation: progress-slide 1.5s cubic-bezier(0.4, 0, 0.2, 1) infinite;
    border-radius: 999px;
    filter: blur(0.4px);
    will-change: transform;
  }
  @keyframes progress-slide {
    0% {
      transform: translateX(-100%);
    }
    100% {
      transform: translateX(386%);
    }
  }

  .project-bar {
    position: absolute;
    top: 16px;
    left: 50%;
    transform: translateX(-50%);
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 5px 10px 5px 12px;
    background: var(--tg-bg-elevated);
    border: 1px solid var(--tg-border);
    border-radius: 999px;
    color: var(--tg-fg);
    font-size: 12.5px;
    z-index: 5;
  }
  .project-bar :global(svg) {
    color: var(--tg-primary);
  }
  .exit-project {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    color: var(--tg-fg-muted);
    text-decoration: none;
    transition:
      background 160ms,
      color 160ms;
  }
  .exit-project:hover {
    background: var(--tg-border);
    color: var(--tg-fg);
  }

  .ptp-shell {
    position: relative;
    width: 100%;
    min-height: calc(100dvh - 48px);
    display: flex;
    flex-direction: column;
  }
  .ptp-main {
    flex: 1;
    min-height: 0;
    max-width: 1200px;
    width: 100%;
    margin: 0 auto;
  }
  .ptp-corner {
    position: fixed;
    bottom: 28px;
    right: 28px;
    z-index: 30;
  }
  @media (max-width: 720px) {
    .ptp-corner {
      bottom: 12px;
      right: 12px;
      left: 12px;
    }
  }

  .hero {
    width: 100%;
    max-width: 720px;
    margin: auto;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
  }
  .logo-wrap {
    margin-bottom: 6px;
  }
  .wordmark :global(.brand) {
    font-size: 36px;
    letter-spacing: -0.025em;
    font-weight: 450;
  }
  .subtitle {
    margin: 4px 0 18px;
    color: var(--tg-fg-muted);
    font-size: 15px;
  }
  .input-wrap {
    width: 100%;
    display: flex;
    justify-content: center;
  }
  .hints {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 9px;
    color: var(--tg-fg-subtle);
    font-size: 13px;
    margin-top: 6px;
  }
  .sep {
    opacity: 0.5;
  }

  .dialog-wrap {
    width: 100%;
    max-width: 640px;
    margin-bottom: -4px;
  }
  .detecting-card {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    padding: 10px 14px;
    border-radius: 14px;
    background: var(--tg-bg-elevated);
    border: 1px solid var(--tg-border);
    color: var(--tg-fg-muted);
    font-size: 13px;
    backdrop-filter: blur(22px) saturate(1.4);
    -webkit-backdrop-filter: blur(22px) saturate(1.4);
  }
  .detecting-card .dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--tg-primary);
    animation: pulse 1.2s ease-in-out infinite;
  }

  .trans {
    width: 100%;
    max-width: 1500px;
    margin: 0 auto;
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(340px, 440px);
    gap: 14px;
    height: 100%;
    min-height: 0;
  }
  .trans:not(.has-discussion) {
    grid-template-columns: minmax(0, 1fr) minmax(340px, 400px);
  }
  @media (max-width: 980px) {
    .trans,
    .trans:not(.has-discussion) {
      grid-template-columns: 1fr;
      grid-template-rows: minmax(0, 1.4fr) minmax(360px, 1fr);
    }
  }

  .output-col {
    display: grid;
    grid-template-rows: minmax(0, 1.35fr) minmax(190px, 0.75fr);
    gap: 12px;
    min-height: 0;
  }

  .output-card,
  .source-card {
    background: var(--tg-bg-elevated);
    border: 1px solid var(--tg-border);
    border-radius: 18px;
    padding: 18px 20px;
    backdrop-filter: blur(22px) saturate(1.4);
    -webkit-backdrop-filter: blur(22px) saturate(1.4);
    display: flex;
    flex-direction: column;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
  }
  .source-card {
    padding: 12px 16px 14px;
  }

  .card-title {
    margin: 0 0 12px;
    font-size: 11.5px;
    color: var(--tg-fg-subtle);
    text-transform: uppercase;
    letter-spacing: 0.07em;
    display: flex;
    align-items: center;
    gap: 9px;
    font-weight: 600;
    flex-shrink: 0;
  }
  .card-body {
    flex: 1;
    overflow-y: auto;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    word-break: break-word;
    font-family: var(--font-sans);
    line-height: 1.65;
    color: var(--tg-fg);
    font-size: 15.5px;
    min-height: 0;
  }
  .placeholder {
    color: var(--tg-fg-subtle);
    font-size: 13px;
    margin: 0;
    font-style: italic;
  }

  .source-card h4 {
    margin: 0 0 8px;
    font-size: 10.5px;
    color: var(--tg-fg-subtle);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    font-weight: 600;
    flex-shrink: 0;
  }
  .source-body {
    flex: 1;
    font-size: 13px;
    line-height: 1.55;
    color: var(--tg-fg);
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    word-break: break-word;
    overflow-y: auto;
    min-height: 0;
  }

  .side-col {
    display: grid;
    grid-template-rows: auto minmax(0, 1fr) auto;
    gap: 12px;
    min-height: 0;
  }

  .status-panel {
    background: var(--tg-bg-elevated);
    border: 1px solid var(--tg-border);
    border-radius: 16px;
    padding: 12px 14px 12px;
    backdrop-filter: blur(22px) saturate(1.4);
    -webkit-backdrop-filter: blur(22px) saturate(1.4);
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .status-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }
  .status-title {
    font-size: 10.5px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--tg-fg-subtle);
    font-weight: 600;
  }
  .status-kv {
    margin: 0;
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 3px 12px;
    font-size: 12.5px;
  }
  .status-kv dt {
    color: var(--tg-fg-subtle);
    font-weight: 500;
  }
  .status-kv dd {
    margin: 0;
    color: var(--tg-fg);
    font-variant-numeric: tabular-nums;
    overflow-wrap: anywhere;
    word-break: break-word;
    min-width: 0;
  }
  .status-kv dd.queued {
    color: var(--tg-accent);
    font-weight: 600;
  }
  .status-error {
    margin: 0;
    padding: 7px 9px;
    border-radius: 9px;
    background: color-mix(in srgb, var(--tg-danger) 10%, transparent);
    color: var(--tg-danger);
    font-size: 12px;
    line-height: 1.45;
    overflow-wrap: anywhere;
    word-break: break-word;
  }
  .status-actions {
    display: flex;
    justify-content: flex-end;
    gap: 6px;
    margin-top: 2px;
  }
  .memory-strip {
    border-top: 1px solid var(--tg-border);
    padding-top: 9px;
  }
  .memory-title {
    display: block;
    margin-bottom: 6px;
    color: var(--tg-fg-subtle);
    font-size: 10.5px;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  .memory-strip ul {
    display: flex;
    flex-direction: column;
    gap: 4px;
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .memory-strip li {
    color: var(--tg-fg-muted);
    font-size: 12px;
    line-height: 1.45;
    overflow-wrap: anywhere;
  }

  .chip {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 3px 9px;
    border-radius: 999px;
    background: var(--tg-bg-elevated);
    border: 1px solid var(--tg-border);
    color: var(--tg-fg);
    font-size: 11.5px;
    font-weight: 500;
  }
  .chip.status .dot-pulse {
    width: 5px;
    height: 5px;
  }
  .chip.status.running {
    background: color-mix(in srgb, var(--tg-primary) 12%, transparent);
    border-color: color-mix(in srgb, var(--tg-primary) 30%, var(--tg-border));
  }
  .chip.status.done {
    background: color-mix(in srgb, var(--tg-accent) 12%, transparent);
    border-color: color-mix(in srgb, var(--tg-accent) 30%, var(--tg-border));
  }
  .chip.status.cancelled {
    background: transparent;
    color: var(--tg-fg-subtle);
  }
  .chip.status.failed {
    background: color-mix(in srgb, var(--tg-danger) 12%, transparent);
    border-color: color-mix(in srgb, var(--tg-danger) 30%, var(--tg-border));
    color: var(--tg-danger);
  }

  .ghost-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 5px 10px;
    border-radius: 8px;
    border: 1px solid transparent;
    background: transparent;
    color: var(--tg-fg-muted);
    font: inherit;
    font-size: 12.5px;
    cursor: pointer;
    transition:
      background 160ms,
      border-color 160ms,
      color 160ms;
  }
  .ghost-btn:hover {
    background: var(--tg-bg-elevated);
    color: var(--tg-fg);
    border-color: var(--tg-border);
  }

  .side-discussion {
    min-height: 0;
    display: flex;
    flex-direction: column;
  }
  .side-hint {
    background: var(--tg-bg-elevated);
    border: 1px dashed var(--tg-border);
    border-radius: 16px;
    padding: 14px 16px;
    color: var(--tg-fg-subtle);
    font-size: 12.5px;
    line-height: 1.55;
    backdrop-filter: blur(22px) saturate(1.4);
    -webkit-backdrop-filter: blur(22px) saturate(1.4);
    min-height: 0;
    overflow-y: auto;
  }
  .side-hint p {
    margin: 0;
  }
  .side-dialog {
    margin-bottom: 8px;
  }

  .error {
    color: var(--tg-danger);
    margin: 0;
  }
  .caret {
    display: inline-block;
    width: 2px;
    height: 1.1em;
    background: var(--tg-primary);
    margin-left: 2px;
    vertical-align: text-bottom;
    animation: caret 1.05s ease-in-out infinite;
  }
  @keyframes caret {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.15;
    }
  }
  .dot-pulse {
    width: 6px;
    height: 6px;
    background: var(--tg-primary);
    border-radius: 50%;
    animation: pulse 1.2s ease-in-out infinite;
    display: inline-block;
  }
  @keyframes pulse {
    0%,
    100% {
      transform: scale(0.8);
      opacity: 0.6;
    }
    50% {
      transform: scale(1.4);
      opacity: 1;
    }
  }
</style>
