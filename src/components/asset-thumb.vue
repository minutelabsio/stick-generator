<script setup lang="ts">
import { ref, watch } from 'vue'
import type { LibraryAsset } from '@shared/api-types'
import { assetThumbnail } from '@/lib/asset-thumbnail'

// An empty slot passes no asset and renders nothing.
const props = defineProps<{ asset: LibraryAsset | undefined }>()

// Loaded per tile, so a virtualised grid only crops the thumbnails it shows.
const src = ref('')

watch(() => props.asset, async (asset) => {
  src.value = ''
  if (!asset) return
  const thumbnail = await assetThumbnail(asset)
  if (props.asset?.id === asset.id) src.value = thumbnail
}, { immediate: true })
</script>

<template>
  <img
    v-if="src"
    :src="src"
    alt=""
    class="asset-thumb"
  >
</template>

<style scoped>
.asset-thumb {
  display: block;
  max-width: 100%;
  max-height: 100%;
}
</style>
