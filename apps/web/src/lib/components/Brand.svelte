<script lang="ts">
  interface Props {
    size?: 'sm' | 'md' | 'lg' | 'xl';
    showDot?: boolean;
  }
  let { size = 'md', showDot = true }: Props = $props();
</script>

<span class="brand brand-{size}">
  {#if showDot}<span class="dot" aria-hidden="true"></span>{/if}
  <span class="word">Tragents</span>
</span>

<style>
  .brand {
    font-family: var(--font-display);
    font-weight: 500;
    letter-spacing: -0.02em;
    color: var(--tg-fg);
    display: inline-flex;
    align-items: center;
    gap: 0.55em;
    line-height: 1;
  }
  .word {
    font-feature-settings: 'ss01' on;
  }
  .brand-sm {
    font-size: 13px;
  }
  .brand-md {
    font-size: 17px;
  }
  .brand-lg {
    font-size: 24px;
  }
  .brand-xl {
    font-size: 36px;
    font-weight: 450;
  }
  .dot {
    display: inline-block;
    width: 0.55em;
    height: 0.55em;
    border-radius: 50%;
    background: var(--tg-primary);
    opacity: 0.9;
  }
</style>
