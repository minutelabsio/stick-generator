import { z } from 'zod'
import { FigureConfig, unknownFigureKeys } from '../../shared/figure'
import type { Rig } from '../../shared/rig'
import type { EntryDetail, EntryStatus, UpdateEntryRequest } from '../../shared/api-types'
import { fileUrl } from '../files'
import { httpError } from '../http-errors'
import { toEntrySummary } from './batch-service'

interface EntryRow {
  id: string
  group_id: string
  name: string | null
  email: string | null
  status: EntryStatus
  answers: string
  likeness_key: string | null
  figure: string | null
  render_key: string | null
  rendered_at: string | null
  submitted_at: string | null
  updated_by: string | null
  updated_at: string
}

interface EntryServiceDependencies {
  db: D1Database
  figureBucket: R2Bucket
  rig: Rig
}

const StoredAnswers = z.record(z.string(), z.string())

export function createEntryService({ db, figureBucket, rig }: EntryServiceDependencies) {
  const findRow = (entryId: string) => db.prepare('SELECT * FROM entries WHERE id = ?').bind(entryId).first<EntryRow>()

  const get = async (entryId: string): Promise<EntryDetail | null> => {
    const row = await findRow(entryId)
    return row ? toEntryDetail(row) : null
  }

  return {
    get,

    async update(entryId: string, changes: UpdateEntryRequest, updatedBy: string): Promise<EntryDetail | null> {
      if (changes.figure) requireFitsRig(changes.figure, rig)
      const figure = changes.figure ? JSON.stringify(changes.figure) : null
      await db
        .prepare(`UPDATE entries
                  SET figure = coalesce(?, figure), status = coalesce(?, status), version = version + 1,
                      updated_by = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
                  WHERE id = ?`)
        .bind(figure, changes.status ?? null, updatedBy, entryId)
        .run()
      return get(entryId)
    },

    async saveRender(entryId: string, png: ArrayBuffer, updatedBy: string): Promise<EntryDetail | null> {
      const row = await findRow(entryId)
      if (!row) return null
      const renderKey = `v2/renders/${row.group_id}/${entryId}.png`
      await figureBucket.put(renderKey, png, { httpMetadata: { contentType: 'image/png' } })
      await db
        .prepare(`UPDATE entries
                  SET render_key = ?, rendered_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), render_stale = 0, updated_by = ?
                  WHERE id = ?`)
        .bind(renderKey, updatedBy, entryId)
        .run()
      return get(entryId)
    },
  }
}

// The schema can't know which slots and colour roles exist, so a figure from a stale
// editor could otherwise save parts that never render.
function requireFitsRig(figure: FigureConfig, rig: Rig) {
  const unknown = unknownFigureKeys(figure, rig)
  if (!unknown.length) return
  throw httpError(400, `This figure uses ${unknown.join(' and ')}, which the editor no longer offers. Reload the editor and try again.`)
}

function toEntryDetail(row: EntryRow): EntryDetail {
  return {
    ...toEntrySummary(row),
    batchId: row.group_id,
    answers: StoredAnswers.parse(JSON.parse(row.answers)),
    likenessUrl: row.likeness_key ? fileUrl('figures', row.likeness_key) : null,
    figure: row.figure ? FigureConfig.parse(JSON.parse(row.figure)) : null,
    updatedBy: row.updated_by,
    updatedAt: row.updated_at,
  }
}
