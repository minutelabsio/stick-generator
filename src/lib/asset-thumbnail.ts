import type { FigureConfig } from '@shared/figure'
import type { AssetPart, Rig } from '@shared/rig'
import type { LibraryAsset } from '@shared/api-types'
import { createCanvas, get2dContext, loadImage } from './images'

const THUMBNAIL_PADDING = 12
// Stand-ins for a recoloured part whose colour hasn't been chosen yet.
const UNTINTED_MASK_COLOR = '#d9d9d9'
const UNTINTED_LINE_COLOR = '#2b2b2b'
const BYTES_PER_PIXEL = 4
const ALPHA_OFFSET = 3
// Tinted thumbnails vary with every colour tried, so old ones are dropped past this.
const THUMBNAIL_CACHE_LIMIT = 600

// Back to front, the order the renderer draws one asset's own parts in.
const PART_ORDER: AssetPart[] = ['backMask', 'backLine', 'mask', 'line']
const MASK_PARTS = new Set<AssetPart>(['backMask', 'mask'])

interface CropBox {
  left: number
  top: number
  width: number
  height: number
}

interface PreparedAsset {
  parts: { part: AssetPart, image: HTMLImageElement }[]
  crop: CropBox
}

// A part maps to its chosen colour, or to null when it is recoloured at render time
// but no colour is chosen yet. Parts drawn as-is are absent.
type PartTints = Partial<Record<AssetPart, string | null>>

const preparedAssets = new Map<string, Promise<PreparedAsset | null>>()
const thumbnails = new Map<string, Promise<string>>()

// Draws the asset in the figure's current colours, so designers browse shapes the way
// they will look rather than as grey line art.
export function assetThumbnail(asset: LibraryAsset, rig: Rig, colors: FigureConfig['colors'] = {}) {
  const tints = partTints({ rig, slotId: asset.slot, colors })
  const key = `${asset.id}:${JSON.stringify(tints)}`
  const cached = thumbnails.get(key)
  if (cached) return cached
  const thumbnail = drawThumbnail(asset, tints)
  thumbnails.set(key, thumbnail)
  evictOldestThumbnails()
  return thumbnail
}

function partTints({ rig, slotId, colors }: { rig: Rig, slotId: string, colors: FigureConfig['colors'] }): PartTints {
  return Object.fromEntries(rig.layers.flatMap(({ slot, part, colorRole }) =>
    (slot === slotId && colorRole ? [[part, colors[colorRole] ?? null]] : [])))
}

function evictOldestThumbnails() {
  const excess = thumbnails.size - THUMBNAIL_CACHE_LIMIT
  if (excess <= 0) return
  for (const key of [...thumbnails.keys()].slice(0, excess)) thumbnails.delete(key)
}

async function drawThumbnail(asset: LibraryAsset, tints: PartTints) {
  const prepared = await prepareAsset(asset)
  if (!prepared) return ''
  const { crop, parts } = prepared
  const context = get2dContext(createCanvas(crop.width, crop.height))
  for (const { part, image } of parts) context.drawImage(croppedPart({ part, image, crop, tints }), 0, 0)
  return context.canvas.toDataURL()
}

// Tints after cropping, so each colour change only fills a thumbnail-sized canvas.
function croppedPart({ part, image, crop, tints }: { part: AssetPart, image: HTMLImageElement, crop: CropBox, tints: PartTints }) {
  const context = get2dContext(createCanvas(crop.width, crop.height))
  context.drawImage(image, crop.left, crop.top, crop.width, crop.height, 0, 0, crop.width, crop.height)
  if (!(part in tints)) return context.canvas
  const fallback = MASK_PARTS.has(part) ? UNTINTED_MASK_COLOR : UNTINTED_LINE_COLOR
  context.globalCompositeOperation = 'source-in'
  context.fillStyle = tints[part] ?? fallback
  context.fillRect(0, 0, crop.width, crop.height)
  return context.canvas
}

// Loading and cropping are the slow steps and don't depend on colour, so they run once
// per asset.
function prepareAsset(asset: LibraryAsset) {
  const cached = preparedAssets.get(asset.id)
  if (cached) return cached
  const preparing = loadAndCrop(asset)
  preparedAssets.set(asset.id, preparing)
  return preparing
}

async function loadAndCrop(asset: LibraryAsset): Promise<PreparedAsset | null> {
  const loaded = await Promise.all(PART_ORDER.map(async (part) => {
    const url = asset.partUrls[part]
    return url ? { part, image: await loadImage(url) } : null
  }))
  const parts = loaded.filter(entry => entry !== null)
  const [first] = parts
  if (!first) return null

  const context = get2dContext(createCanvas(first.image.width, first.image.height), { willReadFrequently: true })
  for (const { image } of parts) context.drawImage(image, 0, 0)
  return { parts, crop: cropBox(context) }
}

// Assets are full-canvas PNGs with the item somewhere small, so crop to what's drawn.
function cropBox(context: CanvasRenderingContext2D): CropBox {
  const { width, height } = context.canvas
  const box = contentBounds(context.getImageData(0, 0, width, height))
  const left = Math.max(0, box.left - THUMBNAIL_PADDING)
  const top = Math.max(0, box.top - THUMBNAIL_PADDING)
  return {
    left,
    top,
    width: Math.min(width, box.right + THUMBNAIL_PADDING) - left,
    height: Math.min(height, box.bottom + THUMBNAIL_PADDING) - top,
  }
}

// Mutates one box while scanning ~670k pixels; allocating a new one per pixel would crawl.
function contentBounds({ data, width, height }: ImageData) {
  const box = { left: width, top: height, right: 0, bottom: 0 }
  for (const pixelIndex of Array.from({ length: width * height }).keys()) {
    if (data[pixelIndex * BYTES_PER_PIXEL + ALPHA_OFFSET] === 0) continue
    const x = pixelIndex % width
    const y = Math.floor(pixelIndex / width)
    box.left = Math.min(box.left, x)
    box.top = Math.min(box.top, y)
    box.right = Math.max(box.right, x)
    box.bottom = Math.max(box.bottom, y)
  }
  return box
}
