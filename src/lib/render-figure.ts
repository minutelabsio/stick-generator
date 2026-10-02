import { CANVAS_HEIGHT, CANVAS_WIDTH, LAYERS } from '@shared/figure'
import type { FigureConfig } from '@shared/figure'
import type { LibraryAsset } from '@shared/api-types'
import { createCanvas, get2dContext, loadImage } from './images'

interface RenderOptions {
  canvas: HTMLCanvasElement
  figure: FigureConfig
  assetsById: Map<string, LibraryAsset>
}

export interface DrawStep {
  url: string
  color: string | undefined
}

// Back to front, skipping layers whose slot is empty or whose asset lacks that part.
export function drawSteps({ figure, assetsById }: Omit<RenderOptions, 'canvas'>): DrawStep[] {
  return LAYERS.flatMap((layer) => {
    const assetId = figure.assets[layer.slot]
    const url = assetId ? assetsById.get(assetId)?.partUrls[layer.part] : undefined
    if (!url) return []
    return [{ url, color: layer.colorRole ? figure.colors[layer.colorRole] : undefined }]
  })
}

// Images load in parallel first so layers never draw out of order.
export async function renderFigure({ canvas, figure, assetsById }: RenderOptions) {
  const loaded = await Promise.all(drawSteps({ figure, assetsById }).map(loadStep))
  const context = get2dContext(canvas)
  const scratch = get2dContext(createCanvas(CANVAS_WIDTH, CANVAS_HEIGHT))

  context.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
  for (const { image, color } of loaded) context.drawImage(color ? tintImage(scratch, image, color) : image, 0, 0)
}

const loadStep = async (step: DrawStep) => ({ ...step, image: await loadImage(step.url) })

// Keeps the image's alpha and replaces its colour: a flat fill for masks, recoloured
// line art for line parts. The same technique v1 used.
function tintImage(scratch: CanvasRenderingContext2D, image: HTMLImageElement, color: string) {
  scratch.globalCompositeOperation = 'source-over'
  scratch.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
  scratch.drawImage(image, 0, 0)
  scratch.globalCompositeOperation = 'source-in'
  scratch.fillStyle = color
  scratch.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
  return scratch.canvas
}
