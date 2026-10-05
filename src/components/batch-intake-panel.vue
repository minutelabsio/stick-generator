<script setup lang="ts">
import Button from 'primevue/button'
import DatePicker from 'primevue/datepicker'
import InputNumber from 'primevue/inputnumber'
import InputText from 'primevue/inputtext'
import Message from 'primevue/message'
import ToggleSwitch from 'primevue/toggleswitch'
import { useToast } from 'primevue/usetoast'
import { computed, ref } from 'vue'
import { UpdateBatchRequest } from '@shared/api-types'
import type { BatchDetail } from '@shared/api-types'
import { MAX_SUBMISSION_LIMIT } from '@shared/batch-intake'
import { api } from '@/lib/api'
import { describeIntake } from '@/lib/status'

const ROTATE_PROMPT = 'Replace the join code? The current link stops working at once, so you will need to send everyone the new one.'

const props = defineProps<{ batch: BatchDetail }>()
const emit = defineEmits<{ changed: [batch: BatchDetail] }>()

const toast = useToast()

const isSwitching = ref(false)
const isSaving = ref(false)
const settingsError = ref<string | null>(null)

// Seeded once from the batch. The live refresh doesn't touch it, so it never
// overwrites what someone is typing.
const draftFrom = (batch: BatchDetail) => ({
  name: batch.name,
  closesAt: batch.closesAt ? new Date(batch.closesAt) : null,
  maxSubmissions: batch.maxSubmissions,
})
const draft = ref(draftFrom(props.batch))
const savedDraft = ref(JSON.stringify(draft.value))
const isDirty = computed(() => JSON.stringify(draft.value) !== savedDraft.value)

const joinLink = computed(() => (props.batch.joinCode ? `${location.origin}/join#${props.batch.joinCode}` : null))
const statusSeverity = computed(() => (props.batch.intakeState === 'open' ? 'success' : 'secondary'))

const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error))

async function setOpen(isOpen: boolean) {
  isSwitching.value = true
  try {
    emit('changed', await api.updateBatch(props.batch.id, { isOpen }))
  } catch (error) {
    toast.add({ severity: 'error', summary: isOpen ? 'Could not open the batch' : 'Could not close the batch', detail: messageOf(error), life: 6000 })
  } finally {
    isSwitching.value = false
  }
}

// Only what changed is sent, so a save never undoes someone else's switch.
function changedSettings() {
  const saved = draftFrom(props.batch)
  const { name, closesAt, maxSubmissions } = draft.value
  return {
    ...(name === saved.name ? {} : { name }),
    ...(closesAt?.getTime() === saved.closesAt?.getTime() ? {} : { closesAt: closesAt?.toISOString() }),
    ...(maxSubmissions === saved.maxSubmissions ? {} : { maxSubmissions }),
  }
}

async function saveSettings() {
  const parsed = UpdateBatchRequest.safeParse(changedSettings())
  if (!parsed.success) {
    settingsError.value = parsed.error.issues[0]?.message ?? 'Please check the settings and try again.'
    return
  }
  settingsError.value = null
  isSaving.value = true
  try {
    const updated = await api.updateBatch(props.batch.id, parsed.data)
    draft.value = draftFrom(updated)
    savedDraft.value = JSON.stringify(draft.value)
    emit('changed', updated)
    toast.add({ severity: 'success', summary: 'Settings saved', life: 2000 })
  } catch (error) {
    settingsError.value = messageOf(error)
  } finally {
    isSaving.value = false
  }
}

async function copyJoinLink() {
  if (!joinLink.value) return
  await navigator.clipboard.writeText(joinLink.value)
  toast.add({ severity: 'success', summary: 'Link copied', life: 2000 })
}

async function rotateCode() {
  if (!confirm(ROTATE_PROMPT)) return
  try {
    emit('changed', await api.rotateBatchCode(props.batch.id))
    toast.add({ severity: 'success', summary: 'New link ready', detail: 'The old link no longer works. Send this one out.', life: 5000 })
  } catch (error) {
    toast.add({ severity: 'error', summary: 'Could not replace the code', detail: messageOf(error), life: 6000 })
  }
}
</script>

<template>
  <section class="card intake">
    <div class="intake-head">
      <label class="switch">
        <ToggleSwitch
          :model-value="batch.isOpen"
          :disabled="isSwitching || !batch.joinCode"
          @update:model-value="setOpen"
        />
        <strong>Taking submissions</strong>
      </label>
      <Message
        :severity="statusSeverity"
        size="small"
        variant="simple"
        class="status"
        aria-live="polite"
      >
        {{ describeIntake(batch) }}
      </Message>
    </div>
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
      <Button
        icon="pi pi-refresh"
        label="Replace code"
        size="small"
        text
        severity="danger"
        class="rotate"
        @click="rotateCode"
      />
    </div>
  </section>

  <section class="card settings">
    <form
      class="settings-form"
      @submit.prevent="saveSettings"
    >
      <label>
        Batch name
        <InputText v-model="draft.name" />
      </label>
      <label>
        Closes on
        <DatePicker
          v-model="draft.closesAt"
          show-time
          hour-format="24"
          :min-date="new Date()"
        />
      </label>
      <label>
        Submission limit
        <InputNumber
          v-model="draft.maxSubmissions"
          :min="1"
          :max="MAX_SUBMISSION_LIMIT"
          placeholder="No limit"
        />
      </label>
      <Button
        type="submit"
        label="Save settings"
        severity="secondary"
        :disabled="!isDirty"
        :loading="isSaving"
      />
    </form>
    <Message
      v-if="settingsError"
      severity="error"
    >
      {{ settingsError }}
    </Message>
  </section>
</template>

<style scoped>
.intake,
.settings {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.intake-head {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
}

.switch {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.join-link {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.rotate {
  margin-left: auto;
}

.settings-form {
  display: grid;
  grid-template-columns: 2fr 1.5fr 1fr auto;
  align-items: end;
  gap: 1rem;
}

.settings-form label {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  font-weight: 600;
}

@media (width <= 48rem) {
  .settings-form {
    grid-template-columns: 1fr;
  }
}
</style>
