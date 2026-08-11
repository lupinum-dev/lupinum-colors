<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { CHANNEL_MODES } from '@/app/channels'
import {
  OVERLAY_DASH,
  OVERLAY_LINE_OPTIONS,
  OVERLAY_MARKER_OPTIONS,
  trianglePoints,
} from '@/app/overlay-style'
import {
  addOverlay,
  applySelectionPreview,
  cancelSelectionPreview,
  canRedo,
  canUndo,
  channelMode,
  history,
  historyIndex,
  overlayConfigs,
  previewLabel,
  previewShades,
  protectAnchor,
  redo,
  referenceFamilies,
  referenceRanks,
  refreshSelectionCurvePreview,
  removeOverlay,
  resetSelectionCurve,
  resolvedAnchor,
  restoreHistory,
  selectedShadeRange,
  selectionChannel,
  selectionChannelKey,
  selectionCurve,
  selectionFeather,
  setPreview,
  setSelectionChannel,
  setSelectionFeather,
  setShadeSelection,
  shadeSelection,
  shades,
  soloOverlay,
  undo,
  updateOverlay,
  updateSelectionCurve,
} from '@/app/palette-store'
import { applyReferenceChannel, smoothChannel, type ReferenceOperation } from '@/app/palette-tools'

type InspectorTab = 'references' | 'selection' | 'history'
type SelectionTool = 'shape' | 'fit' | 'smooth'

const tabs: { id: InspectorTab; label: string }[] = [
  { id: 'references', label: 'References' },
  { id: 'selection', label: 'Selection' },
  { id: 'history', label: 'History' },
]
const tab = ref<InspectorTab>('selection')
const selectionTool = ref<SelectionTool>('shape')
const sourceName = ref('')
const operation = ref<ReferenceOperation>('shape')
const amount = ref(0.2)
const smoothStrength = ref(0.35)
const protectEndpoints = ref(true)
const addReferenceName = ref('')

const channels = computed(() => CHANNEL_MODES[channelMode.value])
const selectedSource = computed(() =>
  referenceFamilies.find((family) => family.name === sourceName.value),
)
const availableReferences = computed(() => {
  const selected = new Set(overlayConfigs.value.map((overlay) => overlay.name))
  return referenceRanks.value.filter(({ family }) => !selected.has(family.name))
})
const channelModel = computed({
  get: () => selectionChannelKey.value,
  set: (value: string) => setSelectionChannel(value),
})
const featherModel = computed({
  get: () => selectionFeather.value,
  set: (value: number) => setSelectionFeather(value),
})
const bodyOffset = computed({
  get: () => (selectionCurve.value.startDelta + selectionCurve.value.endDelta) / 2,
  set: (value: number) => {
    const delta = value - bodyOffset.value
    updateSelectionCurve({
      startDelta: selectionCurve.value.startDelta + delta,
      endDelta: selectionCurve.value.endDelta + delta,
    })
  },
})

watch(
  referenceRanks,
  (ranks) => {
    if (!sourceName.value && ranks[0]) sourceName.value = ranks[0].family.name
    if (!addReferenceName.value && ranks[0]) addReferenceName.value = ranks[0].family.name
  },
  { immediate: true },
)
watch(channelMode, () => {
  const preferred = channels.value.find((channel) => channel.key === 'c' || channel.key === 's')
  setSelectionChannel(preferred?.key ?? channels.value[0]?.key ?? 'l')
})
watch(selectionTool, () => {
  cancelSelectionPreview()
  previewCurrentTool()
})
watch([sourceName, operation, amount], () => {
  if (tab.value === 'selection' && selectionTool.value === 'fit') previewFit()
})
watch([smoothStrength, protectEndpoints], () => {
  if (tab.value === 'selection' && selectionTool.value === 'smooth') previewSmooth()
})
watch(protectAnchor, () => previewCurrentTool())
watch(shadeSelection, () => {
  if (tab.value === 'selection') previewCurrentTool()
})

function previewCurrentTool(): void {
  if (selectionTool.value === 'shape') refreshSelectionCurvePreview()
  else if (selectionTool.value === 'fit') previewFit()
  else previewSmooth()
}

function previewFit(): void {
  const selection = shadeSelection.value
  const channel = selectionChannel.value
  if (!selection || !channel || !shades.value || !selectedSource.value) return
  setPreview(
    applyReferenceChannel(shades.value, selectedSource.value.colors, {
      channel,
      operation: operation.value,
      amount: amount.value,
      scope: 'custom',
      from: selection.from,
      to: selection.to,
      feather: selectionFeather.value,
      anchor: resolvedAnchor.value,
      protectAnchor: protectAnchor.value,
    }),
    `${operation.value === 'shape' ? 'Fit' : 'Moved'} ${selection.from}–${selection.to} ${Math.round(amount.value * 100)}% toward ${selectedSource.value.name}`,
  )
}

