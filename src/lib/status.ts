import type { EntryStatus } from '@shared/api-types'

export const STATUS_OPTIONS: { label: string, value: EntryStatus }[] = [
  { label: 'New', value: 'new' },
  { label: 'In progress', value: 'in_progress' },
  { label: 'Done', value: 'done' },
  { label: 'Skipped', value: 'skipped' },
]

export function isBatchOpen(batch: { joinCode: string | null, opensAt: string | null, closesAt: string | null }) {
  if (!batch.joinCode || !batch.opensAt || !batch.closesAt) return false
  const now = Date.now()
  return Date.parse(batch.opensAt) <= now && now < Date.parse(batch.closesAt)
}

export const formatDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString(undefined, { dateStyle: 'medium' }) : '—')
