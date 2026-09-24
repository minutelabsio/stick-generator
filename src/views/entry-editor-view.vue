<script setup lang="ts">
import Button from 'primevue/button'
import IconField from 'primevue/iconfield'
import InputIcon from 'primevue/inputicon'
import InputText from 'primevue/inputtext'
import Menu from 'primevue/menu'
import Message from 'primevue/message'
import Popover from 'primevue/popover'
import Select from 'primevue/select'
import Toolbar from 'primevue/toolbar'
import { useToast } from 'primevue/usetoast'
import { computed, onMounted, ref, useTemplateRef, watch } from 'vue'
import type { ComponentPublicInstance } from 'vue'
import { onBeforeRouteLeave, onBeforeRouteUpdate, RouterLink, useRouter } from 'vue-router'
import { CANVAS_HEIGHT, CANVAS_WIDTH, COLOR_CHANNELS, SLOT_IDS, SLOTS } from '@shared/figure'
import type { ColorChannelId, FigureConfig, SlotId } from '@shared/figure'
import type { BatchDetail, EntryDetail, EntryStatus, Library, LibraryAsset } from '@shared/api-types'
import AssetGrid from '@/components/asset-grid.vue'
import AssetThumb from '@/components/asset-thumb.vue'
import ColorSwatches from '@/components/color-swatches.vue'
import SlotRail from '@/components/slot-rail.vue'
import StatusMark from '@/components/status-mark.vue'
import { api } from '@/lib/api'
import { initialFigure, randomFigure, selectAsset, selectColor } from '@/lib/figure-edits'
import { createCanvas, get2dContext } from '@/lib/images'
import { renderFigure } from '@/lib/render-figure'
import { readRecentAssets, rememberAsset } from '@/lib/recent-assets'
import { STATUS_OPTIONS } from '@/lib/status'
import { MOD_KEY_LABEL, useShortcuts } from '@/lib/use-shortcuts'

const UNSAVED_CHANGES_PROMPT = 'You have unsaved changes to this figure. Leave anyway?'

const props = defineProps<{ entryId: string }>()

const router = useRouter()
const toast = useToast()
const canvas = useTemplateRef<HTMLCanvasElement>('canvas')
const moreMenu = useTemplateRef<InstanceType<typeof Menu>>('moreMenu')
const shortcutsPopover = useTemplateRef<InstanceType<typeof Popover>>('shortcutsPopover')
const shortcutsButton = useTemplateRef<ComponentPublicInstance>('shortcutsButton')

const library = ref<Library | null>(null)
const entry = ref<EntryDetail | null>(null)
const batch = ref<BatchDetail | null>(null)
const figure = ref<FigureConfig | null>(null)
const status = ref<EntryStatus>('new')
const isDirty = ref(false)
const isSaving = ref(false)
const loadError = ref<string | null>(null)
const activeSlot = ref<SlotId>('head')
// An entry with no saved figure offers a starting point on the proof until any edit.
const needsStartingPoint = ref(false)
const assetFilter = ref('')
const recentAssets = ref(readRecentAssets())
const filterInput = useTemplateRef<ComponentPublicInstance>('filterInput')

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

const slotAssets = computed(() => library.value?.assets.filter(asset => asset.slot === activeSlot.value) ?? [])
const filteredAssets = computed(() => {
  const query = assetFilter.value.trim().toLowerCase()
  return query ? slotAssets.value.filter(asset => asset.label.toLowerCase().includes(query)) : slotAssets.value
})
const recentSlotAssets = computed(() => (recentAssets.value[activeSlot.value] ?? [])
  .map(id => assetsById.value.get(id))
  .filter(asset => asset !== undefined))
const chosenAssets = computed(() => {
  const chosen: Partial<Record<SlotId, LibraryAsset>> = {}
  for (const slot of SLOT_IDS) {
    const assetId = figure.value?.assets[slot]
    chosen[slot] = assetId ? assetsById.value.get(assetId) : undefined
  }
  return chosen
})

