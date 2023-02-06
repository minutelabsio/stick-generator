<script lang="ts">
  import { sessionStore } from '$src/stores'
  import Public from '$components/home/Public.svelte'
  import StickGen from '$components/stick-generator/StickGen.svelte'
</script>

{#if $sessionStore?.session}
  <StickGen />
{:else}
  <Public />
{/if}
