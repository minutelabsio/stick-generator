<script lang="ts">
  import { onMount } from "svelte"
  import StickGen from "./StickGen.svelte"

  let responses = []
  let response = ''
  let selected = null
  let items = []

  onMount(async () => {
    const res = await fetch('/api/responses')
    if (!res.ok){
      console.log('No responses fetched from server')
      return
    }
    responses = await res.json()
  })

  const select = (item) => () => {
    selected = item
  }

  const fetchDataset = async () => {
    const res = await fetch(`/api/responses/${response}`)
    if (!res.ok){
      console.log(`No entries fetched from for dataset ${response}`)
      return
    }
    items = await res.json()
  }

  const onSaved = async (stickProps) => {
    if (!response){ return }
    const data = selected
    selected.stickProps = stickProps
    const res = await fetch(`/api/responses/${response}`, {
      method: 'POST',
      headers: {
        "Content-Type": "text/json"
      },
      body: JSON.stringify([
        data
      ])
    })
    if (!res.ok){
      const msg = await res.text()
      throw new Error(msg)
    }
    selected = data
    items = items.concat([])
  }

</script>

<div class="flex flex-row">
  <div
    class="drawer-side flex"
  >
    <div class="menu p-4 overflow-y-auto w-80 bg-base-100 text-base-content">
      <!-- Upper Menu -->
      <ul>
        <li>
          <select bind:value={response} on:change={fetchDataset} class="select w-full max-w-xs flex items-center justify-start gap-2 font-bold text-sm text-base-content hover:text-base-100 bg-base-100 hover:bg-base-content ease-in-out duration-[250ms]">
            <option disabled value="">Select a Dataset</option>
            {#each responses as item}
            <option value={item}>{item}</option>
            {/each}
          </select>
        </li>
        {#each items as item}
          <li>
            <button
              on:click={select(item)} class:bg-cyan-900="{selected === item}"
              class="flex items-center justify-start gap-2 font-bold text-sm text-base-content hover:text-base-100 bg-base-100 hover:bg-base-content ease-in-out duration-[250ms]"
            >
            {item.stickProps ? "✅ " : ""}
            {item['Email Address']}
            </button>
          </li>
        {/each}
      </ul>
    </div>
  </div>
  <div class="drawer-content flex flex-col">
    <div class="px-4">
      {#if response && selected}
      <img class="py-4" src={`/api/likeness/${response}/${selected.Filename}`} width="620" alt="likeness image"/>
      <StickGen prefix={response} dataEntry={selected} onSaved={onSaved} />
      {/if}
    </div>
  </div>
</div>

<style>
  .drawer-side {
    max-height: 100vh;
    min-width: 340px;
    overflow-y: scroll;
  }
</style>