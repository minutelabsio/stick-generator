import type { BatchDetail, BatchSummary, CreateBatchRequest, EntryStatus, EntrySummary, UpdateBatchRequest } from '../../shared/api-types'
import { intakeStateOf } from '../../shared/batch-intake'
import { generateJoinCode } from '../../shared/join-code'
import { slugify } from '../../shared/slug'
import { fileUrl } from '../files'
import { httpError } from '../http-errors'

interface GroupRow {
  id: string
  channel_id: string
  name: string
  join_code: string | null
  is_open: number
  closes_at: string | null
  max_submissions: number | null
}

interface StatusCountRow {
  group_id: string
  status: EntryStatus
  count: number
  // Of those, how many came in through the join link.
  submitted: number
}

interface EntrySummaryRow {
  id: string
  name: string | null
  email: string | null
  status: EntryStatus
  submitted_at: string | null
  render_key: string | null
  rendered_at: string | null
}

const EMPTY_STATUS_COUNTS: Record<EntryStatus, number> = { new: 0, in_progress: 0, done: 0, skipped: 0 }

export function createBatchService(db: D1Database) {
  const findGroup = (batchId: string) => db.prepare('SELECT * FROM groups WHERE id = ?').bind(batchId).first<GroupRow>()

  const get = async (batchId: string): Promise<BatchDetail | null> => {
    const group = await findGroup(batchId)
    if (!group) return null
    const entries = await db
      .prepare('SELECT id, name, email, status, submitted_at, render_key, rendered_at FROM entries WHERE group_id = ? ORDER BY submitted_at, id')
      .bind(batchId)
      .all<EntrySummaryRow>()
    const statusCounts = entries.results.map(entry => ({
      group_id: batchId,
      status: entry.status,
      count: 1,
      submitted: entry.submitted_at ? 1 : 0,
    }))
    return {
      ...toBatchSummary(group, statusCounts),
      channelId: group.channel_id,
      entries: entries.results.map(toEntrySummary),
    }
  }

  return {
    async list(channelId: string): Promise<BatchSummary[]> {
      const [groups, counts] = await Promise.all([
        db.prepare('SELECT * FROM groups WHERE channel_id = ? AND archived_at IS NULL ORDER BY created_at DESC')
          .bind(channelId)
          .all<GroupRow>(),
        db.prepare(`SELECT group_id, status, count(*) AS count, count(submitted_at) AS submitted FROM entries
                    WHERE group_id IN (SELECT id FROM groups WHERE channel_id = ?)
                    GROUP BY group_id, status`)
          .bind(channelId)
          .all<StatusCountRow>(),
      ])
      return groups.results.map(group => toBatchSummary(group, counts.results))
    },

    get,

    // Starts switched off, so nobody submits before the team has checked it.
    async create(channelId: string, request: CreateBatchRequest): Promise<{ id: string }> {
      const closesAt = requireFutureCloseDate(request.closesAt)
      const id = crypto.randomUUID()
      await db
        .prepare(`INSERT INTO groups (id, channel_id, slug, name, source, join_code, closes_at, max_submissions)
                  VALUES (?, ?, ?, ?, 'intake', ?, ?, ?)`)
        .bind(id, channelId, `${slugify(request.name)}-${id.slice(0, 8)}`, request.name,
          generateJoinCode(), closesAt, request.maxSubmissions)
        .run()
      return { id }
    },

    async update(batchId: string, changes: UpdateBatchRequest): Promise<BatchDetail | null> {
      const group = await findGroup(batchId)
      if (!group) return null
      const closesAt = changes.closesAt === undefined ? group.closes_at : requireFutureCloseDate(changes.closesAt)
      if (changes.isOpen) requireCanOpen(group, closesAt)
      const changesLimit = changes.maxSubmissions !== undefined
      await db
        .prepare(`UPDATE groups
                  SET name = coalesce(?, name), is_open = coalesce(?, is_open), closes_at = ?,
                      max_submissions = CASE WHEN ? THEN ? ELSE max_submissions END
                  WHERE id = ?`)
        .bind(changes.name ?? null, toFlag(changes.isOpen), closesAt, changesLimit ? 1 : 0, changes.maxSubmissions ?? null, batchId)
        .run()
      return get(batchId)
    },

    // The old link stops working at once. Entries already in are untouched.
    async rotateCode(batchId: string): Promise<BatchDetail | null> {
      const group = await findGroup(batchId)
      if (!group) return null
      if (!group.join_code) throw httpError(400, 'This batch has no join link to replace. It only takes entries added by the team.')
      await db.prepare('UPDATE groups SET join_code = ? WHERE id = ?').bind(generateJoinCode(), batchId).run()
      return get(batchId)
    },
  }
}

const toFlag = (value: boolean | undefined) => (value === undefined ? null : Number(value))

// Stored as toISOString() so the SQL comparison with the current time is exact.
function requireFutureCloseDate(closesAt: string) {
  const normalized = new Date(closesAt).toISOString()
  if (Date.parse(normalized) <= Date.now()) {
    throw httpError(400, 'Pick a close date in the future. To stop submissions now, switch the batch off.')
  }
  return normalized
}

function requireCanOpen(group: GroupRow, closesAt: string | null) {
  if (!group.join_code) throw httpError(400, 'This batch has no join link, so it can\'t be opened. It only takes entries added by the team.')
  if (!closesAt || Date.parse(closesAt) <= Date.now()) {
    throw httpError(400, 'This batch\'s close date has passed. Pick a later close date to open it again.')
  }
}

function toBatchSummary(group: GroupRow, counts: StatusCountRow[]): BatchSummary {
  const groupCounts = counts.filter(row => row.group_id === group.id)
  const statusCounts = groupCounts
    .reduce((totals, row) => ({ ...totals, [row.status]: totals[row.status] + row.count }), EMPTY_STATUS_COUNTS)
  const submittedCount = groupCounts.reduce((total, row) => total + row.submitted, 0)
  const gate = {
    hasJoinCode: group.join_code !== null,
    isOpen: group.is_open === 1,
    closesAt: group.closes_at,
    maxSubmissions: group.max_submissions,
    submittedCount,
  }
  return {
    id: group.id,
    name: group.name,
    joinCode: group.join_code,
    isOpen: gate.isOpen,
    closesAt: gate.closesAt,
    maxSubmissions: gate.maxSubmissions,
    submittedCount,
    intakeState: intakeStateOf(gate, Date.now()),
    statusCounts,
  }
}

export function toEntrySummary(row: EntrySummaryRow): EntrySummary {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    status: row.status,
    submittedAt: row.submitted_at,
    renderUrl: row.render_key ? `${fileUrl('figures', row.render_key)}?v=${row.rendered_at}` : null,
  }
}