async function loadEntry(entryId: string) {
  try {
    loadError.value = null
    library.value ??= await api.getLibrary()
    entry.value = await api.getEntry(entryId)
    batch.value = await api.getBatch(entry.value.batchId)
    figure.value = entry.value.figure ?? initialFigure(library.value)
    needsStartingPoint.value = entry.value.figure === null
    status.value = entry.value.status
    isDirty.value = false
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : String(error)
  }
}

type FigureEdit = (current: FigureConfig, currentLibrary: Library) => FigureConfig

// A hovered or focused choice is drawn on the proof without touching the figure, so
// designers can flick through options and only commit the one that matches.
const previewEdit = ref<FigureEdit | null>(null)
const displayedFigure = computed(() => {
  if (!figure.value || !library.value || !previewEdit.value) return figure.value
  return previewEdit.value(figure.value, library.value)
})

function applyEdit(edit: FigureEdit) {
  if (!figure.value || !library.value) return
  figure.value = edit(figure.value, library.value)
  previewEdit.value = null
  needsStartingPoint.value = false
  isDirty.value = true
}

const previewAsset = (slot: SlotId, assetId: string | undefined) => {
  previewEdit.value = (current, currentLibrary) => selectAsset(current, slot, assetId, currentLibrary)
}
const previewColor = (channel: ColorChannelId, color: string) => {
  previewEdit.value = current => selectColor(current, channel, color)
}
const clearPreview = () => {
  previewEdit.value = null
}

function onSelectAsset(slot: SlotId, assetId: string | undefined) {
  applyEdit((current, currentLibrary) => selectAsset(current, slot, assetId, currentLibrary))
  if (assetId) recentAssets.value = rememberAsset(recentAssets.value, slot, assetId)
}
const onSelectColor = (channel: ColorChannelId, color: string | undefined) =>
  applyEdit(current => selectColor(current, channel, color))
const onRandomise = () => applyEdit((_current, currentLibrary) => randomFigure(currentLibrary))
const startBlank = () => {
  needsStartingPoint.value = false
}

// Renders offscreen and only copies the latest request to the screen, so a slow
// earlier render can never overwrite a newer one.
let latestRenderId = 0
async function redraw() {
  if (!displayedFigure.value || !canvas.value) return
  latestRenderId += 1
  const renderId = latestRenderId
  const offscreen = createCanvas(CANVAS_WIDTH, CANVAS_HEIGHT)
  await renderFigure({ canvas: offscreen, figure: displayedFigure.value, assetsById: assetsById.value })
  if (renderId !== latestRenderId) return
  const context = get2dContext(canvas.value)
  context.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
  context.drawImage(offscreen, 0, 0)
}

const canvasToPng = (source: HTMLCanvasElement) => new Promise<Blob>((resolve, reject) => {
  source.toBlob(blob => (blob ? resolve(blob) : reject(new Error('Could not export the canvas.'))), 'image/png')
})

interface PersistOptions {
  nextStatus: EntryStatus
  confirmation: string
}

// The canvas may be showing a preview, so draw the committed figure before capturing it.
async function drawCommittedFigure() {
  clearPreview()
  await redraw()
}

async function persist({ nextStatus, confirmation }: PersistOptions) {
  if (!canvas.value || !figure.value) return false
  isSaving.value = true
  try {
    await drawCommittedFigure()
    await api.uploadRender(props.entryId, await canvasToPng(canvas.value))
    entry.value = await api.updateEntry(props.entryId, { figure: figure.value, status: nextStatus })
    status.value = entry.value.status
    isDirty.value = false
    toast.add({ severity: 'success', summary: confirmation, life: 2000 })
    return true
  } catch (error) {
    toast.add({ severity: 'error', summary: 'Could not save', detail: String(error), life: 6000 })
    return false
  } finally {
    isSaving.value = false
  }
}

// Saving is the moment work starts, so a new entry moves to in progress.
const save = () => persist({
  nextStatus: status.value === 'new' ? 'in_progress' : status.value,
  confirmation: 'Saved',
})

async function markDoneAndContinue() {
  const isSaved = await persist({ nextStatus: 'done', confirmation: 'Marked done' })
  if (!isSaved) return
  if (neighbours.value.next) return goTo(neighbours.value.next)
  if (batch.value) await router.push({ name: 'batch', params: { batchId: batch.value.id } })
}

