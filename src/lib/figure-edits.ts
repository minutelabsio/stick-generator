import { colorRoleById, slotById } from '@shared/rig'
import type { FigureConfig } from '@shared/figure'
import type { ColorRole } from '@shared/rig'
import type { Library } from '@shared/api-types'

const pickRandom = <T>(items: readonly T[]) => items[Math.floor(Math.random() * items.length)]

const assetsForSlot = (library: Library, slotId: string) => library.assets.filter(asset => asset.slot === slotId)
const swatches = (library: Library, role: ColorRole) => library.palettes[role.palette] ?? []

export function initialFigure(library: Library): FigureConfig {
  const requiredSlots = library.rig.slots.filter(slot => slot.required)
  const roleIds = new Set(requiredSlots.flatMap(slot => slot.colorRoles))
  return {
    assets: Object.fromEntries(requiredSlots.map(slot => [slot.id, assetsForSlot(library, slot.id)[0]?.id])),
    colors: randomColors(library, library.rig.colorRoles.filter(role => roleIds.has(role.id))),
  }
}

export function selectAsset(figure: FigureConfig, slotId: string, assetId: string | undefined, library: Library): FigureConfig {
  const assets = { ...figure.assets, [slotId]: assetId }
  if (!assetId) return { ...figure, assets }
  return { assets, colors: fillMissingColors(figure.colors, slotById(library.rig, slotId)?.colorRoles ?? [], library) }
}

export function selectColor(figure: FigureConfig, roleId: string, color: string | undefined): FigureConfig {
  return { ...figure, colors: { ...figure.colors, [roleId]: color } }
}

export function randomFigure(library: Library): FigureConfig {
  const filledSlots = library.rig.slots.filter(slot => Math.random() < slot.randomFillChance)
  return {
    assets: Object.fromEntries(filledSlots.map(slot => [slot.id, pickRandom(assetsForSlot(library, slot.id))?.id])),
    colors: randomColors(library, library.rig.colorRoles),
  }
}

// A following role takes the colour rolled for the role it follows, the way people's
// facial hair usually matches their hair.
function randomColors(library: Library, roles: ColorRole[]) {
  const rolled = Object.fromEntries(roles.filter(role => !role.followsRole).map(role => [role.id, pickRandom(swatches(library, role))]))
  const followed = roles.flatMap(role => (role.followsRole ? [[role.id, rolled[role.followsRole] ?? pickRandom(swatches(library, role))]] : []))
  return { ...rolled, ...Object.fromEntries(followed) }
}

// An untinted mask would draw as an invisible fill, so picking an asset also picks a colour.
function fillMissingColors(colors: FigureConfig['colors'], roleIds: string[], library: Library) {
  const missing = roleIds.flatMap(roleId => colorRoleById(library.rig, roleId) ?? []).filter(role => !colors[role.id])
  return { ...colors, ...Object.fromEntries(missing.map(role => [role.id, startingColor(colors, role, library)])) }
}

// A following role starts with the colour of the role it follows, chosen or not yet.
function startingColor(colors: FigureConfig['colors'], role: ColorRole, library: Library): string | undefined {
  const followed = role.followsRole ? colorRoleById(library.rig, role.followsRole) : undefined
  if (followed) return colors[followed.id] ?? startingColor(colors, followed, library)
  return role.defaultColor ?? swatches(library, role)[0]
}
