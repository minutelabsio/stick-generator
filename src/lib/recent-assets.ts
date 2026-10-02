import { z } from 'zod'

// Per designer, per browser. The same few assets recur through a batch, so this row
// covers most picks without searching the full list.
const STORAGE_KEY = 'stick-generator.recent-assets'
const RECENT_LIMIT = 8

// Keyed by slot id.
const RecentAssets = z.partialRecord(z.string(), z.array(z.string()))
export type RecentAssets = z.infer<typeof RecentAssets>

export function readRecentAssets(): RecentAssets {
  try {
    const parsed = RecentAssets.safeParse(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}'))
    return parsed.success ? parsed.data : {}
  } catch {
    return {}
  }
}

export function rememberAsset(recent: RecentAssets, slot: string, assetId: string): RecentAssets {
  const ids = [assetId, ...(recent[slot] ?? []).filter(id => id !== assetId)].slice(0, RECENT_LIMIT)
  const updated = { ...recent, [slot]: ids }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
  } catch {
    // Storage can be blocked (private windows). Recents still work for this visit.
  }
  return updated
}
