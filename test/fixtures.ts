import { env } from 'cloudflare:workers'
import { STICK_RIG } from '../shared/stick-rig'

export const TEST_CHANNEL_ID = 'test-channel'

// Every batch, asset, and palette belongs to a channel, so most tests need one first.
// The intake settings are stored as given, like a hand-edited row would be.
export async function insertChannel(id = TEST_CHANNEL_ID, intake: object = {}) {
  await env.DB
    .prepare('INSERT INTO channels (id, slug, name, rig, intake) VALUES (?, ?, ?, ?, ?) ON CONFLICT DO NOTHING')
    .bind(id, id, `Channel ${id}`, JSON.stringify(STICK_RIG), JSON.stringify(intake))
    .run()
}

export async function insertAsset({ id, channelId = TEST_CHANNEL_ID, slot }: { id: string, channelId?: string, slot: string }) {
  await env.DB
    .prepare('INSERT INTO assets (id, channel_id, slot, label, parts) VALUES (?, ?, ?, ?, ?) ON CONFLICT DO NOTHING')
    .bind(id, channelId, slot, id, JSON.stringify({ line: `v2/assets/${id}/line-r1.png` }))
    .run()
}
