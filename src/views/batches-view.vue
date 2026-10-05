<script setup lang="ts">
import Button from 'primevue/button'
import Column from 'primevue/column'
import DataTable from 'primevue/datatable'
import DatePicker from 'primevue/datepicker'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import MeterGroup from 'primevue/metergroup'
import Message from 'primevue/message'
import Textarea from 'primevue/textarea'
import Toolbar from 'primevue/toolbar'
import { useToast } from 'primevue/usetoast'
import { computed, ref, watch } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import type { BatchSummary } from '@shared/api-types'
import ChannelSwitcher from '@/components/channel-switcher.vue'
import { api } from '@/lib/api'
import { rememberChannelId } from '@/lib/last-channel'
import { describeCounts, formatDate, isBatchOpen, progressSegments, totalEntries } from '@/lib/status'
import { useChannelStore } from '@/stores/channels'

const DEFAULT_WINDOW_DAYS = 14
const MILLISECONDS_PER_DAY = 1000 * 60 * 60 * 24

const props = defineProps<{ channelSlug: string }>()

const router = useRouter()
const toast = useToast()
const channelStore = useChannelStore()

const batches = ref<BatchSummary[]>([])
const loadError = ref<string | null>(null)
const isCreating = ref(false)
const newBatch = ref(emptyNewBatch())

const channel = computed(() => channelStore.bySlug(props.channelSlug))

function emptyNewBatch() {
  return {
    name: '',
    closesAt: new Date(Date.now() + DEFAULT_WINDOW_DAYS * MILLISECONDS_PER_DAY),
    questions: 'Describe your hair\nA hobby or favourite thing',
  }
}

async function loadBatches() {
  batches.value = []
  loadError.value = null
  try {
    await channelStore.load()
    if (!channel.value) {
      loadError.value = `There is no channel called "${props.channelSlug}". Pick one from the channel menu.`
      return
    }
    rememberChannelId(channel.value.id)
    batches.value = await api.listBatches(channel.value.id)
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : String(error)
  }
}

async function createBatch() {
  if (!channel.value) return
  try {
    const { id } = await api.createBatch(channel.value.id, {
      name: newBatch.value.name,
      closesAt: newBatch.value.closesAt.toISOString(),
      questionLabels: newBatch.value.questions.split('\n').map(line => line.trim()).filter(Boolean),
    })
    isCreating.value = false
    newBatch.value = emptyNewBatch()
    await router.push({ name: 'batch', params: { batchId: id } })
  } catch (error) {
    toast.add({ severity: 'error', summary: 'Could not create batch', detail: String(error), life: 5000 })
  }
}

const openBatch = ({ data }: { data: BatchSummary }) => router.push({ name: 'batch', params: { batchId: data.id } })

// Switching channels reuses this view, so reload whenever the channel changes.
watch(() => props.channelSlug, loadBatches, { immediate: true })
</script>

<template>
  <main class="page">
    <Toolbar class="page-header">
      <template #start>
        <div class="title">
          <ChannelSwitcher :channel-slug="channelSlug" />
          <h1>Batches</h1>
        </div>
      </template>
      <template #end>
        <RouterLink
          :to="{ name: 'channels' }"
          class="manage-channels"
        >
          Manage channels
        </RouterLink>
        <Button
          label="New batch"
          icon="pi pi-plus"
          :disabled="!channel"
          @click="isCreating = true"
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
      :value="batches"
      row-hover
      class="ledger"
      @row-click="openBatch"
    >
      <template #empty>
        No batches yet. Create one to get a join link to share with followers.
      </template>
      <Column header="Batch">
        <template #body="{ data }">
          <RouterLink
            :to="{ name: 'batch', params: { batchId: data.id } }"
            class="batch-name"
          >
            {{ data.name }}
          </RouterLink>
        </template>
      </Column>
      <Column
        header="Progress"
        style="width: 40%"
      >
        <template #body="{ data }">
          <MeterGroup
            :value="progressSegments(data.statusCounts)"
            :max="Math.max(1, totalEntries(data.statusCounts))"
          >
            <template #label>
              <span class="muted counts">{{ describeCounts(data.statusCounts) || 'No entries yet' }}</span>
            </template>
          </MeterGroup>
        </template>
      </Column>
      <Column header="Entries">
        <template #body="{ data }">
          {{ totalEntries(data.statusCounts) }}
        </template>
      </Column>
      <Column header="Intake">
        <template #body="{ data }">
          <span :class="{ muted: !isBatchOpen(data) }">{{ isBatchOpen(data) ? 'Open' : 'Closed' }}</span>
        </template>
      </Column>
      <Column header="Closes">
        <template #body="{ data }">
          {{ formatDate(data.closesAt) }}
        </template>
      </Column>
    </DataTable>

    <Dialog
      v-model:visible="isCreating"
      modal
      :header="`New batch in ${channel?.name}`"
      :style="{ width: '32rem' }"
    >
      <form
        class="form"
        @submit.prevent="createBatch"
      >
        <label>
          Name
          <InputText
            v-model="newBatch.name"
            required
            placeholder="e.g. Autumn 2026 supporters"
          />
        </label>
        <label>
          Closes on
          <DatePicker
            v-model="newBatch.closesAt"
            show-time
            hour-format="24"
          />
        </label>
        <label>
          Questions (one per line)
          <Textarea
            v-model="newBatch.questions"
            rows="4"
          />
        </label>
        <Button
          type="submit"
          label="Create batch"
        />
      </form>
    </Dialog>
  </main>
</template>

<style scoped>
.page-header {
  margin-bottom: 1.5rem;
}

.title {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.manage-channels {
  margin-right: 1rem;
  font-size: var(--text-md);
}

.ledger :deep(tr) {
  cursor: pointer;
}

.batch-name {
  color: inherit;
  font-weight: 600;
  text-decoration: none;
}

.counts {
  font-size: var(--text-md);
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
</style>
