<script lang="ts">
import { onMount } from 'svelte'
import { createCanvas } from '@wellcaffeinated/view-draw'
import ImageSelector from './ImageSelector.svelte'
import ColorSelector from './ColorSelector.svelte'
import { addNotification } from '$lib/notifications.js'
import StickAssets from '$lib/stick-assets.js'
// import CustomImageSelector from './CustomImageSelector.svelte'
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
let Assets : any = {}

export let prefix
export let dataEntry
export let onSaved

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
    hat,
    custom
  ] = await Promise.all([
    loadImage(Assets.bodies[0]),
    loadImage(Assets.heads[0]),
    loadImage(props.hairStyle),
    loadImage(props.facialHairStyle),
    loadImage(props.glasses),
    loadImage(props.accessory),
    loadImage(props.hat),
    loadImage(props.customImage)
  ])

  const [
    headMask,
    hairMask,
    hatMask
  ] = await Promise.all([
    loadImage(getMaskFile(Assets.heads[0])),
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

  let layers = [
    body,
    skinColor,
    facialHair,
    head,
    hairColor,
    hair,
    glasses,
    accessory,
    hatColor,
    hat,
  ]

  layers.splice(-props.customImageLayerIndex - 1, 0, custom)

  layers.forEach((layer) => drawImage(ctx, layer, 0, 0))
  clearCanvas(Draw.ctx)
  drawImage(Draw.ctx, ctx.canvas, 0, 0)
}

function downloadStickFigure(){
  const id = dataEntry.id || 'unknown'
  downloadCanvasImage(Drawing.canvas, `stick-figure-${id}`, true)
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
let customImage = null
let customImageLayerIndex = 0

const reset = () => {
  hat = null
  hatColor = null
  hairStyle = null
  hairColor = null
  skinColor = null
  facialHairStyle = null
  facialHairColor = null
  glasses = null
  accessory = null
  customImage = null
  customImageLayerIndex = 0
}

$: if (hat && !hatColor){
  hatColor = Assets?.hatColors[0]
}
$: if (hairStyle && !hairColor){
  hairColor = Assets?.hairColors[0]
}
$: if (facialHairStyle && !facialHairColor){
  facialHairColor = Assets?.facialHairColors[0]
}

const withDefaults = (obj) => {
  if (!dataEntry.stickProps){ return obj }
  for (const key of Object.keys(obj)){
    obj[key] = obj[key] === null ? dataEntry?.stickProps[key] : obj[key]
  }
  return obj
}

let oldEntry
const checkReset = (dataEntry) => {
  if (dataEntry !== oldEntry) {
    oldEntry = dataEntry
    reset()
  }
  return true
}

$: stickFigureCfg = checkReset(dataEntry) && withDefaults({
  hat,
  hatColor,
  hairStyle,
  hairColor,
  skinColor,
  facialHairStyle,
  facialHairColor,
  glasses,
  accessory,
  customImage,
  customImageLayerIndex
})
$: draw(Drawing, stickFigureCfg)
const nLayers = 12

function changeLayer(n){
  customImageLayerIndex = Math.min(nLayers, Math.max(0, n + customImageLayerIndex))
}

async function saveImage(){
  const dataURI = Drawing.canvas.toDataURL()
  try {
    const id = dataEntry.id
    if (!id){
      throw new Error('Could not read id address for this entry')
    }
    const img = (await fetch(dataURI))
    const res = await fetch(`/api/images/${prefix}/${id}.png`, {
      method: 'POST',
      headers: {
        "Content-Type": "image/png"
      },
      body: await img.blob(),
    })
    if (!res.ok){
      const msg = await res.text()
      throw new Error(msg)
    }
    await onSaved(stickFigureCfg)
    addNotification('Saved Image', 'success')
  } catch (e) {
    addNotification(e.message, 'error')
  }
}

onMount(async () => {
  Assets = await StickAssets.load()
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
    <div class="">
      <button class="btn btn-wide btn-secondary" on:click={saveImage}>Save</button>
      <button class="btn btn-wide btn-secondary" on:click={downloadStickFigure}>Download</button>
    </div>
  </div>
  <div class="controls flex-none">
    <div class="stick-option">
      <h3>Hair Style</h3>
      <ImageSelector cropped bind:selected={hairStyle} images={Assets.hairStyles}/>
      <ColorSelector bind:selected={hairColor} colors={Assets.hairColors}/>
    </div>
    <div class="stick-option">
      <h3>Hat</h3>
      <ImageSelector cropped bind:selected={hat} images={Assets.hats}/>
      <ColorSelector bind:selected={hatColor} colors={Assets.hatColors}/>
    </div>
    <div class="stick-option">
      <h3>Skin Color</h3>
      <ColorSelector bind:selected={skinColor} colors={Assets.skinColors}/>
    </div>
    <div class="stick-option">
      <h3>Facial Hair</h3>
      <ImageSelector cropped bind:selected={facialHairStyle} images={Assets.facialHairStyles}/>
      <ColorSelector bind:selected={facialHairColor} colors={Assets.facialHairColors}/>
    </div>
    <div class="stick-option">
      <h3>Glasses</h3>
      <ImageSelector cropped bind:selected={glasses} images={Assets.glasses}/>
    </div>
    <div class="stick-option">
      <h3>Accessory</h3>
      <ImageSelector cropped bind:selected={accessory} images={Assets.accessories}/>
    </div>
    <div class="stick-option">
      <h3>Custom Images</h3>
      <div class="btn-group">
        <button class="btn" on:click={() => changeLayer(1)}>«</button>
        <button class="btn">Layer {nLayers - customImageLayerIndex}</button>
        <button class="btn" on:click={() => changeLayer(-1)}>»</button>
      </div>
      <!-- <CustomImageSelector bind:selected={customImage}/> -->
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