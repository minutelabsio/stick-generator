<script lang="ts">
import { onMount } from 'svelte'
import { createCanvas } from '@wellcaffeinated/view-draw'
import ImageSelector from './ImageSelector.svelte'
import ColorSelector from './ColorSelector.svelte'
import { addNotification } from '$lib/notifications.js'
import _StickAssets from '$lib/stick-assets.js'
import AssetUpload from './AssetUpload.svelte'
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

let StickAssets = _StickAssets
let canvasWrap
let Drawing
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
  const allHeads = await StickAssets.heads.value
  const [
    body,
    head,
    hairFront,
    hairBack,
    beardMask,
    mustacheMask,
    longbeard,
    glasses,
    accessory,
    hat,
    custom
  ] = await Promise.all([
    loadImage(props.body),
    loadImage(allHeads[0]),
    loadImage(hairStyleFront),
    loadImage(hairStyleBack),
    loadImage(props.beardStyle),
    loadImage(props.mustacheStyle),
    loadImage(props.longbeardStyle),
    loadImage(props.glasses),
    loadImage(props.accessory),
    loadImage(props.hat),
    loadImage(props.customImage)
  ])

  const [
    headMask,
    longbeardMask,
    hairFrontMask,
    hairBackMask,
    hatMask
  ] = await Promise.all([
    loadImage(getMaskFile(allHeads[0])),
    loadImage(getMaskFile(props.longbeardStyle)),
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
  const { canvas: longbeardColor } = offscreenCanvas(width, height, (ctx) => {
    drawColorMask(ctx, longbeardMask, props.facialHairColor)
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
    longbeardColor,
    longbeard,
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
let longbeardStyle
let mustacheStyle
let facialHairColor
let glasses
let accessory
let customImage
let customImageLayerIndex = 0

const transparent = '#00000000'

const reset = () => {
  body = undefined
  hat = undefined
  hatColor = transparent
  hairStyle = undefined
  hairColor = transparent
  skinColor = transparent
  beardStyle = undefined
  longbeardStyle = undefined
  mustacheStyle = undefined
  facialHairColor = transparent
  glasses = undefined
  accessory = undefined
  customImage = undefined
  customImageLayerIndex = 0
}

const withDefaults = (obj, Assets) => {
  if (!dataEntry.stickProps){ return obj }
  for (const key of Object.keys(obj)){
    obj[key] = obj[key] === undefined ? dataEntry?.stickProps[key] : obj[key]
  }
  if (!obj.body){
    obj.body = randomSelection(Assets.bodies)
  }
  if (obj.hat && obj.hatColor === transparent){
    obj.hatColor = Assets?.hatColors[0]
  }
  if (obj.hairStyle && obj.hairColor === transparent){
    obj.hairColor = Assets?.hairColors[0]
  }
  if (obj.skinColor === transparent){
    obj.skinColor = randomSelection(Assets.skinColor)
  }
  if ((obj.beardStyle || obj.mustacheStyle || obj.longbeardStyle) && obj.facialHairColor === transparent){
    obj.facialHairColor = obj.hairColor === transparent ? randomSelection(Assets.hairColors) : obj.hairColor
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

let stickFigureCfg = null
$: (async (ready, dataEntry, StickAssets) => {
  if (ready && checkReset(dataEntry)){
    stickFigureCfg = withDefaults({
      body,
      hat,
      hatColor,
      hairStyle,
      hairColor,
      skinColor,
      beardStyle,
      longbeardStyle,
      mustacheStyle,
      facialHairColor,
      glasses,
      accessory,
      customImage,
      customImageLayerIndex
    }, await StickAssets.getAll())
  }
})(ready, dataEntry, StickAssets)

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

const refreshAssets = (category) => {
  if (Array.isArray(category)){
    category.forEach(c => refreshAssets(c))
    return
  }
  StickAssets[category]?.refresh()
  StickAssets = StickAssets
}

onMount(async () => {
  await StickAssets.refreshAll()
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
    <AssetUpload category="Bodies" onUpload={() => refreshAssets('bodies')}>
      <div class="stick-option">
        <h3>Bodies</h3>
        <ImageSelector cropped bind:selected={body} images={StickAssets.bodies.value}/>
      </div>
    </AssetUpload>
    <AssetUpload category="Hairs" onUpload={() => refreshAssets('hairStyles')}>
      <div class="stick-option">
        <h3>Hair Style</h3>
        <ImageSelector cropped bind:selected={hairStyle} images={StickAssets.hairStyles.value}/>
        <ColorSelector bind:selected={hairColor} colors={StickAssets.hairColors}/>
      </div>
    </AssetUpload>
    <AssetUpload category="Hats" onUpload={() => refreshAssets('hats')}>
      <div class="stick-option">
        <h3>Hat</h3>
        <ImageSelector cropped bind:selected={hat} images={StickAssets.hats.value}/>
        <ColorSelector bind:selected={hatColor} colors={StickAssets.hatColors}/>
      </div>
    </AssetUpload>
    <div class="stick-option">
      <h3>Skin Color</h3>
      <ColorSelector bind:selected={skinColor} colors={StickAssets.skinColors}/>
    </div>
    <AssetUpload category="Facial Hairs" onUpload={() => {() => refreshAssets(['beardStyles', 'mustacheStyles'])}}>
      <div class="stick-option">
        <h3>Mustache</h3>
        <ImageSelector cropped bind:selected={mustacheStyle} images={StickAssets.mustacheStyles.value}/>
        <h3>Beard</h3>
        <ImageSelector cropped bind:selected={beardStyle} images={StickAssets.beardStyles.value}/>
        <h3>Long Beard</h3>
        <ImageSelector cropped bind:selected={longbeardStyle} images={StickAssets.longbeardStyles.value}/>
        <ColorSelector bind:selected={facialHairColor} colors={StickAssets.facialHairColors}/>
      </div>
    </AssetUpload>
    <AssetUpload category="Glasses" onUpload={() => refreshAssets('glasses')}>
      <div class="stick-option">
        <h3>Glasses</h3>
        <ImageSelector cropped bind:selected={glasses} images={StickAssets.glasses.value}/>
      </div>
    </AssetUpload>
    <AssetUpload category="Accessories" onUpload={() => refreshAssets('accessories')}>
      <div class="stick-option">
        <h3>Accessory</h3>
        <ImageSelector cropped bind:selected={accessory} images={StickAssets.accessories.value}/>
      </div>
    </AssetUpload>
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
/* .controls > * {
  overflow: hidden;
} */
.stick-option {
  border: 1px solid #666;
  border-radius: 5px;
  margin-bottom: 1rem;
}
.stick-option h3 {
  margin: 0.5rem 0.5rem;
}
</style>