<script setup lang="ts">
import Tag from 'primevue/tag'
import type { EntryStatus } from '@shared/api-types'

defineProps<{ status: EntryStatus }>()

const STATUS_DISPLAY: Record<EntryStatus, { label: string, severity: string }> = {
  new: { label: 'New', severity: 'info' },
  in_progress: { label: 'In progress', severity: 'warn' },
  done: { label: 'Done', severity: 'success' },
  skipped: { label: 'Skipped', severity: 'secondary' },
}
</script>

<template>
  <Tag
    :value="STATUS_DISPLAY[status].label"
    :severity="STATUS_DISPLAY[status].severity"
  />
</template>
