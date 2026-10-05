<script setup lang="ts">
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import RadioButton from 'primevue/radiobutton'
import Select from 'primevue/select'
import Textarea from 'primevue/textarea'
import { computed, onBeforeUnmount, ref } from 'vue'
import type { Question } from '@shared/intake'
import { OTHER_CHOICE } from '@/lib/join-answers'
import { preparePhoto } from '@/lib/prepare-photo'

const props = defineProps<{ question: Question }>()
const answer = defineModel<string>('answer', { default: '' })
const other = defineModel<string>('other', { default: '' })
const image = defineModel<Blob | null>('image', { default: null })

const imageError = ref<string | null>(null)
const previewUrl = ref<string | null>(null)

const fieldId = computed(() => `question-${props.question.id}`)
const choices = computed(() => {
  const { question } = props
  if (question.type !== 'select') return []
  const listed = question.options.map(option => ({ label: option, value: option }))
  return question.allowOther ? [...listed, { label: 'Other…', value: OTHER_CHOICE }] : listed
})

function showPreview(blob: Blob | null) {
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
  previewUrl.value = blob ? URL.createObjectURL(blob) : null
}

// Same treatment as the photo: shrunk and re-encoded on the device, which drops EXIF
// data such as GPS location before anything is sent.
async function onImageChosen(event: Event) {
  const file = event.target instanceof HTMLInputElement ? event.target.files?.[0] : undefined
  if (!file) return
  try {
    imageError.value = null
    const prepared = await preparePhoto(file)
    image.value = prepared
    // Not image.value: the model only updates once the parent has re-rendered.
    showPreview(prepared)
  } catch (error) {
    imageError.value = error instanceof Error ? error.message : String(error)
  }
}

function clearImage() {
  image.value = null
  showPreview(null)
}

onBeforeUnmount(() => showPreview(null))
</script>

<template>
  <fieldset
    v-if="question.type === 'radio'"
    class="field"
  >
    <legend>
      {{ question.label }} <span
        v-if="!question.required"
        class="muted"
      >(optional)</span>
    </legend>
    <small
      v-if="question.help"
      class="muted help"
    >{{ question.help }}</small>
    <label
      v-for="(option, index) in question.options"
      :key="option"
      class="choice"
    >
      <RadioButton
        v-model="answer"
        :input-id="`${fieldId}-${index}`"
        :name="fieldId"
        :value="option"
      />
      {{ option }}
    </label>
  </fieldset>

  <div
    v-else
    class="field"
  >
    <label :for="fieldId">
      {{ question.label }} <span
        v-if="!question.required"
        class="muted"
      >(optional)</span>
    </label>
    <small
      v-if="question.help"
      class="muted help"
    >{{ question.help }}</small>

    <Textarea
      v-if="question.type === 'text' && question.multiline"
      :id="fieldId"
      v-model="answer"
      rows="3"
      auto-resize
      :maxlength="question.maxLength"
      :required="question.required"
    />
    <InputText
      v-else-if="question.type === 'text'"
      :id="fieldId"
      v-model="answer"
      :maxlength="question.maxLength"
      :required="question.required"
    />
    <InputText
      v-else-if="question.type === 'email'"
      :id="fieldId"
      v-model="answer"
      type="email"
      :required="question.required"
    />
    <template v-else-if="question.type === 'select'">
      <Select
        v-model="answer"
        :input-id="fieldId"
        :options="choices"
        option-label="label"
        option-value="value"
        placeholder="Choose…"
        :show-clear="!question.required"
      />
      <InputText
        v-if="answer === OTHER_CHOICE"
        v-model="other"
        aria-label="Your other answer"
        placeholder="Type your answer"
        maxlength="200"
        required
      />
    </template>
    <template v-else-if="question.type === 'image'">
      <input
        :id="fieldId"
        type="file"
        accept="image/*"
        @change="onImageChosen"
      >
      <div
        v-if="previewUrl"
        class="image-preview"
      >
        <img
          :src="previewUrl"
          :alt="question.label"
        >
        <Button
          label="Remove"
          text
          severity="secondary"
          size="small"
          @click="clearImage"
        />
      </div>
      <small
        v-if="imageError"
        class="image-error"
      >{{ imageError }}</small>
    </template>
  </div>
</template>

<style scoped>
.field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  margin: 0;
  padding: 0;
  border: 0;
}

.field > label,
legend {
  padding: 0;
  font-weight: 600;
}

legend + .help,
legend + .choice {
  margin-top: 0.35rem;
}

.help {
  white-space: pre-line;
}

.choice {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.image-preview {
  display: flex;
  align-items: flex-end;
  gap: 0.5rem;
}

.image-preview img {
  max-height: 10rem;
  max-width: 70%;
  border-radius: 0.5rem;
}

.image-error {
  color: var(--p-red-600);
}
</style>
