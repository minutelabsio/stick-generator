export function downloadCanvasImage(canvas, filename = 'stick-figure', timestamp = true) {
  const link = document.createElement('a')
  const ts = timestamp ? '-' + (new Date()).toISOString() : ''
  const name = `${filename}${ts}.png`
  link.download = name
  link.href = canvas.toDataURL()
  link.click()
}

export function loadImage(src){
  if (!src){ return null }
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.src = src
    img.onload = () => resolve(img)
    img.onerror = reject
  })
}

export function drawImage(ctx, img, x, y){
  if (!img){ return }
  ctx.drawImage(img, x, y)
}

export function getMaskFile(file){
  if (!file){ return null }
  const parts = file.split('/')
  parts[parts.length - 1] = 'mask' + parts[parts.length - 1]
  return parts.join('/')
}

export function clearCanvas(ctx){
  const { width, height } = ctx.canvas
  ctx.clearRect(0, 0, width, height)
}

export function getCanvasAsImage(ctx){
  const img = new Image()
  img.src = ctx.canvas.toDataURL()
  return img
}

export function offscreenCanvas(width, height, fn){
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d', {
    willReadFrequently: true
  })
  fn(ctx)
  return ctx
}

export function drawColorMask(ctx, mask, color){
  if (!mask){ return }
  const { width, height } = ctx.canvas
  const gco = ctx.globalCompositeOperation
  ctx.drawImage(mask, 0, 0)
  ctx.globalCompositeOperation = 'source-in'
  ctx.fillStyle = color || 'white'
  ctx.fillRect(0, 0, width, height)
  ctx.globalCompositeOperation = gco
}

export function* pixels(ctx, x0 = 0, y0 = 0){
  const canvas = ctx.canvas
  const w = canvas.width
  const h = canvas.height
  const imageData = ctx.getImageData(x0, y0, canvas.width, canvas.height)

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let index = (y * w + x) * 4
      yield {
        x, y,
        pixel: imageData.data.subarray(index, index + 4)
      }
    }
  }
}

export function boundingBox(ctx){
  let xmin = ctx.canvas.width
  let ymin = ctx.canvas.height
  let xmax = 0
  let ymax = 0
  for (let entry of pixels(ctx)){
    if (entry.pixel[3] > 0){
      xmin = Math.min(entry.x, xmin)
      ymin = Math.min(entry.y, ymin)
      xmax = Math.max(entry.x, xmax)
      ymax = Math.max(entry.y, ymax)
    }
  }
  return {
    xmin, ymin,
    xmax, ymax,
    width: xmax - xmin,
    height: ymax - ymin,
  }
}

export function croppedImage(img, padding = 0){
  const ctx = offscreenCanvas(img.width, img.height, (ctx) => {
    ctx.drawImage(img, 0, 0)
  })
  const box = boundingBox(ctx)
  box.xmin -= padding
  box.ymin -= padding
  box.xmax += padding
  box.ymax += padding
  box.width += 2 * padding
  box.height += 2 * padding
  const cut = ctx.getImageData(box.xmin, box.ymin, box.width, box.height)
  ctx.canvas.width = box.width
  ctx.canvas.height = box.height
  ctx.putImageData(cut, 0, 0)
  return ctx.canvas.toDataURL()
}