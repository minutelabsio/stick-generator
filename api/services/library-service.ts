import { z } from 'zod'
import type { Library, LibraryAsset } from '../../shared/api-types'
import type { Rig } from '../../shared/rig'
import { fileUrl } from '../files'

interface AssetRow {
  id: string
  slot: string
  label: string
  parts: string
}

interface PaletteRow {
  id: string
  colors: string
}

const StoredParts = z.partialRecord(z.enum(['line', 'mask', 'backLine', 'backMask']), z.string())
const StoredColors = z.array(z.string())

interface LibraryDependencies {
  db: D1Database
  rig: Rig
}

export function createLibraryService({ db, rig }: LibraryDependencies) {
  return {
    async get(): Promise<Library> {
      const [assetRows, paletteRows] = await Promise.all([
        db.prepare('SELECT id, slot, label, parts FROM assets WHERE archived_at IS NULL ORDER BY slot, sort').all<AssetRow>(),
        db.prepare('SELECT id, colors FROM palettes').all<PaletteRow>(),
      ])
      return {
        assets: assetRows.results.map(toLibraryAsset),
        palettes: toPalettes(rig, paletteRows.results),
        rig,
      }
    },
  }
}

function toLibraryAsset(row: AssetRow): LibraryAsset {
  const parts = StoredParts.parse(JSON.parse(row.parts))
  const partUrls = Object.fromEntries(Object.entries(parts).map(([part, key]) => [part, fileUrl('assets', key)]))
  return { id: row.id, slot: row.slot, label: row.label, partUrls }
}

// Every palette the rig names is present, empty until a designer adds swatches.
function toPalettes(rig: Rig, rows: PaletteRow[]): Library['palettes'] {
  const colorsById = new Map(rows.map(row => [row.id, StoredColors.parse(JSON.parse(row.colors))]))
  return Object.fromEntries(rig.palettes.map(paletteId => [paletteId, colorsById.get(paletteId) ?? []]))
}
