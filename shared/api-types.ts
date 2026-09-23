import { z } from 'zod'
import { FigureConfig } from './figure'
import type { AssetPart, PaletteId, SlotId } from './figure'

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
  palettes: Record<PaletteId, string[]>
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
