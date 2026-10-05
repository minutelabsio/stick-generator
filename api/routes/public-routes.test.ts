import { env } from 'cloudflare:workers'
import { beforeAll, describe, expect, it } from 'vitest'
import type { JoinBatch } from '../../shared/api-types'
import { DEFAULT_CONSENT_TEXT } from '../../shared/intake'
import type { StoredAnswer } from '../../shared/intake'
import { insertChannel } from '../../test/fixtures'
import { createApp } from '../app'

const ORIGIN = 'https://stick.example.com'
const CHANNEL_ID = 'public-routes-channel'
const OPEN_CODE = 'OPEN-BTCH-2345'
const CLOSED_CODE = 'CLSD-BTCH-2345'
const MILLISECONDS_PER_DAY = 1000 * 60 * 60 * 24
const JPEG_BYTES = new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10])

const INTAKE = {
  instructions: 'Send a clear photo.',
  questions: [
    { id: 'hair', type: 'text', label: 'Your hair', required: true },
    { id: 'size', type: 'radio', label: 'Mug size', options: ['Small', 'Large'] },
    { id: 'pet', type: 'image', label: 'Your pet' },
  ],
  contactEmail: 'team@example.com',
}

const app = createApp()

const daysFromNow = (days: number) => new Date(Date.now() + days * MILLISECONDS_PER_DAY).toISOString()
const jpeg = (name = 'me.jpg') => new File([JPEG_BYTES], name, { type: 'image/jpeg' })

async function insertBatch({ id, joinCode, closesAt }: { id: string, joinCode: string, closesAt: string }) {
  await env.DB
    .prepare(`INSERT INTO groups (id, channel_id, slug, name, source, join_code, opens_at, closes_at)
              VALUES (?, ?, ?, ?, 'intake', ?, ?, ?)`)
    .bind(id, CHANNEL_ID, id, `Batch ${id}`, joinCode, daysFromNow(-7), closesAt)
    .run()
}

function submissionForm(overrides: Record<string, string | Blob> = {}) {
  const form = new FormData()
  const fields = {
    name: 'Ada',
    email: 'Ada@Example.com',
    answers: JSON.stringify({ hair: 'Curly', size: 'Large' }),
    consent: 'true',
    photo: jpeg(),
    ...overrides,
  }
  Object.entries(fields).forEach(([key, value]) => form.append(key, value))
  return form
}

const submit = (joinCode: string, form: FormData) =>
  app.request(`${ORIGIN}/api/public/submission`, { method: 'POST', headers: { 'X-Join-Code': joinCode }, body: form }, env)

const getBatch = (joinCode: string) =>
  app.request(`${ORIGIN}/api/public/batch`, { headers: { 'X-Join-Code': joinCode } }, env)

const entriesFor = async (email: string) => {
  const rows = await env.DB
    .prepare('SELECT answers, likeness_key, consent_text, status FROM entries WHERE email = ? ORDER BY submitted_at')
    .bind(email)
    .all<{ answers: string, likeness_key: string, consent_text: string, status: string }>()
  return rows.results.map(row => ({ ...row, answers: JSON.parse(row.answers) as StoredAnswer[] }))
}

beforeAll(async () => {
  await insertChannel(CHANNEL_ID, INTAKE)
  await insertBatch({ id: 'open-batch', joinCode: OPEN_CODE, closesAt: daysFromNow(7) })
  await insertBatch({ id: 'closed-batch', joinCode: CLOSED_CODE, closesAt: daysFromNow(-1) })
})

