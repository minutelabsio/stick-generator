<script setup lang="ts">
import Listbox from 'primevue/listbox'
import { computed } from 'vue'
import type { FigureConfig } from '@shared/figure'
import type { Rig } from '@shared/rig'
import type { LibraryAsset } from '@shared/api-types'
import AssetThumb from '@/components/asset-thumb.vue'

const props = defineProps<{
  rig: Rig
  chosen: Partial<Record<string, LibraryAsset>>
  colors: FigureConfig['colors']
}>()

const activeSlot = defineModel<string>({ required: true })

// Objects rather than bare ids, so Listbox exposes "Long beard" to assistive tech, not "longbeard".
// The rig lists a group's slots together, so grouping keeps the rig's slot order.
const railGroups = computed(() => [...new Set(props.rig.slots.map(slot => slot.group))].map(group => ({
  label: group,
  options: props.rig.slots.filter(slot => slot.group === group).map(slot => ({ id: slot.id, label: slot.label })),
})))

// Listbox types its slot options as any; this gives them back their type.
const chosenFor = (slot: string) => props.chosen[slot]

// Arrow keys switch slots as focus moves, but the mouse only switches on click:
// Listbox's hover-to-focus would otherwise change slot as the pointer passes over.

// Listbox clears a single selection when its selected option is clicked again. The rail
// always has an open slot, so that "clear" is ignored.
function onChange(slot: string | null) {
  if (slot) activeSlot.value = slot
}
</script>

<template>
  <Listbox
    :model-value="activeSlot"
    :options="railGroups"
    option-group-label="label"
    option-group-children="options"
    option-label="label"
    option-value="id"
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
        :class="{ empty: !chosenFor(option.id) }"
      >
        <AssetThumb
          :asset="chosenFor(option.id)"
          :rig="rig"
          :colors="colors"
        />
      </span>
      <span>{{ option.label }}</span>
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
