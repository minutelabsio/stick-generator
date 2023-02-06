<script lang="ts">
  import { sessionStore } from '$src/stores'
  import { appName } from '$lib/app-info'
  import Alert from '$components/icons/Alert.svelte'
  import Connect from '$components/icons/Connect.svelte'
</script>

<div
  class="min-h-[calc(100vh-96px)] flex flex-col items-start justify-center max-w-[700px] m-auto gap-6 pb-5 text-sm"
>
  <h1 class="text-xl">Welcome to the {appName}</h1>

  <div class="max-w-[590px]">
    <p class="mb-5">
      To be able to upload assets you need to connect this device. You will
      only be able to see assets you upload on a browser that is connected
      with the same account.
    </p>

    {#if $sessionStore.error === 'Unsupported Browser'}
      <div class="p-4 rounded-lg bg-base-content text-neutral-50">
        <h3 class="flex items-center gap-2 text-base">
          <span class="-translate-y-[2px]"><Alert /></span>
          Unsupported device
        </h3>
        <p>
          It appears this device isn’t supported. Webnative requires IndexedDB
          in order to function. This browser doesn’t appear to implement this
          API. Are you in a Firefox private window?
        </p>
      </div>
    {:else}
      <div class="flex flex-col items-start gap-4">
        <a class="btn btn-primary !btn-lg !h-10 gap-2" href="/register">
          <Connect /> Connect this device
        </a>
        <a class="btn btn-outline" href="/recover">
          Recover an existing account
        </a>
      </div>
    {/if}
  </div>
</div>
