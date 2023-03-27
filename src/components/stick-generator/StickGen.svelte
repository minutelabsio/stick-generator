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
  import LoadingSpinner from '$components/common/LoadingSpinner.svelte'

let canvasWrap
let Drawing
let Assets : any = {}
let ready = false

export let prefix
export let dataEntry
export let onSaved

function randomSelection(choices){
  if (!choices){ return undefined }
  const i = Math.floor(Math.random() * choices.length)
  return choices[i]
}

async function draw(Draw, props){
  if (!Draw || !props){ return }
  console.log(props)
  const { ctx } = Draw.offcanvas
  const { width, height } = ctx.canvas
  const [hairStyleFront, hairStyleBack] = Array.isArray(props.hairStyle) ? props.hairStyle : [props.hairStyle]
  const [
    body,
    head,
    hairFront,
    hairBack,
    beardMask,
    mustacheMask,
    glasses,
    accessory,
    hat,
    custom
  ] = await Promise.all([
    loadImage(props.body),
    loadImage(Assets.heads[0]),
    loadImage(hairStyleFront),
    loadImage(hairStyleBack),
    loadImage(props.beardStyle),
    loadImage(props.mustacheStyle),
    loadImage(props.glasses),
    loadImage(props.accessory),
    loadImage(props.hat),
    loadImage(props.customImage)
  ])

  const [
    headMask,
    hairFrontMask,
    hairBackMask,
    hatMask
  ] = await Promise.all([
    loadImage(getMaskFile(Assets.heads[0])),
    loadImage(getMaskFile(hairStyleFront)),
    loadImage(getMaskFile(hairStyleBack)),
    loadImage(getMaskFile(props.hat)),
  ])

  const { canvas: skinColor}  = offscreenCanvas(width, height, (ctx) => {
    drawColorMask(ctx, headMask, props.skinColor)
  })
  const { canvas: hairFrontColor}  = offscreenCanvas(width, height, (ctx) => {
    drawColorMask(ctx, hairFrontMask, props.hairColor)
  })
  const { canvas: hairBackColor}  = offscreenCanvas(width, height, (ctx) => {
    drawColorMask(ctx, hairBackMask, props.hairColor)
  })
  const { canvas: beard } = offscreenCanvas(width, height, (ctx) => {
    drawColorMask(ctx, beardMask, props.facialHairColor)
  })
  const { canvas: mustache } = offscreenCanvas(width, height, (ctx) => {
    drawColorMask(ctx, mustacheMask, props.facialHairColor)
  })
  const { canvas: hatColor } = offscreenCanvas(width, height, (ctx) => {
    drawColorMask(ctx, hatMask, props.hatColor)
  })

  clearCanvas(ctx)

  let layers = [
    hairBackColor,
    hairBack,
    body,
    skinColor,
    beard,
    mustache,
    head,
    hairFrontColor,
    hairFront,
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

let body
let hat
let hatColor
let hairStyle
let hairColor
let skinColor
let beardStyle
let mustacheStyle
let facialHairColor
let glasses
let accessory
let customImage
let customImageLayerIndex = 0

const reset = () => {
  body = undefined
  hat = undefined
  hatColor = undefined
  hairStyle = undefined
  hairColor = undefined
  skinColor = undefined
  beardStyle = undefined
  mustacheStyle = undefined
  facialHairColor = undefined
  glasses = undefined
  accessory = undefined
  customImage = undefined
  customImageLayerIndex = 0
}

$: if (hat && !hatColor){
  hatColor = Assets?.hatColors[0]
}
$: if (hairStyle && !hairColor){
  hairColor = Assets?.hairColors[0]
}
$: if ((beardStyle || mustacheStyle) && !facialHairColor){
  facialHairColor = Assets?.facialHairColors[0]
}

const withDefaults = (obj) => {
  if (!dataEntry.stickProps){ return obj }
  for (const key of Object.keys(obj)){
    obj[key] = obj[key] === undefined ? dataEntry?.stickProps[key] : obj[key]
  }
  if (!obj.body){
    obj.body = randomSelection(Assets.bodies)
  }
  if (!obj.skinColor){
    obj.skinColor = randomSelection(Assets.skinColor)
  }
  if (!obj.facialHairColor){
    obj.facialHairColor = obj.hairColor
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

$: stickFigureCfg = ready && checkReset(dataEntry) && withDefaults({
  body,
  hat,
  hatColor,
  hairStyle,
  hairColor,
  skinColor,
  beardStyle,
  mustacheStyle,
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
  Assets = await StickAssets.load(true)
  ready = true
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
  {#if ready}
  <div class="controls flex-none">
    <div class="stick-option">
      <h3>Bodies</h3>
      <ImageSelector cropped bind:selected={body} images={Assets.bodies}/>
    </div>
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
      <h3>Beard</h3>
      <ImageSelector cropped bind:selected={beardStyle} images={Assets.beardStyles}/>
      <h3>Mustache</h3>
      <ImageSelector cropped bind:selected={mustacheStyle} images={Assets.mustacheStyles}/>
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
    <!-- <div class="stick-option">
      <h3>Custom Images</h3>
      <div class="btn-group">
        <button class="btn" on:click={() => changeLayer(1)}>«</button>
        <button class="btn">Layer {nLayers - customImageLayerIndex}</button>
        <button class="btn" on:click={() => changeLayer(-1)}>»</button>
      </div>
      <CustomImageSelector bind:selected={customImage}/>
    </div> -->
  </div>
  {:else}
  <LoadingSpinner />
  {/if}
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