<script module lang="ts">
  export interface DiscussionTurn {
    id: string;
    agentId: string;
    agentLabel: string;
    role: 'translator' | 'reviewer';
    text: string;
    chunkIndex?: number;
    timestamp: number;
  }
</script>

<script lang="ts">
  import { fly, fade } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';

  interface Props {
    turns: DiscussionTurn[];
    title?: string;
    emptyHint?: string;
    streaming?: boolean;
  }

  let { turns, title, emptyHint, streaming = false }: Props = $props();

  let scrollEl: HTMLDivElement | undefined = $state();

  $effect(() => {
    turns.length;
    if (!scrollEl) return;
    queueMicrotask(() => {
      if (!scrollEl) return;
      scrollEl.scrollTo({ top: scrollEl.scrollHeight, behavior: 'smooth' });
    });
  });

  function roleClass(role: 'translator' | 'reviewer') {
    return role === 'reviewer' ? 'reviewer' : 'translator';
  }
</script>

<section class="panel" aria-label={title ?? 'Agent discussion'}>
  {#if title}
    <header class="head">
      <span class="title">{title}</span>
      {#if streaming}<span class="dot" aria-hidden="true"></span>{/if}
    </header>
  {/if}

  <div class="stream" bind:this={scrollEl}>
    {#if turns.length === 0}
      <div class="empty" in:fade={{ duration: 200 }}>
        <p>{emptyHint ?? 'Agents will start talking here once the translation begins.'}</p>
      </div>
    {:else}
      {#each turns as t (t.id)}
        <article
          class="bubble {roleClass(t.role)}"
          in:fly={{ y: 8, duration: 260, easing: cubicOut }}
        >
          <div class="meta">
            <span class="label">{t.agentLabel}</span>
            {#if t.chunkIndex !== undefined}
              <span class="chunk">· #{t.chunkIndex + 1}</span>
            {/if}
          </div>
          <p class="text">{t.text}</p>
        </article>
      {/each}
    {/if}
  </div>
</section>

<style>
  .panel {
    display: flex;
    flex-direction: column;
    min-height: 0;
    height: 100%;
    background: var(--tg-bg-elevated);
    border: 1px solid var(--tg-border);
    border-radius: 18px;
    overflow: hidden;
    backdrop-filter: blur(22px) saturate(1.4);
    -webkit-backdrop-filter: blur(22px) saturate(1.4);
  }

  .head {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 14px 18px;
    border-bottom: 1px solid var(--tg-border);
    flex-shrink: 0;
  }
  .title {
    font-size: 11.5px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--tg-fg-subtle);
    font-weight: 600;
  }
  .dot {
    width: 6px;
    height: 6px;
    background: var(--tg-primary);
    border-radius: 50%;
    animation: pulse 1.2s ease-in-out infinite;
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

  .stream {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 16px 14px 22px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    scroll-behavior: smooth;
  }

  .empty {
    margin: auto;
    padding: 24px 18px;
    color: var(--tg-fg-subtle);
    font-size: 13px;
    text-align: center;
    line-height: 1.55;
    font-style: italic;
  }

  .bubble {
    max-width: 86%;
    padding: 9px 13px 10px;
    border-radius: 16px;
    border: 1px solid var(--tg-border);
    background: var(--tg-bg);
    align-self: flex-start;
    box-shadow: 0 1px 0 color-mix(in srgb, var(--tg-fg) 3%, transparent);
  }
  .bubble.translator {
    border-color: color-mix(in srgb, var(--tg-primary) 30%, var(--tg-border));
    background: color-mix(in srgb, var(--tg-primary) 6%, var(--tg-bg));
    border-bottom-left-radius: 6px;
  }
  .bubble.reviewer {
    align-self: flex-end;
    border-color: color-mix(in srgb, var(--tg-accent) 30%, var(--tg-border));
    background: color-mix(in srgb, var(--tg-accent) 7%, var(--tg-bg));
    border-bottom-right-radius: 6px;
  }

  .meta {
    display: flex;
    align-items: baseline;
    gap: 6px;
    margin-bottom: 3px;
  }
  .label {
    font-size: 10.5px;
    font-weight: 600;
    color: var(--tg-fg-subtle);
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }
  .chunk {
    font-size: 10.5px;
    color: var(--tg-fg-subtle);
    opacity: 0.8;
  }

  .text {
    margin: 0;
    font-size: 13.5px;
    line-height: 1.5;
    color: var(--tg-fg);
    white-space: pre-wrap;
    word-wrap: break-word;
  }
</style>
