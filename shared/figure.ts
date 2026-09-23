import { z } from 'zod'

// The canvas every layer asset is drawn on. Assets are full-size, pre-positioned PNGs.
export const CANVAS_WIDTH = 710
export const CANVAS_HEIGHT = 943

export const SLOT_IDS = ['body', 'head', 'hair', 'hat', 'mustache', 'beard', 'longbeard', 'glasses', 'accessory'] as const
export type SlotId = typeof SLOT_IDS[number]

export const COLOR_CHANNEL_IDS = ['skin', 'hair', 'hat', 'facialHair', 'glassesFrame', 'glassesLens'] as const
export type ColorChannelId = typeof COLOR_CHANNEL_IDS[number]

export const PALETTE_IDS = ['skin', 'hair', 'hat', 'glasses'] as const
export type PaletteId = typeof PALETTE_IDS[number]

export type AssetPart = 'line' | 'mask' | 'backLine' | 'backMask'

interface SlotDefinition {
  label: string
  colorChannels: ColorChannelId[]
  // The body is always drawn, so it has no "none" choice.
  required: boolean
}

export const SLOTS: Record<SlotId, SlotDefinition> = {
  body: { label: 'Body', colorChannels: [], required: true },
  head: { label: 'Head', colorChannels: ['skin'], required: true },
  hair: { label: 'Hair', colorChannels: ['hair'], required: false },
  hat: { label: 'Hat', colorChannels: ['hat'], required: false },
  mustache: { label: 'Mustache', colorChannels: ['facialHair'], required: false },
  beard: { label: 'Beard', colorChannels: ['facialHair'], required: false },
  longbeard: { label: 'Long beard', colorChannels: ['facialHair'], required: false },
  glasses: { label: 'Glasses', colorChannels: ['glassesFrame', 'glassesLens'], required: false },
  accessory: { label: 'Accessory', colorChannels: [], required: false },
}

interface ColorChannelDefinition {
  label: string
  palette: PaletteId
}

export const COLOR_CHANNELS: Record<ColorChannelId, ColorChannelDefinition> = {
  skin: { label: 'Skin', palette: 'skin' },
  hair: { label: 'Hair colour', palette: 'hair' },
  hat: { label: 'Hat colour', palette: 'hat' },
  facialHair: { label: 'Facial hair colour', palette: 'hair' },
  glassesFrame: { label: 'Frame colour', palette: 'glasses' },
  glassesLens: { label: 'Lens colour', palette: 'glasses' },
}

export interface Layer {
  slot: SlotId
  part: AssetPart
  tint?: ColorChannelId
}

// Back to front. Same order as v1. A tinted `line` part recolours the line art itself;
// a tinted `mask` part is a flat fill drawn under the untinted line art.
export const LAYERS: readonly Layer[] = [
  { slot: 'hat', part: 'backMask', tint: 'hat' },
  { slot: 'hat', part: 'backLine' },
  { slot: 'hair', part: 'backMask', tint: 'hair' },
  { slot: 'hair', part: 'backLine' },
  { slot: 'body', part: 'line' },
  { slot: 'head', part: 'mask', tint: 'skin' },
  { slot: 'beard', part: 'line', tint: 'facialHair' },
  { slot: 'mustache', part: 'line', tint: 'facialHair' },
  { slot: 'head', part: 'line' },
  { slot: 'hair', part: 'mask', tint: 'hair' },
  { slot: 'hair', part: 'line' },
  { slot: 'glasses', part: 'mask', tint: 'glassesLens' },
  { slot: 'glasses', part: 'line', tint: 'glassesFrame' },
  { slot: 'accessory', part: 'line' },
  { slot: 'longbeard', part: 'mask', tint: 'facialHair' },
  { slot: 'longbeard', part: 'line' },
  { slot: 'hat', part: 'mask', tint: 'hat' },
  { slot: 'hat', part: 'line' },
]

const HexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/)

export const FigureConfig = z.object({
  assets: z.partialRecord(z.enum(SLOT_IDS), z.string()),
  colors: z.partialRecord(z.enum(COLOR_CHANNEL_IDS), HexColor),
})
export type FigureConfig = z.infer<typeof FigureConfig>

export const EMPTY_FIGURE: FigureConfig = { assets: {}, colors: {} }
