import { Rig } from '../../shared/rig'
import type { ChannelSummary, CreateChannelRequest } from '../../shared/api-types'
import { httpError } from '../http-errors'

interface ChannelRow {
  id: string
  slug: string
  name: string
  rig: string
}

export interface Channel extends ChannelSummary {
  rig: Rig
}

interface NewChannel extends CreateChannelRequest {
  rig: Rig
}

export function createChannelService(db: D1Database) {
  return {
    async list(): Promise<ChannelSummary[]> {
      const rows = await db
        .prepare('SELECT id, slug, name FROM channels WHERE archived_at IS NULL ORDER BY name')
        .all<Omit<ChannelRow, 'rig'>>()
      return rows.results.map(toChannelSummary)
    },

    async get(channelId: string): Promise<Channel | null> {
      const row = await db.prepare('SELECT id, slug, name, rig FROM channels WHERE id = ?').bind(channelId).first<ChannelRow>()
      if (!row) return null
      // Parsed on every read so a hand-edited rig fails loudly instead of drawing wrongly.
      return { ...toChannelSummary(row), rig: Rig.parse(JSON.parse(row.rig)) }
    },

    // A taken slug is caught by the insert itself, so two people creating the same
    // channel at once can't both succeed.
    async create({ name, slug, rig }: NewChannel): Promise<ChannelSummary> {
      const id = crypto.randomUUID()
      const result = await db
        .prepare('INSERT INTO channels (id, slug, name, rig) VALUES (?, ?, ?, ?) ON CONFLICT (slug) DO NOTHING')
        .bind(id, slug, name, JSON.stringify(rig))
        .run()
      if (!result.meta.changes) throw httpError(409, `Another channel already uses the address "${slug}". Pick a different one.`)
      return { id, slug, name }
    },
  }
}

export type ChannelService = ReturnType<typeof createChannelService>

const toChannelSummary = ({ id, slug, name }: Omit<ChannelRow, 'rig'>): ChannelSummary => ({ id, slug, name })
