import { env } from 'cloudflare:workers'
import { beforeAll, describe, expect, it } from 'vitest'
import { createTestAccessKeys } from '../../test/access-tokens'
import { insertChannel, TEST_CHANNEL_ID } from '../../test/fixtures'
import { createApp } from '../app'

const ORIGIN = 'https://stick.example.com'
const ENTRY_ID = 'entry-routes-entry'

let patchFigure: (figure: unknown) => Response | Promise<Response>

beforeAll(async () => {
  const { resolveKeys, sign } = await createTestAccessKeys()
  const app = createApp({ resolveAccessKeys: resolveKeys })
  const token = await sign()
  patchFigure = figure => app.request(`${ORIGIN}/api/entries/${ENTRY_ID}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Cf-Access-Jwt-Assertion': token },
    body: JSON.stringify({ figure }),
  }, env)

  await insertChannel()
  await env.DB.batch([
    env.DB.prepare(`INSERT INTO groups (id, channel_id, slug, name, source) VALUES ('entry-routes-batch', ?, 'entry-routes-batch', 'Batch', 'manual')`)
      .bind(TEST_CHANNEL_ID),
    env.DB.prepare(`INSERT INTO entries (id, group_id, name) VALUES (?, 'entry-routes-batch', 'Ada')`).bind(ENTRY_ID),
  ])
})

describe('PATCH /api/entries/:id', () => {
  it('saves a figure that uses the rig\'s slots and colour roles', async () => {
    const response = await patchFigure({ assets: { hair: 'some-hair' }, colors: { facialHair: '#123456' } })

    expect(response.status).toBe(200)
  })

  // A stale editor must not save parts the renderer would silently drop.
  it('refuses a slot or colour role the rig does not have, saying which', async () => {
    const response = await patchFigure({ assets: { wings: 'feathers' }, colors: { gold: '#FFD700' } })

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({
      error: 'This figure uses slot "wings" and colour role "gold", which the editor no longer offers. Reload the editor and try again.',
    })
  })
})
