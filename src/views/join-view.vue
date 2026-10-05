<script setup lang="ts">
import Button from 'primevue/button'
import Checkbox from 'primevue/checkbox'
import InputText from 'primevue/inputtext'
import Message from 'primevue/message'
import Textarea from 'primevue/textarea'
import { computed, onMounted, ref } from 'vue'
import type { JoinBatch } from '@shared/api-types'
import { normalizeJoinCode } from '@shared/join-code'
import { api } from '@/lib/api'
import { preparePhoto } from '@/lib/prepare-photo'
import { formatDate } from '@/lib/status'

type PageState = 'enter-code' | 'loading' | 'ready' | 'submitted'

const pageState = ref<PageState>('loading')
const joinCode = ref('')
const typedCode = ref('')
const batch = ref<JoinBatch | null>(null)
const errorMessage = ref<string | null>(null)
const isSubmitting = ref(false)

const name = ref('')
const email = ref('')
const answers = ref<Record<string, string>>({})
const consent = ref(false)
const photo = ref<Blob | null>(null)
const photoPreviewUrl = ref<string | null>(null)

const contactLine = computed(() => (batch.value?.contactEmail ? ` Email ${batch.value.contactEmail} if you missed it.` : ''))

async function loadBatch(code: string) {
  pageState.value = 'loading'
  errorMessage.value = null
  try {
    joinCode.value = normalizeJoinCode(code)
    batch.value = await api.getJoinBatch(joinCode.value)
    pageState.value = 'ready'
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : String(error)
    pageState.value = 'enter-code'
  }
}

async function onPhotoChosen(event: Event) {
  const file = event.target instanceof HTMLInputElement ? event.target.files?.[0] : undefined
  if (!file) return
  try {
    errorMessage.value = null
    photo.value = await preparePhoto(file)
    if (photoPreviewUrl.value) URL.revokeObjectURL(photoPreviewUrl.value)
    photoPreviewUrl.value = URL.createObjectURL(photo.value)
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : String(error)
  }
}

async function submit() {
  if (!photo.value) {
    errorMessage.value = 'Please add a photo of yourself.'
    return
  }
  const form = new FormData()
  form.append('name', name.value)
  form.append('email', email.value)
  form.append('answers', JSON.stringify(answers.value))
  form.append('consent', String(consent.value))
  form.append('photo', photo.value, 'photo.jpg')
  isSubmitting.value = true
  errorMessage.value = null
  try {
    await api.submitJoin(joinCode.value, form)
    pageState.value = 'submitted'
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : String(error)
  } finally {
    isSubmitting.value = false
  }
}

onMounted(async () => {
  const codeFromLink = location.hash.slice(1)
  // Keep the code out of the address bar, screenshots, and anything copied from it.
  history.replaceState(null, '', location.pathname)
  if (!codeFromLink) {
    pageState.value = 'enter-code'
    return
  }
  await loadBatch(codeFromLink)
})
</script>

<template>
  <main class="join">
    <div class="card panel">
      <p
        v-if="batch?.channelName"
        class="channel muted"
      >
        {{ batch.channelName }}
      </p>
      <p
        v-if="pageState === 'loading'"
        class="muted"
      >
        Loading…
      </p>

      <form
        v-else-if="pageState === 'enter-code'"
        class="form"
        @submit.prevent="loadBatch(typedCode)"
      >
        <h1>Join a stick figure batch</h1>
        <p>Enter the invite code from your email.</p>
        <InputText
          v-model="typedCode"
          placeholder="XXXX-XXXX-XXXX"
          required
        />
        <Button
          type="submit"
          label="Continue"
        />
      </form>

      <template v-else-if="pageState === 'submitted'">
        <h1>Got it, thanks!</h1>
        <p>We'll draw your stick figure soon. If you need to change anything, reply to your invitation email.</p>
      </template>

      <template v-else-if="batch?.state === 'closed'">
        <h1>This batch has closed</h1>
        <p>Sorry, submissions are no longer open.{{ contactLine }}</p>
      </template>

      <template v-else-if="batch?.state === 'not_yet_open'">
        <h1>Not open yet</h1>
        <p>This batch hasn't opened. Try your link again later.</p>
      </template>

      <form
        v-else-if="batch"
        class="form"
        @submit.prevent="submit"
      >
        <h1>{{ batch.batchName }}</h1>
        <p class="muted">
          Open until {{ formatDate(batch.closesAt) }}. We'll draw a stick figure of you from your photo and answers.
        </p>
        <label>
          Your name
          <InputText
            v-model="name"
            required
            autocomplete="name"
          />
        </label>
        <label>
          Email
          <InputText
            v-model="email"
            type="email"
            required
            autocomplete="email"
          />
        </label>
        <label
          v-for="question in batch.questions"
          :key="question.id"
        >
          {{ question.label }}
          <Textarea
            v-model="answers[question.id]"
            rows="2"
            auto-resize
            :required="question.required"
          />
        </label>
        <label>
          A photo of you
          <input
            type="file"
            accept="image/*"
            @change="onPhotoChosen"
          >
        </label>
        <img
          v-if="photoPreviewUrl"
          :src="photoPreviewUrl"
          class="preview"
          alt="Your photo"
        >
        <label class="consent">
          <Checkbox
            v-model="consent"
            binary
            required
          />
          <span>I agree that my photo and answers can be used to draw my stick figure. Only the team sees them.</span>
        </label>
        <Message
          v-if="errorMessage"
          severity="error"
        >
          {{ errorMessage }}
        </Message>
        <Button
          type="submit"
          label="Send"
          :loading="isSubmitting"
        />
      </form>

      <Message
        v-if="errorMessage && pageState === 'enter-code'"
        severity="error"
      >
        {{ errorMessage }}
      </Message>
    </div>
  </main>
</template>

<style scoped>
.join {
  display: flex;
  justify-content: center;
  padding: 1.5rem 1rem;
}

.panel {
  width: 100%;
  max-width: 30rem;
}

.channel {
  margin: 0 0 0.25rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.form label {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  font-weight: 600;
}

.form .consent {
  flex-direction: row;
  align-items: flex-start;
  gap: 0.6rem;
  font-weight: 400;
}

.preview {
  max-height: 16rem;
  align-self: flex-start;
  border-radius: 0.5rem;
}
</style>
