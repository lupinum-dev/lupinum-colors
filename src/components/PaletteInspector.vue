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
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Slider } from '@/components/ui/slider'

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
const amountModel = computed({
  get: () => [amount.value],
  set: (value: number[]) => (amount.value = value[0] ?? 0),
})
const smoothStrengthModel = computed({
  get: () => [smoothStrength.value],
  set: (value: number[]) => (smoothStrength.value = value[0] ?? 0),
})

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
  <Card class="inspector" aria-label="Palette inspector">
    <nav class="tabs" aria-label="Inspector sections">
      <Button
        v-for="item in tabs"
        :key="item.id"
        type="button"
        :class="{ active: tab === item.id }"
        @click="tab = item.id"
      >
        {{ item.label }}
      </Button>
    </nav>

    <section v-if="tab === 'references'" class="inspector-body">
      <header>
        <h2>Nearest Tailwind palettes</h2>
        <p>Compare complete curves, or fit the current selection toward one reference.</p>
      </header>
      <div class="reference-list">
        <article
          v-for="overlay in overlayConfigs"
          :key="overlay.name"
          class="reference-row"
          :class="{ off: !overlay.enabled }"
        >
          <div class="reference-title">
            <label class="check">
              <Checkbox
                :model-value="overlay.enabled"
                @update:model-value="updateOverlay(overlay.name, { enabled: !overlay.enabled })"
              />
              <svg class="sample" width="46" height="14" aria-hidden="true">
                <line
                  x1="2"
                  y1="7"
                  x2="44"
                  y2="7"
                  :stroke="overlay.color"
                  stroke-width="1.5"
                  :stroke-dasharray="OVERLAY_DASH[overlay.line]"
                />
                <circle
                  v-if="overlay.marker === 'circle'"
                  cx="23"
                  cy="7"
                  r="3.5"
                  :stroke="overlay.color"
                />
                <rect
                  v-else-if="overlay.marker === 'square'"
                  x="19.7"
                  y="3.7"
                  width="6.6"
                  height="6.6"
                  :stroke="overlay.color"
                />
                <rect
                  v-else-if="overlay.marker === 'diamond'"
                  x="19.8"
                  y="3.8"
                  width="6.4"
                  height="6.4"
                  transform="rotate(45 23 7)"
                  :stroke="overlay.color"
                />
                <polygon v-else :points="trianglePoints(23, 7, 4.4)" :stroke="overlay.color" />
              </svg>
              <strong>{{ overlay.name }}</strong>
            </label>
            <Badge variant="secondary" class="font-mono">{{ overlay.score.toFixed(0) }}%</Badge>
          </div>
          <div class="reference-controls">
            <input
              type="color"
              :value="overlay.color"
              :aria-label="`${overlay.name} line color`"
              @input="
                updateOverlay(overlay.name, { color: ($event.target as HTMLInputElement).value })
              "
            />
            <NativeSelect
              :value="overlay.line"
              :aria-label="`${overlay.name} line style`"
              @change="
                updateOverlay(overlay.name, {
                  line: ($event.target as HTMLSelectElement).value as typeof overlay.line,
                })
              "
            >
              <NativeSelectOption
                v-for="option in OVERLAY_LINE_OPTIONS"
                :key="option.value"
                :value="option.value"
                >{{ option.label }}</NativeSelectOption
              >
            </NativeSelect>
            <NativeSelect
              :value="overlay.marker"
              :aria-label="`${overlay.name} marker shape`"
              @change="
                updateOverlay(overlay.name, {
                  marker: ($event.target as HTMLSelectElement).value as typeof overlay.marker,
                })
              "
            >
              <NativeSelectOption
                v-for="marker in OVERLAY_MARKER_OPTIONS"
                :key="marker"
                :value="marker"
                >{{ marker }}</NativeSelectOption
              >
            </NativeSelect>
            <Button type="button" @click="soloOverlay(overlay.name)">Solo</Button>
            <Button type="button" @click="fitFrom(overlay.name)">Fit selection</Button>
            <Button
              type="button"
              :aria-label="`Remove ${overlay.name} reference`"
              @click="removeOverlay(overlay.name)"
              >×</Button
            >
          </div>
        </article>
      </div>
      <div class="inline-control">
        <NativeSelect v-model="addReferenceName" aria-label="Reference palette to add">
          <NativeSelectOption
            v-for="rank in availableReferences"
            :key="rank.family.name"
            :value="rank.family.name"
            >{{ rank.family.name }} · {{ rank.score.toFixed(0) }}%</NativeSelectOption
          >
        </NativeSelect>
        <Button type="button" :disabled="!addReferenceName" @click="addSelectedReference"
          >Add</Button
        >
      </div>
    </section>

    <section v-else-if="tab === 'selection'" class="inspector-body selection-panel">
      <template v-if="shadeSelection">
        <header class="selection-head">
          <div>
            <h2>{{ shadeSelection.from }}–{{ shadeSelection.to }}</h2>
            <p>
              {{ selectedShadeRange.length }} selected shade{{
                selectedShadeRange.length === 1 ? '' : 's'
              }}
              · {{ selectionChannel?.label }} channel
            </p>
          </div>
          <Button type="button" @click="setShadeSelection(50, 950)">Select all</Button>
        </header>

        <div class="tool-switch" role="group" aria-label="Selection operation">
          <Button
            v-for="tool in ['shape', 'fit', 'smooth'] as const"
            :key="tool"
            type="button"
            :class="{ active: selectionTool === tool }"
            @click="selectionTool = tool"
            >{{ tool }}</Button
          >
        </div>

        <div class="split">
          <label
            >Channel
            <NativeSelect v-model="channelModel">
              <NativeSelectOption
                v-for="channel in channels"
                :key="channel.key"
                :value="channel.key"
                >{{ channel.label }}</NativeSelectOption
              >
            </NativeSelect>
          </label>
          <label
            >Edge feather
            <NativeSelect v-model.number="featherModel">
              <NativeSelectOption v-for="value in [0, 1, 2, 3]" :key="value" :value="value"
                >{{ value }} shade{{ value === 1 ? '' : 's' }}</NativeSelectOption
              >
            </NativeSelect>
          </label>
        </div>

        <template v-if="selectionTool === 'shape'">
          <p class="hint">
            Drag the curve body to offset the range. Start, Curve, and End handles control its
            shape.
          </p>
          <div class="numeric-grid">
            <label
              >Offset Δ
              <Input v-model.number="bodyOffset" type="number" :step="selectionChannel?.step" />
            </label>
            <label
              >Start Δ
              <Input
                type="number"
                :step="selectionChannel?.step"
                :model-value="selectionCurve.startDelta"
                @change="setCurveValue('startDelta', $event)"
              />
            </label>
            <label
              >Curve Δ
              <Input
                type="number"
                :step="selectionChannel?.step"
                :model-value="selectionCurve.curveDelta"
                @change="setCurveValue('curveDelta', $event)"
              />
            </label>
            <label
              >End Δ
              <Input
                type="number"
                :step="selectionChannel?.step"
                :model-value="selectionCurve.endDelta"
                @change="setCurveValue('endDelta', $event)"
              />
            </label>
          </div>
          <Button type="button" @click="resetSelectionCurve()">Reset curve</Button>
        </template>

        <template v-else-if="selectionTool === 'fit'">
          <label
            >Reference
            <NativeSelect v-model="sourceName">
              <NativeSelectOption
                v-for="rank in referenceRanks"
                :key="rank.family.name"
                :value="rank.family.name"
                >{{ rank.family.name }} · ΔE {{ rank.meanDelta.toFixed(3) }}</NativeSelectOption
              >
            </NativeSelect>
          </label>
          <div class="split">
            <label
              >Method
              <NativeSelect v-model="operation"
                ><NativeSelectOption value="shape">shape</NativeSelectOption
                ><NativeSelectOption value="values">values</NativeSelectOption></NativeSelect
              >
            </label>
            <label
              >Amount <output>{{ Math.round(amount * 100) }}%</output>
              <Slider v-model="amountModel" :min="0" :max="1" :step="0.01" />
            </label>
          </div>
          <p class="hint">
            Only {{ shadeSelection.from }}–{{ shadeSelection.to }} and its feathered edges move
            toward {{ selectedSource?.name }}.
          </p>
        </template>

        <template v-else>
          <label
            >Smoothing strength <output>{{ Math.round(smoothStrength * 100) }}%</output>
            <Slider v-model="smoothStrengthModel" :min="0" :max="1" :step="0.01" />
          </label>
          <label class="check"
            ><Checkbox v-model="protectEndpoints" /> Preserve selection endpoints</label
          >
          <p class="hint">
            Regularizes local kinks inside this range while keeping the rest of the palette
            unchanged.
          </p>
        </template>

        <label class="check"
          ><Checkbox v-model="protectAnchor" /> Preserve anchor {{ resolvedAnchor }}</label
        >
      </template>

      <div v-else class="empty-selection">
        <div class="empty-diagram" aria-hidden="true">[ ●—●—● ]</div>
        <h2>Select shades first</h2>
        <p>
          Click a shade, Shift-click a range, or drag across the shade strip. The curve controls
          will appear here.
        </p>
        <div class="actions">
          <Button type="button" class="primary" @click="setShadeSelection(700, 950)"
            >Select dark tail</Button
          >
          <Button type="button" @click="setShadeSelection(50, 950)">Select all</Button>
        </div>
      </div>
    </section>

    <section v-else class="inspector-body">
      <header>
        <h2>Edit history</h2>
        <p>Every applied selection operation and direct point edit is reversible.</p>
      </header>
      <div class="actions">
        <Button type="button" :disabled="!canUndo" @click="undo">Undo</Button
        ><Button type="button" :disabled="!canRedo" @click="redo">Redo</Button>
      </div>
      <ol class="history-list">
        <li v-for="(entry, index) in history" :key="`${index}-${entry.label}`">
          <Button
            type="button"
            :class="{ current: index === historyIndex }"
            :aria-current="index === historyIndex ? 'step' : undefined"
            @click="restoreHistory(index)"
            ><span>{{ String(index + 1).padStart(2, '0') }}</span
            >{{ entry.label }}</Button
          >
        </li>
      </ol>
    </section>

    <footer v-if="previewShades" class="preview-bar">
      <div><span>PREVIEW</span>{{ previewLabel }}</div>
      <div class="actions">
        <Button type="button" @click="cancelSelectionPreview">Cancel</Button
        ><Button type="button" class="primary" @click="applySelectionPreview">Apply</Button>
      </div>
    </footer>
  </Card>
