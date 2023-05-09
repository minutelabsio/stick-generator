<script>
import { croppedImage, drawImage, loadImage, offscreenCanvas } from '$lib/canvas.js'
export let cropped = false
export let images = Promise.resolve([])
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

// takes the asset which is possibly an array and returns the filename without the path
const getName = (asset) => {
  if (Array.isArray(asset)){ return asset[0].split('/').pop() }
  return asset.split('/').pop()
}

let lastImages
async function updateImages(imagePromise, cropped){
  const images = await imagePromise
  if (lastImages === images){ return }
  lastImages = images.map(asset => ({ name: getName(asset), value: asset }))
  if (!Array.isArray(images)){ return }
  imageList = await Promise.all(images.map(async assets =>
    ({ src: await getComposite(assets, cropped), value: assets, name: getName(assets) }))
  )
}

$: updateImages(images, cropped)
</script>

<div class="carousel selector stick-selector">
  {#await images}
    <p>Loading...</p>
  {:then images}
    {#each imageList as {src, value, name}}
      <div on:click={select(value)} class="carousel-item" class:selected="{selected === value}"  data-alt={name}>
        <img src={src} width="{imageWidth}" alt={name}/>
      </div>
    {/each}
  {:catch error}
    <p>Error loading images</p>
  {/await}
</div>

<style>
.selector {
  cursor: pointer;
  flex-wrap: wrap;
  /* border: 1px solid #666; */
}
.carousel-item {
  position: relative;
  filter: brightness(0.8) saturate(0.8);
  transition: filter 0.15s ease;
  background: white;
  overflow: visible;
}
.carousel-item img {
  height: intrinsic;
  align-self: center;
}
.carousel-item:hover {
  z-index: 1;
}
.carousel-item:hover,
.carousel-item.selected {
  filter: brightness(1.25) saturate(1);
}
/* create popup for alt tags on images */
.carousel-item:hover::after {
  content: attr(data-alt);
  position: absolute;
  bottom: 0em;
  left: 0;
  padding: 0.25em;
  background: white;
  z-index: 3;
  color: red;
  width: max-content;
}
</style>