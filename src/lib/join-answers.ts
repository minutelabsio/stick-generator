import type { Question, SubmittedAnswers } from '@shared/intake'

// Stands for "Other…" in a drop-down. Options are cleaned of control characters when
// saved, so no real option can ever equal it.
export const OTHER_CHOICE = `${String.fromCodePoint(0)}other`

// Keyed by question id. A choice question holds the option picked, or OTHER_CHOICE.
export type AnswerDrafts = Record<string, string | undefined>

// Shapes what the follower filled in the way the server reads it. Image answers travel
// as files, so they are not part of this.
export function toSubmittedAnswers(questions: Question[], answers: AnswerDrafts, others: AnswerDrafts): SubmittedAnswers {
  return Object.fromEntries(questions.flatMap((question): [string, SubmittedAnswers[string]][] => {
    const value = answers[question.id]
    if (question.type === 'image' || !value) return []
    if (value === OTHER_CHOICE) return [[question.id, { other: others[question.id] ?? '' }]]
    return [[question.id, value]]
  }))
}
