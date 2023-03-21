<script>
import { croppedImage, drawImage, loadImage, offscreenCanvas } from '$lib/canvas.js'
export let cropped = false
export let images = []
export let selected
export let padding = 42
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

async function getComposite(images){
  if (!Array.isArray(images)) { return images }
  const layers = await Promise.all(images.map(src => loadImage(src)))
  const ctx = offscreenCanvas(layers[0].width, layers[0].height, (ctx) => {
    layers.forEach(img => drawImage(ctx, img, 0, 0))
  })
  return ctx.canvas.toDataURL()
}

async function updateImages(images, cropped){
  if (!Array.isArray(images)){ return }
  if (!cropped){
    imageList = await Promise.all(images.map(async assets =>
      ({ src: await getComposite(assets), value: assets }))
    )
    return
  }
  imageList = await Promise.all(images.map(async (assets) => {
    const src = await getComposite(assets)
    const img = await loadImage(src)
    return {
      src: croppedImage(img, padding),
      value: assets
    }
  }))
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