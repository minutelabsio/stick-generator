import { describe, expect, it } from 'vitest'
import { Question } from '@shared/intake'
import { OTHER_CHOICE, toSubmittedAnswers } from './join-answers'

const QUESTIONS = [
  Question.parse({ id: 'hair', type: 'text', label: 'Hair' }),
  Question.parse({ id: 'colour', type: 'select', label: 'Colour', options: ['Red'], allowOther: true }),
  Question.parse({ id: 'pet', type: 'image', label: 'Pet' }),
]

describe('toSubmittedAnswers', () => {
  it('sends "Other" as its typed text and leaves out blanks and images', () => {
    const answers = { hair: '', colour: OTHER_CHOICE, pet: 'ignored' }

    expect(toSubmittedAnswers(QUESTIONS, answers, { colour: 'Teal' })).toEqual({ colour: { other: 'Teal' } })
  })

  it('sends a picked option as itself', () => {
    expect(toSubmittedAnswers(QUESTIONS, { hair: 'Curly', colour: 'Red' }, {})).toEqual({ hair: 'Curly', colour: 'Red' })
  })
})
