<script setup lang="ts">
import Button from 'primevue/button'
import Message from 'primevue/message'
import Select from 'primevue/select'
import { useToast } from 'primevue/usetoast'
import { computed, onMounted, ref, useTemplateRef, watch } from 'vue'
import { onBeforeRouteLeave, onBeforeRouteUpdate, useRouter } from 'vue-router'
import { CANVAS_HEIGHT, CANVAS_WIDTH, COLOR_CHANNELS, SLOTS } from '@shared/figure'
import type { ColorChannelId, FigureConfig, SlotId } from '@shared/figure'
import type { BatchDetail, EntryDetail, EntryStatus, Library } from '@shared/api-types'
import AssetPicker from '@/components/asset-picker.vue'
import ColorSwatches from '@/components/color-swatches.vue'
import { api } from '@/lib/api'
import { initialFigure, randomFigure, selectAsset, selectColor } from '@/lib/figure-edits'
import { createCanvas, get2dContext } from '@/lib/images'
import { renderFigure } from '@/lib/render-figure'
import { STATUS_OPTIONS } from '@/lib/status'

interface EditorSection {
  title: string
  slots: SlotId[]
  channels: ColorChannelId[]
}

// Groups slots the way a designer thinks about a face, rather than one panel per slot.
const EDITOR_SECTIONS: EditorSection[] = [
  { title: 'Body', slots: ['body'], channels: [] },
  { title: 'Head & skin', slots: ['head'], channels: ['skin'] },
  { title: 'Hair', slots: ['hair'], channels: ['hair'] },
  { title: 'Facial hair', slots: ['mustache', 'beard', 'longbeard'], channels: ['facialHair'] },
  { title: 'Glasses', slots: ['glasses'], channels: ['glassesFrame', 'glassesLens'] },
  { title: 'Hat', slots: ['hat'], channels: ['hat'] },
  { title: 'Accessory', slots: ['accessory'], channels: [] },
]

const UNSAVED_CHANGES_PROMPT = 'You have unsaved changes to this figure. Leave anyway?'

const props = defineProps<{ entryId: string }>()

const router = useRouter()
const toast = useToast()
const canvas = useTemplateRef<HTMLCanvasElement>('canvas')

const library = ref<Library | null>(null)
const entry = ref<EntryDetail | null>(null)
const batch = ref<BatchDetail | null>(null)
const figure = ref<FigureConfig | null>(null)
const status = ref<EntryStatus>('new')
const isDirty = ref(false)
const isSaving = ref(false)
const loadError = ref<string | null>(null)

const assetsById = computed(() => new Map(library.value?.assets.map(asset => [asset.id, asset])))
const highlightedAnswers = computed(() => {
  if (!entry.value || !batch.value) return []
  const answers = entry.value.answers
  return batch.value.questions
    .filter(question => question.highlight)
    .map(question => ({ label: question.label, answer: answers[question.id] ?? '—' }))
})
const neighbours = computed(() => {
  const entryIds = batch.value?.entries.map(summary => summary.id) ?? []
  const index = entryIds.indexOf(props.entryId)
  return { previous: entryIds[index - 1], next: entryIds[index + 1] }
})

const assetsForSlot = (slot: SlotId) => library.value?.assets.filter(asset => asset.slot === slot) ?? []

async function loadEntry(entryId: string) {
  try {
    loadError.value = null
    library.value ??= await api.getLibrary()
    entry.value = await api.getEntry(entryId)
    batch.value = await api.getBatch(entry.value.batchId)
    figure.value = entry.value.figure ?? initialFigure(library.value)
    status.value = entry.value.status
    isDirty.value = false
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : String(error)
  }
}

function applyEdit(edit: (current: FigureConfig, currentLibrary: Library) => FigureConfig) {
  if (!figure.value || !library.value) return
  figure.value = edit(figure.value, library.value)
  isDirty.value = true
}

const onSelectAsset = (slot: SlotId, assetId: string | undefined) =>
  applyEdit((current, currentLibrary) => selectAsset(current, slot, assetId, currentLibrary))
const onSelectColor = (channel: ColorChannelId, color: string | undefined) =>
  applyEdit(current => selectColor(current, channel, color))
const onRandomise = () => applyEdit((_current, currentLibrary) => randomFigure(currentLibrary))

// Renders offscreen and only copies the latest request to the screen, so a slow
// earlier render can never overwrite a newer one.
let latestRenderId = 0
async function redraw() {
  if (!figure.value || !canvas.value) return
  latestRenderId += 1
  const renderId = latestRenderId
  const offscreen = createCanvas(CANVAS_WIDTH, CANVAS_HEIGHT)
  await renderFigure({ canvas: offscreen, figure: figure.value, assetsById: assetsById.value })
  if (renderId !== latestRenderId) return
  const context = get2dContext(canvas.value)
  context.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
  context.drawImage(offscreen, 0, 0)
}

const canvasToPng = (source: HTMLCanvasElement) => new Promise<Blob>((resolve, reject) => {
  source.toBlob(blob => (blob ? resolve(blob) : reject(new Error('Could not export the canvas.'))), 'image/png')
})

async function save() {
  if (!canvas.value || !figure.value) return
  isSaving.value = true
  try {
    await api.uploadRender(props.entryId, await canvasToPng(canvas.value))
    const nextStatus = status.value === 'new' ? 'in_progress' : status.value
    entry.value = await api.updateEntry(props.entryId, { figure: figure.value, status: nextStatus })
    status.value = entry.value.status
    isDirty.value = false
    toast.add({ severity: 'success', summary: 'Saved', life: 2000 })
  } catch (error) {
    toast.add({ severity: 'error', summary: 'Could not save', detail: String(error), life: 6000 })
  } finally {
    isSaving.value = false
  }
}

