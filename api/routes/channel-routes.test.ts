import { env } from 'cloudflare:workers'
import { beforeAll, describe, expect, it } from 'vitest'
import { createTestAccessKeys } from '../../test/access-tokens'
import { insertChannel } from '../../test/fixtures'
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
  body: JSON.stringify({ name, closesAt: '2030-01-01T00:00:00.000Z', questionLabels: [] }),
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
