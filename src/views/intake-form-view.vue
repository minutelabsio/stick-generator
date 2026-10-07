<script setup lang="ts">
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Message from 'primevue/message'
import Textarea from 'primevue/textarea'
import Toolbar from 'primevue/toolbar'
import { useToast } from 'primevue/usetoast'
import { computed, ref, watch } from 'vue'
import { onBeforeRouteLeave, RouterLink } from 'vue-router'
import { DEFAULT_CONSENT_TEXT, DEFAULT_THANK_YOU_MESSAGE, IntakeSettings, MAX_QUESTIONS } from '@shared/intake'
import type { Question } from '@shared/intake'
import QuestionEditor from '@/components/question-editor.vue'
import { api } from '@/lib/api'
import { newQuestion } from '@/lib/intake-questions'
import { useChannelStore } from '@/stores/channels'

const UNSAVED_CHANGES_PROMPT = 'You have unsaved changes to this form. Leave anyway?'

const props = defineProps<{ channelSlug: string }>()

const toast = useToast()
const channelStore = useChannelStore()

const draft = ref<IntakeSettings | null>(null)
const savedSnapshot = ref('')
const loadError = ref<string | null>(null)
const formError = ref<string | null>(null)
const isSaving = ref(false)

const channel = computed(() => channelStore.bySlug(props.channelSlug))
const isDirty = computed(() => draft.value !== null && JSON.stringify(draft.value) !== savedSnapshot.value)

function showSaved(intake: IntakeSettings) {
  draft.value = intake
  savedSnapshot.value = JSON.stringify(intake)
}

async function loadIntake() {
  draft.value = null
  loadError.value = null
  try {
    await channelStore.load()
    if (!channel.value) {
      loadError.value = `There is no channel called "${props.channelSlug}". Pick one from the channel menu.`
      return
    }
    showSaved(await api.getIntake(channel.value.id))
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : String(error)
  }
}

const withoutBlankOptions = (question: Question): Question =>
  'options' in question ? { ...question, options: question.options.filter(option => option.trim()) } : question

// Names the question a problem is in, since the shared rules only know its position.
function describeProblem(path: PropertyKey[], message: string) {
  const [section, index] = path
  return section === 'questions' && typeof index === 'number' ? `Question ${index + 1}: ${message}` : message
}

async function save() {
  if (!draft.value || !channel.value) return
  const candidate = { ...draft.value, questions: draft.value.questions.map(withoutBlankOptions) }
  // Checked with the server's own rules first, so the message says what to fix.
  const parsed = IntakeSettings.safeParse(candidate)
  if (!parsed.success) {
    const [issue] = parsed.error.issues
    formError.value = issue ? describeProblem(issue.path, issue.message) : 'Please check the form and try again.'
    return
  }
  formError.value = null
  isSaving.value = true
  try {
    showSaved(await api.saveIntake(channel.value.id, parsed.data))
    toast.add({ severity: 'success', summary: 'Intake form saved', life: 2000 })
  } catch (error) {
    formError.value = error instanceof Error ? error.message : String(error)
  } finally {
    isSaving.value = false
  }
}

function addQuestion() {
  if (draft.value) draft.value.questions = [...draft.value.questions, newQuestion()]
}

function removeQuestion(index: number) {
  if (draft.value) draft.value.questions = draft.value.questions.toSpliced(index, 1)
}

function moveQuestion(index: number, offset: -1 | 1) {
  const questions = draft.value?.questions
  const moving = questions?.[index]
  const displaced = questions?.[index + offset]
  if (!draft.value || !questions || !moving || !displaced) return
  draft.value.questions = questions.with(index, displaced).with(index + offset, moving)
}

onBeforeRouteLeave(() => !isDirty.value || confirm(UNSAVED_CHANGES_PROMPT))

watch(() => props.channelSlug, loadIntake, { immediate: true })
</script>

<template>
  <main class="page">
    <RouterLink
      :to="{ name: 'batches', params: { channelSlug } }"
      class="back"
    >
      <i class="pi pi-angle-left" /> {{ channel ? `${channel.name} batches` : 'Batches' }}
    </RouterLink>
    <Toolbar class="page-header">
      <template #start>
        <h1>Intake form</h1>
      </template>
      <template #end>
        <Button
          label="Save form"
          icon="pi pi-check"
          :disabled="!isDirty"
          :loading="isSaving"
          @click="save"
        />
      </template>
    </Toolbar>

    <Message
      v-if="loadError"
      severity="error"
    >
      {{ loadError }}
    </Message>

    <template v-if="draft && channel">
      <p class="muted lede">
        Every batch in {{ channel.name }} asks these. Changes apply to new submissions.
        Entries already in keep the questions they were asked.
      </p>

      <section class="card block">
        <h2>Before the questions</h2>
        <label>
          <span>Instructions <span class="muted optional">optional, plain text, line breaks are kept</span></span>
          <Textarea
            v-model="draft.instructions"
            rows="4"
            placeholder="e.g. A clear photo of your face works best."
          />
        </label>
        <p class="muted always-asked">
          Always asked: name, email, a photo to draw from, and consent.
        </p>
      </section>

      <div class="questions">
        <QuestionEditor
          v-for="(question, index) in draft.questions"
          :key="question.id"
          v-model="draft.questions[index]!"
          :position="index + 1"
          :is-first="index === 0"
          :is-last="index === draft.questions.length - 1"
          @remove="removeQuestion(index)"
          @move-up="moveQuestion(index, -1)"
          @move-down="moveQuestion(index, 1)"
        />
        <Button
          label="Add question"
          icon="pi pi-plus"
          severity="secondary"
          :disabled="draft.questions.length >= MAX_QUESTIONS"
          @click="addQuestion"
        />
      </div>

      <section class="card block">
        <h2>After the questions</h2>
        <label>
          Consent text
          <Textarea
            v-model="draft.consentText"
            rows="3"
            :placeholder="DEFAULT_CONSENT_TEXT"
          />
        </label>
        <label>
          Thank-you message
          <Textarea
            v-model="draft.thankYouMessage"
            rows="3"
            :placeholder="DEFAULT_THANK_YOU_MESSAGE"
          />
        </label>
        <div class="pair">
          <label>
            <span>Thank-you button <span class="muted optional">optional, sends followers on after they submit</span></span>
            <InputText
              v-model="draft.thankYouLinkLabel"
              placeholder="e.g. Back to our site"
            />
          </label>
          <label>
            Button link
            <InputText
              v-model="draft.thankYouLinkUrl"
              type="url"
              placeholder="https://…"
            />
          </label>
        </div>
        <label>
          <span>Contact email <span class="muted optional">shown when a batch is closed or full</span></span>
          <InputText
            v-model="draft.contactEmail"
            type="email"
          />
        </label>
      </section>

      <Message
        v-if="formError"
        severity="error"
      >
        {{ formError }}
      </Message>
    </template>
  </main>
</template>

<style scoped>
.back {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  margin-bottom: 0.25rem;
  font-size: var(--text-md);
  text-decoration: none;
}

.page-header {
  margin-bottom: 1rem;
}

.lede {
  margin: 0 0 1rem;
}

.block {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin-bottom: 1rem;
}

.block h2 {
  margin: 0;
  font-size: 1.1rem;
}

.block label {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  font-weight: 600;
}

.pair {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
  gap: 1rem;
}

.optional {
  font-weight: 400;
}

.always-asked {
  margin: 0;
  font-size: var(--text-md);
}

.questions {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 1rem;
  margin-bottom: 1rem;
}

.questions > :deep(.question) {
  align-self: stretch;
}
</style>