async function changeStatus(nextStatus: EntryStatus) {
  try {
    entry.value = await api.updateEntry(props.entryId, { status: nextStatus })
    status.value = entry.value.status
  } catch (error) {
    toast.add({ severity: 'error', summary: 'Could not change status', detail: String(error), life: 6000 })
  }
}

function download() {
  if (!canvas.value || !entry.value) return
  const link = document.createElement('a')
  link.download = `${entry.value.name ?? 'stick-figure'}-${entry.value.id}.png`
  link.href = canvas.value.toDataURL('image/png')
  link.click()
}

const goTo = (entryId: string | undefined) => entryId && router.push({ name: 'entry', params: { entryId } })

const confirmLeave = () => !isDirty.value || window.confirm(UNSAVED_CHANGES_PROMPT)

onBeforeRouteLeave(confirmLeave)
onBeforeRouteUpdate(async (to) => {
  if (!confirmLeave()) return false
  await loadEntry(String(to.params.entryId))
  return true
})

watch([figure, canvas], redraw, { deep: true })
onMounted(() => loadEntry(props.entryId))
</script>

<template>
  <main class="editor">
    <Message
      v-if="loadError"
      severity="error"
    >
      {{ loadError }}
    </Message>

    <template v-if="entry && figure && library">
      <aside class="reference card">
        <RouterLink
          v-if="batch"
          :to="{ name: 'batch', params: { batchId: batch.id } }"
          class="back"
        >
          <i class="pi pi-arrow-left" /> {{ batch.name }}
        </RouterLink>
        <h2>{{ entry.name ?? 'Unnamed' }}</h2>
        <p class="muted">
          {{ entry.email }}
        </p>
        <img
          v-if="entry.likenessUrl"
          :src="entry.likenessUrl"
          class="likeness"
          alt="Photo submitted by the follower"
        >
        <p
          v-else
          class="no-photo muted"
        >
          No photo submitted
        </p>
        <dl class="answers">
          <template
            v-for="item in highlightedAnswers"
            :key="item.label"
          >
            <dt>{{ item.label }}</dt>
            <dd>{{ item.answer }}</dd>
          </template>
        </dl>
      </aside>

      <section class="stage">
        <div class="toolbar">
          <Button
            icon="pi pi-chevron-left"
            text
            :disabled="!neighbours.previous"
            title="Previous entry"
            @click="goTo(neighbours.previous)"
          />
          <Select
            :model-value="status"
            :options="STATUS_OPTIONS"
            option-label="label"
            option-value="value"
            @update:model-value="changeStatus"
          />
          <Button
            label="Randomise"
            icon="pi pi-sparkles"
            severity="secondary"
            @click="onRandomise"
          />
          <Button
            label="Download"
            icon="pi pi-download"
            severity="secondary"
            @click="download"
          />
          <Button
            :label="isDirty ? 'Save*' : 'Save'"
            icon="pi pi-save"
            :loading="isSaving"
            @click="save"
          />
          <Button
            icon="pi pi-chevron-right"
            text
            :disabled="!neighbours.next"
            title="Next entry"
            @click="goTo(neighbours.next)"
          />
        </div>
        <canvas
          ref="canvas"
          :width="CANVAS_WIDTH"
          :height="CANVAS_HEIGHT"
          class="figure-canvas"
        />
      </section>

      <aside class="controls">
        <section
          v-for="section in EDITOR_SECTIONS"
          :key="section.title"
          class="card control-section"
        >
          <h3>{{ section.title }}</h3>
          <div
            v-for="slot in section.slots"
            :key="slot"
            class="slot"
          >
            <span
              v-if="section.slots.length > 1"
              class="slot-label"
            >{{ SLOTS[slot].label }}</span>
            <AssetPicker
              :assets="assetsForSlot(slot)"
              :selected-id="figure.assets[slot]"
              :allow-none="!SLOTS[slot].required"
              @select="onSelectAsset(slot, $event)"
            />
          </div>
          <ColorSwatches
            v-for="channel in section.channels"
            :key="channel"
            :label="COLOR_CHANNELS[channel].label"
            :colors="library.palettes[COLOR_CHANNELS[channel].palette]"
            :selected="figure.colors[channel]"
            @select="onSelectColor(channel, $event)"
          />
        </section>
      </aside>
    </template>
  </main>
</template>

<style scoped>
.editor {
  display: grid;
  grid-template-columns: 18rem minmax(0, 1fr) 24rem;
  gap: 1rem;
  padding: 1rem;
  height: 100vh;
  box-sizing: border-box;
}

.reference,
.controls {
  overflow-y: auto;
}

.back {
  display: inline-block;
  margin-bottom: 0.75rem;
  color: inherit;
}

.likeness {
  width: 100%;
  border-radius: 0.5rem;
}

.no-photo {
  padding: 3rem 0;
  text-align: center;
  border: 1px dashed #d0d0ca;
  border-radius: 0.5rem;
}

.answers dt {
  margin-top: 0.75rem;
  font-size: 0.85rem;
  color: #6b6b66;
}

.answers dd {
  margin: 0.15rem 0 0;
  font-weight: 600;
}

.stage {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  min-height: 0;
}

.toolbar {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
  justify-content: center;
}

.figure-canvas {
  flex: 1;
  min-height: 0;
  max-width: 100%;
  object-fit: contain;
  background: #fff;
  border: 1px solid #e3e3df;
  border-radius: 0.75rem;
}

.controls {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.control-section {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.control-section h3 {
  margin: 0;
}

.slot-label {
  display: block;
  margin-bottom: 0.3rem;
  font-size: 0.85rem;
  font-weight: 600;
}
</style>
