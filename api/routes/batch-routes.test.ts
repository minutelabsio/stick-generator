import { env } from 'cloudflare:workers'
import { beforeAll, describe, expect, it } from 'vitest'
import type { BatchDetail, JoinBatch } from '../../shared/api-types'
import { createTestAccessKeys } from '../../test/access-tokens'
import { insertChannel, TEST_CHANNEL_ID } from '../../test/fixtures'
import { createApp } from '../app'

const ORIGIN = 'https://stick.example.com'
const MILLISECONDS_PER_DAY = 1000 * 60 * 60 * 24

let send: (path: string, init?: RequestInit) => Response | Promise<Response>

const daysFromNow = (days: number) => new Date(Date.now() + days * MILLISECONDS_PER_DAY).toISOString()

beforeAll(async () => {
  const { resolveKeys, sign } = await createTestAccessKeys()
  const app = createApp({ resolveAccessKeys: resolveKeys })
  const token = await sign()
  send = (path, init = {}) => app.request(`${ORIGIN}/api${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', 'Cf-Access-Jwt-Assertion': token },
  }, env)
  await insertChannel()
})

async function createBatch(name = 'A batch') {
  const response = await send(`/channels/${TEST_CHANNEL_ID}/batches`, {
    method: 'POST',
    body: JSON.stringify({ name, closesAt: daysFromNow(14), maxSubmissions: null }),
  })
  const { id } = await response.json<{ id: string }>()
  return id
}

const patchBatch = (batchId: string, changes: unknown) => send(`/batches/${batchId}`, { method: 'PATCH', body: JSON.stringify(changes) })

const publicState = async (joinCode: string | null) => {
  const response = await createApp().request(`${ORIGIN}/api/public/batch`, { headers: { 'X-Join-Code': joinCode ?? '' } }, env)
  return (await response.json<JoinBatch>()).state
}

describe('batch settings', () => {
  it('starts a new batch switched off, so nobody can submit yet', async () => {
    const batch = await (await send(`/batches/${await createBatch()}`)).json<BatchDetail>()

    expect(batch).toMatchObject({ isOpen: false, intakeState: 'closed', maxSubmissions: null, submittedCount: 0 })
    expect(await publicState(batch.joinCode)).toBe('closed')
  })

  it('renames, switches on, and sets a limit, opening the join link', async () => {
    const batchId = await createBatch()

    const batch = await (await patchBatch(batchId, { name: 'Autumn supporters', isOpen: true, maxSubmissions: 60 })).json<BatchDetail>()

    expect(batch).toMatchObject({ name: 'Autumn supporters', isOpen: true, maxSubmissions: 60, intakeState: 'open' })
    expect(await publicState(batch.joinCode)).toBe('open')
  })

  it('removes the limit when it is cleared, and leaves it alone when not sent', async () => {
    const batchId = await createBatch()
    await patchBatch(batchId, { maxSubmissions: 10 })

    const renamed = await (await patchBatch(batchId, { name: 'Renamed' })).json<BatchDetail>()
    const cleared = await (await patchBatch(batchId, { maxSubmissions: null })).json<BatchDetail>()

    expect(renamed.maxSubmissions).toBe(10)
    expect(cleared.maxSubmissions).toBeNull()
  })

  it('refuses a close date in the past', async () => {
    const response = await patchBatch(await createBatch(), { closesAt: daysFromNow(-1) })

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'Pick a close date in the future. To stop submissions now, switch the batch off.' })
  })

  it('refuses to switch on a batch whose close date has passed', async () => {
    const batchId = await createBatch()
    await env.DB.prepare('UPDATE groups SET closes_at = ? WHERE id = ?').bind(daysFromNow(-1), batchId).run()

    const response = await patchBatch(batchId, { isOpen: true })

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'This batch\'s close date has passed. Pick a later close date to open it again.' })
  })

  it('reopens a batch past its date when a later date comes with the switch', async () => {
    const batchId = await createBatch()
    await env.DB.prepare('UPDATE groups SET closes_at = ? WHERE id = ?').bind(daysFromNow(-1), batchId).run()

    const batch = await (await patchBatch(batchId, { isOpen: true, closesAt: daysFromNow(3) })).json<BatchDetail>()

    expect(batch.intakeState).toBe('open')
  })
})

describe('rotating the join code', () => {
  it('kills the old link at once and opens the new one', async () => {
    const batchId = await createBatch()
    const before = await (await patchBatch(batchId, { isOpen: true })).json<BatchDetail>()

    const after = await (await send(`/batches/${batchId}/rotate-code`, { method: 'POST' })).json<BatchDetail>()

    expect(after.joinCode).not.toBe(before.joinCode)
    expect(await publicState(before.joinCode)).toBe('closed')
    expect(await publicState(after.joinCode)).toBe('open')
  })
})

describe('exporting responses as CSV', () => {
  const exportChannel = 'export-channel'
  const hair = { id: 'hair', type: 'text', label: 'Hair?' }
  const colour = { id: 'colour', type: 'select', label: 'Colour', options: ['Red'], allowOther: true }
  const pet = { id: 'pet', type: 'image', label: 'Your pet' }
  const snack = { id: 'snack', type: 'text', label: 'Favourite snack' }

  beforeAll(async () => {
    // Since these answers came in, "Hair?" was reworded and the snack question removed.
    await insertChannel(exportChannel, { questions: [{ ...hair, label: 'Describe your hair' }, colour, pet] })
    await env.DB.batch([
      env.DB.prepare(`INSERT INTO groups (id, channel_id, slug, name, source) VALUES ('export-batch', ?, 'export-batch', 'Export', 'manual')`)
        .bind(exportChannel),
      env.DB.prepare(`INSERT INTO entries (id, group_id, name, email, status, submitted_at, likeness_key, answers)
                      VALUES ('export-1', 'export-batch', ?, 'ada@example.com', 'new', '2026-09-01T10:00:00.000Z', 'v2/likeness/export-1-abcd1234.jpg', ?)`)
        .bind('=HYPERLINK("https://evil.example")', JSON.stringify([
          { question: hair, value: { kind: 'text', text: 'Curly, "very"\nand long' } },
          { question: colour, value: { kind: 'other', text: 'Teal' } },
          { question: pet, value: { kind: 'image', key: 'v2/answers/export-1/pet-ef567890.jpg' } },
          { question: snack, value: { kind: 'text', text: 'Pretzels' } },
        ])),
      env.DB.prepare(`INSERT INTO entries (id, group_id, name, status, submitted_at) VALUES ('export-2', 'export-batch', 'Grace', 'skipped', '2026-09-02T10:00:00.000Z')`),
    ])
  })

  it('downloads every entry with a column per question asked, current form first', async () => {
    const response = await send('/batches/export-batch/export.csv')
    const bytes = new Uint8Array(await response.arrayBuffer())
    // Decoding drops the byte-order mark, so check for it in the raw bytes.
    const csv = new TextDecoder().decode(bytes)

    expect(response.headers.get('Content-Type')).toBe('text/csv; charset=utf-8')
    expect(response.headers.get('Content-Disposition')).toBe('attachment; filename="export-batch-responses.csv"')
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect([...bytes.slice(0, 3)]).toEqual([0xEF, 0xBB, 0xBF])
    expect(csv.split('\r\n')).toEqual([
      '"Name","Email","Status","Submitted","Photo","Describe your hair","Colour","Your pet","Favourite snack"',
      `"'=HYPERLINK(""https://evil.example"")","ada@example.com","new","2026-09-01T10:00:00.000Z","likeness/export-1-abcd1234.jpg",`
      + '"Curly, ""very""\nand long","Other: Teal","answers/export-1/pet-ef567890.jpg","Pretzels"',
      '"Grace","","skipped","2026-09-02T10:00:00.000Z","","","","",""',
      '',
    ])
  })

  it('answers 404 for a batch that does not exist', async () => {
    const response = await send('/batches/no-such-batch/export.csv')

    expect(response.status).toBe(404)
  })
})
