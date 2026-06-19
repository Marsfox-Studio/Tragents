<script lang="ts">
  import { LANGUAGES, type LanguageCode } from '@tragents/shared';
  import Select from './Select.svelte';

  interface Props {
    value: LanguageCode;
    excludeAuto?: boolean;
    placeholder?: string;
  }

  let { value = $bindable(), excludeAuto = false, placeholder }: Props = $props();

  const options = $derived(
    LANGUAGES.filter((l) => (excludeAuto ? l.code !== 'auto' : true)).map((l) => ({
      value: l.code,
      label: l.nativeName === l.name ? l.name : `${l.name} (${l.nativeName})`,
    })),
  );
</script>

<Select bind:value {options} {placeholder} />
