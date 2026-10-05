import { ENTRY_STATUSES } from '@shared/api-types'
import type { BatchSummary, EntryStatus } from '@shared/api-types'
import type { IntakeState } from '@shared/batch-intake'

export const STATUS_LABELS: Record<EntryStatus, string> = {
  new: 'New',
  in_progress: 'In progress',
  done: 'Done',
  skipped: 'Skipped',
}

export const STATUS_OPTIONS = ENTRY_STATUSES.map(value => ({ label: STATUS_LABELS[value], value }))

// Progress reads left to right as finished work. New entries are the empty track.
const PROGRESS_COLORS: Partial<Record<EntryStatus, string>> = {
  done: 'var(--p-surface-700)',
  in_progress: 'var(--p-surface-400)',
  skipped: 'var(--p-surface-300)',
}
const PROGRESS_ORDER: EntryStatus[] = ['done', 'in_progress', 'skipped']

export const totalEntries = (counts: Record<EntryStatus, number>) =>
  Object.values(counts).reduce((sum, count) => sum + count, 0)

export function progressSegments(counts: Record<EntryStatus, number>) {
  return PROGRESS_ORDER.map(status => ({
    label: STATUS_LABELS[status],
    value: counts[status],
    color: PROGRESS_COLORS[status],
  }))
}

export function describeCounts(counts: Record<EntryStatus, number>) {
  const parts = ENTRY_STATUSES
    .filter(status => counts[status] > 0)
    .map(status => `${counts[status]} ${STATUS_LABELS[status].toLowerCase()}`)
  return parts.join(', ')
}

export const INTAKE_STATE_LABELS: Record<IntakeState, string> = {
  open: 'Open',
  closed: 'Closed',
  full: 'Full',
}

export const intakeLabel = (batch: Pick<BatchSummary, 'intakeState'>) => INTAKE_STATE_LABELS[batch.intakeState]

// e.g. "41 / 60 submitted" or "12 submitted" when there is no limit.
export const describeSubmissions = (batch: Pick<BatchSummary, 'submittedCount' | 'maxSubmissions'>) =>
  batch.maxSubmissions === null ? `${batch.submittedCount} submitted` : `${batch.submittedCount} / ${batch.maxSubmissions} submitted`

export const formatDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString(undefined, { dateStyle: 'medium' }) : '—')
