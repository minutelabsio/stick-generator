import { z } from 'zod'
import { Question } from '../../shared/api-types'
import type { BatchDetail, BatchSummary, CreateBatchRequest, EntryStatus, EntrySummary } from '../../shared/api-types'
import { generateJoinCode } from '../../shared/join-code'
import { fileUrl } from '../files'

interface GroupRow {
  id: string
  name: string
  join_code: string | null
  opens_at: string | null
  closes_at: string | null
  questions: string
  contact_email: string | null
}

interface StatusCountRow {
  group_id: string
  status: EntryStatus
  count: number
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

const StoredQuestions = z.array(Question)

const EMPTY_STATUS_COUNTS: Record<EntryStatus, number> = { new: 0, in_progress: 0, done: 0, skipped: 0 }

export function createBatchService(db: D1Database) {
  return {
    async list(): Promise<BatchSummary[]> {
      const [groups, counts] = await Promise.all([
        db.prepare('SELECT * FROM groups WHERE archived_at IS NULL ORDER BY created_at DESC').all<GroupRow>(),
        db.prepare('SELECT group_id, status, count(*) AS count FROM entries GROUP BY group_id, status').all<StatusCountRow>(),
      ])
      return groups.results.map(group => toBatchSummary(group, counts.results))
    },

    async get(batchId: string): Promise<BatchDetail | null> {
      const group = await db.prepare('SELECT * FROM groups WHERE id = ?').bind(batchId).first<GroupRow>()
      if (!group) return null
      const entries = await db
        .prepare('SELECT id, name, email, status, submitted_at, render_key, rendered_at FROM entries WHERE group_id = ? ORDER BY submitted_at, id')
        .bind(batchId)
        .all<EntrySummaryRow>()
      const statusCounts = entries.results.map(entry => ({ group_id: batchId, status: entry.status, count: 1 }))
      return {
        ...toBatchSummary(group, statusCounts),
        questions: StoredQuestions.parse(JSON.parse(group.questions)),
        contactEmail: group.contact_email,
        entries: entries.results.map(toEntrySummary),
      }
    },

    async create(request: CreateBatchRequest): Promise<{ id: string }> {
      const id = crypto.randomUUID()
      const questions = request.questionLabels.map((label, index) => ({ id: `q${index + 1}`, label, required: false, highlight: true }))
      await db
        .prepare(`INSERT INTO groups (id, slug, name, source, questions, join_code, opens_at, closes_at, contact_email)
                  VALUES (?, ?, ?, 'intake', ?, ?, ?, ?, ?)`)
        .bind(id, `${slugify(request.name)}-${id.slice(0, 8)}`, request.name, JSON.stringify(questions),
          generateJoinCode(), new Date().toISOString(), request.closesAt, request.contactEmail ?? null)
        .run()
      return { id }
    },
  }
}

function toBatchSummary(group: GroupRow, counts: StatusCountRow[]): BatchSummary {
  const statusCounts = counts
    .filter(row => row.group_id === group.id)
    .reduce((totals, row) => ({ ...totals, [row.status]: totals[row.status] + row.count }), EMPTY_STATUS_COUNTS)
  return {
    id: group.id,
    name: group.name,
    joinCode: group.join_code,
    opensAt: group.opens_at,
    closesAt: group.closes_at,
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

const slugify = (name: string) => name.toLowerCase().replaceAll(/[^a-z0-9]+/g, '-').replaceAll(/^-|-$/g, '')
