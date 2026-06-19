<script lang="ts">
  import Sidebar from '$lib/components/Sidebar.svelte';

  let { children } = $props();
</script>

<div class="shell">
  <Sidebar />
  <main class="main">
    {@render children?.()}
  </main>
</div>

<style>
  .shell {
    display: flex;
    height: 100dvh;
    background: var(--tg-bg);
  }
  .main {
    flex: 1;
    min-width: 0;
    overflow-y: auto;
    overflow-x: hidden;
  }
  @media (max-width: 720px) {
    .shell {
      flex-direction: column;
      height: auto;
      min-height: 100dvh;
    }
  }
</style>
