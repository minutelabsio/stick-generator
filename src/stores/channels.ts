import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { ChannelSummary } from '@shared/api-types'
import { api } from '@/lib/api'
import { readLastChannelId } from '@/lib/last-channel'

// Channels rarely change, so every view shares one fetch per page load.
export const useChannelStore = defineStore('channels', () => {
  const channels = ref<ChannelSummary[]>([])
  let loading: Promise<void> | null = null

  function load() {
    loading ??= api.listChannels()
      .then((list) => {
        channels.value = list
      })
      .catch((error: unknown) => {
        loading = null
        throw error
      })
    return loading
  }

  const bySlug = (slug: string) => channels.value.find(channel => channel.slug === slug)
  const byId = (id: string) => channels.value.find(channel => channel.id === id)
  const lastUsed = () => byId(readLastChannelId() ?? '') ?? channels.value[0]

  return { channels, load, bySlug, byId, lastUsed }
})
