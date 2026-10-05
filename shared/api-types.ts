import { z } from 'zod'
import { FigureConfig } from './figure'
import { cleanText, SubmittedAnswers } from './intake'
import type { Question } from './intake'
import type { AssetPart, Rig } from './rig'

export const ENTRY_STATUSES = ['new', 'in_progress', 'done', 'skipped'] as const
export type EntryStatus = typeof ENTRY_STATUSES[number]

export interface ChannelSummary {
  id: string
  slug: string
  name: string
}

// The slug is the channel's address in the app (/c/<slug>), so keep it URL-plain.
export const CreateChannelRequest = z.object({
  name: z.string().trim().min(1, 'Give the channel a name.').max(100),
  slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Use lower-case letters, numbers, and single dashes for the address.').max(60),
})
export type CreateChannelRequest = z.infer<typeof CreateChannelRequest>

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
  channelId: string
  entries: EntrySummary[]
}

// One answer as the team sees it, labelled as the question was asked.
export interface EntryAnswer {
  questionId: string
  label: string
  // From the channel's current form while it still has the question, so turning
  // highlight on or off applies to entries already submitted.
  highlight: boolean
  // The text typed, or the option picked. Null for an image answer.
  text: string | null
  isOther: boolean
  imageUrl: string | null
}

export interface EntryDetail extends EntrySummary {
  batchId: string
  channelId: string
  answers: EntryAnswer[]
  likenessUrl: string | null
  figure: FigureConfig | null
  updatedBy: string | null
  updatedAt: string
}

export interface LibraryAsset {
  id: string
  slot: string
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
  // Null whenever batchName is, so a closed batch reveals nothing about its channel.
  channelName: string | null
  batchName: string | null
  closesAt: string | null
  instructions: string
  questions: Question[]
  thankYouMessage: string
  consentText: string
  contactEmail: string | null
}

function tryParseJson(raw: string): unknown {
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

// Applies to the photo and to each image answer.
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024

// Each image answer arrives as its own multipart file under this prefix plus the question id.
export const IMAGE_ANSWER_FIELD_PREFIX = 'image:'

export const SubmissionFields = z.object({
  name: z.string().transform(raw => cleanText(raw, { multiline: false })).pipe(z.string().min(1, 'Please enter your name.').max(100)),
  email: z.string().trim().pipe(z.email('Please enter a valid email address.').max(200)),
  answers: z.string().transform((raw, context) => {
    const parsed = SubmittedAnswers.safeParse(tryParseJson(raw))
    if (parsed.success) return parsed.data
    context.addIssue({ code: 'custom', message: 'Answers were not in the expected format.' })
    return z.NEVER
  }),
  consent: z.literal('true', { error: 'Please tick the consent box so we can use your photo.' }),
})
