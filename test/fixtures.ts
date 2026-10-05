import { env } from 'cloudflare:workers'
import { STICK_RIG } from '../shared/stick-rig'

export const TEST_CHANNEL_ID = 'test-channel'

// Every batch, asset, and palette belongs to a channel, so most tests need one first.
export async function insertChannel(id = TEST_CHANNEL_ID) {
  await env.DB
    .prepare('INSERT INTO channels (id, slug, name, rig) VALUES (?, ?, ?, ?) ON CONFLICT DO NOTHING')
    .bind(id, id, `Channel ${id}`, JSON.stringify(STICK_RIG))
    .run()
}
