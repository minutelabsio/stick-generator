import { COLOR_CHANNELS, SLOT_IDS, SLOTS } from '@shared/figure'
import type { ColorChannelId, FigureConfig, SlotId } from '@shared/figure'
import type { Library } from '@shared/api-types'

// Chance an optional slot is filled when randomising. Most people don't wear a hat.
const RANDOM_FILL_CHANCE: Record<SlotId, number> = {
  body: 1,
  head: 1,
  hair: 0.8,
  hat: 0.25,
  mustache: 0.2,
  beard: 0.2,
  longbeard: 0.05,
  glasses: 0.35,
  accessory: 0.15,
}

// Colours applied when a slot is first picked. Palette order is display order, and its
// first entries (white hair, pale blue frames) make poor starting points.
const DEFAULT_COLORS: Partial<Record<ColorChannelId, string>> = {
  hair: '#63503C',
  glassesFrame: '#1A1A1A',
  glassesLens: '#FCF4F0',
}

const pickRandom = <T>(items: readonly T[]) => items[Math.floor(Math.random() * items.length)]

const assetsForSlot = (library: Library, slot: SlotId) => library.assets.filter(asset => asset.slot === slot)

export function initialFigure(library: Library): FigureConfig {
  return {
    assets: {
      body: assetsForSlot(library, 'body')[0]?.id,
      head: assetsForSlot(library, 'head')[0]?.id,
    },
    colors: { skin: pickRandom(library.palettes.skin) },
  }
}

export function selectAsset(figure: FigureConfig, slot: SlotId, assetId: string | undefined, library: Library): FigureConfig {
  const assets = { ...figure.assets, [slot]: assetId }
  if (!assetId) return { ...figure, assets }
  return { assets, colors: fillMissingColors(figure.colors, SLOTS[slot].colorChannels, library) }
}

export function selectColor(figure: FigureConfig, channel: ColorChannelId, color: string | undefined): FigureConfig {
  return { ...figure, colors: { ...figure.colors, [channel]: color } }
}

export function randomFigure(library: Library): FigureConfig {
  const assetEntries = SLOT_IDS
    .filter(slot => Math.random() < RANDOM_FILL_CHANCE[slot])
    .map(slot => [slot, pickRandom(assetsForSlot(library, slot))?.id] as const)
  const colors = Object.fromEntries(
    Object.entries(COLOR_CHANNELS).map(([channel, { palette }]) => [channel, pickRandom(library.palettes[palette])]),
  )
  return { assets: Object.fromEntries(assetEntries), colors: { ...colors, facialHair: colors.hair } }
}

// An untinted mask would draw as an invisible fill, so picking an asset also picks a colour.
// Facial hair follows the hair colour, the way people usually look.
function fillMissingColors(colors: FigureConfig['colors'], channels: ColorChannelId[], library: Library) {
  const missing = channels.filter(channel => !colors[channel])
  const defaults = missing.map((channel) => {
    const fallback = DEFAULT_COLORS[channel] ?? library.palettes[COLOR_CHANNELS[channel].palette][0]
    const color = channel === 'facialHair' ? (colors.hair ?? DEFAULT_COLORS.hair) : fallback
    return [channel, color] as const
  })
  return { ...colors, ...Object.fromEntries(defaults) }
}
