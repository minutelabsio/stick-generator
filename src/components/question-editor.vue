<script setup lang="ts">
import Button from 'primevue/button'
import Checkbox from 'primevue/checkbox'
import InputNumber from 'primevue/inputnumber'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import Textarea from 'primevue/textarea'
import { computed } from 'vue'
import { MAX_TEXT_ANSWER_LENGTH, QUESTION_TYPES } from '@shared/intake'
import type { Question, QuestionType } from '@shared/intake'
import { QUESTION_TYPE_LABELS, withType } from '@/lib/intake-questions'

defineProps<{ position: number, isFirst: boolean, isLast: boolean }>()
const emit = defineEmits<{ remove: [], moveUp: [], moveDown: [] }>()

// The form page owns the draft, and this edits one question of it in place.
const question = defineModel<Question>({ required: true })

const typeOptions = QUESTION_TYPES.map(type => ({ value: type, label: QUESTION_TYPE_LABELS[type] }))

const changeType = (type: QuestionType) => {
  question.value = withType(question.value, type)
}

// One option per line. Blank lines are dropped on save, so typing Enter is harmless.
const optionsText = computed({
  get: () => ('options' in question.value ? question.value.options.join('\n') : ''),
  set: (text: string) => {
    if ('options' in question.value) question.value.options = text.split('\n')
  },
})
</script>

<template>
  <section class="question card">
    <header class="question-header">
      <span class="muted position">Question {{ position }}</span>
      <div class="question-actions">
        <Button
          icon="pi pi-arrow-up"
          text
          severity="secondary"
          aria-label="Move up"
          :disabled="isFirst"
          @click="emit('moveUp')"
        />
        <Button
          icon="pi pi-arrow-down"
          text
          severity="secondary"
          aria-label="Move down"
          :disabled="isLast"
          @click="emit('moveDown')"
        />
        <Button
          icon="pi pi-trash"
          text
          severity="danger"
          aria-label="Remove question"
          @click="emit('remove')"
        />
      </div>
    </header>

    <div class="fields">
      <label class="wide">
        Question
        <InputText
          v-model="question.label"
          placeholder="e.g. Describe your hair"
        />
      </label>
      <label>
        Answer type
        <Select
          :model-value="question.type"
          :options="typeOptions"
          option-label="label"
          option-value="value"
          @update:model-value="changeType"
        />
      </label>
      <label class="wide">
        <span>Help text <span class="muted optional">optional</span></span>
        <InputText v-model="question.help" />
      </label>

      <template v-if="question.type === 'text'">
        <label class="inline">
          <Checkbox
            v-model="question.multiline"
            binary
          />
          Allow several lines
        </label>
        <label>
          Longest answer (characters)
          <InputNumber
            v-model="question.maxLength"
            :min="1"
            :max="MAX_TEXT_ANSWER_LENGTH"
          />
        </label>
      </template>

      <template v-if="question.type === 'select' || question.type === 'radio'">
        <label class="wide">
          Options, one per line
          <Textarea
            v-model="optionsText"
            rows="4"
          />
        </label>
      </template>
      <label
        v-if="question.type === 'select'"
        class="inline wide"
      >
        <Checkbox
          v-model="question.allowOther"
          binary
        />
        Add an “Other” choice with a text box
      </label>

      <label class="inline">
        <Checkbox
          v-model="question.required"
          binary
        />
        Required
      </label>
      <label class="inline">
        <Checkbox
          v-model="question.highlight"
          binary
        />
        Show the answer beside the editor
      </label>
    </div>
  </section>
</template>

<style scoped>
.question-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.5rem;
}

.position {
  font-size: var(--text-md);
  font-weight: 600;
}

.question-actions {
  display: flex;
}

.fields {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 0.75rem 1rem;
}

.fields label {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  font-weight: 600;
}

.fields .wide {
  grid-column: 1 / -1;
}

.fields .inline {
  flex-direction: row;
  align-items: center;
  gap: 0.5rem;
  font-weight: 400;
}

.optional {
  font-weight: 400;
}

@media (width <= 40rem) {
  .fields {
    grid-template-columns: 1fr;
  }
}
</style>
