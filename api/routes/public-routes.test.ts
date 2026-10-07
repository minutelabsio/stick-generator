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
const SWITCHED_OFF_CODE = 'OFFF-BTCH-2345'
const FULL_CODE = 'FULL-BTCH-2345'
const LAST_PLACES_CODE = 'LAST-PLCS-2345'
const MILLISECONDS_PER_DAY = 1000 * 60 * 60 * 24
const JPEG_BYTES = new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10])

const INTAKE = {
  instructions: 'Send a clear photo.',
  questions: [
    { id: 'hair', type: 'text', label: 'Your hair', required: true },
    { id: 'size', type: 'radio', label: 'Mug size', options: ['Small', 'Large'] },
    { id: 'pet', type: 'image', label: 'Your pet' },
  ],
  thankYouLinkLabel: 'Visit the shop',
  thankYouLinkUrl: 'https://shop.example.com',
  contactEmail: 'team@example.com',
}

const app = createApp()

const daysFromNow = (days: number) => new Date(Date.now() + days * MILLISECONDS_PER_DAY).toISOString()
const jpeg = (name = 'me.jpg') => new File([JPEG_BYTES], name, { type: 'image/jpeg' })

interface TestBatch {
  id: string
  joinCode: string
  closesAt?: string
  isOpen?: boolean
  maxSubmissions?: number | null
}

async function insertBatch({ id, joinCode, closesAt = daysFromNow(7), isOpen = true, maxSubmissions = null }: TestBatch) {
  await env.DB
    .prepare(`INSERT INTO groups (id, channel_id, slug, name, source, join_code, is_open, closes_at, max_submissions)
              VALUES (?, ?, ?, ?, 'intake', ?, ?, ?, ?)`)
    .bind(id, CHANNEL_ID, id, `Batch ${id}`, joinCode, Number(isOpen), closesAt, maxSubmissions)
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
  await insertBatch({ id: 'open-batch', joinCode: OPEN_CODE })
  await insertBatch({ id: 'closed-batch', joinCode: CLOSED_CODE, closesAt: daysFromNow(-1) })
  await insertBatch({ id: 'switched-off-batch', joinCode: SWITCHED_OFF_CODE, isOpen: false })
  await insertBatch({ id: 'full-batch', joinCode: FULL_CODE, maxSubmissions: 1 })
  await insertBatch({ id: 'last-places-batch', joinCode: LAST_PLACES_CODE, maxSubmissions: 2 })
  await env.DB
    .prepare(`INSERT INTO entries (id, group_id, name, submitted_at) VALUES ('already-in', 'full-batch', 'Early', '2026-01-01T00:00:00.000Z')`)
    .run()
})

describe('public intake', () => {
  it('shows an open batch its channel\'s form, accepting codes typed loosely', async () => {
    const batch = await (await getBatch('open btch 2345')).json<JoinBatch>()

    expect(batch).toMatchObject({ state: 'open', channelName: `Channel ${CHANNEL_ID}`, instructions: 'Send a clear photo.' })
    expect(batch.questions.map(question => question.id)).toEqual(['hair', 'size', 'pet'])
    expect(batch.consentText).toBe(DEFAULT_CONSENT_TEXT)
    expect(batch.thankYouLink).toEqual({ label: 'Visit the shop', url: 'https://shop.example.com' })
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

  it.each([
    ['its close date has passed', CLOSED_CODE],
    ['the team has switched it off', SWITCHED_OFF_CODE],
  ])('shows a batch as closed and refuses submissions when %s', async (_label, joinCode) => {
    const batch = await (await getBatch(joinCode)).json<JoinBatch>()
    const response = await submit(joinCode, submissionForm())

    expect(batch.state).toBe('closed')
    expect(response.status).toBe(403)
  })

  it('shows a batch at its limit as full and refuses more', async () => {
    const batch = await (await getBatch(FULL_CODE)).json<JoinBatch>()
    const response = await submit(FULL_CODE, submissionForm({ email: 'too-late@example.com' }))

    expect(batch).toMatchObject({ state: 'full', batchName: 'Batch full-batch', contactEmail: 'team@example.com' })
    expect(response.status).toBe(409)
    expect(await entriesFor('too-late@example.com')).toEqual([])
  })

  // D1 can't lock, so only a single conditional insert keeps the limit exact.
  it('holds the limit when several people submit at the same moment', async () => {
    const responses = await Promise.all(Array.from({ length: 6 }, async (_, index) =>
      submit(LAST_PLACES_CODE, submissionForm({ email: `rush-${index}@example.com` }))))
    const stored = await env.DB
      .prepare(`SELECT count(*) AS count FROM entries WHERE group_id = 'last-places-batch'`)
      .first<{ count: number }>()

    expect(responses.filter(response => response.status === 201)).toHaveLength(2)
    expect(responses.filter(response => response.status === 409)).toHaveLength(4)
    expect(stored?.count).toBe(2)
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

  // Without Content-Length the size can only be known by counting what arrives.
  it('refuses an oversized upload that leaves out its Content-Length, without reading it all', async () => {
    const chunk = new Uint8Array(1024 * 1024)
    const chunksToSend = 64
    let chunksPulled = 0
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        chunksPulled += 1
        if (chunksPulled > chunksToSend) controller.close()
        else controller.enqueue(chunk)
      },
    })
    const response = await app.request(`${ORIGIN}/api/public/submission`, {
      method: 'POST',
      headers: { 'X-Join-Code': OPEN_CODE, 'Content-Type': 'multipart/form-data; boundary=x' },
      body,
    }, env)

    expect(response.status).toBe(413)
    expect(chunksPulled).toBeLessThan(chunksToSend)
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
