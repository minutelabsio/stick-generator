<script setup lang="ts">
import { ApiError, MeResponse } from '@shared/api-schemas'
import Message from 'primevue/message'
import { onMounted, ref } from 'vue'

type SessionState
  = | { status: 'loading' }
    | { status: 'signed-in', email: string }
    | { status: 'error', message: string }

const session = ref<SessionState>({ status: 'loading' })

const FALLBACK_ERROR = 'Something went wrong loading your session.'

async function loadSession(): Promise<SessionState> {
  const response = await fetch('/api/me').catch(() => null)
  if (!response) return { status: 'error', message: 'Could not reach the server. Check your connection and reload.' }
  const body: unknown = await response.json().catch(() => null)
  if (!response.ok) return { status: 'error', message: ApiError.safeParse(body).data?.error ?? FALLBACK_ERROR }
  const me = MeResponse.safeParse(body)
  if (!me.success) return { status: 'error', message: FALLBACK_ERROR }
  return { status: 'signed-in', email: me.data.email }
}

onMounted(async () => {
  session.value = await loadSession()
})
</script>

<template>
  <main class="home">
    <h1>Stick Generator</h1>
    <p v-if="session.status === 'signed-in'">
      Hello, {{ session.email }}
    </p>
    <Message
      v-else-if="session.status === 'error'"
      severity="error"
    >
      {{ session.message }}
    </Message>
    <p v-else>
      Loading…
    </p>
  </main>
</template>

<style scoped>
.home {
  max-width: 40rem;
  margin: 2rem auto;
  padding: 0 1rem;
}
</style>