describe('public intake', () => {
  it('shows an open batch its channel\'s form, accepting codes typed loosely', async () => {
    const batch = await (await getBatch('open btch 2345')).json<JoinBatch>()

    expect(batch).toMatchObject({ state: 'open', channelName: `Channel ${CHANNEL_ID}`, instructions: 'Send a clear photo.' })
    expect(batch.questions.map(question => question.id)).toEqual(['hair', 'size', 'pet'])
    expect(batch.consentText).toBe(DEFAULT_CONSENT_TEXT)
  })

  // The closed message names the contact email, which an unknown code can't know.
  it('answers an unknown code like a closed batch, apart from the contact email', async () => {
    const unknown = await (await getBatch('NOPE-NOPE-NOPE')).json()
    const closed = await (await getBatch(CLOSED_CODE)).json()

    expect(unknown).toEqual({ ...closed as object, contactEmail: null })
  })

  it('stores each answer beside a copy of its question, with the photo in R2', async () => {
    const response = await submit(OPEN_CODE, submissionForm({ email: 'copies@example.com' }))
    const [entry] = await entriesFor('copies@example.com')

    expect(response.status).toBe(201)
    expect(entry?.answers).toEqual([
      { question: expect.objectContaining({ id: 'hair', label: 'Your hair', type: 'text' }), value: { kind: 'text', text: 'Curly' } },
      { question: expect.objectContaining({ id: 'size', options: ['Small', 'Large'] }), value: { kind: 'choice', choice: 'Large' } },
    ])
    expect(entry?.consent_text).toBe(DEFAULT_CONSENT_TEXT)
    expect(await env.FIGURE_BUCKET.head(entry?.likeness_key ?? '')).not.toBeNull()
  })

  it('takes a second submission from the same email as a separate entry', async () => {
    await submit(OPEN_CODE, submissionForm({ email: 'twice@example.com', answers: JSON.stringify({ hair: 'Mine' }) }))
    await submit(OPEN_CODE, submissionForm({ email: 'twice@example.com', answers: JSON.stringify({ hair: 'My partner\'s' }) }))

    const entries = await entriesFor('twice@example.com')

    expect(entries.map(entry => entry.answers[0]?.value)).toEqual([
      { kind: 'text', text: 'Mine' },
      { kind: 'text', text: 'My partner\'s' },
    ])
  })

  it('stores an image answer under a key of its own choosing', async () => {
    const response = await submit(OPEN_CODE, submissionForm({ 'email': 'pet@example.com', 'image:pet': jpeg('../../evil.jpg') }))
    const [entry] = await entriesFor('pet@example.com')
    const petAnswer = entry?.answers.find(answer => answer.question.id === 'pet')
    const key = petAnswer?.value.kind === 'image' ? petAnswer.value.key : ''

    expect(response.status).toBe(201)
    expect(key).toMatch(/^v2\/answers\/[0-9a-f-]+\/pet-[0-9a-f]{8}\.jpg$/)
    expect(await env.FIGURE_BUCKET.head(key)).not.toBeNull()
  })

  it('refuses an image answer that is not really an image, storing nothing', async () => {
    const disguised = new File([new TextEncoder().encode('<script>')], 'pet.jpg', { type: 'image/jpeg' })
    const response = await submit(OPEN_CODE, submissionForm({ 'email': 'fake-pet@example.com', 'image:pet': disguised }))

    expect(response.status).toBe(415)
    expect(await response.json()).toEqual({ error: 'We couldn\'t read the image for “Your pet”. Please use a JPEG, PNG, or WebP image.' })
    expect(await entriesFor('fake-pet@example.com')).toEqual([])
  })

  it('refuses an answer the form does not allow, saying which', async () => {
    const response = await submit(OPEN_CODE, submissionForm({ answers: JSON.stringify({ hair: 'Curly', size: 'Huge' }) }))

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'Pick one of the listed options for “Mug size”.' })
  })

  it('rejects submissions to a closed batch', async () => {
    const response = await submit(CLOSED_CODE, submissionForm())

    expect(response.status).toBe(403)
  })

  it('rejects a photo that is not really an image', async () => {
    const disguised = new File([new TextEncoder().encode('<script>')], 'me.jpg', { type: 'image/jpeg' })
    const response = await submit(OPEN_CODE, submissionForm({ photo: disguised }))

    expect(response.status).toBe(415)
  })

  it('rejects an oversized request before reading it', async () => {
    const response = await app.request(`${ORIGIN}/api/public/submission`, {
      method: 'POST',
      headers: { 'X-Join-Code': OPEN_CODE, 'Content-Length': String(100 * 1024 * 1024) },
      body: 'x',
    }, env)

    expect(response.status).toBe(413)
  })

  it.each([
    ['consent is missing', { consent: 'false' }],
    ['answers are not JSON', { answers: 'not json' }],
    ['email is invalid', { email: 'nope' }],
    ['name is only invisible characters', { name: String.fromCodePoint(0x20_2E, 0x00) }],
  ])('rejects the form when %s', async (_label, overrides) => {
    const response = await submit(OPEN_CODE, submissionForm(overrides))

    expect(response.status).toBe(400)
  })
})
