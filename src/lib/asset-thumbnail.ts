import type { LibraryAsset } from '@shared/api-types'
import { createCanvas, get2dContext, loadImage } from './images'

const THUMBNAIL_PADDING = 12
const MASK_PREVIEW_COLOR = '#d9d9d9'
const BYTES_PER_PIXEL = 4
const ALPHA_OFFSET = 3

const thumbnailCache = new Map<string, Promise<string>>()

// Assets are full-canvas PNGs with the item somewhere small, so crop to what's drawn.
export function assetThumbnail(asset: LibraryAsset) {
  const cached = thumbnailCache.get(asset.id)
  if (cached) return cached
  const thumbnail = drawCroppedThumbnail(asset)
  thumbnailCache.set(asset.id, thumbnail)
  return thumbnail
}

async function drawCroppedThumbnail(asset: LibraryAsset) {
  const layerUrls = [asset.partUrls.backMask, asset.partUrls.backLine, asset.partUrls.mask, asset.partUrls.line]
  const images = await Promise.all(layerUrls.map(url => (url ? loadImage(url) : Promise.resolve(null))))
  const [firstImage] = images.filter(image => image !== null)
  if (!firstImage) return ''

  const context = get2dContext(createCanvas(firstImage.width, firstImage.height), { willReadFrequently: true })
  images.forEach((image, index) => {
    if (!image) return
    const isMask = index % 2 === 0
    context.drawImage(isMask ? greyedOut(image) : image, 0, 0)
  })
  return cropToContent(context)
}

function greyedOut(image: HTMLImageElement) {
  const context = get2dContext(createCanvas(image.width, image.height))
  context.drawImage(image, 0, 0)
  context.globalCompositeOperation = 'source-in'
  context.fillStyle = MASK_PREVIEW_COLOR
  context.fillRect(0, 0, image.width, image.height)
  return context.canvas
}

function cropToContent(context: CanvasRenderingContext2D) {
  const { width, height } = context.canvas
  const box = contentBounds(context.getImageData(0, 0, width, height))
  const left = Math.max(0, box.left - THUMBNAIL_PADDING)
  const top = Math.max(0, box.top - THUMBNAIL_PADDING)
  const cropWidth = Math.min(width, box.right + THUMBNAIL_PADDING) - left
  const cropHeight = Math.min(height, box.bottom + THUMBNAIL_PADDING) - top
  const cropped = get2dContext(createCanvas(cropWidth, cropHeight))
  cropped.drawImage(context.canvas, left, top, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight)
  return cropped.canvas.toDataURL()
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
