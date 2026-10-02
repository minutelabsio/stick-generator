import { z } from 'zod'
import { FigureConfig } from './figure'
import type { AssetPart, SlotId } from './figure'
import type { Rig } from './rig'

export const ENTRY_STATUSES = ['new', 'in_progress', 'done', 'skipped'] as const
export type EntryStatus = typeof ENTRY_STATUSES[number]

export const Question = z.object({
  id: z.string(),
  label: z.string(),
  required: z.boolean().default(false),
  highlight: z.boolean().default(false),
})
export type Question = z.infer<typeof Question>

export interface BatchSummary {
  id: string
  name: string
  joinCode: string | null
  opensAt: string | null
  closesAt: string | null
  statusCounts: Record<EntryStatus, number>
}

export interface EntrySummary {
  id: string
  name: string | null
  email: string | null
  status: EntryStatus
  submittedAt: string | null
  renderUrl: string | null
}

export interface BatchDetail extends BatchSummary {
  questions: Question[]
  contactEmail: string | null
  entries: EntrySummary[]
}

export interface EntryDetail extends EntrySummary {
  batchId: string
  answers: Record<string, string>
  likenessUrl: string | null
  figure: FigureConfig | null
  updatedBy: string | null
  updatedAt: string
}

export interface LibraryAsset {
  id: string
  slot: SlotId
  label: string
  partUrls: Partial<Record<AssetPart, string>>
}

export interface Library {
  assets: LibraryAsset[]
  // Keyed by the rig's palette ids.
  palettes: Record<string, string[]>
  rig: Rig
}

export const CreateBatchRequest = z.object({
  name: z.string().trim().min(1).max(100),
  closesAt: z.iso.datetime(),
  questionLabels: z.array(z.string().trim().min(1).max(200)).max(20),
  contactEmail: z.email().optional(),
})
export type CreateBatchRequest = z.infer<typeof CreateBatchRequest>

export const UpdateEntryRequest = z.object({
  figure: FigureConfig.optional(),
  status: z.enum(ENTRY_STATUSES).optional(),
})
export type UpdateEntryRequest = z.infer<typeof UpdateEntryRequest>

export const JOIN_CODE_HEADER = 'X-Join-Code'

export type JoinBatchState = 'open' | 'not_yet_open' | 'closed'

export interface JoinBatch {
  state: JoinBatchState
  batchName: string | null
  closesAt: string | null
  questions: Question[]
  contactEmail: string | null
}

function tryParseJson(raw: string): unknown {
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export const MAX_PHOTO_BYTES = 5 * 1024 * 1024

export const SubmissionFields = z.object({
  name: z.string().trim().min(1, 'Please enter your name.').max(100),
  email: z.email('Please enter a valid email address.').max(200),
  answers: z.string().transform((raw, context) => {
    const parsed = z.record(z.string(), z.string().max(500)).safeParse(tryParseJson(raw))
    if (parsed.success) return parsed.data
    context.addIssue({ code: 'custom', message: 'Answers were not in the expected format.' })
    return z.NEVER
  }),
  consent: z.literal('true', { error: 'Please tick the consent box so we can use your photo.' }),
})
