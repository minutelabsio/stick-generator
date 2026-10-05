import { z } from 'zod'

// A channel's intake form and the rules its answers must follow. The server checks
// submissions with these, and the join page uses the same rules, so a follower sees
// the server's own message for anything it would refuse.

export const MAX_QUESTIONS = 20
export const MAX_IMAGE_QUESTIONS = 3
export const MAX_OPTIONS = 50
export const MAX_TEXT_ANSWER_LENGTH = 2000
export const DEFAULT_TEXT_MAX_LENGTH = 500
const MAX_OTHER_LENGTH = 200
const MAX_EMAIL_LENGTH = 200

export const DEFAULT_THANK_YOU_MESSAGE = 'Got it, thanks! We\'ll draw your stick figure soon.'
export const DEFAULT_CONSENT_TEXT = 'I agree that my photo and answers can be used to draw my stick figure. Only the team sees them.'

// Invisible control characters and bidirectional overrides can hide or disguise text
// for whoever reads it later, so they never get stored. Line breaks survive only in
// multi-line fields.
const INVISIBLE_CODE_POINTS: readonly (readonly [number, number])[] = [
  [0x00, 0x08], // control characters, keeping tab, line feed, and carriage return
  [0x0B, 0x0C],
  [0x0E, 0x1F],
  [0x7F, 0x7F],
  [0x200E, 0x200F], // left-to-right and right-to-left marks
  [0x202A, 0x202E], // bidirectional embeddings and overrides
  [0x2066, 0x2069], // bidirectional isolates
]
const LINE_BREAKS = /\r\n?|\n|\t/g

const isVisible = (character: string) => {
  const codePoint = character.codePointAt(0) ?? 0
  return !INVISIBLE_CODE_POINTS.some(([first, last]) => codePoint >= first && codePoint <= last)
}

export function cleanText(raw: string, { multiline }: { multiline: boolean }) {
  const normalized = [...raw.normalize('NFC')].filter(isVisible).join('')
  const shaped = multiline ? normalized.replaceAll(/\r\n?/g, '\n') : normalized.replaceAll(LINE_BREAKS, ' ')
  return shaped.trim()
}

const plainText = (maxLength: number, multiline = false) =>
  z.string().transform(raw => cleanText(raw, { multiline })).pipe(z.string().max(maxLength))

const requiredText = (maxLength: number, message: string) =>
  z.string().transform(raw => cleanText(raw, { multiline: false })).pipe(z.string().min(1, message).max(maxLength))

// Made when a question is added and never edited, so a reworded question is still
// the same question.
export const QuestionId = z.string().regex(/^[A-Za-z0-9_-]{1,40}$/)

const Options = z
  .array(requiredText(100, 'Options can\'t be blank.'))
  .min(1, 'Give the question at least one option.')
  .max(MAX_OPTIONS)
  .refine(options => new Set(options).size === options.length, 'Each option can only be listed once.')

// Stored copies of questions are read with these same schemas, so later changes must
// stay able to read old copies: add optional fields or defaults, never tighten.
const QuestionBase = z.object({
  id: QuestionId,
  label: requiredText(200, 'Every question needs a label.'),
  help: plainText(500).default(''),
  required: z.boolean().default(false),
  highlight: z.boolean().default(false),
})

const TextQuestion = QuestionBase.extend({
  type: z.literal('text'),
  multiline: z.boolean().default(false),
  maxLength: z.int().min(1).max(MAX_TEXT_ANSWER_LENGTH).default(DEFAULT_TEXT_MAX_LENGTH),
})
const EmailQuestion = QuestionBase.extend({ type: z.literal('email') })
const SelectQuestion = QuestionBase.extend({ type: z.literal('select'), options: Options, allowOther: z.boolean().default(false) })
const RadioQuestion = QuestionBase.extend({ type: z.literal('radio'), options: Options })
const ImageQuestion = QuestionBase.extend({ type: z.literal('image') })

export const Question = z.discriminatedUnion('type', [TextQuestion, EmailQuestion, SelectQuestion, RadioQuestion, ImageQuestion])
export type Question = z.infer<typeof Question>
export type QuestionType = Question['type']
type QuestionOf<T extends QuestionType> = Extract<Question, { type: T }>

export const QUESTION_TYPES = ['text', 'email', 'select', 'radio', 'image'] as const satisfies readonly QuestionType[]

export const IntakeSettings = z.object({
  instructions: plainText(2000, true).default(''),
  questions: z
    .array(Question)
    .max(MAX_QUESTIONS, `A form can have at most ${MAX_QUESTIONS} questions.`)
    .default([])
    .refine(questions => new Set(questions.map(question => question.id)).size === questions.length, 'Two questions share an id.')
    .refine(
      questions => questions.filter(question => question.type === 'image').length <= MAX_IMAGE_QUESTIONS,
      `A form can ask for at most ${MAX_IMAGE_QUESTIONS} images besides the photo.`,
    ),
  thankYouMessage: plainText(1000, true).default(''),
  consentText: plainText(1000, true).default(''),
  contactEmail: z.union([z.literal(''), z.email('The contact email isn\'t a valid email address.').max(MAX_EMAIL_LENGTH)]).default(''),
})
export type IntakeSettings = z.infer<typeof IntakeSettings>

