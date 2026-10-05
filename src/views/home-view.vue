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
  if (!channel) {
    problem.value = 'There are no channels yet, so there is nowhere to put batches. Ask whoever runs this tool to add one.'
    return
  }
  await router.replace({ name: 'batches', params: { channelSlug: channel.slug } })
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
