import type { FigureConfig } from '@shared/figure'
import type { Rig } from '@shared/rig'
import type { LibraryAsset } from '@shared/api-types'
import { createCanvas, get2dContext, loadImage } from './images'

interface RenderOptions {
  canvas: HTMLCanvasElement
  rig: Rig
  figure: FigureConfig
  assetsById: Map<string, LibraryAsset>
}

export interface DrawStep {
  url: string
  color: string | undefined
}

// Back to front, skipping layers whose slot is empty or whose asset lacks that part.
export function drawSteps({ rig, figure, assetsById }: Omit<RenderOptions, 'canvas'>): DrawStep[] {
  return rig.layers.flatMap((layer) => {
    const assetId = figure.assets[layer.slot]
    const url = assetId ? assetsById.get(assetId)?.partUrls[layer.part] : undefined
    if (!url) return []
    return [{ url, color: layer.colorRole ? figure.colors[layer.colorRole] : undefined }]
  })
}

// Images load in parallel first so layers never draw out of order.
export async function renderFigure({ canvas, rig, figure, assetsById }: RenderOptions) {
  const loaded = await Promise.all(drawSteps({ rig, figure, assetsById }).map(loadStep))
  const { width, height } = rig.canvas
  const context = get2dContext(canvas)
  const scratch = get2dContext(createCanvas(width, height))

  context.clearRect(0, 0, width, height)
  for (const { image, color } of loaded) context.drawImage(color ? tintImage(scratch, image, color) : image, 0, 0)
}

const loadStep = async (step: DrawStep) => ({ ...step, image: await loadImage(step.url) })

// Keeps the image's alpha and replaces its colour: a flat fill for masks, recoloured
// line art for line parts. The same technique v1 used.
function tintImage(scratch: CanvasRenderingContext2D, image: HTMLImageElement, color: string) {
  const { width, height } = scratch.canvas
  scratch.globalCompositeOperation = 'source-over'
  scratch.clearRect(0, 0, width, height)
  scratch.drawImage(image, 0, 0)
  scratch.globalCompositeOperation = 'source-in'
  scratch.fillStyle = color
  scratch.fillRect(0, 0, width, height)
  return scratch.canvas
}
