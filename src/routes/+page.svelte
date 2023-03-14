<script lang="ts">
  import { sessionStore } from '$src/stores'
  import Public from '$components/home/Public.svelte'
  import StickGen from '$components/stick-generator/StickGen.svelte'
</script>

<StickGen />

<!-- {#if $sessionStore?.session}

{:else}
  <Public />
{/if} -->
