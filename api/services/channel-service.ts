import { Rig } from '../../shared/rig'
import type { ChannelSummary } from '../../shared/api-types'

interface ChannelRow {
  id: string
  slug: string
  name: string
  rig: string
}

export interface Channel extends ChannelSummary {
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
  }
}

export type ChannelService = ReturnType<typeof createChannelService>

const toChannelSummary = ({ id, slug, name }: Omit<ChannelRow, 'rig'>): ChannelSummary => ({ id, slug, name })
