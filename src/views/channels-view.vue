<script setup lang="ts">
import Button from 'primevue/button'
import Column from 'primevue/column'
import DataTable from 'primevue/datatable'
import Dialog from 'primevue/dialog'
import InputGroup from 'primevue/inputgroup'
import InputGroupAddon from 'primevue/inputgroupaddon'
import InputText from 'primevue/inputtext'
import Message from 'primevue/message'
import Toolbar from 'primevue/toolbar'
import { computed, onMounted, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { CreateChannelRequest } from '@shared/api-types'
import { slugify } from '@shared/slug'
import { api } from '@/lib/api'
import { useChannelStore } from '@/stores/channels'

const router = useRouter()
const channelStore = useChannelStore()

const loadError = ref<string | null>(null)
const isCreating = ref(false)
const isSaving = ref(false)
const formError = ref<string | null>(null)
const name = ref('')
// Follows the name until edited by hand, so most channels need only a name.
const typedSlug = ref<string | null>(null)
const slug = computed({
  get: () => typedSlug.value ?? slugify(name.value),
  set: (value: string) => {
    typedSlug.value = value
  },
})

function startCreating() {
  name.value = ''
  typedSlug.value = null
  formError.value = null
  isCreating.value = true
}

async function createChannel() {
  // Checked here with the server's own schema, so the message says what to fix.
  const parsed = CreateChannelRequest.safeParse({ name: name.value, slug: slug.value })
  if (!parsed.success) {
    formError.value = parsed.error.issues[0]?.message ?? 'Please check the form and try again.'
    return
  }
  isSaving.value = true
  try {
    const channel = await api.createChannel(parsed.data)
    channelStore.added(channel)
    isCreating.value = false
    await router.push({ name: 'batches', params: { channelSlug: channel.slug } })
  } catch (error) {
    formError.value = error instanceof Error ? error.message : String(error)
  } finally {
    isSaving.value = false
  }
}

onMounted(async () => {
  try {
    await channelStore.load()
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : String(error)
  }
})
</script>

<template>
  <main class="page">
    <RouterLink
      v-if="channelStore.channels.length"
      :to="{ name: 'home' }"
      class="back"
    >
      <i class="pi pi-angle-left" /> Batches
    </RouterLink>
    <Toolbar class="page-header">
      <template #start>
        <h1>Channels</h1>
      </template>
      <template #end>
        <Button
          label="New channel"
          icon="pi pi-plus"
          @click="startCreating"
        />
      </template>
    </Toolbar>

    <Message
      v-if="loadError"
      severity="error"
    >
      {{ loadError }}
    </Message>

    <DataTable
      :value="channelStore.channels"
      class="ledger"
    >
      <template #empty>
        No channels yet. Create one to start taking batches of subscribers.
      </template>
      <Column header="Channel">
        <template #body="{ data }">
          <RouterLink
            :to="{ name: 'batches', params: { channelSlug: data.slug } }"
            class="channel-name"
          >
            {{ data.name }}
          </RouterLink>
        </template>
      </Column>
      <Column header="Address">
        <template #body="{ data }">
          <code class="muted">/c/{{ data.slug }}</code>
        </template>
      </Column>
    </DataTable>

    <Dialog
      v-model:visible="isCreating"
      modal
      header="New channel"
      :style="{ width: '32rem' }"
    >
      <form
        class="form"
        @submit.prevent="createChannel"
      >
        <label>
          Name
          <InputText
            v-model="name"
            required
            placeholder="e.g. Science Shorts"
          />
        </label>
        <label>
          Address
          <InputGroup>
            <InputGroupAddon>/c/</InputGroupAddon>
            <InputText v-model="slug" />
          </InputGroup>
        </label>
        <p class="muted hint">
          New channels draw figures the same way as the others. Palettes and assets are
          added per channel.
        </p>
        <Message
          v-if="formError"
          severity="error"
        >
          {{ formError }}
        </Message>
        <Button
          type="submit"
          label="Create channel"
          :loading="isSaving"
        />
      </form>
    </Dialog>
  </main>
</template>

<style scoped>
.back {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  margin-bottom: 0.25rem;
  font-size: var(--text-md);
  text-decoration: none;
}

.page-header {
  margin-bottom: 1.5rem;
}

.channel-name {
  color: inherit;
  font-weight: 600;
  text-decoration: none;
}

.form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.form label {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  font-weight: 600;
}

.hint {
  margin: 0;
  font-size: var(--text-md);
}
</style>