export const EMPTY_INTAKE_SETTINGS: IntakeSettings = IntakeSettings.parse({})

// What a follower picked or typed, as stored on the entry. An image answer holds the
// server-chosen key of the uploaded file.
export const AnswerValue = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('text'), text: z.string() }),
  z.object({ kind: z.literal('choice'), choice: z.string() }),
  z.object({ kind: z.literal('other'), text: z.string() }),
  z.object({ kind: z.literal('image'), key: z.string() }),
])
export type AnswerValue = z.infer<typeof AnswerValue>

// The question is a copy of what was asked, so the answer still makes sense after the
// form changes.
export const StoredAnswer = z.object({ question: Question, value: AnswerValue })
export type StoredAnswer = z.infer<typeof StoredAnswer>

// The join page sends each choice as the option's text, and "Other" as { other }.
export const SubmittedAnswerValue = z.union([z.string(), z.object({ other: z.string() })])
export const SubmittedAnswers = z.record(z.string(), SubmittedAnswerValue)
export type SubmittedAnswers = z.infer<typeof SubmittedAnswers>

type NonImageValue = Exclude<AnswerValue, { kind: 'image' }>
type AnswerRule<T extends QuestionType> = (question: QuestionOf<T>) => z.ZodType<NonImageValue | null, unknown>

const quoted = (question: Question) => `“${question.label}”`

const textRule: AnswerRule<'text'> = question => z
  .string()
  .transform(raw => cleanText(raw, { multiline: question.multiline }))
  .pipe(z.string().max(question.maxLength, `${quoted(question)} can be at most ${question.maxLength} characters.`))
  .transform(text => (text ? { kind: 'text' as const, text } : null))

const emailRule: AnswerRule<'email'> = question => z
  .string()
  .transform(raw => cleanText(raw, { multiline: false }))
  .pipe(z.union([z.literal(''), z.email(`${quoted(question)} needs a valid email address.`).max(MAX_EMAIL_LENGTH)]))
  .transform(text => (text ? { kind: 'text' as const, text } : null))

const choiceFrom = (question: QuestionOf<'select' | 'radio'>) => z
  .string()
  .refine(choice => question.options.includes(choice), `Pick one of the listed options for ${quoted(question)}.`)
  .transform(choice => ({ kind: 'choice' as const, choice }))

const otherFor = (question: QuestionOf<'select'>) => z
  .object({ other: z.string() })
  .refine(() => question.allowOther, `Pick one of the listed options for ${quoted(question)}.`)
  .transform(({ other }) => cleanText(other, { multiline: false }))
  .pipe(z.string().max(MAX_OTHER_LENGTH, `Your answer to ${quoted(question)} can be at most ${MAX_OTHER_LENGTH} characters.`))
  .transform(text => (text ? { kind: 'other' as const, text } : null))

const selectRule: AnswerRule<'select'> = question => z.union([choiceFrom(question), otherFor(question)])
const radioRule: AnswerRule<'radio'> = question => choiceFrom(question)
// Image answers arrive as files, not in the answers JSON. See parseAnswers.
const imageRule: AnswerRule<'image'> = () => z.unknown().transform(() => null)

const ANSWER_RULES: { [T in QuestionType]: AnswerRule<T> } = {
  text: textRule,
  email: emailRule,
  select: selectRule,
  radio: radioRule,
  image: imageRule,
}

const ruleFor = <T extends QuestionType>(question: QuestionOf<T>): ReturnType<AnswerRule<T>> =>
  (ANSWER_RULES[question.type] as AnswerRule<T>)(question)

// A follower who loaded the form before it changed may be missing a new question.
const missingMessage = (question: Question) => question.type === 'image'
  ? `Please add an image for ${quoted(question)}. If you can't see that question, reload the page: the form was updated.`
  : `Please answer ${quoted(question)}. If you can't see that question, reload the page: the form was updated.`

export type ParsedAnswer
  = | { question: Question, value: NonImageValue }
    | { question: QuestionOf<'image'>, value: { kind: 'image' } }

export type ParseAnswersResult = { success: true, answers: ParsedAnswer[] } | { success: false, message: string }

// Checks a submission against the form as it is now. Answers to questions the form no
// longer has are dropped. imageQuestionIds names the image questions a file came with.
export function parseAnswers(questions: Question[], submitted: SubmittedAnswers, imageQuestionIds: ReadonlySet<string>): ParseAnswersResult {
  const answers: ParsedAnswer[] = []
  for (const question of questions) {
    if (question.type === 'image') {
      if (imageQuestionIds.has(question.id)) answers.push({ question, value: { kind: 'image' } })
      else if (question.required) return { success: false, message: missingMessage(question) }
      continue
    }
    const raw = submitted[question.id]
    const parsed = raw === undefined ? { success: true as const, data: null } : ruleFor(question).safeParse(raw)
    if (!parsed.success) return { success: false, message: parsed.error.issues[0]?.message ?? missingMessage(question) }
    if (parsed.data) answers.push({ question, value: parsed.data })
    else if (question.required) return { success: false, message: missingMessage(question) }
  }
  return { success: true, answers }
}
