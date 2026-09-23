<script setup lang="ts">
import Message from 'primevue/message'
import { onMounted, ref } from 'vue'

type ApiStatus = 'checking' | 'ok' | 'unreachable'

const apiStatus = ref<ApiStatus>('checking')

async function checkApi() {
  const response = await fetch('/api/health').catch(() => null)
  apiStatus.value = response?.ok ? 'ok' : 'unreachable'
}

onMounted(checkApi)
</script>

<template>
  <main class="home">
    <h1>Stick Generator</h1>
    <Message v-if="apiStatus === 'ok'" severity="success">API reachable</Message>
    <Message v-else-if="apiStatus === 'unreachable'" severity="error">API unreachable</Message>
    <Message v-else severity="secondary">Checking API…</Message>
  </main>
</template>

<style scoped>
.home {
  max-width: 40rem;
  margin: 2rem auto;
  padding: 0 1rem;
}
</style>