function previewSmooth(): void {
  const selection = shadeSelection.value
  const channel = selectionChannel.value
  if (!selection || !channel || !shades.value) return
  setPreview(
    smoothChannel(shades.value, {
      channel,
      strength: smoothStrength.value,
      scope: 'custom',
      from: selection.from,
      to: selection.to,
      feather: selectionFeather.value,
      anchor: resolvedAnchor.value,
      protectAnchor: protectAnchor.value,
      protectEndpoints: false,
      protectScopeEndpoints: protectEndpoints.value,
    }),
    `Smoothed ${channel.label} across ${selection.from}–${selection.to}`,
  )
}

function setCurveValue(key: keyof typeof selectionCurve.value, event: Event): void {
  const value = Number((event.target as HTMLInputElement).value)
  if (Number.isFinite(value)) updateSelectionCurve({ [key]: value })
}

function addSelectedReference(): void {
  if (!addReferenceName.value) return
  addOverlay(addReferenceName.value)
  addReferenceName.value = availableReferences.value[0]?.family.name ?? ''
}

function fitFrom(name: string): void {
  if (!shadeSelection.value) setShadeSelection(700, 950)
  sourceName.value = name
  tab.value = 'selection'
  selectionTool.value = 'fit'
  previewFit()
}
</script>

