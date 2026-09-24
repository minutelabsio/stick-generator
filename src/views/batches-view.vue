<script setup lang="ts">
import Button from 'primevue/button'
import DatePicker from 'primevue/datepicker'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import Message from 'primevue/message'
import Textarea from 'primevue/textarea'
import Toolbar from 'primevue/toolbar'
import { useToast } from 'primevue/usetoast'
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import type { BatchSummary } from '@shared/api-types'
import { api } from '@/lib/api'
import { formatDate, isBatchOpen } from '@/lib/status'

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

const totalEntries = (batch: BatchSummary) => Object.values(batch.statusCounts).reduce((sum, count) => sum + count, 0)

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

    <div class="batch-list">
      <RouterLink
        v-for="batch in batches"
        :key="batch.id"
        :to="{ name: 'batch', params: { batchId: batch.id } }"
        class="card batch-card"
      >
        <div class="batch-title">
          <h2>{{ batch.name }}</h2>
          <span :class="isBatchOpen(batch) ? 'open' : 'closed'">
            {{ isBatchOpen(batch) ? 'Open' : 'Closed' }}
          </span>
        </div>
        <p class="muted">
          Closes {{ formatDate(batch.closesAt) }} · {{ totalEntries(batch) }} entries
        </p>
        <p class="counts">
          <span>{{ batch.statusCounts.new }} new</span>
          <span>{{ batch.statusCounts.in_progress }} in progress</span>
          <span>{{ batch.statusCounts.done }} done</span>
        </p>
      </RouterLink>
    </div>

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

.batch-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(18rem, 1fr));
  gap: 1rem;
}

.batch-card {
  color: inherit;
  text-decoration: none;
}

.batch-card:hover {
  border-color: #b9b9b2;
}

.batch-title {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
}

.open {
  color: #1b7f3b;
  font-weight: 600;
}

.closed {
  color: #8a8a84;
}

.counts {
  display: flex;
  gap: 1rem;
  margin: 0;
  font-size: 0.9rem;
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
