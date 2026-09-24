<script setup lang="ts">
import Button from 'primevue/button'
import Menu from 'primevue/menu'
import Message from 'primevue/message'
import Select from 'primevue/select'
import Toolbar from 'primevue/toolbar'
import { useToast } from 'primevue/usetoast'
import { computed, onMounted, ref, useTemplateRef, watch } from 'vue'
import { onBeforeRouteLeave, onBeforeRouteUpdate, RouterLink, useRouter } from 'vue-router'
import { CANVAS_HEIGHT, CANVAS_WIDTH, COLOR_CHANNELS, SLOTS } from '@shared/figure'
import type { ColorChannelId, FigureConfig, SlotId } from '@shared/figure'
import type { BatchDetail, EntryDetail, EntryStatus, Library } from '@shared/api-types'
import AssetPicker from '@/components/asset-picker.vue'
import ColorSwatches from '@/components/color-swatches.vue'
import StatusMark from '@/components/status-mark.vue'
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
const moreMenu = useTemplateRef<InstanceType<typeof Menu>>('moreMenu')

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
  return { previous: entryIds[index - 1], next: entryIds[index + 1], position: index + 1, total: entryIds.length }
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

const moreActions = [
  { label: 'Download PNG', icon: 'pi pi-download', command: download },
  { label: 'Randomise figure', icon: 'pi pi-sparkles', command: onRandomise },
]

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
      <Toolbar class="editor-header">
        <template #start>
          <RouterLink
            v-if="batch"
            :to="{ name: 'batch', params: { batchId: batch.id } }"
            class="back"
          >
            <i class="pi pi-angle-left" /> {{ batch.name }}
          </RouterLink>
          <h1>{{ entry.name ?? 'Unnamed' }}</h1>
          <nav
            class="entry-nav"
            aria-label="Entries in this batch"
          >
            <Button
              icon="pi pi-angle-left"
              text
              severity="secondary"
              :disabled="!neighbours.previous"
              aria-label="Previous entry"
              @click="goTo(neighbours.previous)"
            />
            <span
              v-if="neighbours.total"
              class="tabular muted"
            >{{ neighbours.position }} of {{ neighbours.total }}</span>
            <Button
              icon="pi pi-angle-right"
              text
              severity="secondary"
              :disabled="!neighbours.next"
              aria-label="Next entry"
              @click="goTo(neighbours.next)"
            />
          </nav>
        </template>
        <template #end>
          <Select
            :model-value="status"
            :options="STATUS_OPTIONS"
            option-label="label"
            option-value="value"
            aria-label="Status"
            @update:model-value="changeStatus"
          >
            <template #value="{ value }">
              <StatusMark :status="value" />
            </template>
            <template #option="{ option }">
              <StatusMark :status="option.value" />
            </template>
          </Select>
          <Button
            icon="pi pi-ellipsis-h"
            text
            severity="secondary"
            aria-label="More actions"
            aria-haspopup="true"
            @click="moreMenu?.toggle($event)"
          />
          <Menu
            ref="moreMenu"
            :model="moreActions"
            popup
          />
          <Button
            label="Save"
            severity="secondary"
            :class="{ unsaved: isDirty }"
            :aria-label="isDirty ? 'Save (unsaved changes)' : 'Save'"
            :loading="isSaving"
            @click="save"
          />
        </template>
      </Toolbar>

      <aside class="reference">
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
        <p class="muted">
          {{ entry.email }}
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

      <section class="proof-column">
        <div class="proof">
          <canvas
            ref="canvas"
            :width="CANVAS_WIDTH"
            :height="CANVAS_HEIGHT"
            class="proof-sheet"
            role="img"
            :aria-label="`Stick figure for ${entry.name ?? 'this entry'}`"
          />
        </div>
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
  --proof-margin: 1.5rem;
  --crop-gap: 0.4rem;

  display: grid;
  grid-template-columns: clamp(16rem, 22vw, 24rem) minmax(0, 1fr) 26rem;
  grid-template-rows: auto minmax(0, 1fr);
  height: 100vh;
}

.editor > .p-message,
.editor-header {
  grid-column: 1 / -1;
}

.editor-header {
  padding: 0.5rem 1rem;
  background: var(--glaze);
  border-bottom: 1px solid var(--rule);
  border-radius: 0;
}

.editor-header :deep(.p-toolbar-start) {
  gap: 1rem;
}

.editor-header h1 {
  font-size: var(--text-lg);
}

.back {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  font-size: var(--text-md);
  text-decoration: none;
}

.entry-nav {
  display: flex;
  align-items: center;
  font-size: var(--text-md);
}

.unsaved::after {
  content: '';
  width: 0.5rem;
  height: 0.5rem;
  margin-left: 0.15rem;
  border-radius: 50%;
  background: var(--unsaved);
}

.reference {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: calc(var(--proof-margin) + 0.75rem) 0 1rem 1rem;
  min-height: 0;
  overflow-y: auto;
}

.reference p {
  margin: 0;
}

.likeness {
  flex: 1 1 auto;
  min-height: 12rem;
  max-width: 100%;
  object-fit: contain;
  object-position: top;
}

.no-photo {
  padding: 3rem 0;
  text-align: center;
  border: 1px dashed var(--rule);
  border-radius: var(--p-border-radius-md);
}

.answers {
  margin: 0;
}

.answers dt {
  margin-top: 0.75rem;
  font-size: var(--text-md);
  color: var(--pencil);
}

.answers dd {
  margin: 0.15rem 0 0;
  font-weight: 600;
}

.proof-column {
  display: flex;
  justify-content: center;
  min-height: 0;
  padding: 0.75rem 0.5rem;
}

/* Hairline crop marks sit just outside each corner of the sheet, like a print proof. */
.proof {
  --mark: linear-gradient(var(--pencil), var(--pencil));
  --mark-length: calc(var(--proof-margin) - var(--crop-gap));

  box-sizing: border-box;
  height: 100%;
  max-width: 100%;
  padding: var(--proof-margin);
  background:
    var(--mark) left 0 top var(--proof-margin) / var(--mark-length) 1px,
    var(--mark) right 0 top var(--proof-margin) / var(--mark-length) 1px,
    var(--mark) left 0 bottom var(--proof-margin) / var(--mark-length) 1px,
    var(--mark) right 0 bottom var(--proof-margin) / var(--mark-length) 1px,
    var(--mark) left var(--proof-margin) top 0 / 1px var(--mark-length),
    var(--mark) right var(--proof-margin) top 0 / 1px var(--mark-length),
    var(--mark) left var(--proof-margin) bottom 0 / 1px var(--mark-length),
    var(--mark) right var(--proof-margin) bottom 0 / 1px var(--mark-length);
  background-repeat: no-repeat;
}

.proof-sheet {
  display: block;
  height: 100%;
  max-width: 100%;
  aspect-ratio: 710 / 943;
  object-fit: contain;
  background: var(--glaze);
}

.controls {
  padding: 1rem 1rem 1rem 0;
  min-height: 0;
  overflow-y: auto;
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