</template>

<style scoped>
.inspector {
  display: flex;
  min-width: 0;
  min-height: 560px;
  flex-direction: column;
  gap: 0;
  padding: 0;
}
.tabs {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  border-bottom: 1px solid var(--border);
}
.tabs :deep(button) {
  border: 0;
  border-right: 1px solid var(--border);
  border-radius: 0;
  background: transparent;
  color: var(--muted-foreground);
  box-shadow: none;
}
.tabs :deep(button:last-child) {
  border-right: 0;
}
.tabs :deep(button.active) {
  background: var(--muted);
  color: var(--foreground);
  box-shadow: inset 0 -2px var(--primary);
}
.inspector-body {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 14px;
  padding: 16px;
}
header h2 {
  margin: 0;
  color: var(--foreground);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.07em;
  text-transform: uppercase;
}
header p {
  margin: 5px 0 0;
  color: var(--muted-foreground);
  font-size: 11.5px;
  line-height: 1.5;
}
.selection-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
}
label {
  display: flex;
  flex-direction: column;
  gap: 6px;
  color: var(--muted-foreground);
  font-size: 11px;
}
label output {
  margin-left: auto;
  color: var(--foreground);
  font-family: ui-monospace, monospace;
}
input[type='color'] {
  width: 32px;
  height: 32px;
  padding: 3px;
  border: 1px solid var(--input);
  border-radius: var(--radius-md);
  background: transparent;
}
.split,
.numeric-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
.numeric-grid :deep(input) {
  font-family: ui-monospace, monospace;
}
.check {
  flex-direction: row;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}
