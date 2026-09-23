import { env } from 'cloudflare:workers'
import { describe, expect, it } from 'vitest'

// The schema's CHECK constraints are the last line of defence for data integrity,
// so prove a representative few actually reject bad writes.

const GROUP_ID = 'group-1'

async function insertGroup() {
  await env.DB
    .prepare('INSERT INTO groups (id, slug, name, source) VALUES (?, ?, ?, ?) ON CONFLICT DO NOTHING')
    .bind(GROUP_ID, 'group-1', 'Group 1', 'manual')
    .run()
}

describe('schema constraints', () => {
  it('rejects an unknown entry status', async () => {
    await insertGroup()
    const insert = env.DB
      .prepare('INSERT INTO entries (id, group_id, status) VALUES (?, ?, ?)')
      .bind('entry-1', GROUP_ID, 'bogus')

    await expect(insert.run()).rejects.toThrow(/CHECK constraint failed/)
  })

  it('rejects an open batch without a submission window', async () => {
    const insert = env.DB
      .prepare('INSERT INTO groups (id, slug, name, source, join_code) VALUES (?, ?, ?, ?, ?)')
      .bind('group-2', 'group-2', 'Group 2', 'intake', 'ABCD-EFGH-JKMN')

    await expect(insert.run()).rejects.toThrow(/CHECK constraint failed/)
  })

  it('rejects an allowlist email that is not normalised', async () => {
    await insertGroup()
    const insert = env.DB
      .prepare('INSERT INTO batch_allowlist (group_id, email) VALUES (?, ?)')
      .bind(GROUP_ID, ' Someone@Example.com')

    await expect(insert.run()).rejects.toThrow(/CHECK constraint failed/)
  })
})
