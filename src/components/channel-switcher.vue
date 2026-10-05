<script setup lang="ts">
import Select from 'primevue/select'
import { useRouter } from 'vue-router'
import { useChannelStore } from '@/stores/channels'

defineProps<{ channelSlug: string }>()

const router = useRouter()
const channelStore = useChannelStore()

const switchTo = (channelSlug: string) => router.push({ name: 'batches', params: { channelSlug } })
</script>

<template>
  <Select
    :model-value="channelSlug"
    :options="channelStore.channels"
    option-label="name"
    option-value="slug"
    aria-label="Channel"
    class="channel-switcher"
    @update:model-value="switchTo"
  />
</template>

<style scoped>
.channel-switcher {
  min-width: 12rem;
}
</style>
