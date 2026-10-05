<script setup lang="ts">
import Message from 'primevue/message'
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useChannelStore } from '@/stores/channels'

const router = useRouter()
const channelStore = useChannelStore()

const problem = ref<string | null>(null)

// Opens the channel this designer last worked in, so the app starts where they left off.
onMounted(async () => {
  try {
    await channelStore.load()
  } catch (error) {
    problem.value = error instanceof Error ? error.message : String(error)
    return
  }
  const channel = channelStore.lastUsed()
  // Batches need a channel, so a fresh install starts by making one.
  await router.replace(channel ? { name: 'batches', params: { channelSlug: channel.slug } } : { name: 'channels' })
})
</script>

<template>
  <main class="page">
    <Message
      v-if="problem"
      severity="error"
    >
      {{ problem }}
    </Message>
  </main>
</template>
