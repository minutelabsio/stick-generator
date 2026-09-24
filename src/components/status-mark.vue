<script setup lang="ts">
import type { EntryStatus } from '@shared/api-types'
import { STATUS_LABELS } from '@/lib/status'

defineProps<{ status: EntryStatus }>()
</script>

<template>
  <span
    class="status-mark"
    :class="status"
  >
    <span
      class="glyph"
      aria-hidden="true"
    />
    {{ STATUS_LABELS[status] }}
  </span>
</template>

<style scoped>
/* Shape, not hue, carries status: the figure is the only colour on screen. */
.status-mark {
  display: inline-flex;
  align-items: center;
  gap: 0.4em;
  white-space: nowrap;
}

.glyph {
  width: 0.75em;
  height: 0.75em;
  box-sizing: border-box;
  border: 1.5px solid currentColor;
  border-radius: 50%;
}

.in_progress .glyph {
  background: linear-gradient(90deg, currentColor 50%, transparent 50%);
}

.done .glyph {
  background: currentColor;
}

.skipped {
  color: var(--pencil);
}

.skipped .glyph {
  background: linear-gradient(135deg, transparent 43%, currentColor 43% 57%, transparent 57%);
}
</style>
