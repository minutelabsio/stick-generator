<script>
import { croppedImage, drawImage, loadImage, offscreenCanvas } from '$lib/canvas.js'
export let cropped = false
export let images = []
export let selected
export let padding = 6
export let imageWidth = 100
const select = (item) => () => {
  // deselect
  if (selected === item){
    selected = null
  } else {
    selected = item
  }
}

let imageList = []


async function getMaybeCropped(img, cropped){
  const isStr = typeof img === 'string'
  if (!cropped){
    if (isStr){ return img }
    return img.toDataURL()
  }
  const image = isStr ? await loadImage(img) : img
  const s = image.width / imageWidth
  return croppedImage(image, s * padding)
}

async function getComposite(images, cropped){
  if (!Array.isArray(images)) { return await getMaybeCropped(images, cropped) }
  const layers = await Promise.all(images.map(src => loadImage(src)))
  const scale = imageWidth / layers[0].width
  const ctx = offscreenCanvas(scale * layers[0].width, scale * layers[0].height, (ctx) => {
    ctx.scale(scale, scale)
    layers.forEach(img => drawImage(ctx, img, 0, 0))
  })
  return await getMaybeCropped(ctx.canvas, cropped)
}

let lastImages
async function updateImages(images, cropped){
  if (lastImages === images){ return }
  lastImages = images
  if (!Array.isArray(images)){ return }
  imageList = await Promise.all(images.map(async assets =>
    ({ src: await getComposite(assets, cropped), value: assets }))
  )
}

$: updateImages(images, cropped)
</script>

<div class="carousel selector stick-selector">
  {#each imageList as {src, value}}
    <div on:click={select(value)} class="carousel-item" class:selected="{selected === value}">
      <img src={src} width="{imageWidth}"/>
    </div>
  {/each}
</div>

<style>
.selector {
  cursor: pointer;
  /* border: 1px solid #666; */
}
.carousel-item {
  filter: brightness(0.8) saturate(0.8);
  transition: filter 0.15s ease;
  background: white;
}
.carousel-item:hover,
.carousel-item.selected {
  filter: brightness(1.25) saturate(1);
}
</style>