<template>
  <aside class="inspector" aria-label="Palette inspector">
    <nav class="tabs" aria-label="Inspector sections">
      <button v-for="item in tabs" :key="item.id" type="button" :class="{ active: tab === item.id }" @click="tab = item.id">
        {{ item.label }}
      </button>
    </nav>

    <section v-if="tab === 'references'" class="inspector-body">
      <header>
        <h2>Nearest Tailwind palettes</h2>
        <p>Compare complete curves, or fit the current selection toward one reference.</p>
      </header>
      <div class="reference-list">
        <article v-for="overlay in overlayConfigs" :key="overlay.name" class="reference-row" :class="{ off: !overlay.enabled }">
          <div class="reference-title">
            <label class="check">
              <input type="checkbox" :checked="overlay.enabled" @change="updateOverlay(overlay.name, { enabled: !overlay.enabled })" />
              <svg class="sample" width="46" height="14" aria-hidden="true">
                <line x1="2" y1="7" x2="44" y2="7" :stroke="overlay.color" stroke-width="1.5" :stroke-dasharray="OVERLAY_DASH[overlay.line]" />
                <circle v-if="overlay.marker === 'circle'" cx="23" cy="7" r="3.5" :stroke="overlay.color" />
                <rect v-else-if="overlay.marker === 'square'" x="19.7" y="3.7" width="6.6" height="6.6" :stroke="overlay.color" />
                <rect v-else-if="overlay.marker === 'diamond'" x="19.8" y="3.8" width="6.4" height="6.4" transform="rotate(45 23 7)" :stroke="overlay.color" />
                <polygon v-else :points="trianglePoints(23, 7, 4.4)" :stroke="overlay.color" />
              </svg>
              <strong>{{ overlay.name }}</strong>
            </label>
            <span class="score">{{ overlay.score.toFixed(0) }}%</span>
          </div>
          <div class="reference-controls">
            <input type="color" :value="overlay.color" :aria-label="`${overlay.name} line color`" @input="updateOverlay(overlay.name, { color: ($event.target as HTMLInputElement).value })" />
            <select :value="overlay.line" :aria-label="`${overlay.name} line style`" @change="updateOverlay(overlay.name, { line: ($event.target as HTMLSelectElement).value as typeof overlay.line })">
              <option v-for="option in OVERLAY_LINE_OPTIONS" :key="option.value" :value="option.value">{{ option.label }}</option>
            </select>
            <select :value="overlay.marker" :aria-label="`${overlay.name} marker shape`" @change="updateOverlay(overlay.name, { marker: ($event.target as HTMLSelectElement).value as typeof overlay.marker })">
              <option v-for="marker in OVERLAY_MARKER_OPTIONS" :key="marker" :value="marker">{{ marker }}</option>
            </select>
            <button type="button" @click="soloOverlay(overlay.name)">Solo</button>
            <button type="button" @click="fitFrom(overlay.name)">Fit selection</button>
            <button type="button" :aria-label="`Remove ${overlay.name} reference`" @click="removeOverlay(overlay.name)">×</button>
          </div>
        </article>
      </div>
      <div class="inline-control">
        <select v-model="addReferenceName" aria-label="Reference palette to add">
          <option v-for="rank in availableReferences" :key="rank.family.name" :value="rank.family.name">{{ rank.family.name }} · {{ rank.score.toFixed(0) }}%</option>
        </select>
        <button type="button" :disabled="!addReferenceName" @click="addSelectedReference">Add</button>
      </div>
    </section>

    <section v-else-if="tab === 'selection'" class="inspector-body selection-panel">
      <template v-if="shadeSelection">
        <header class="selection-head">
          <div>
            <h2>{{ shadeSelection.from }}–{{ shadeSelection.to }}</h2>
            <p>{{ selectedShadeRange.length }} selected shade{{ selectedShadeRange.length === 1 ? '' : 's' }} · {{ selectionChannel?.label }} channel</p>
          </div>
          <button type="button" @click="setShadeSelection(50, 950)">Select all</button>
        </header>

        <div class="tool-switch" role="group" aria-label="Selection operation">
          <button v-for="tool in ['shape', 'fit', 'smooth'] as const" :key="tool" type="button" :class="{ active: selectionTool === tool }" @click="selectionTool = tool">{{ tool }}</button>
        </div>

        <div class="split">
          <label>Channel
            <select v-model="channelModel">
              <option v-for="channel in channels" :key="channel.key" :value="channel.key">{{ channel.label }}</option>
            </select>
          </label>
          <label>Edge feather
            <select v-model.number="featherModel">
              <option v-for="value in [0, 1, 2, 3]" :key="value" :value="value">{{ value }} shade{{ value === 1 ? '' : 's' }}</option>
            </select>
          </label>
        </div>

        <template v-if="selectionTool === 'shape'">
          <p class="hint">Drag the curve body to offset the range. Start, Curve, and End handles control its shape.</p>
          <div class="numeric-grid">
            <label>Offset Δ
              <input v-model.number="bodyOffset" type="number" :step="selectionChannel?.step" />
            </label>
            <label>Start Δ
              <input type="number" :step="selectionChannel?.step" :value="selectionCurve.startDelta" @change="setCurveValue('startDelta', $event)" />
            </label>
            <label>Curve Δ
              <input type="number" :step="selectionChannel?.step" :value="selectionCurve.curveDelta" @change="setCurveValue('curveDelta', $event)" />
            </label>
            <label>End Δ
              <input type="number" :step="selectionChannel?.step" :value="selectionCurve.endDelta" @change="setCurveValue('endDelta', $event)" />
            </label>
          </div>
          <button type="button" @click="resetSelectionCurve">Reset curve</button>
        </template>

        <template v-else-if="selectionTool === 'fit'">
          <label>Reference
            <select v-model="sourceName">
              <option v-for="rank in referenceRanks" :key="rank.family.name" :value="rank.family.name">{{ rank.family.name }} · ΔE {{ rank.meanDelta.toFixed(3) }}</option>
            </select>
          </label>
          <div class="split">
            <label>Method
              <select v-model="operation"><option value="shape">shape</option><option value="values">values</option></select>
            </label>
            <label>Amount <output>{{ Math.round(amount * 100) }}%</output>
              <input v-model.number="amount" type="range" min="0" max="1" step="0.01" />
            </label>
          </div>
          <p class="hint">Only {{ shadeSelection.from }}–{{ shadeSelection.to }} and its feathered edges move toward {{ selectedSource?.name }}.</p>
        </template>

        <template v-else>
          <label>Smoothing strength <output>{{ Math.round(smoothStrength * 100) }}%</output>
            <input v-model.number="smoothStrength" type="range" min="0" max="1" step="0.01" />
          </label>
          <label class="check"><input v-model="protectEndpoints" type="checkbox" /> Preserve selection endpoints</label>
          <p class="hint">Regularizes local kinks inside this range while keeping the rest of the palette unchanged.</p>
        </template>

        <label class="check"><input v-model="protectAnchor" type="checkbox" /> Preserve anchor {{ resolvedAnchor }}</label>
      </template>

      <div v-else class="empty-selection">
        <div class="empty-diagram" aria-hidden="true">[ ●—●—● ]</div>
        <h2>Select shades first</h2>
        <p>Click a shade, Shift-click a range, or drag across the shade strip. The curve controls will appear here.</p>
        <div class="actions">
          <button type="button" class="primary" @click="setShadeSelection(700, 950)">Select dark tail</button>
          <button type="button" @click="setShadeSelection(50, 950)">Select all</button>
        </div>
      </div>
    </section>

    <section v-else class="inspector-body">
      <header><h2>Edit history</h2><p>Every applied selection operation and direct point edit is reversible.</p></header>
      <div class="actions"><button type="button" :disabled="!canUndo" @click="undo">Undo</button><button type="button" :disabled="!canRedo" @click="redo">Redo</button></div>
      <ol class="history-list">
        <li v-for="(entry, index) in history" :key="`${index}-${entry.label}`">
          <button type="button" :class="{ current: index === historyIndex }" :aria-current="index === historyIndex ? 'step' : undefined" @click="restoreHistory(index)"><span>{{ String(index + 1).padStart(2, '0') }}</span>{{ entry.label }}</button>
        </li>
      </ol>
    </section>

    <footer v-if="previewShades" class="preview-bar">
      <div><span>PREVIEW</span>{{ previewLabel }}</div>
      <div class="actions"><button type="button" @click="cancelSelectionPreview">Cancel</button><button type="button" class="primary" @click="applySelectionPreview">Apply</button></div>
    </footer>
  </aside>
