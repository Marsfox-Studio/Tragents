<script lang="ts">
  import '../app.css';
  import { onMount } from 'svelte';
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import { base } from '$app/paths';
  import { applyTheme, watchSystemMode } from '@tragents/ui';
  import {
    settings,
    providers,
    projects,
    glossaries,
    checkpoints,
    sessions,
    tasks,
    activities,
    memories,
  } from '$lib/stores';
  import { i18n } from '$lib/i18n.svelte';
  import Logo from '$lib/components/Logo.svelte';

  let { children } = $props();
  let ready = $state(false);

  onMount(() => {
    let unwatch: (() => void) | undefined;

    (async () => {
      try {
        await Promise.all([
          settings.load(),
          providers.load(),
          projects.load(),
          glossaries.load(),
          checkpoints.load(),
          sessions.load(),
          tasks.load(),
          activities.load(),
          memories.load(),
        ]);
        // Any task left in 'running' state died with the previous page load.
        tasks.reconcileAfterReload();
      } catch (err) {
        console.error('Failed to load app state', err);
      }

      const { palette, mode } = settings.current.theme;
      applyTheme(palette, mode);

      if (settings.current.onboardingCompleted && settings.current.uiLanguage) {
        i18n.setLocale(settings.current.uiLanguage);
      }

      unwatch = watchSystemMode(() => {
        if (settings.current.theme.mode === 'system') {
          applyTheme(settings.current.theme.palette, 'system');
        }
      });

      ready = true;

      const routePath = page.url.pathname.slice(base.length) || '/';
      if (!settings.current.onboardingCompleted && routePath !== '/welcome') {
        goto(`${base}/welcome`, { replaceState: true });
      }
    })();

    return () => unwatch?.();
  });

  $effect(() => {
    if (!ready) return;
    const { palette, mode } = settings.current.theme;
    applyTheme(palette, mode);
  });

  $effect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = i18n.locale;
    }
  });
</script>

{#if ready}
  {@render children?.()}
{:else}
  <div class="boot" aria-label="Loading">
    <Logo size={64} />
  </div>
{/if}

<style>
  .boot {
    min-height: 100dvh;
    display: grid;
    place-items: center;
    background: var(--tg-bg);
  }
</style>
