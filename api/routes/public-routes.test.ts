import { env } from 'cloudflare:workers'
import { beforeAll, describe, expect, it } from 'vitest'
import { insertChannel, TEST_CHANNEL_ID } from '../../test/fixtures'
import { createApp } from '../app'

const ORIGIN = 'https://stick.example.com'
const OPEN_CODE = 'OPEN-BTCH-2345'
const CLOSED_CODE = 'CLSD-BTCH-2345'
const MILLISECONDS_PER_DAY = 1000 * 60 * 60 * 24
const JPEG_BYTES = new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10])

const app = createApp()

const daysFromNow = (days: number) => new Date(Date.now() + days * MILLISECONDS_PER_DAY).toISOString()

async function insertBatch({ id, joinCode, closesAt }: { id: string, joinCode: string, closesAt: string }) {
  await env.DB
    .prepare(`INSERT INTO groups (id, channel_id, slug, name, source, questions, join_code, opens_at, closes_at)
              VALUES (?, ?, ?, ?, 'intake', ?, ?, ?, ?)`)
    .bind(id, TEST_CHANNEL_ID, id, `Batch ${id}`, '[{"id":"q1","label":"Hair?","required":false,"highlight":true}]', joinCode, daysFromNow(-7), closesAt)
    .run()
}

function submissionForm(overrides: Record<string, string | Blob> = {}) {
  const form = new FormData()
  const fields = {
    name: 'Ada',
    email: 'Ada@Example.com',
    answers: JSON.stringify({ q1: 'Curly' }),
    consent: 'true',
    photo: new File([JPEG_BYTES], 'me.jpg', { type: 'image/jpeg' }),
    ...overrides,
  }
  Object.entries(fields).forEach(([key, value]) => form.append(key, value))
  return form
}

const submit = (joinCode: string, form: FormData) =>
  app.request(`${ORIGIN}/api/public/submission`, { method: 'POST', headers: { 'X-Join-Code': joinCode }, body: form }, env)

const getBatch = (joinCode: string) =>
  app.request(`${ORIGIN}/api/public/batch`, { headers: { 'X-Join-Code': joinCode } }, env)

beforeAll(async () => {
  await insertChannel()
  await insertBatch({ id: 'open-batch', joinCode: OPEN_CODE, closesAt: daysFromNow(7) })
  await insertBatch({ id: 'closed-batch', joinCode: CLOSED_CODE, closesAt: daysFromNow(-1) })
})

describe('public intake', () => {
  it('shows an open batch its questions, accepting codes typed loosely', async () => {
    const response = await getBatch('open btch 2345')
    const batch = await response.json<{ state: string, questions: unknown[] }>()

    expect(batch.state).toBe('open')
    expect(batch.questions).toHaveLength(1)
  })

  it('answers an unknown code exactly like a closed batch', async () => {
    const unknown = await (await getBatch('NOPE-NOPE-NOPE')).json()
    const closed = await (await getBatch(CLOSED_CODE)).json()

    expect(unknown).toEqual(closed)
  })

  it('creates an entry with the photo stored in R2', async () => {
    const response = await submit(OPEN_CODE, submissionForm())
    const entry = await env.DB
      .prepare('SELECT email, answers, likeness_key, status FROM entries WHERE group_id = ?')
      .bind('open-batch')
      .first<{ email: string, answers: string, likeness_key: string, status: string }>()

    expect(response.status).toBe(201)
    expect(entry).toMatchObject({ email: 'ada@example.com', status: 'new' })
    expect(JSON.parse(entry?.answers ?? '{}')).toEqual({ q1: 'Curly' })
    expect(await env.FIGURE_BUCKET.head(entry?.likeness_key ?? '')).not.toBeNull()
  })

  it('rejects submissions to a closed batch', async () => {
    const response = await submit(CLOSED_CODE, submissionForm())

    expect(response.status).toBe(403)
  })

  it('rejects a file that is not really an image', async () => {
    const disguised = new File([new TextEncoder().encode('<script>')], 'me.jpg', { type: 'image/jpeg' })
    const response = await submit(OPEN_CODE, submissionForm({ photo: disguised }))

    expect(response.status).toBe(415)
  })

  it.each([
    ['consent is missing', { consent: 'false' }],
    ['answers are not JSON', { answers: 'not json' }],
    ['email is invalid', { email: 'nope' }],
  ])('rejects the form when %s', async (_label, overrides) => {
    const response = await submit(OPEN_CODE, submissionForm(overrides))

    expect(response.status).toBe(400)
  })
})
