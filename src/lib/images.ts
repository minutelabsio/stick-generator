const imageCache = new Map<string, Promise<HTMLImageElement>>()

export function loadImage(url: string) {
  const cached = imageCache.get(url)
  if (cached) return cached
  const loading = new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error(`Could not load image ${url}`))
    image.src = url
  })
  imageCache.set(url, loading)
  return loading
}

export function createCanvas(width: number, height: number) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  return canvas
}

export function get2dContext(canvas: HTMLCanvasElement, options?: CanvasRenderingContext2DSettings) {
  const context = canvas.getContext('2d', options)
  if (!context) throw new Error('Canvas 2D is not available in this browser.')
  return context
}
