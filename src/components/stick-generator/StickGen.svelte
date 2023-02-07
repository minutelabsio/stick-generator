<script lang="ts">
import { onMount } from 'svelte'
import { createCanvas } from '@wellcaffeinated/view-draw'
import ImageSelector from './ImageSelector.svelte'
import ColorSelector from './ColorSelector.svelte'
import StickAssets from '$lib/stick-assets.js'
import {
  downloadCanvasImage,
  loadImage,
  drawImage,
  getMaskFile,
  clearCanvas,
  offscreenCanvas,
  drawColorMask,
} from '$lib/canvas.js'

let canvasWrap
let Drawing

function randomSelection(choices){
  const i = Math.floor(Math.random() * choices.length)
  return choices[i]
}

async function draw(Draw, props){
  if (!Draw){ return }
  const { ctx } = Draw.offcanvas
  const { width, height } = ctx.canvas
  const [
    body,
    head,
    hair,
    facialHairMask,
    glasses,
    accessory,
    hat
  ] = await Promise.all([
    loadImage(StickAssets.bodies[0]),
    loadImage(StickAssets.heads[0]),
    loadImage(props.hairStyle),
    loadImage(props.facialHairStyle),
    loadImage(props.glasses),
    loadImage(props.accessory),
    loadImage(props.hat)
  ])

  const [
    headMask,
    hairMask,
    hatMask
  ] = await Promise.all([
    loadImage(getMaskFile(StickAssets.heads[0])),
    loadImage(getMaskFile(props.hairStyle)),
    loadImage(getMaskFile(props.hat)),
  ])

  const { canvas: skinColor}  = offscreenCanvas(width, height, (ctx) => {
    drawColorMask(ctx, headMask, props.skinColor)
  })
  const { canvas: hairColor}  = offscreenCanvas(width, height, (ctx) => {
    drawColorMask(ctx, hairMask, props.hairColor)
  })
  const { canvas: facialHair } = offscreenCanvas(width, height, (ctx) => {
    drawColorMask(ctx, facialHairMask, props.facialHairColor)
  })
  const { canvas: hatColor } = offscreenCanvas(width, height, (ctx) => {
    drawColorMask(ctx, hatMask, props.hatColor)
  })

  clearCanvas(ctx)

  drawImage(ctx, body, 0, 0)
  drawImage(ctx, skinColor, 0, 0)
  drawImage(ctx, facialHair, 0, 0)
  drawImage(ctx, head, 0, 0)
  drawImage(ctx, hairColor, 0, 0)
  drawImage(ctx, hair, 0, 0)
  drawImage(ctx, glasses, 0, 0)
  drawImage(ctx, accessory, 0, 0)
  drawImage(ctx, hatColor, 0, 0)
  drawImage(ctx, hat, 0, 0)
  clearCanvas(Draw.ctx)
  drawImage(Draw.ctx, ctx.canvas, 0, 0)
}

function downloadStickFigure(){
  downloadCanvasImage(Drawing.canvas, 'stick-figure', true)
}

let hat = null
let hatColor = null
let hairStyle = null
let hairColor = null
let skinColor = null
let facialHairStyle = null
let facialHairColor = null
let glasses = null
let accessory = null

$: if (hat && !hatColor){
  hatColor = StickAssets.hatColors[0]
}
$: if (hairStyle && !hairColor){
  hairColor = StickAssets.hairColors[0]
}
$: if (facialHairStyle && !facialHairColor){
  facialHairColor = StickAssets.facialHairColors[0]
}


$: stickFigureCfg = {
  hat,
  hatColor,
  hairStyle,
  hairColor,
  skinColor,
  facialHairStyle,
  facialHairColor,
  glasses,
  accessory
}
$: draw(Drawing, stickFigureCfg)

onMount(() => {
  const cfg = {
    el: canvasWrap,
    width: 710,
    height: 943,
    autoResize: false,
    background: 'transparent'
  }
  Drawing = createCanvas(cfg)
  const offcanvas = createCanvas({
    ...cfg,
    el: document.createElement('canvas')
  })
  offcanvas.canvas.width = cfg.width
  offcanvas.canvas.height = cfg.height
  Drawing.offcanvas = offcanvas
  draw(Drawing, stickFigureCfg)
})
</script>

<div class="grid grid-rows-1 grid-flow-col gap-4">
  <div class="display">
    <div bind:this={canvasWrap} class="flex-none canvas-wrap">
    </div>
    <button class="btn btn-wide" on:click={downloadStickFigure}>Download</button>
  </div>
  <div class="controls flex-none">
    <div class="stick-option">
      <h3>Hair Style</h3>
      <ImageSelector cropped bind:selected={hairStyle} images={StickAssets.hairStyles}/>
      <ColorSelector bind:selected={hairColor} colors={StickAssets.hairColors}/>
    </div>
    <div class="stick-option">
      <h3>Hat</h3>
      <ImageSelector cropped bind:selected={hat} images={StickAssets.hats}/>
      <ColorSelector bind:selected={hatColor} colors={StickAssets.hatColors}/>
    </div>
    <div class="stick-option">
      <h3>Skin Color</h3>
      <ColorSelector bind:selected={skinColor} colors={StickAssets.skinColors}/>
    </div>
    <div class="stick-option">
      <h3>Facial Hair</h3>
      <ImageSelector cropped bind:selected={facialHairStyle} images={StickAssets.facialHairStyles}/>
      <ColorSelector bind:selected={facialHairColor} colors={StickAssets.facialHairColors}/>
    </div>
    <div class="stick-option">
      <h3>Glasses</h3>
      <ImageSelector cropped bind:selected={glasses} images={StickAssets.glasses}/>
    </div>
    <div class="stick-option">
      <h3>Accessory</h3>
      <ImageSelector cropped bind:selected={accessory} images={StickAssets.accessories}/>
    </div>
  </div>
</div>

<style>
.canvas-wrap {
  overflow: hidden;
  width: 710px;
  height: 943px;
  border: 1px solid #666;
  background: white;
}
.controls {
  position: relative;
  min-width: 0;
}
.controls > * {
  overflow: hidden;
}
.stick-option {
  border: 1px solid #666;
  border-radius: 5px;
  margin-bottom: 1rem;
}
.stick-option h3 {
  margin: 0.5rem 0.5rem;
}
</style>