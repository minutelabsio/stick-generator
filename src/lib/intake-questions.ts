import { DEFAULT_TEXT_MAX_LENGTH } from '@shared/intake'
import type { Question, QuestionOf, QuestionType } from '@shared/intake'

type BaseFields = Pick<Question, 'id' | 'label' | 'help' | 'required' | 'highlight'>

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  text: 'Text',
  email: 'Email address',
  select: 'Drop-down',
  radio: 'Radio buttons',
  image: 'Image upload',
}

// Switching type keeps what every question has (id, label, help, flags) and resets the
// rest, so a question never carries settings its type doesn't use.
const WITH_TYPE: { [T in QuestionType]: (base: BaseFields, previous: Question) => QuestionOf<T> } = {
  text: base => ({ ...base, type: 'text', multiline: false, maxLength: DEFAULT_TEXT_MAX_LENGTH }),
  email: base => ({ ...base, type: 'email' }),
  select: (base, previous) => ({ ...base, type: 'select', options: optionsOf(previous), allowOther: false }),
  radio: (base, previous) => ({ ...base, type: 'radio', options: optionsOf(previous) }),
  image: base => ({ ...base, type: 'image' }),
}

const optionsOf = (question: Question) => ('options' in question ? question.options : [])

export function withType(question: Question, type: QuestionType): Question {
  const { id, label, help, required, highlight } = question
  return WITH_TYPE[type]({ id, label, help, required, highlight }, question)
}

// Short and random: unique within a form is all it needs, and it never changes.
export const newQuestion = (): Question => ({
  id: crypto.randomUUID().slice(0, 8),
  label: '',
  help: '',
  required: false,
  highlight: false,
  type: 'text',
  multiline: false,
  maxLength: DEFAULT_TEXT_MAX_LENGTH,
})