</template>

<style scoped>
.inspector { display: flex; min-width: 0; min-height: 560px; flex-direction: column; border: 1px solid #2a2c33; border-radius: 10px; background: #1b1c21; overflow: hidden; }
.tabs { display: grid; grid-template-columns: repeat(3, 1fr); border-bottom: 1px solid #2a2c33; }
.tabs button { padding: 10px 3px; border: 0; border-right: 1px solid #2a2c33; border-radius: 0; background: #18191d; color: #8f929d; font-size: 10px; letter-spacing: .025em; }
.tabs button:last-child { border-right: 0; }
.tabs button.active { color: #f1f2f5; background: #23252b; box-shadow: inset 0 -2px #7190ff; }
.inspector-body { display: flex; flex: 1; flex-direction: column; gap: 14px; padding: 16px; }
header h2 { margin: 0; color: #e6e7eb; font-size: 12px; letter-spacing: .07em; text-transform: uppercase; }
header p { margin: 5px 0 0; color: #8f929d; font-size: 11.5px; line-height: 1.5; }
.selection-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; }
label { display: flex; flex-direction: column; gap: 5px; color: #a8aab3; font-size: 11px; }
label output { margin-left: auto; color: #e7e8ec; font-family: ui-monospace, monospace; }
input[type='range'] { width: 100%; padding: 0; accent-color: #7190ff; }
input[type='color'] { width: 28px; height: 28px; padding: 3px; }
select, button, input { min-width: 0; }
.split { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.numeric-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.numeric-grid input { width: 100%; font-family: ui-monospace, monospace; }
.check { flex-direction: row; align-items: center; gap: 7px; }
.check input { margin: 0; }
.actions, .inline-control { display: flex; gap: 7px; }
.actions button { flex: 1; }
.inline-control select { flex: 1; }
.tool-switch { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px; }
.tool-switch button { text-transform: capitalize; }
.tool-switch button.active { border-color: #6077bd; background: #283048; color: #d5ddff; }
.reference-list { display: flex; flex-direction: column; gap: 8px; }
.reference-row { padding: 9px; border: 1px solid #30323a; background: #202127; }
.reference-row.off { opacity: .55; }
.reference-title, .reference-controls { display: flex; align-items: center; gap: 7px; }
.reference-title { justify-content: space-between; }
.reference-title strong { color: #e7e8ec; text-transform: capitalize; }
.reference-controls { margin-top: 8px; flex-wrap: wrap; }
.reference-controls select { flex: 1; }
.sample circle, .sample rect, .sample polygon { fill: #202127; stroke-width: 1.5; }
.score { color: #8f929d; font: 11px ui-monospace, monospace; }
.hint { margin: 0; color: #777b87; font-size: 10.5px; line-height: 1.5; }
.empty-selection { display: flex; flex: 1; flex-direction: column; align-items: center; justify-content: center; gap: 10px; text-align: center; }
.empty-selection h2, .empty-selection p { margin: 0; }
.empty-selection p { max-width: 28ch; color: #8f929d; line-height: 1.5; }
.empty-diagram { color: #ffc167; font: 18px ui-monospace, monospace; letter-spacing: .12em; }
.history-list { display: flex; flex-direction: column-reverse; gap: 3px; margin: 0; padding: 0; list-style: none; }
.history-list button { width: 100%; border-color: transparent; background: transparent; text-align: left; }
.history-list button span { display: inline-block; width: 28px; color: #777a84; font-family: ui-monospace, monospace; }
.history-list button.current { border-color: #465067; background: #242832; color: #fff; }
.preview-bar { position: sticky; bottom: 0; display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 11px 14px; border-top: 1px solid #3c465f; background: #222733; color: #cfd5e6; font-size: 11px; }
.preview-bar span { margin-right: 7px; color: #8da7ff; font: 9px ui-monospace, monospace; letter-spacing: .1em; }
button:disabled { cursor: not-allowed; opacity: .38; }
</style>
