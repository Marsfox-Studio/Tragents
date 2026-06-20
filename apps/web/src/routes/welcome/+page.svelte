<script lang="ts">
  import { onMount } from 'svelte';
  import { fly, fade } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import type { ProviderKind, ThemeMode } from '@tragents/shared';
  import { goto } from '$app/navigation';
  import { base } from '$app/paths';
  import Logo from '$lib/components/Logo.svelte';
  import Brand from '$lib/components/Brand.svelte';
  import Button from '$lib/components/Button.svelte';
  import ModeCard from '$lib/components/ModeCard.svelte';
  import ProviderForm from '$lib/components/ProviderForm.svelte';
  import { settings, providers } from '$lib/stores';
  import { applyTheme } from '@tragents/ui';
  import { i18n, UI_LOCALES } from '$lib/i18n.svelte';

  // Already onboarded? Bounce back to home — welcome is a one-shot.
  onMount(() => {
    if (settings.current.onboardingCompleted) {
      goto(`${base}/`, { replaceState: true });
    }
  });

  let step = $state(0);
  const total = 5;

  let mode = $state<ThemeMode>(settings.current.theme.mode);
  const modes: ThemeMode[] = ['system', 'light', 'dark'];

  $effect(() => {
    applyTheme('mono', mode);
  });

  async function next() {
    if (step === 0) {
      await settings.setUILanguage(i18n.locale);
    }
    if (step === 2) {
      await settings.setTheme('mono', mode);
    }
    if (step < total - 1) step++;
    else await finish();
  }

  function prev() {
    if (step > 0) step--;
  }

  async function addProvider(data: {
    kind: ProviderKind;
    name: string;
    baseURL?: string;
    apiKey: string;
    defaultModel?: string;
  }) {
    await providers.add(data);
    step = total - 1;
  }

  async function skipProvider() {
    await finish();
  }

  async function finish() {
    await settings.setUILanguage(i18n.locale);
    await settings.setTheme('mono', mode);
    await settings.completeOnboarding();
    goto(`${base}/`);
  }
</script>

<svelte:head>
  <title>{i18n.t('pageTitle.welcome')}</title>
</svelte:head>

