import { env } from 'cloudflare:workers'
import { describe, expect, it } from 'vitest'
import { insertChannel, TEST_CHANNEL_ID } from '../test/fixtures'

// The schema's CHECK constraints are the last line of defence for data integrity,
// so prove a representative few actually reject bad writes.

const GROUP_ID = 'group-1'

async function insertGroup() {
  await insertChannel()
  await env.DB
    .prepare('INSERT INTO groups (id, channel_id, slug, name, source) VALUES (?, ?, ?, ?, ?) ON CONFLICT DO NOTHING')
    .bind(GROUP_ID, TEST_CHANNEL_ID, 'group-1', 'Group 1', 'manual')
    .run()
}

const insertPalette = (channelId: string, paletteId: string) => env.DB
  .prepare('INSERT INTO palettes (channel_id, id, colors) VALUES (?, ?, ?)')
  .bind(channelId, paletteId, '["#000000"]')

describe('schema constraints', () => {
  it('rejects an unknown entry status', async () => {
    await insertGroup()
    const insert = env.DB
      .prepare('INSERT INTO entries (id, group_id, status) VALUES (?, ?, ?)')
      .bind('entry-1', GROUP_ID, 'bogus')

    await expect(insert.run()).rejects.toThrow(/CHECK constraint failed/)
  })

  it('rejects a batch with a join link but no close date', async () => {
    await insertChannel()
    const insert = env.DB
      .prepare('INSERT INTO groups (id, channel_id, slug, name, source, join_code) VALUES (?, ?, ?, ?, ?, ?)')
      .bind('group-2', TEST_CHANNEL_ID, 'group-2', 'Group 2', 'intake', 'ABCD-EFGH-JKMN')

    await expect(insert.run()).rejects.toThrow(/CHECK constraint failed/)
  })

  it('rejects an allowlist email that is not normalised', async () => {
    await insertGroup()
    const insert = env.DB
      .prepare('INSERT INTO batch_allowlist (group_id, email) VALUES (?, ?)')
      .bind(GROUP_ID, ' Someone@Example.com')

    await expect(insert.run()).rejects.toThrow(/CHECK constraint failed/)
  })

  it('rejects a batch in a channel that does not exist', async () => {
    const insert = env.DB
      .prepare('INSERT INTO groups (id, channel_id, slug, name, source) VALUES (?, ?, ?, ?, ?)')
      .bind('group-3', 'no-such-channel', 'group-3', 'Group 3', 'manual')

    await expect(insert.run()).rejects.toThrow(/FOREIGN KEY constraint failed/)
  })

  it('lets two channels each have a palette with the same id', async () => {
    await insertChannel('channel-a')
    await insertChannel('channel-b')

    await insertPalette('channel-a', 'hair').run()
    await insertPalette('channel-b', 'hair').run()
    await expect(insertPalette('channel-a', 'hair').run()).rejects.toThrow(/UNIQUE constraint failed/)
  })

  it('rejects entry answers that are not a list', async () => {
    await insertGroup()
    const insert = env.DB
      .prepare('INSERT INTO entries (id, group_id, answers) VALUES (?, ?, ?)')
      .bind('entry-2', GROUP_ID, '{"hair":"Curly"}')

    await expect(insert.run()).rejects.toThrow(/CHECK constraint failed/)
  })

  it('rejects channel intake settings that are not an object', async () => {
    const insert = env.DB
      .prepare('INSERT INTO channels (id, slug, name, rig, intake) VALUES (?, ?, ?, ?, ?)')
      .bind('channel-c', 'channel-c', 'Channel C', '{}', '[]')

    await expect(insert.run()).rejects.toThrow(/CHECK constraint failed/)
  })

  it('rejects a batch switched on without a join link', async () => {
    await insertChannel()
    const insert = env.DB
      .prepare('INSERT INTO groups (id, channel_id, slug, name, source, is_open) VALUES (?, ?, ?, ?, ?, 1)')
      .bind('group-4', TEST_CHANNEL_ID, 'group-4', 'Group 4', 'manual')

    await expect(insert.run()).rejects.toThrow(/CHECK constraint failed/)
  })
})
