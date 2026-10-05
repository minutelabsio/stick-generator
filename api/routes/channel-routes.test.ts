import { env } from 'cloudflare:workers'
import { beforeAll, describe, expect, it } from 'vitest'
import type { ChannelSummary, Library } from '../../shared/api-types'
import type { IntakeSettings } from '../../shared/intake'
import { STICK_RIG } from '../../shared/stick-rig'
import { createTestAccessKeys } from '../../test/access-tokens'
import { insertAsset, insertChannel } from '../../test/fixtures'
import { createApp } from '../app'

const ORIGIN = 'https://stick.example.com'
const CHANNEL_A = 'channel-a'
const CHANNEL_B = 'channel-b'

let send: (path: string, init?: RequestInit) => Response | Promise<Response>

beforeAll(async () => {
  const { resolveKeys, sign } = await createTestAccessKeys()
  const app = createApp({ resolveAccessKeys: resolveKeys })
  const token = await sign()
  send = (path, init = {}) => app.request(`${ORIGIN}/api${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', 'Cf-Access-Jwt-Assertion': token },
  }, env)

  await insertChannel(CHANNEL_A)
  await insertChannel(CHANNEL_B)
})

const createBatch = (channelId: string, name: string) => send(`/channels/${channelId}/batches`, {
  method: 'POST',
  body: JSON.stringify({ name, closesAt: '2030-01-01T00:00:00.000Z', maxSubmissions: null }),
})

const listBatchNames = async (channelId: string) => {
  const batches = await (await send(`/channels/${channelId}/batches`)).json<{ name: string }[]>()
  return batches.map(batch => batch.name)
}

describe('channel-scoped batches', () => {
  it('lists only the batches created in that channel', async () => {
    await createBatch(CHANNEL_A, 'Batch in A')
    await createBatch(CHANNEL_B, 'Batch in B')

    expect(await listBatchNames(CHANNEL_A)).toEqual(['Batch in A'])
    expect(await listBatchNames(CHANNEL_B)).toEqual(['Batch in B'])
  })

  it('says which channel a batch belongs to', async () => {
    const { id } = await (await createBatch(CHANNEL_B, 'Another in B')).json<{ id: string }>()

    const batch = await (await send(`/batches/${id}`)).json<{ channelId: string }>()

    expect(batch.channelId).toBe(CHANNEL_B)
  })

  it('refuses to create a batch in a channel that does not exist', async () => {
    const response = await createBatch('no-such-channel', 'Orphan')

    expect(response.status).toBe(404)
  })
})

describe('channel-scoped library', () => {
  it('holds only that channel\'s assets and palettes, with its rig', async () => {
    await insertAsset({ id: 'hair-in-a', channelId: CHANNEL_A, slot: 'hair' })
    await insertAsset({ id: 'hair-in-b', channelId: CHANNEL_B, slot: 'hair' })
    await env.DB.batch([
      env.DB.prepare(`INSERT INTO palettes (channel_id, id, colors) VALUES (?, 'hair', '["#AAAAAA"]')`).bind(CHANNEL_A),
      env.DB.prepare(`INSERT INTO palettes (channel_id, id, colors) VALUES (?, 'hair', '["#BBBBBB"]')`).bind(CHANNEL_B),
    ])

    const library = await (await send(`/channels/${CHANNEL_A}/library`)).json<Library>()

    expect(library.assets.map(asset => asset.id)).toEqual(['hair-in-a'])
    expect(library.palettes.hair).toEqual(['#AAAAAA'])
    expect(library.rig.slots.length).toBeGreaterThan(0)
  })
})

describe('creating a channel', () => {
  const createChannel = (body: unknown) => send('/channels', { method: 'POST', body: JSON.stringify(body) })

  it('adds it to the list, drawing with the stick rig and an empty library', async () => {
    const created = await (await createChannel({ name: 'Fresh', slug: 'fresh' })).json<ChannelSummary>()

    const channels = await (await send('/channels')).json<ChannelSummary[]>()
    const library = await (await send(`/channels/${created.id}/library`)).json<Library>()

    expect(channels).toContainEqual(created)
    expect(library.rig).toEqual(STICK_RIG)
    expect(library.assets).toEqual([])
  })

  it('refuses an address another channel already uses', async () => {
    await createChannel({ name: 'Taken', slug: 'taken' })

    const response = await createChannel({ name: 'Also taken', slug: 'taken' })

    expect(response.status).toBe(409)
  })

  it('refuses an address that would not work in a URL', async () => {
    const response = await createChannel({ name: 'Spaces', slug: 'has spaces' })

    expect(response.status).toBe(400)
  })
})

describe('channel intake settings', () => {
  const putIntake = (body: unknown) => send(`/channels/${CHANNEL_A}/intake`, { method: 'PUT', body: JSON.stringify(body) })

  it('saves the form whole and serves it back cleaned', async () => {
    await putIntake({
      instructions: 'Line one\r\nLine two',
      questions: [{ id: 'size', type: 'select', label: ' Mug size ', options: ['Small', 'Large'], allowOther: true }],
      thankYouMessage: 'Thanks!',
    })

    const intake = await (await send(`/channels/${CHANNEL_A}/intake`)).json<IntakeSettings>()

    expect(intake.instructions).toBe('Line one\nLine two')
    expect(intake.questions).toEqual([expect.objectContaining({ id: 'size', label: 'Mug size', allowOther: true, required: false })])
    expect(intake.thankYouMessage).toBe('Thanks!')
  })

  it('refuses a form that asks for more than three images', async () => {
    const images = ['a', 'b', 'c', 'd'].map(id => ({ id, type: 'image', label: `Image ${id}` }))

    const response = await putIntake({ questions: images })

    expect(response.status).toBe(400)
  })
})