async function changeStatus(nextStatus: EntryStatus) {
  try {
    entry.value = await api.updateEntry(props.entryId, { status: nextStatus })
    status.value = entry.value.status
  } catch (error) {
    toast.add({ severity: 'error', summary: 'Could not change status', detail: String(error), life: 6000 })
  }
}

async function download() {
  if (!canvas.value || !entry.value) return
  await drawCommittedFigure()
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

const SHORTCUT_HELP = [
  { keys: ['←', '→'], action: 'Previous or next entry' },
  { keys: ['1', '–', '9'], action: 'Open a figure part' },
  { keys: ['/'], action: 'Filter the open part' },
  { keys: ['↑', '↓', '←', '→'], action: 'Move through the asset grid, previewing each' },
  { keys: ['Enter'], action: 'Use the focused asset' },
  { keys: ['Esc'], action: 'Stop previewing' },
  { keys: [MOD_KEY_LABEL, 'S'], action: 'Save' },
  { keys: [MOD_KEY_LABEL, 'Enter'], action: 'Mark done and open the next entry' },
  { keys: ['?'], action: 'Show these shortcuts' },
]

const slotShortcuts = Object.fromEntries(SLOT_IDS.map((slot, index) => [String(index + 1), () => {
  activeSlot.value = slot
}]))

useShortcuts({
  ...slotShortcuts,
  '/': () => filterInput.value?.$el.focus(),
  'ArrowLeft': () => goTo(neighbours.value.previous),
  'ArrowRight': () => goTo(neighbours.value.next),
  'mod+s': save,
  'Escape': clearPreview,
  'mod+enter': markDoneAndContinue,
  '?': event => shortcutsPopover.value?.toggle(event, shortcutsButton.value?.$el),
})

const confirmLeave = () => !isDirty.value || window.confirm(UNSAVED_CHANGES_PROMPT)

onBeforeRouteLeave(confirmLeave)
onBeforeRouteUpdate(async (to) => {
  if (!confirmLeave()) return false
  await loadEntry(String(to.params.entryId))
  return true
})

watch(activeSlot, () => {
  assetFilter.value = ''
  clearPreview()
})
watch([displayedFigure, canvas], redraw, { deep: true })
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
          <Button
            ref="shortcutsButton"
            icon="pi pi-question-circle"
            text
            severity="secondary"
            aria-label="Keyboard shortcuts"
            @click="shortcutsPopover?.toggle($event)"
          />
          <Popover ref="shortcutsPopover">
            <dl class="shortcuts">
              <template
                v-for="shortcut in SHORTCUT_HELP"
                :key="shortcut.action"
              >
                <dt>
                  <kbd
                    v-for="key in shortcut.keys"
                    :key="key"
                  >{{ key }}</kbd>
                </dt>
                <dd>{{ shortcut.action }}</dd>
              </template>
            </dl>
          </Popover>
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
            :disabled="isSaving"
            @click="save"
          />
          <Button
            :label="neighbours.next ? 'Done, next entry' : 'Done, back to batch'"
            :loading="isSaving"
            @click="markDoneAndContinue"
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
          <div
            v-if="needsStartingPoint"
            class="start"
          >
            <p>No figure saved for {{ entry.name ?? 'this entry' }} yet.</p>
            <div class="start-actions">
              <Button
                label="Start from random"
                icon="pi pi-sparkles"
                @click="onRandomise"
              />
              <Button
                label="Start blank"
                severity="secondary"
                @click="startBlank"
              />
            </div>
          </div>
        </div>
      </section>

      <aside class="controls">
        <SlotRail
          v-model="activeSlot"
          :chosen="chosenAssets"
          :colors="figure.colors"
        />
        <section
          class="picker"
          :aria-label="`${SLOTS[activeSlot].label} choices`"
        >
          <div class="picker-pinned">
            <h2>{{ SLOTS[activeSlot].label }}</h2>
            <ColorSwatches
              v-for="channel in SLOTS[activeSlot].colorChannels"
              :key="channel"
              :label="COLOR_CHANNELS[channel].label"
              :colors="library.palettes[COLOR_CHANNELS[channel].palette]"
              :selected="figure.colors[channel]"
              @select="onSelectColor(channel, $event)"
              @preview="previewColor(channel, $event)"
              @clear-preview="clearPreview"
            />
            <div class="filter">
              <IconField>
                <InputIcon class="pi pi-search" />
                <InputText
                  ref="filterInput"
                  v-model="assetFilter"
                  placeholder="Filter by name"
                  :aria-label="`Filter ${SLOTS[activeSlot].label.toLowerCase()} by name`"
                  size="small"
                />
              </IconField>
              <span class="muted tabular">{{ assetFilter ? `${filteredAssets.length} of ${slotAssets.length}` : `${slotAssets.length} ${slotAssets.length === 1 ? 'asset' : 'assets'}` }}</span>
            </div>
            <div
              v-if="recentSlotAssets.length && !assetFilter"
              class="recent"
              @mouseleave="clearPreview"
              @focusout="clearPreview"
            >
              <span class="muted">Recent</span>
              <button
                v-for="asset in recentSlotAssets"
                :key="asset.id"
                type="button"
                class="recent-tile"
                :class="{ selected: figure.assets[activeSlot] === asset.id }"
                :aria-label="asset.label"
                :title="asset.label"
                @mouseenter="previewAsset(activeSlot, asset.id)"
                @focus="previewAsset(activeSlot, asset.id)"
                @click="onSelectAsset(activeSlot, asset.id)"
              >
                <AssetThumb
                  :asset="asset"
                  :colors="figure.colors"
                />
              </button>
            </div>
          </div>
          <p
            v-if="assetFilter && !filteredAssets.length"
            class="muted"
          >
            No {{ SLOTS[activeSlot].label.toLowerCase() }} names match “{{ assetFilter }}”. Clear the filter to see all {{ slotAssets.length }}.
          </p>
          <AssetGrid
            v-else
            :assets="filteredAssets"
            :selected-id="figure.assets[activeSlot]"
            :allow-none="!SLOTS[activeSlot].required && !assetFilter"
            :colors="figure.colors"
            @select="onSelectAsset(activeSlot, $event)"
            @preview="previewAsset(activeSlot, $event)"
            @clear-preview="clearPreview"
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
  grid-template-columns: clamp(14rem, 20vw, 24rem) minmax(0, 1fr) 32.5rem;
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

.shortcuts {
  display: grid;
  grid-template-columns: auto auto;
  gap: 0.5rem 1rem;
  margin: 0;
  font-size: var(--text-md);
}

.shortcuts dt {
  display: flex;
  gap: 0.25rem;
  justify-content: flex-end;
}

.shortcuts dd {
  margin: 0;
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

  position: relative;
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

.start {
  position: absolute;
  inset: var(--proof-margin);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  background: rgb(255 255 255 / 85%);
}

.start p {
  margin: 0;
}

.start-actions {
  display: flex;
  gap: 0.75rem;
}

.controls {
  display: grid;
  grid-template-columns: 9.5rem minmax(0, 1fr);
  gap: 0.75rem;
  min-height: 0;
  padding: 1rem 1rem 0 0;
}

.slot-rail {
  overflow-y: auto;
}

.picker {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  min-height: 0;
}

/* Only the grid scrolls, so the tint and filter never drift below the fold. */
.picker-pinned {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  flex: none;
}

.filter {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: var(--text-md);
}

.recent {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: var(--text-md);
}

.recent-tile {
  display: grid;
  place-items: center;
  width: 2.25rem;
  height: 2.25rem;
  padding: 0.15rem;
  box-sizing: border-box;
  background: var(--glaze);
  border: 1px solid var(--rule);
  border-radius: var(--p-border-radius-sm);
  cursor: pointer;
}

.recent-tile.selected {
  border-color: var(--graphite);
  box-shadow: 0 0 0 1.5px var(--graphite);
}

.picker .asset-grid {
  flex: 1;
  min-height: 0;
}
</style>
