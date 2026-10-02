import { z } from 'zod'
import { HexColor } from './rig'
import type { Rig } from './rig'

// Keyed by the rig's slot and colour role ids. Which ids are allowed depends on the
// rig, so that check is unknownFigureKeys rather than part of the schema.
export const FigureConfig = z.object({
  assets: z.partialRecord(z.string(), z.string()),
  colors: z.partialRecord(z.string(), HexColor),
})
export type FigureConfig = z.infer<typeof FigureConfig>

export function unknownFigureKeys(figure: FigureConfig, rig: Rig) {
  const slotIds = new Set(rig.slots.map(slot => slot.id))
  const roleIds = new Set(rig.colorRoles.map(role => role.id))
  return [
    ...Object.keys(figure.assets).filter(id => !slotIds.has(id)).map(id => `slot "${id}"`),
    ...Object.keys(figure.colors).filter(id => !roleIds.has(id)).map(id => `colour role "${id}"`),
  ]
}

export const EMPTY_FIGURE: FigureConfig = { assets: {}, colors: {} }