.actions,
.inline-control {
  display: flex;
  gap: 7px;
}
.actions :deep(button) {
  flex: 1;
}
.inline-control > :first-child {
  flex: 1;
}
.tool-switch {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 4px;
}
.tool-switch :deep(button) {
  text-transform: capitalize;
}
.tool-switch :deep(button.active) {
  border-color: var(--ring);
  background: var(--muted);
  color: var(--foreground);
}
.reference-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.reference-row {
  padding: 10px;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: color-mix(in oklch, var(--muted) 55%, transparent);
}
.reference-row.off {
  opacity: 0.55;
}
.reference-title,
.reference-controls {
  display: flex;
  align-items: center;
  gap: 7px;
}
.reference-title {
  justify-content: space-between;
}
.reference-title strong {
  color: var(--foreground);
  text-transform: capitalize;
}
.reference-controls {
  margin-top: 8px;
  flex-wrap: wrap;
}
.reference-controls > :deep([data-slot='native-select-wrapper']) {
  min-width: 90px;
  flex: 1;
}
.sample circle,
.sample rect,
.sample polygon {
  fill: var(--card);
  stroke-width: 1.5;
}
.hint {
  margin: 0;
  color: var(--muted-foreground);
  font-size: 10.5px;
  line-height: 1.5;
}
.empty-selection {
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  text-align: center;
}
.empty-selection h2,
.empty-selection p {
  margin: 0;
}
.empty-selection p {
  max-width: 28ch;
  color: var(--muted-foreground);
  line-height: 1.5;
}
.empty-diagram {
  color: oklch(0.78 0.14 78);
  font:
    18px ui-monospace,
    monospace;
  letter-spacing: 0.12em;
}
.history-list {
  display: flex;
  flex-direction: column-reverse;
  gap: 3px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.history-list :deep(button) {
  width: 100%;
  justify-content: flex-start;
  border-color: transparent;
  background: transparent;
  text-align: left;
}
.history-list :deep(button span) {
  display: inline-block;
  width: 28px;
  color: var(--muted-foreground);
  font-family: ui-monospace, monospace;
}
.history-list :deep(button.current) {
  border-color: var(--border);
  background: var(--muted);
  color: var(--foreground);
}
.preview-bar {
  position: sticky;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 11px 14px;
  border-top: 1px solid var(--border);
  background: var(--card);
  color: var(--foreground);
  font-size: 11px;
}
.preview-bar span {
  margin-right: 7px;
  color: oklch(0.72 0.14 265);
  font:
    9px ui-monospace,
    monospace;
  letter-spacing: 0.1em;
}
</style>
