<script lang="ts">
import { onMount } from 'svelte'
import { createCanvas } from '@wellcaffeinated/view-draw'
import ImageSelector from './ImageSelector.svelte'
import ColorSelector from './ColorSelector.svelte'
import StickAssets from '$lib/stick-assets.js'

let canvasWrap
let Drawing

onMount(() => {
  Drawing = createCanvas({
    el: canvasWrap,
    width: 710,
    height: 943,
    autoResize: false,
    background: 'white'
  })
})

function loadImage(src){
  if (!src){ return null }
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.src = src
    img.onload = () => resolve(img)
    img.onerror = reject
  })
}

function drawImage(ctx, img, x, y){
  if (!img){ return }
  ctx.drawImage(img, x, y)
}

async function draw(Draw, props){
  if (!Draw){ return }
  const { ctx, clear } = Draw
  const [
    body,
    head,
    hair,
    facialHair,
    glasses,
    accessory
  ] = await Promise.all([
    loadImage(StickAssets.bodies[0]),
    loadImage(StickAssets.heads[0]),
    loadImage(props.hairStyle),
    loadImage(props.facialHairStyle),
    loadImage(props.glasses),
    loadImage(props.accessory)
  ])

  drawImage(ctx, body, 0, 0)
  drawImage(ctx, head, 0, 0)
  drawImage(ctx, hair, 0, 0)
  drawImage(ctx, facialHair, 0, 0)
  drawImage(ctx, glasses, 0, 0)
  drawImage(ctx, accessory, 0, 0)
}

let hairStyle = null
let hairColor = null
let skinColor = null
let facialHairStyle = null
let facialHairColor = null
let glasses = null
let accessory = null

$: stickFigureCfg = {
  hairStyle,
  hairColor,
  skinColor,
  facialHairStyle,
  facialHairColor,
  glasses,
  accessory
}
$: draw(Drawing, stickFigureCfg)

</script>

<div class="flex gap-4">
  <div bind:this={canvasWrap} class="flex-none canvas-wrap">
  </div>
  <div class="controls flex-1">
    <div class="stick-option">
      <h3>Hair Style</h3>
      <ImageSelector bind:selected={hairStyle} images={StickAssets.hairStyles}/>
    </div>
    <div class="stick-option">
      <h3>Hair Color</h3>
      <ColorSelector bind:selected={hairColor} colors={StickAssets.hairColors}/>
    </div>
    <div class="stick-option">
      <h3>Skin Color</h3>
      <ColorSelector bind:selected={skinColor} colors={StickAssets.skinColors}/>
    </div>
    <div class="stick-option">
      <h3>Facial Hair Style</h3>
      <ImageSelector bind:selected={facialHairStyle} images={StickAssets.facialHairStyles}/>
    </div>
    <div class="stick-option">
      <h3>Facial Hair Color</h3>
      <ColorSelector bind:selected={facialHairColor} colors={StickAssets.facialHairColors}/>
    </div>
    <div class="stick-option">
      <h3>Glasses</h3>
      <ImageSelector bind:selected={glasses} images={StickAssets.glasses}/>
    </div>
    <div class="stick-option">
      <h3>Accessory</h3>
      <ImageSelector bind:selected={accessory} images={StickAssets.accessories}/>
    </div>
  </div>
</div>

<style>
.canvas-wrap {
  overflow: hidden;
  width: 710px;
  height: 943px;
  border: 1px solid #666;
}
</style>