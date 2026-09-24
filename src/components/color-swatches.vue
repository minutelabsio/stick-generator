<script setup lang="ts">
import ColorPicker from 'primevue/colorpicker'
import { useId } from 'vue'

const props = defineProps<{
  label: string
  colors: string[]
  selected: string | undefined
}>()

const emit = defineEmits<{ select: [color: string | undefined] }>()

const labelId = useId()

const isSelected = (color: string) => color.toLowerCase() === props.selected?.toLowerCase()

// ColorPicker's hex format has no leading '#'.
const onCustomColor = (hex: string) => emit('select', `#${hex}`)
</script>

<template>
  <div
    class="swatches"
    role="group"
    :aria-labelledby="labelId"
  >
    <div class="heading">
      <span :id="labelId">{{ label }}</span>
      <span class="hex tabular">{{ selected?.toUpperCase() }}</span>
    </div>
    <div class="chips">
      <button
        v-for="color in colors"
        :key="color"
        type="button"
        class="chip"
        :class="{ selected: isSelected(color) }"
        :style="{ background: color }"
        :title="color.toUpperCase()"
        :aria-label="color.toUpperCase()"
        :aria-pressed="isSelected(color)"
        @click="emit('select', isSelected(color) ? undefined : color)"
      />
      <ColorPicker
        :model-value="selected?.slice(1)"
        format="hex"
        class="custom"
        aria-label="Custom colour"
        @update:model-value="onCustomColor"
      />
    </div>
  </div>
</template>

<style scoped>
.swatches {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.heading {
  display: flex;
  justify-content: space-between;
  font-size: var(--text-md);
  font-weight: 600;
}

.hex {
  color: var(--pencil);
  font-weight: 400;
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.chip,
.custom :deep(.p-colorpicker-preview) {
  width: 1.25rem;
  height: 1.25rem;
  padding: 0;
  border: 1px solid rgb(0 0 0 / 15%);
  border-radius: var(--p-border-radius-xs);
  cursor: pointer;
}

.custom {
  display: flex;
}

/* A colour wheel, so it reads as "pick any colour" rather than another swatch. */
.custom :deep(.p-colorpicker-preview) {
  background-image: conic-gradient(red, yellow, lime, cyan, blue, magenta, red);
}

/* Same hue-free ring as asset tiles. */
.chip.selected {
  box-shadow: 0 0 0 2px var(--glaze), 0 0 0 3.5px var(--graphite);
}
</style>
