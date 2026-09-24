<script setup lang="ts">
import Button from 'primevue/button'
import Column from 'primevue/column'
import DataTable from 'primevue/datatable'
import Message from 'primevue/message'
import Toolbar from 'primevue/toolbar'
import { useToast } from 'primevue/usetoast'
import { computed, onMounted, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import type { BatchDetail, EntrySummary } from '@shared/api-types'
import StatusMark from '@/components/status-mark.vue'
import { api } from '@/lib/api'
import { formatDate, isBatchOpen } from '@/lib/status'

const props = defineProps<{ batchId: string }>()

const router = useRouter()
const toast = useToast()

const batch = ref<BatchDetail | null>(null)
const loadError = ref<string | null>(null)

const joinLink = computed(() => (batch.value?.joinCode ? `${location.origin}/join#${batch.value.joinCode}` : null))

async function copyJoinLink() {
  if (!joinLink.value) return
  await navigator.clipboard.writeText(joinLink.value)
  toast.add({ severity: 'success', summary: 'Link copied', life: 2000 })
}

async function openEntry({ data }: { data: EntrySummary }) {
  await router.push({ name: 'entry', params: { entryId: data.id } })
}

onMounted(async () => {
  try {
    batch.value = await api.getBatch(props.batchId)
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : String(error)
  }
})
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
        :to="{ name: 'batches' }"
        class="back"
      >
        <i class="pi pi-angle-left" /> Batches
      </RouterLink>
      <Toolbar class="page-header">
        <template #start>
          <h1>{{ batch.name }}</h1>
        </template>
      </Toolbar>

      <section class="intake card">
        <p>
          <strong>{{ isBatchOpen(batch) ? 'Intake open' : 'Intake closed' }}</strong>
          <span class="muted">{{ isBatchOpen(batch) ? 'until' : 'since' }} {{ formatDate(batch.closesAt) }}</span>
        </p>
        <div
          v-if="joinLink"
          class="join-link"
        >
          <code>{{ joinLink }}</code>
          <Button
            icon="pi pi-copy"
            label="Copy link"
            size="small"
            severity="secondary"
            @click="copyJoinLink"
          />
          <a
            :href="joinLink"
            target="_blank"
          >Open join page</a>
        </div>
      </section>

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

.intake {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
  margin-bottom: 1rem;
}

.intake p {
  display: flex;
  gap: 0.4rem;
  margin: 0;
}

.join-link {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.entries :deep(tr) {
  cursor: pointer;
}

.render-thumb {
  height: 3rem;
}
</style>
