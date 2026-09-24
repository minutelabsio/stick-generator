<script setup lang="ts">
import VirtualScroller from 'primevue/virtualscroller'
import { computed } from 'vue'
import type { LibraryAsset } from '@shared/api-types'
import AssetThumb from '@/components/asset-thumb.vue'

const props = defineProps<{
  assets: LibraryAsset[]
  selectedId: string | undefined
  allowNone: boolean
}>()

const emit = defineEmits<{ select: [assetId: string | undefined] }>()

// VirtualScroller needs a fixed row height in pixels, so the tile size is fixed too.
// The gap leaves room for the selection ring, which draws outside the tile.
const COLUMNS = 4
const TILE_PX = 72
const GAP_PX = 10
const ROW_PX = TILE_PX + GAP_PX

// null is the "none" tile for optional slots.
type Tile = LibraryAsset | null

const rows = computed(() => {
  const tiles: Tile[] = props.allowNone ? [null, ...props.assets] : props.assets
  return Array.from({ length: Math.ceil(tiles.length / COLUMNS) }, (_row, index) =>
    tiles.slice(index * COLUMNS, (index + 1) * COLUMNS))
})

const isSelected = (tile: Tile) => (tile ? tile.id === props.selectedId : !props.selectedId)
</script>

<template>
  <VirtualScroller
    :items="rows"
    :item-size="ROW_PX"
    class="asset-grid"
    :style="{ '--tile': `${TILE_PX}px`, '--gap': `${GAP_PX}px`, '--columns': COLUMNS }"
  >
    <template #item="{ item: row }">
      <div class="row">
        <button
          v-for="tile in row"
          :key="tile?.id ?? 'none'"
          type="button"
          class="tile"
          :class="{ selected: isSelected(tile), none: !tile }"
          :aria-pressed="isSelected(tile)"
          :aria-label="tile?.label ?? 'None'"
          :title="tile?.label ?? 'None'"
          @click="emit('select', tile?.id)"
        >
          <AssetThumb
            v-if="tile"
            :asset="tile"
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
