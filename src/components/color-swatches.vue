<script setup lang="ts">
defineProps<{
  label: string
  colors: string[]
  selected: string | undefined
}>()

const emit = defineEmits<{ select: [color: string | undefined] }>()

const isSelected = (color: string, selected: string | undefined) => color.toLowerCase() === selected?.toLowerCase()

function onCustomColor(event: Event) {
  if (event.target instanceof HTMLInputElement) emit('select', event.target.value)
}
</script>

<template>
  <div class="swatches">
    <span class="label">{{ label }}</span>
    <div class="row">
      <button
        v-for="color in colors"
        :key="color"
        type="button"
        class="swatch"
        :class="{ selected: isSelected(color, selected) }"
        :style="{ background: color }"
        :title="color"
        @click="emit('select', isSelected(color, selected) ? undefined : color)"
      />
      <label
        class="custom"
        title="Custom colour"
      >
        <input
          type="color"
          :value="selected ?? '#000000'"
          @input="onCustomColor"
        >
        <i class="pi pi-palette" />
      </label>
    </div>
  </div>
</template>

<style scoped>
.swatches {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.label {
  font-size: 0.85rem;
  font-weight: 600;
}

.row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
}

.swatch,
.custom {
  width: 1.6rem;
  height: 1.6rem;
  border-radius: 50%;
  border: 1px solid rgb(0 0 0 / 15%);
  cursor: pointer;
  padding: 0;
}

.swatch.selected {
  outline: 3px solid #2563eb;
  outline-offset: 1px;
}

.custom {
  position: relative;
  display: grid;
  place-items: center;
  background: #fff;
  color: #6b6b66;
}

.custom input {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
}
</style>
