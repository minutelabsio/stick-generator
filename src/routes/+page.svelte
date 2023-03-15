<script lang="ts">
  import { sessionStore } from '$src/stores'
  import Public from '$components/home/Public.svelte'
  import Editor from '$components/stick-generator/Editor.svelte'
</script>

<Editor/>

<!-- {#if $sessionStore?.session}

{:else}
  <Public />
{/if} -->
