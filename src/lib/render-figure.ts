import { CANVAS_HEIGHT, CANVAS_WIDTH, LAYERS } from '@shared/figure'
import type { FigureConfig, Layer } from '@shared/figure'
import type { LibraryAsset } from '@shared/api-types'
import { createCanvas, get2dContext, loadImage } from './images'

interface RenderOptions {
  canvas: HTMLCanvasElement
  figure: FigureConfig
  assetsById: Map<string, LibraryAsset>
}

interface ResolvedLayer {
  image: HTMLImageElement
  color: string | undefined
}

// Drawn in LAYERS order. Images load in parallel first so layers never draw out of order.
export async function renderFigure({ canvas, figure, assetsById }: RenderOptions) {
  const resolved = await Promise.all(LAYERS.map(layer => resolveLayer({ layer, figure, assetsById })))
  const context = get2dContext(canvas)
  const scratch = get2dContext(createCanvas(CANVAS_WIDTH, CANVAS_HEIGHT))

  context.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
  for (const layer of resolved) {
    if (!layer) continue
    const source = layer.color ? tintImage(scratch, layer.image, layer.color) : layer.image
    context.drawImage(source, 0, 0)
  }
}

async function resolveLayer({ layer, figure, assetsById }: Omit<RenderOptions, 'canvas'> & { layer: Layer }) {
  const assetId = figure.assets[layer.slot]
  const url = assetId ? assetsById.get(assetId)?.partUrls[layer.part] : undefined
  if (!url) return null
  const color = layer.colorRole ? figure.colors[layer.colorRole] : undefined
  return { image: await loadImage(url), color } satisfies ResolvedLayer
}

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