<main class="welcome">
  <div class="container">
    <header class="head" in:fade={{ duration: 320 }}>
      <Logo size={44} />
      <div class="brand"><Brand size="md" showDot={false} /></div>
      <div class="dots" aria-label="Onboarding progress">
        {#each Array(total) as _, i (i)}
          <span class="dot" class:active={i === step} class:done={i < step}></span>
        {/each}
      </div>
    </header>

    {#key step}
      <div class="step" in:fly={{ y: 14, duration: 320, easing: cubicOut }}>
        {#if step === 0}
          <h1>{i18n.t('welcome.lang.title')}</h1>
          <p class="lead">{i18n.t('welcome.lang.lead')}</p>
          <div class="lang-grid">
            {#each UI_LOCALES as loc (loc.code)}
              <button
                type="button"
                class="lang-btn"
                class:selected={i18n.locale === loc.code}
                onclick={() => i18n.setLocale(loc.code)}
              >
                <span class="lang-native">{loc.nativeLabel}</span>
                {#if loc.label !== loc.nativeLabel}
                  <span class="lang-en">{loc.label}</span>
                {/if}
              </button>
            {/each}
          </div>
          <div class="actions">
            <Button onclick={next}>{i18n.t('welcome.lang.continue')}</Button>
          </div>
        {:else if step === 1}
          <h1>{i18n.t('welcome.intro.title')}</h1>
          <p class="lead">{i18n.t('welcome.intro.lead')}</p>
          <div class="actions split">
            <Button variant="ghost" onclick={prev}>{i18n.t('common.back')}</Button>
            <Button onclick={next} size="lg">{i18n.t('welcome.intro.cta')}</Button>
          </div>
        {:else if step === 2}
          <h1>{i18n.t('welcome.theme.title')}</h1>
          <p class="lead">{i18n.t('welcome.theme.lead')}</p>

          <h2 class="sub-h">{i18n.t('welcome.theme.theme')}</h2>
          <div class="mode-grid">
            {#each modes as m (m)}
              <ModeCard mode={m} selected={mode === m} onclick={() => (mode = m)} />
            {/each}
          </div>

          <div class="actions split">
            <Button variant="ghost" onclick={prev}>{i18n.t('common.back')}</Button>
            <Button onclick={next}>{i18n.t('welcome.theme.continue')}</Button>
          </div>
        {:else if step === 3}
          <h1>{i18n.t('welcome.provider.title')}</h1>
          <p class="lead">{i18n.t('welcome.provider.lead')}</p>
          <div class="form-wrap">
            <ProviderForm onSave={addProvider} submitLabel={i18n.t('welcome.provider.save')} />
          </div>
          <div class="skip-row">
            <button class="skip" onclick={skipProvider}>{i18n.t('welcome.provider.skip')}</button>
          </div>
        {:else}
          <div class="finish">
            <Logo size={96} animate />
            <h1>{i18n.t('welcome.done.title')}</h1>
            <p class="lead">{i18n.t('welcome.done.lead')}</p>
            <Button onclick={finish} size="lg">{i18n.t('welcome.done.enter')}</Button>
          </div>
        {/if}
      </div>
    {/key}
  </div>
</main>

<style>
  .welcome {
    min-height: 100dvh;
    display: grid;
    place-items: center;
    padding: 32px 24px;
    background: var(--tg-bg);
    background-image: radial-gradient(
      circle at 50% 0%,
      color-mix(in srgb, var(--tg-accent) 8%, transparent),
      transparent 60%
    );
  }
  .container {
    width: 100%;
    max-width: 640px;
    display: flex;
    flex-direction: column;
    gap: 28px;
  }
  .head {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
  }
  .brand {
    flex: 1;
    min-width: 0;
  }
  .dots {
    display: flex;
    gap: 6px;
  }
  .dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--tg-border-strong);
    transition:
      background 220ms cubic-bezier(0.4, 0, 0.2, 1),
      width 220ms cubic-bezier(0.4, 0, 0.2, 1);
  }
  .dot.active {
    background: var(--tg-primary);
    width: 22px;
    border-radius: 999px;
  }
  .dot.done {
    background: color-mix(in srgb, var(--tg-primary) 55%, transparent);
  }

  .step {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  h1 {
    margin: 0;
    font-size: 30px;
    font-weight: 500;
    letter-spacing: -0.025em;
    line-height: 1.15;
  }
  .sub-h {
    margin: 14px 0 2px;
    font-size: 11.5px;
    color: var(--tg-fg-subtle);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    font-weight: 600;
  }
  .lead {
    margin: 0 0 12px;
    color: var(--tg-fg-muted);
    font-size: 15px;
    line-height: 1.6;
  }
  .actions {
    display: flex;
    margin-top: 12px;
  }
  .actions.split {
    justify-content: space-between;
    align-items: center;
  }

  .lang-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 10px;
    margin-top: 6px;
  }
  .lang-btn {
    display: flex;
    flex-direction: column;
    gap: 4px;
    align-items: flex-start;
    padding: 14px 16px;
    border-radius: 14px;
    border: 1px solid var(--tg-border);
    background: var(--tg-bg-elevated);
    cursor: pointer;
    text-align: left;
    color: var(--tg-fg);
    font-family: inherit;
    transition:
      border-color 200ms cubic-bezier(0.4, 0, 0.2, 1),
      transform 200ms cubic-bezier(0.4, 0, 0.2, 1),
      box-shadow 240ms cubic-bezier(0.4, 0, 0.2, 1);
  }
  .lang-btn:hover {
    border-color: var(--tg-border-strong);
    transform: translateY(-1px);
  }
  .lang-btn.selected {
    border-color: var(--tg-primary);
    box-shadow: 0 0 0 3px var(--tg-ring);
  }
  .lang-native {
    font-size: 16px;
    font-weight: 500;
  }
  .lang-en {
    font-size: 12px;
    color: var(--tg-fg-subtle);
  }

  .mode-grid {
    display: grid;
    gap: 8px;
  }

  .form-wrap {
    background: var(--tg-bg-elevated);
    border: 1px solid var(--tg-border);
    border-radius: 18px;
    padding: 22px;
  }

  .skip-row {
    text-align: center;
    margin-top: 6px;
  }
  .skip {
    background: transparent;
    border: none;
    color: var(--tg-fg-muted);
    font-size: 13px;
    font-family: inherit;
    cursor: pointer;
    padding: 8px 12px;
    border-radius: 999px;
    transition:
      color 160ms,
      background 160ms;
  }
  .skip:hover {
    color: var(--tg-fg);
    background: var(--tg-bg-elevated);
  }

  .finish {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 14px;
    text-align: center;
    padding: 40px 0;
  }
</style>
