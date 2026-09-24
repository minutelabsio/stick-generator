import { ENTRY_STATUSES } from '@shared/api-types'
import type { EntryStatus } from '@shared/api-types'

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

export function isBatchOpen(batch: { joinCode: string | null, opensAt: string | null, closesAt: string | null }) {
  if (!batch.joinCode || !batch.opensAt || !batch.closesAt) return false
  const now = Date.now()
  return Date.parse(batch.opensAt) <= now && now < Date.parse(batch.closesAt)
}

export const formatDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString(undefined, { dateStyle: 'medium' }) : '—')
