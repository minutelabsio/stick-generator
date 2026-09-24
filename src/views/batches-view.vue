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
import { onMounted, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import type { BatchSummary } from '@shared/api-types'
import { api } from '@/lib/api'
import { describeCounts, formatDate, isBatchOpen, progressSegments, totalEntries } from '@/lib/status'

const DEFAULT_WINDOW_DAYS = 14
const MILLISECONDS_PER_DAY = 1000 * 60 * 60 * 24

const router = useRouter()
const toast = useToast()

const batches = ref<BatchSummary[]>([])
const loadError = ref<string | null>(null)
const isCreating = ref(false)
const newBatch = ref(emptyNewBatch())

function emptyNewBatch() {
  return {
    name: '',
    closesAt: new Date(Date.now() + DEFAULT_WINDOW_DAYS * MILLISECONDS_PER_DAY),
    questions: 'Describe your hair\nA hobby or favourite thing',
  }
}

async function loadBatches() {
  try {
    batches.value = await api.listBatches()
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : String(error)
  }
}

async function createBatch() {
  try {
    const { id } = await api.createBatch({
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

onMounted(loadBatches)
</script>

<template>
  <main class="page">
    <Toolbar class="page-header">
      <template #start>
        <h1>Batches</h1>
      </template>
      <template #end>
        <Button
          label="New batch"
          icon="pi pi-plus"
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
      header="New batch"
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
