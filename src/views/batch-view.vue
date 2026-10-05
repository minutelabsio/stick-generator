<script setup lang="ts">
import Button from 'primevue/button'
import Column from 'primevue/column'
import DataTable from 'primevue/datatable'
import Message from 'primevue/message'
import Toolbar from 'primevue/toolbar'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import type { BatchDetail, EntrySummary } from '@shared/api-types'
import BatchIntakePanel from '@/components/batch-intake-panel.vue'
import StatusMark from '@/components/status-mark.vue'
import { api } from '@/lib/api'
import { formatDate } from '@/lib/status'
import { useChannelStore } from '@/stores/channels'

const props = defineProps<{ batchId: string }>()

// Often enough to watch a batch fill up, rare enough not to matter.
const REFRESH_INTERVAL_MS = 15 * 1000

const router = useRouter()
const channelStore = useChannelStore()

const batch = ref<BatchDetail | null>(null)
const loadError = ref<string | null>(null)

const channel = computed(() => (batch.value ? channelStore.byId(batch.value.channelId) : undefined))
const backLink = computed(() => (channel.value ? { name: 'batches', params: { channelSlug: channel.value.slug } } : { name: 'home' }))

async function openEntry({ data }: { data: EntrySummary }) {
  await router.push({ name: 'entry', params: { entryId: data.id } })
}

// Keeps the status and entry list live. A failed refresh is ignored: the page still
// shows the last good state, and the next refresh tries again.
async function refresh() {
  if (document.hidden) return
  batch.value = await api.getBatch(props.batchId).catch(() => batch.value)
}

let refreshTimer: ReturnType<typeof setInterval> | undefined

onMounted(async () => {
  try {
    const [loaded] = await Promise.all([api.getBatch(props.batchId), channelStore.load()])
    batch.value = loaded
    refreshTimer = setInterval(refresh, REFRESH_INTERVAL_MS)
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : String(error)
  }
})

onBeforeUnmount(() => clearInterval(refreshTimer))
</script>

<template>
  <main class="page">
    <Message
      v-if="loadError"
      severity="error"
    >
      {{ loadError }}
    </Message>

    <template v-if="batch">
      <RouterLink
        :to="backLink"
        class="back"
      >
        <i class="pi pi-angle-left" /> {{ channel ? `${channel.name} batches` : 'Batches' }}
      </RouterLink>
      <Toolbar class="page-header">
        <template #start>
          <h1>{{ batch.name }}</h1>
        </template>
        <template #end>
          <Button
            as="a"
            :href="`/api/batches/${batch.id}/export.csv`"
            download
            label="Download CSV"
            icon="pi pi-download"
            severity="secondary"
            class="download"
          />
        </template>
      </Toolbar>

      <BatchIntakePanel
        :batch="batch"
        @changed="updated => batch = updated"
      />

      <DataTable
        :value="batch.entries"
        row-hover
        class="entries"
        @row-click="openEntry"
      >
        <template #empty>
          No entries yet. Share the link above.
        </template>
        <Column header="">
          <template #body="{ data }">
            <img
              v-if="data.renderUrl"
              :src="data.renderUrl"
              class="render-thumb"
              alt=""
            >
          </template>
        </Column>
        <Column
          field="name"
          header="Name"
        />
        <Column
          field="email"
          header="Email"
        />
        <Column header="Status">
          <template #body="{ data }">
            <StatusMark :status="data.status" />
          </template>
        </Column>
        <Column header="Submitted">
          <template #body="{ data }">
            {{ formatDate(data.submittedAt) }}
          </template>
        </Column>
      </DataTable>
    </template>
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

.download {
  text-decoration: none;
}

.entries :deep(tr) {
  cursor: pointer;
}

.render-thumb {
  height: 3rem;
}
</style>
