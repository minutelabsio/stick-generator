import { z } from 'zod'
import type { Library, LibraryAsset } from '../../shared/api-types'
import type { PaletteId, SlotId } from '../../shared/figure'
import { fileUrl } from '../files'

interface AssetRow {
  id: string
  slot: SlotId
  label: string
  parts: string
}

interface PaletteRow {
  id: PaletteId
  colors: string
}

const StoredParts = z.partialRecord(z.enum(['line', 'mask', 'backLine', 'backMask']), z.string())
const StoredColors = z.array(z.string())

export function createLibraryService(db: D1Database) {
  return {
    async get(): Promise<Library> {
      const [assetRows, paletteRows] = await Promise.all([
        db.prepare('SELECT id, slot, label, parts FROM assets WHERE archived_at IS NULL ORDER BY slot, sort').all<AssetRow>(),
        db.prepare('SELECT id, colors FROM palettes').all<PaletteRow>(),
      ])
      return {
        assets: assetRows.results.map(toLibraryAsset),
        palettes: toPalettes(paletteRows.results),
      }
    },
  }
}

function toLibraryAsset(row: AssetRow): LibraryAsset {
  const parts = StoredParts.parse(JSON.parse(row.parts))
  const partUrls = Object.fromEntries(Object.entries(parts).map(([part, key]) => [part, fileUrl('assets', key)]))
  return { id: row.id, slot: row.slot, label: row.label, partUrls }
}

function toPalettes(rows: PaletteRow[]): Library['palettes'] {
  const colorsById = new Map(rows.map(row => [row.id, StoredColors.parse(JSON.parse(row.colors))]))
  return {
    skin: colorsById.get('skin') ?? [],
    hair: colorsById.get('hair') ?? [],
    hat: colorsById.get('hat') ?? [],
    glasses: colorsById.get('glasses') ?? [],
  }
}
