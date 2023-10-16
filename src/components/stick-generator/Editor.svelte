<script lang="ts">
  import { onMount } from "svelte"
  import StickGen from "./StickGen.svelte"
  import _cloneDeep from "lodash/cloneDeep"
  import { v4 as uuidv4 } from 'uuid'

  let responses = []
  let response = ''
  let selected = null
  let items = []
  let busy = false
  let newGroupModal
  let newGroupName = ''
  let newStickModal
  let newStickFields = {}

  const refreshResponses = async () => {
    const res = await fetch('/api/responses')
    if (!res.ok){
      console.log('No responses fetched from server')
      return
    }
    responses = await res.json()
  }

  onMount(async () => {
    await refreshResponses()
  })

  const select = (item) => () => {
    if (busy){ return }
    selected = item
  }

  const onSelectGroup = () => {
    if (!response){ return }
    if (response === '__new__'){
      response = ''
      newGroupModal.checked = true
    } else {
      fetchDataset()
    }
  }

  const createGroup = async () => {
    const name = newGroupName
    newGroupName = ''
    newGroupModal.checked = false
    const res = await fetch(`/api/responses/${name}`, {
      method: 'POST',
      headers: {
        "Content-Type": "text/json"
      },
      body: JSON.stringify([])
    })
    if (!res.ok){
      const msg = await res.text()
      throw new Error(msg)
    } else {
      await refreshResponses()
      response = name
    }
  }

  const fetchDataset = async () => {
    const res = await fetch(`/api/responses/${response}`)
    if (!res.ok){
      console.log(`No entries fetched from for dataset ${response}`)
      return
    }
    items = await res.json()
  }

  const onSaved = async (dataEntry, stickProps) => {
    if (!response){ return }
    const data = _cloneDeep(dataEntry)
    data.stickProps = stickProps
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
    const index = items.findIndex(item => item.id === data.id)
    if (index === -1){
      throw new Error('Could not find item in list. Tell jasper.')
    }
    items[index] = data
    items = items.concat([])
    selected = data
  }


  const createStick = () => {
    const fields = _cloneDeep(newStickFields)
    newStickFields = {}
    newStickModal.checked = false
    fields.id = uuidv4()
    items = items.concat([fields])
    onSaved(fields, null)
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
          <select bind:value={response} on:change={onSelectGroup} class="select w-full max-w-xs flex items-center justify-start gap-2 font-bold text-sm text-base-content hover:text-base-100 bg-base-100 hover:bg-base-content ease-in-out duration-[250ms]">
            <option disabled value="">Select a Group</option>
            {#each responses as item}
            <option value={item}>{item}</option>
            {/each}
            <option value="__new__">[New Group]</option>
          </select>
        </li>
        {#each items as item}
          <li>
            <button
              on:click={select(item)} class:bg-cyan-900="{selected === item}"
              class="flex items-center justify-start gap-2 font-bold text-sm text-base-content hover:text-base-100 bg-base-100 hover:bg-base-content ease-in-out duration-[250ms]"
            >
            {item.done ? "✅ " : item.stickProps ? "🖌️ " :""}
            {item['Email Address']}
            </button>
          </li>
        {/each}
        {#if response}
        <li>
          <label for="addStickModal" class="btn btn-secondary">Add Stick</label>
        </li>
        {/if}
      </ul>
    </div>
  </div>
  <div class="drawer-content flex flex-col">
    <div class="px-4">
      {#if response && selected}
      <div class="grid grid-cols-3 gap-4">
        <img class="py-4" src={`/api/likeness/${response}/${selected.Filename}`} width="620" alt="likeness image"/>
        <table class="table-auto">
          <tbody>
            {#each Object.entries(selected) as [key, value]}
              <tr>
                <td class="px-4 py-1">{key}</td>
                {#if key.includes('Hair') || key.includes('hobby') || key.includes('Name')}
                <td class="px-4 py-1"><strong>{value}</strong></td>
                {:else}
                <td class="px-4 py-1">{value}</td>
                {/if}
              </tr>
            {/each}
          </tbody>
        </table>
        <label class="done-label cursor-pointer label">
          <span class="label-text">done?</span>
          <input type="checkbox" bind:checked={selected.done} class="checkbox checkbox-success" />
        </label>
      </div>
      <StickGen bind:busy={busy} prefix={response} dataEntry={selected} onSaved={onSaved} />
      {/if}
    </div>
  </div>
</div>

<input bind:this={newGroupModal} type="checkbox" id="newGroupModal" class="modal-toggle" />
<div class="modal">
  <form class="modal-box" on:submit={createGroup}>
    <input required type="text" placeholder="New Group Name" bind:value={newGroupName} class="input input-bordered" />
    <div class="modal-action">
      <label for="newGroupModal" class="btn">Cancel</label>
      <button type="submit" class="btn btn-secondary">Create</button>
    </div>
  </form>
</div>

<input bind:this={newStickModal} type="checkbox" id="addStickModal" class="modal-toggle" />
<div class="modal">
  <form class="modal-box" on:submit={createStick}>
    <input type="text" required placeholder="Name" bind:value={newStickFields['Name']} class="input input-bordered" />
    <input type="email" required placeholder="Email" bind:value={newStickFields['Email Address']} class="input input-bordered" />
    <div class="modal-action">
      <label for="addStickModal" class="btn">Cancel</label>
      <button type="submit" class="btn btn-secondary">Add</button>
    </div>
  </form>
</div>

<style>
  .done-label {
    width: 5em;
  }
  .drawer-side {
    max-height: 100vh;
    min-width: 340px;
    overflow-y: scroll;
  }
</style>