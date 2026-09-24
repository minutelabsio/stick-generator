<script setup lang="ts">
import Listbox from 'primevue/listbox'
import { SLOTS } from '@shared/figure'
import type { FigureConfig, SlotId } from '@shared/figure'
import type { LibraryAsset } from '@shared/api-types'
import AssetThumb from '@/components/asset-thumb.vue'

const props = defineProps<{
  chosen: Partial<Record<SlotId, LibraryAsset>>
  colors: FigureConfig['colors']
}>()

const activeSlot = defineModel<SlotId>({ required: true })

const SLOT_GROUPS: { label: string, slots: SlotId[] }[] = [
  { label: 'Figure', slots: ['body', 'head', 'hair', 'hat'] },
  { label: 'Facial hair', slots: ['mustache', 'beard', 'longbeard'] },
  { label: 'Extras', slots: ['glasses', 'accessory'] },
]

// Listbox types its slot options as any; these give them back their type.
const chosenFor = (slot: SlotId) => props.chosen[slot]
const labelFor = (slot: SlotId) => SLOTS[slot].label

// Arrow keys switch slots as focus moves, but the mouse only switches on click:
// Listbox's hover-to-focus would otherwise change slot as the pointer passes over.

// Listbox clears a single selection when its selected option is clicked again. The rail
// always has an open slot, so that "clear" is ignored.
function onChange(slot: SlotId | null) {
  if (slot) activeSlot.value = slot
}
</script>

<template>
  <Listbox
    :model-value="activeSlot"
    :options="SLOT_GROUPS"
    option-group-label="label"
    option-group-children="slots"
    select-on-focus
    :focus-on-hover="false"
    scroll-height="none"
    class="slot-rail"
    aria-label="Figure parts"
    @update:model-value="onChange"
  >
    <template #optiongroup>
      <span class="group-divider" />
    </template>
    <template #option="{ option }">
      <span
        class="thumb"
        :class="{ empty: !chosenFor(option) }"
      >
        <AssetThumb
          :asset="chosenFor(option)"
          :colors="colors"
        />
      </span>
      <span>{{ labelFor(option) }}</span>
    </template>
  </Listbox>
</template>

<style scoped>
.slot-rail {
  border: none;
  background: transparent;
  box-shadow: none;
}

.slot-rail :deep(.p-listbox-option) {
  gap: 0.6rem;
  padding: 0.3rem 0.5rem;
  font-size: var(--text-md);
}

/* The rail sits on the grey board, where the neutral highlight would vanish. */
.slot-rail :deep(.p-listbox-option-selected),
.slot-rail :deep(.p-listbox-option-selected.p-focus) {
  font-weight: 600;
  background: var(--glaze);
  box-shadow: inset 3px 0 0 var(--graphite);
}

.slot-rail :deep(.p-listbox-option-group) {
  padding: 0.25rem 0.5rem;
}

.slot-rail :deep(.p-listbox-option-group:first-child) {
  display: none;
}

.group-divider {
  display: block;
  width: 100%;
  border-top: 1px solid var(--rule);
}

.thumb {
  flex: none;
  display: grid;
  place-items: center;
  width: 2rem;
  height: 2rem;
  padding: 0.15rem;
  box-sizing: border-box;
  background: var(--glaze);
  border: 1px solid var(--rule);
  border-radius: var(--p-border-radius-sm);
}

.thumb.empty {
  background: transparent;
  border-style: dashed;
  border-radius: 50%;
}
</style>
