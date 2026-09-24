<script setup lang="ts">
import { ref, watch } from 'vue'
import type { FigureConfig } from '@shared/figure'
import type { LibraryAsset } from '@shared/api-types'
import { assetThumbnail } from '@/lib/asset-thumbnail'

// An empty slot passes no asset and renders nothing.
const props = defineProps<{
  asset: LibraryAsset | undefined
  colors?: FigureConfig['colors']
}>()

// Loaded per tile, so a virtualised grid only crops the thumbnails it shows.
const src = ref('')

// Keeps the old image up while a recoloured one draws, so tiles don't flash blank.
let latestRequest = 0
watch(() => [props.asset, props.colors] as const, async ([asset, colors]) => {
  latestRequest += 1
  const request = latestRequest
  if (!asset) {
    src.value = ''
    return
  }
  const thumbnail = await assetThumbnail(asset, colors)
  if (request === latestRequest) src.value = thumbnail
}, { immediate: true, deep: true })
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
