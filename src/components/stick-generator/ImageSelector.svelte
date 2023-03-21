<script>
import { croppedImage, loadImage } from '$lib/canvas.js'
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

async function updateImages(images, cropped){
  if (!Array.isArray(images)){ return }
  if (!cropped){
    imageList = images.map(src => ({ src, value: src }))
    return
  }
  imageList = await Promise.all(images.map(async (src) => {
    const img = await loadImage(src)
    return {
      src: croppedImage(img, padding),
      value: src
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