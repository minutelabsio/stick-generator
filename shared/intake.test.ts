import { describe, expect, it } from 'vitest'
import { cleanText, IntakeSettings, parseAnswers, Question } from './intake'

const question = (fields: Record<string, unknown>) => Question.parse({ label: 'A question', ...fields })

const HAIR = question({ id: 'hair', type: 'text', label: 'Your hair', required: true, maxLength: 20 })
const CONTACT = question({ id: 'contact', type: 'email', label: 'Partner\'s email' })
const COLOUR = question({ id: 'colour', type: 'select', label: 'Favourite colour', options: ['Red', 'Blue'], allowOther: true })
const SIZE = question({ id: 'size', type: 'radio', label: 'Mug size', options: ['Small', 'Large'], required: true })
const PET = question({ id: 'pet', type: 'image', label: 'Your pet', required: true })

const NO_IMAGES = new Set<string>()

describe('cleanText', () => {
  it('drops invisible characters that could hide or disguise text', () => {
    const disguised = `Ad${String.fromCodePoint(0x00)}a${String.fromCodePoint(0x20_2E, 0x20_0F)}`

    expect(cleanText(disguised, { multiline: false })).toBe('Ada')
  })

  it('keeps line breaks only where the field is multi-line', () => {
    expect(cleanText('one\r\ntwo', { multiline: true })).toBe('one\ntwo')
    expect(cleanText('one\r\ntwo', { multiline: false })).toBe('one two')
  })
})

describe('parseAnswers', () => {
  it('keeps each answer with a copy of its question, in form order', () => {
    const result = parseAnswers([HAIR, SIZE], { size: 'Large', hair: ' Curly ' }, NO_IMAGES)

    expect(result).toEqual({
      success: true,
      answers: [
        { question: HAIR, value: { kind: 'text', text: 'Curly' } },
        { question: SIZE, value: { kind: 'choice', choice: 'Large' } },
      ],
    })
  })

  // Rendering is always as text, so markup is harmless and kept as typed.
  it('stores markup as plain text rather than rejecting or interpreting it', () => {
    const result = parseAnswers([HAIR], { hair: '<b>bold</b>' }, NO_IMAGES)

    expect(result.success && result.answers[0]?.value).toEqual({ kind: 'text', text: '<b>bold</b>' })
  })

  it('refuses an option that is not in the list', () => {
    const result = parseAnswers([SIZE], { size: 'Huge' }, NO_IMAGES)

    expect(result).toEqual({ success: false, message: 'Pick one of the listed options for “Mug size”.' })
  })

  it('accepts "Other" only where the question allows it', () => {
    const noOther = question({ id: 'shape', type: 'select', options: ['Round'], allowOther: false })

    expect(parseAnswers([COLOUR], { colour: { other: 'Teal' } }, NO_IMAGES))
      .toEqual({ success: true, answers: [{ question: COLOUR, value: { kind: 'other', text: 'Teal' } }] })
    expect(parseAnswers([noOther], { shape: { other: 'Square' } }, NO_IMAGES).success).toBe(false)
  })

  it('refuses an answer longer than the question allows', () => {
    const result = parseAnswers([HAIR], { hair: 'x'.repeat(21) }, NO_IMAGES)

    expect(result).toEqual({ success: false, message: '“Your hair” can be at most 20 characters.' })
  })

  it('refuses an invalid email address', () => {
    expect(parseAnswers([CONTACT], { contact: 'not-an-email' }, NO_IMAGES).success).toBe(false)
  })

  it('refuses a missing required answer, pointing at a changed form', () => {
    const result = parseAnswers([HAIR], {}, NO_IMAGES)

    expect(result).toEqual({
      success: false,
      message: 'Please answer “Your hair”. If you can\'t see that question, reload the page: the form was updated.',
    })
  })

  it('treats a blank optional answer as unanswered', () => {
    expect(parseAnswers([CONTACT], { contact: '  ' }, NO_IMAGES)).toEqual({ success: true, answers: [] })
  })

  it('drops answers to questions the form no longer has', () => {
    const result = parseAnswers([SIZE], { size: 'Small', removed: 'anything' }, NO_IMAGES)

    expect(result.success && result.answers.map(answer => answer.question.id)).toEqual(['size'])
  })

  it('needs a file for a required image question', () => {
    expect(parseAnswers([PET], {}, NO_IMAGES).success).toBe(false)
    expect(parseAnswers([PET], {}, new Set(['pet'])))
      .toEqual({ success: true, answers: [{ question: PET, value: { kind: 'image' } }] })
  })
})

describe('IntakeSettings', () => {
  it('refuses more than three image questions', () => {
    const images = ['a', 'b', 'c', 'd'].map(id => ({ id, type: 'image', label: `Image ${id}` }))

    expect(IntakeSettings.safeParse({ questions: images }).success).toBe(false)
  })

  it('refuses two questions with the same id', () => {
    const questions = [{ id: 'same', type: 'email', label: 'One' }, { id: 'same', type: 'email', label: 'Two' }]

    expect(IntakeSettings.safeParse({ questions }).success).toBe(false)
  })

  it('refuses a choice question with a repeated option', () => {
    const questions = [{ id: 'size', type: 'radio', label: 'Size', options: ['Small', 'Small'] }]

    expect(IntakeSettings.safeParse({ questions }).success).toBe(false)
  })

  // Followers click this link, so it must never be able to run script.
  it('accepts only https links for the thank-you button', () => {
    const withUrl = (thankYouLinkUrl: string) => IntakeSettings.safeParse({ thankYouLinkLabel: 'Shop', thankYouLinkUrl }).success

    expect(withUrl('https://shop.example.com/mugs')).toBe(true)
    expect(withUrl('javascript:alert(1)')).toBe(false)
    expect(withUrl('http://shop.example.com')).toBe(false)
  })

  it('refuses a thank-you button with only a label or only a link', () => {
    expect(IntakeSettings.safeParse({ thankYouLinkLabel: 'Shop' }).success).toBe(false)
    expect(IntakeSettings.safeParse({ thankYouLinkUrl: 'https://shop.example.com' }).success).toBe(false)
  })
})
