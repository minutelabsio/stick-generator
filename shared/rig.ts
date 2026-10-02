import { z } from 'zod'

// A rig is how a channel's figures are drawn: the canvas, the slots a figure has, the
// colour roles and palettes that colour them, and the layers in draw order. Code reads
// it as data, so no slot or colour role is named outside a rig definition.

export const ASSET_PARTS = ['line', 'mask', 'backLine', 'backMask'] as const
export const AssetPart = z.enum(ASSET_PARTS)
export type AssetPart = z.infer<typeof AssetPart>

export const HexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/)

// Ids end up as JSON keys in stored figures, so keep them plain.
const RigId = z.string().regex(/^[a-z][a-zA-Z0-9]*$/)

const ColorRole = z.object({
  id: RigId,
  label: z.string().min(1),
  palette: RigId,
  // Used instead of the palette's first swatch when the role is first needed.
  defaultColor: HexColor.optional(),
  // Takes that role's colour until set on its own, the way facial hair follows hair.
  followsRole: RigId.optional(),
})
export type ColorRole = z.infer<typeof ColorRole>

const Slot = z.object({
  id: RigId,
  label: z.string().min(1),
  // The heading the slot sits under in the editor's slot rail.
  group: z.string().min(1),
  // A required slot has no "none" choice, and a new figure starts with its first asset.
  required: z.boolean(),
  // In the order the editor shows their pickers.
  colorRoles: z.array(RigId),
  randomFillChance: z.number().min(0).max(1),
})
export type Slot = z.infer<typeof Slot>

// A tinted `line` part recolours the line art itself; a tinted `mask` part is a flat
// fill drawn under the untinted line art.
const Layer = z.object({
  slot: RigId,
  part: AssetPart,
  colorRole: RigId.optional(),
})
export type Layer = z.infer<typeof Layer>

const RigShape = z.object({
  canvas: z.object({ width: z.int().positive(), height: z.int().positive() }),
  // The slot the editor opens on.
  initialSlot: RigId,
  palettes: z.array(RigId).min(1),
  colorRoles: z.array(ColorRole),
  slots: z.array(Slot).min(1),
  // Back to front.
  layers: z.array(Layer).min(1),
})
type RigShape = z.infer<typeof RigShape>

export const Rig = RigShape.superRefine((rig, context) => {
  for (const message of rigProblems(rig)) context.addIssue({ code: 'custom', message })
})
export type Rig = z.infer<typeof Rig>

interface RigIndex {
  slotIds: Set<string>
  rolesById: Map<string, ColorRole>
  paletteIds: Set<string>
  usedRoleIds: Set<string>
  layersBySlot: Map<string, Layer[]>
}

function indexRig(rig: RigShape): RigIndex {
  return {
    slotIds: new Set(rig.slots.map(slot => slot.id)),
    rolesById: new Map(rig.colorRoles.map(role => [role.id, role])),
    paletteIds: new Set(rig.palettes),
    usedRoleIds: new Set(rig.slots.flatMap(slot => slot.colorRoles)),
    layersBySlot: new Map(rig.slots.map(slot => [slot.id, rig.layers.filter(layer => layer.slot === slot.id)])),
  }
}

function rigProblems(rig: RigShape) {
  const index = indexRig(rig)
  return [
    ...duplicateProblems(rig),
    ...(index.slotIds.has(rig.initialSlot) ? [] : [`The editor opens on slot "${rig.initialSlot}", which does not exist.`]),
    ...rig.colorRoles.flatMap(role => colorRoleProblems(role, index)),
    ...rig.slots.flatMap(slot => slotProblems(slot, index)),
    ...rig.layers.flatMap(layer => layerProblems(layer, index)),
  ]
}

function duplicateProblems(rig: RigShape) {
  return [
    ...duplicates(rig.palettes).map(id => `Palette "${id}" is listed twice.`),
    ...duplicates(rig.colorRoles.map(role => role.id)).map(id => `Colour role "${id}" is listed twice.`),
    ...duplicates(rig.slots.map(slot => slot.id)).map(id => `Slot "${id}" is listed twice.`),
    ...duplicates(rig.layers.map(layer => `${layer.slot}.${layer.part}`)).map(id => `Layer "${id}" is drawn twice.`),
  ]
}

function colorRoleProblems(role: ColorRole, { paletteIds, usedRoleIds, rolesById }: RigIndex) {
  const followed = role.followsRole ? rolesById.get(role.followsRole) : undefined
  return [
    ...(paletteIds.has(role.palette) ? [] : [`Colour role "${role.id}" uses palette "${role.palette}", which does not exist.`]),
    ...(usedRoleIds.has(role.id) ? [] : [`Colour role "${role.id}" is not used by any slot.`]),
    ...(role.followsRole && !followed ? [`Colour role "${role.id}" follows "${role.followsRole}", which does not exist.`] : []),
    // One level only, so a colour always resolves without walking a chain.
    ...(followed && (followed.id === role.id || followed.followsRole) ? [`Colour role "${role.id}" must follow a role that follows nothing.`] : []),
  ]
}

function slotProblems(slot: Slot, { rolesById, layersBySlot }: RigIndex) {
  const layers = layersBySlot.get(slot.id) ?? []
  const layerRoleIds = layers.flatMap(layer => layer.colorRole ?? [])
  return [
    ...slot.colorRoles.filter(roleId => !rolesById.has(roleId)).map(roleId => `Slot "${slot.id}" uses colour role "${roleId}", which does not exist.`),
    ...(layers.some(layer => layer.part === 'line') ? [] : [`Slot "${slot.id}" has no line layer, but every asset has line art.`]),
    ...(sameItems(slot.colorRoles, layerRoleIds) ? [] : [`Slot "${slot.id}" must list exactly the colour roles its layers use.`]),
    ...(slot.required && slot.randomFillChance !== 1 ? [`Slot "${slot.id}" is required, so randomising must always fill it.`] : []),
  ]
}

function layerProblems(layer: Layer, { slotIds, rolesById }: RigIndex) {
  return [
    ...(slotIds.has(layer.slot) ? [] : [`A layer uses slot "${layer.slot}", which does not exist.`]),
    ...(!layer.colorRole || rolesById.has(layer.colorRole) ? [] : [`A layer uses colour role "${layer.colorRole}", which does not exist.`]),
  ]
}

const duplicates = (ids: string[]) => [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))]

// Each listed once, and the same set as used.
const sameItems = (listed: string[], used: string[]) => {
  const listedSet = new Set(listed)
  const usedSet = new Set(used)
  return listedSet.size === listed.length && listedSet.size === usedSet.size && used.every(id => listedSet.has(id))
}

export const slotById = (rig: Rig, slotId: string) => rig.slots.find(slot => slot.id === slotId)
export const colorRoleById = (rig: Rig, roleId: string) => rig.colorRoles.find(role => role.id === roleId)
