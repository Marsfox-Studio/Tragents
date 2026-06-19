<script lang="ts">
  interface Props {
    size?: number;
    /** Accepted for backward compat; no longer affects rendering. */
    animate?: boolean;
    class?: string;
  }
  let { size = 56, class: klass = '' }: Props = $props();
</script>

<img
  src="/logo.png"
  width={size}
  height={size}
  alt="Tragents"
  class={klass}
  draggable="false"
/>

<style>
  img {
    display: block;
    user-select: none;
    -webkit-user-drag: none;
  }
</style>
