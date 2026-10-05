import { z } from 'zod'
import { FigureConfig, unknownFigureKeys } from '../../shared/figure'
import { IntakeSettings, StoredAnswer } from '../../shared/intake'
import type { AnswerValue, Question } from '../../shared/intake'
import type { Rig } from '../../shared/rig'
import type { EntryAnswer, EntryDetail, EntryStatus, UpdateEntryRequest } from '../../shared/api-types'
import { fileUrl } from '../files'
import { httpError } from '../http-errors'
import { toEntrySummary } from './batch-service'
import type { ChannelService } from './channel-service'

interface EntryRow {
  id: string
  group_id: string
  channel_id: string
  // The channel's current intake settings, for which answers to highlight.
  intake: string
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
  channels: ChannelService
}

interface MisplacedAssetRow {
  slot: string
  asset_id: string
}

const StoredAnswers = z.array(StoredAnswer)

export function createEntryService({ db, figureBucket, channels }: EntryServiceDependencies) {
  const findRow = (entryId: string) => db
    .prepare(`SELECT entries.*, groups.channel_id, channels.intake FROM entries
              JOIN groups ON groups.id = entries.group_id
              JOIN channels ON channels.id = groups.channel_id
              WHERE entries.id = ?`)
    .bind(entryId)
    .first<EntryRow>()

  // One query for every asset in the figure. An asset never changes channel or slot,
  // so checking before the write cannot race with it.
  const requireChannelAssets = async (figure: FigureConfig, channelId: string) => {
    const misplaced = await db
      .prepare(`SELECT key AS slot, value AS asset_id FROM json_each(?)
                WHERE NOT EXISTS (SELECT 1 FROM assets WHERE assets.id = value AND channel_id = ? AND assets.slot = key)`)
      .bind(JSON.stringify(figure.assets), channelId)
      .all<MisplacedAssetRow>()
    if (!misplaced.results.length) return
    const named = misplaced.results.map(row => `"${row.asset_id}" for ${row.slot}`).join(' and ')
    throw httpError(400, `This figure uses ${named}, which this channel's library doesn't have. Reload the editor and try again.`)
  }

  const get = async (entryId: string): Promise<EntryDetail | null> => {
    const row = await findRow(entryId)
    return row ? toEntryDetail(row) : null
  }

  return {
    get,

    async update(entryId: string, changes: UpdateEntryRequest, updatedBy: string): Promise<EntryDetail | null> {
      const row = await findRow(entryId)
      if (!row) return null
      if (changes.figure) {
        const channel = await channels.get(row.channel_id)
        if (!channel) throw new Error(`Entry ${entryId} belongs to missing channel ${row.channel_id}`)
        requireFitsRig(changes.figure, channel.rig)
        await requireChannelAssets(changes.figure, channel.id)
      }
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
  const currentQuestions = new Map(IntakeSettings.parse(JSON.parse(row.intake)).questions.map(question => [question.id, question]))
  return {
    ...toEntrySummary(row),
    batchId: row.group_id,
    channelId: row.channel_id,
    answers: StoredAnswers.parse(JSON.parse(row.answers)).map(answer => toEntryAnswer(answer, currentQuestions)),
    likenessUrl: row.likeness_key ? fileUrl('figures', row.likeness_key) : null,
    figure: row.figure ? FigureConfig.parse(JSON.parse(row.figure)) : null,
    updatedBy: row.updated_by,
    updatedAt: row.updated_at,
  }
}

// Labelled as asked, from the entry's own copy. Highlight follows the current form,
// so a designer can turn it on for answers already in.
function toEntryAnswer({ question, value }: StoredAnswer, currentQuestions: ReadonlyMap<string, Question>): EntryAnswer {
  return {
    questionId: question.id,
    label: question.label,
    highlight: currentQuestions.get(question.id)?.highlight ?? question.highlight,
    text: answerText(value),
    isOther: value.kind === 'other',
    imageUrl: value.kind === 'image' ? fileUrl('figures', value.key) : null,
  }
}

function answerText(value: AnswerValue) {
  if (value.kind === 'image') return null
  if (value.kind === 'choice') return value.choice
  return value.text
}
