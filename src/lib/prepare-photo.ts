import { createCanvas, get2dContext } from './images'

const MAX_PHOTO_EDGE_PX = 1600
const JPEG_QUALITY = 0.85

// Re-encoding through a canvas drops all EXIF metadata (including GPS location) and
// shrinks phone photos to a size designers need, before anything leaves the device.
export async function preparePhoto(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error('We couldn\'t read that image. Try a JPEG or PNG photo.')
  })
  const scale = Math.min(1, MAX_PHOTO_EDGE_PX / Math.max(bitmap.width, bitmap.height))
  const canvas = createCanvas(Math.round(bitmap.width * scale), Math.round(bitmap.height * scale))
  const context = get2dContext(canvas)
  // JPEG has no transparency, and transparent pixels would otherwise turn black.
  context.fillStyle = '#FFFFFF'
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => (blob ? resolve(blob) : reject(new Error('Could not prepare the photo.'))), 'image/jpeg', JPEG_QUALITY)
  })
}
