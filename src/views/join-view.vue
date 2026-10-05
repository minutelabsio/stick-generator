<script setup lang="ts">
import Button from 'primevue/button'
import Checkbox from 'primevue/checkbox'
import InputText from 'primevue/inputtext'
import Message from 'primevue/message'
import { computed, onMounted, ref } from 'vue'
import { IMAGE_ANSWER_FIELD_PREFIX } from '@shared/api-types'
import type { JoinBatch } from '@shared/api-types'
import { parseAnswers } from '@shared/intake'
import { normalizeJoinCode } from '@shared/join-code'
import JoinQuestion from '@/components/join-question.vue'
import { api } from '@/lib/api'
import { toSubmittedAnswers } from '@/lib/join-answers'
import type { AnswerDrafts } from '@/lib/join-answers'
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
const answers = ref<AnswerDrafts>({})
const otherAnswers = ref<AnswerDrafts>({})
const imageAnswers = ref<Record<string, Blob | null | undefined>>({})
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

// Keyed by question id, only for images actually chosen.
const chosenImages = () => Object.entries(imageAnswers.value).flatMap(([questionId, blob]) => (blob ? [[questionId, blob] as const] : []))

async function submit() {
  if (!batch.value) return
  if (!photo.value) {
    errorMessage.value = 'Please add a photo of yourself.'
    return
  }
  const submitted = toSubmittedAnswers(batch.value.questions, answers.value, otherAnswers.value)
  const images = chosenImages()
  // The server's own rules, checked first so the follower doesn't wait on an upload to hear them.
  const checked = parseAnswers(batch.value.questions, submitted, new Set(images.map(([questionId]) => questionId)))
  if (!checked.success) {
    errorMessage.value = checked.message
    return
  }
  const form = new FormData()
  form.append('name', name.value)
  form.append('email', email.value)
  form.append('answers', JSON.stringify(submitted))
  form.append('consent', String(consent.value))
  form.append('photo', photo.value, 'photo.jpg')
  images.forEach(([questionId, blob]) => form.append(`${IMAGE_ANSWER_FIELD_PREFIX}${questionId}`, blob, `${questionId}.jpg`))
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

// People often answer for a partner or friend too, so the same link takes another.
function startAnother() {
  name.value = ''
  answers.value = {}
  otherAnswers.value = {}
  imageAnswers.value = {}
  consent.value = false
  photo.value = null
  if (photoPreviewUrl.value) URL.revokeObjectURL(photoPreviewUrl.value)
  photoPreviewUrl.value = null
  pageState.value = 'ready'
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
        <h1>Sent</h1>
        <p class="message">
          {{ batch?.thankYouMessage }}
        </p>
        <p class="muted">
          Need to change something? {{ batch?.contactEmail ? `Email ${batch.contactEmail}.` : 'Reply to your invitation email.' }}
        </p>
        <Button
          label="Send another, for someone else"
          severity="secondary"
          @click="startAnother"
        />
      </template>

      <template v-else-if="batch?.state === 'closed'">
        <h1>This batch has closed</h1>
        <p>Sorry, submissions are no longer open.{{ contactLine }}</p>
      </template>

      <template v-else-if="batch?.state === 'full'">
        <h1>This batch is full</h1>
        <p>Sorry, it already has all the entries it can take.{{ contactLine }}</p>
      </template>

      <form
        v-else-if="batch"
        class="form"
        @submit.prevent="submit"
      >
        <h1>{{ batch.batchName }}</h1>
        <p
          v-if="batch.instructions"
          class="message"
        >
          {{ batch.instructions }}
        </p>
        <p class="muted">
          Open until {{ formatDate(batch.closesAt) }}.
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
        <label>
          A photo of you to draw from
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
        <JoinQuestion
          v-for="question in batch.questions"
          :key="question.id"
          v-model:answer="answers[question.id]"
          v-model:other="otherAnswers[question.id]"
          v-model:image="imageAnswers[question.id]"
          :question="question"
        />
        <label class="consent">
          <Checkbox
            v-model="consent"
            binary
            required
          />
          <span class="message">{{ batch.consentText }}</span>
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

.message {
  white-space: pre-line;
}

.form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

/* The flex gap spaces the form, and flex items' margins don't collapse into it. */
.form p {
  margin: 0;
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
