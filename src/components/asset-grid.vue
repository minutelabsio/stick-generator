<script setup lang="ts">
import VirtualScroller from 'primevue/virtualscroller'
import { computed, nextTick, ref, useTemplateRef, watch } from 'vue'
import type { ComponentPublicInstance } from 'vue'
import type { FigureConfig } from '@shared/figure'
import type { LibraryAsset } from '@shared/api-types'
import AssetThumb from '@/components/asset-thumb.vue'

const props = defineProps<{
  assets: LibraryAsset[]
  selectedId: string | undefined
  allowNone: boolean
  colors: FigureConfig['colors']
}>()

const emit = defineEmits<{
  select: [assetId: string | undefined]
  preview: [assetId: string | undefined]
  clearPreview: []
}>()

// VirtualScroller needs a fixed row height in pixels, so the tile size is fixed too.
// The gap leaves room for the selection ring, which draws outside the tile.
const COLUMNS = 4
const TILE_PX = 72
const GAP_PX = 10
const ROW_PX = TILE_PX + GAP_PX

// null is the "none" tile for optional slots.
type Tile = LibraryAsset | null

const scroller = useTemplateRef<ComponentPublicInstance>('scroller')

const tiles = computed<Tile[]>(() => (props.allowNone ? [null, ...props.assets] : props.assets))
const rows = computed(() => Array.from({ length: Math.ceil(tiles.value.length / COLUMNS) }, (_row, rowIndex) =>
  tiles.value.slice(rowIndex * COLUMNS, (rowIndex + 1) * COLUMNS).map((tile, column) => ({ tile, index: rowIndex * COLUMNS + column }))))

const isSelected = (tile: Tile) => (tile ? tile.id === props.selectedId : !props.selectedId)
const selectedIndex = () => Math.max(0, tiles.value.findIndex(isSelected))

// Roving tabindex: the grid is one tab stop, and arrow keys move within it.
const focusedIndex = ref(selectedIndex())
watch(tiles, () => {
  focusedIndex.value = selectedIndex()
})

const ARROW_STEPS: Record<string, number> = {
  ArrowLeft: -1,
  ArrowRight: 1,
  ArrowUp: -COLUMNS,
  ArrowDown: COLUMNS,
}

function onKeydown(event: KeyboardEvent) {
  const step = ARROW_STEPS[event.key]
  if (step === undefined) return
  event.preventDefault()
  const target = focusedIndex.value + step
  if (target < 0 || target >= tiles.value.length) return
  void focusTile(target)
}

// The target row may not be rendered yet, so scroll it into view before focusing it.
async function focusTile(index: number) {
  focusedIndex.value = index
  const element = scroller.value?.$el
  if (!(element instanceof HTMLElement)) return
  const rowTop = Math.floor(index / COLUMNS) * ROW_PX
  if (rowTop < element.scrollTop) element.scrollTop = rowTop
  if (rowTop + ROW_PX > element.scrollTop + element.clientHeight) element.scrollTop = rowTop + ROW_PX - element.clientHeight
  await nextTick()
  requestAnimationFrame(() => element.querySelector<HTMLElement>(`[data-index="${index}"]`)?.focus())
}

function onFocusTile(tile: Tile, index: number) {
  focusedIndex.value = index
  emit('preview', tile?.id)
}

function onFocusOut(event: FocusEvent) {
  const isLeavingGrid = !(event.relatedTarget instanceof Node && scroller.value?.$el.contains(event.relatedTarget))
  if (isLeavingGrid) emit('clearPreview')
}
</script>

<template>
  <VirtualScroller
    ref="scroller"
    :items="rows"
    :item-size="ROW_PX"
    :tabindex="-1"
    class="asset-grid"
    :style="{ '--tile': `${TILE_PX}px`, '--gap': `${GAP_PX}px`, '--columns': COLUMNS }"
    @keydown="onKeydown"
    @mouseleave="emit('clearPreview')"
    @focusout="onFocusOut"
  >
    <template #item="{ item: row }">
      <div class="row">
        <button
          v-for="{ tile, index } in row"
          :key="tile?.id ?? 'none'"
          type="button"
          class="tile"
          :class="{ selected: isSelected(tile), none: !tile }"
          :data-index="index"
          :tabindex="index === focusedIndex ? 0 : -1"
          :aria-pressed="isSelected(tile)"
          :aria-label="tile?.label ?? 'None'"
          :title="tile?.label ?? 'None'"
          @mouseenter="emit('preview', tile?.id)"
          @focus="onFocusTile(tile, index)"
          @click="emit('select', tile?.id)"
        >
          <AssetThumb
            v-if="tile"
            :asset="tile"
            :colors="colors"
          />
          <i
            v-else
            class="pi pi-ban"
          />
        </button>
      </div>
    </template>
  </VirtualScroller>
</template>

<style scoped>
.asset-grid {
  height: 100%;
}

.row {
  display: grid;
  grid-template-columns: repeat(var(--columns), var(--tile));
  gap: var(--gap);
  height: calc(var(--tile) + var(--gap));
  padding: calc(var(--gap) / 2);
  box-sizing: border-box;
}

.tile {
  display: grid;
  place-items: center;
  width: var(--tile);
  height: var(--tile);
  padding: 0.3rem;
  box-sizing: border-box;
  overflow: hidden;
  background: var(--glaze);
  border: 1px solid var(--rule);
  border-radius: var(--p-border-radius-md);
  cursor: pointer;
}

.tile:hover {
  border-color: var(--pencil);
}

/* Hue-free selection: a graphite ring with a white gap, so it never reads as a tint. */
.tile.selected {
  border-color: var(--graphite);
  box-shadow: 0 0 0 2px var(--glaze), 0 0 0 4px var(--graphite);
}

.none {
  color: var(--pencil);
  font-size: 1.25rem;
}
</style>
