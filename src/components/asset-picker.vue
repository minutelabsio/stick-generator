<script setup lang="ts">
import { ref, watch } from 'vue'
import type { LibraryAsset } from '@shared/api-types'
import { assetThumbnail } from '@/lib/asset-thumbnail'

const props = defineProps<{
  assets: LibraryAsset[]
  selectedId: string | undefined
  allowNone: boolean
}>()

const emit = defineEmits<{ select: [assetId: string | undefined] }>()

const thumbnails = ref<Record<string, string>>({})

async function loadThumbnails(assets: LibraryAsset[]) {
  const loaded = await Promise.all(assets.map(async asset => [asset.id, await assetThumbnail(asset)] as const))
  thumbnails.value = Object.fromEntries(loaded)
}

watch(() => props.assets, (assets) => {
  void loadThumbnails(assets)
}, { immediate: true })
</script>

<template>
  <div class="picker">
    <button
      v-if="allowNone"
      type="button"
      class="option none"
      :class="{ selected: !selectedId }"
      title="None"
      @click="emit('select', undefined)"
    >
      <i class="pi pi-ban" />
    </button>
    <button
      v-for="asset in assets"
      :key="asset.id"
      type="button"
      class="option"
      :class="{ selected: selectedId === asset.id }"
      :title="asset.label"
      @click="emit('select', asset.id)"
    >
      <img
        v-if="thumbnails[asset.id]"
        :src="thumbnails[asset.id]"
        :alt="asset.label"
      >
    </button>
  </div>
</template>

<style scoped>
.picker {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.option {
  width: 4.5rem;
  height: 4.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  padding: 0.25rem;
  background: #fff;
  border: 2px solid #e3e3df;
  border-radius: 0.5rem;
  cursor: pointer;
}

.option:hover {
  border-color: #9a9a94;
}

.option.selected {
  border-color: #2563eb;
  box-shadow: 0 0 0 2px #bfd3ff;
}

.option img {
  max-width: 100%;
  max-height: 100%;
}

.none {
  color: #9a9a94;
  font-size: 1.25rem;
}
</style>
