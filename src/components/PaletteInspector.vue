<script setup lang="ts">
import { XIcon } from '@lucide/vue'
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
  beginContinuousEdit,
  cancelSelectionPreview,
  canRedo,
  canUndo,
  channelMode,
  displayShades,
  effectiveShades,
  endContinuousEdit,
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
  selectedShade,
  selectionChannel,
  selectionChannelKey,
  selectionCurve,
  selectionFeather,
  setPreview,
  setSelectionChannel,
  setSelectionFeather,
  setShadeSelection,
  setShadeColor,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { formatOklch } from '@/index'

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
const selectedEntry = computed(() =>
  displayShades.value.find((entry) => entry.shade === selectedShade.value),
)
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
  },
  { immediate: true },
)
watch(
  availableReferences,
  (ranks) => {
    const isAvailable = ranks.some((rank) => rank.family.name === addReferenceName.value)
    if (!isAvailable) addReferenceName.value = ranks[0]?.family.name ?? ''
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

function channelInput(event: Event, channelLabel: string, set: (value: number) => void): void {
  const value = Number((event.target as HTMLInputElement).value)
  if (!Number.isFinite(value)) return
  beginContinuousEdit()
  set(value)
  endContinuousEdit(`Set ${channelLabel} at ${selectedShade.value}`)
}

function contrastBadge(ratio: number): string {
  if (ratio >= 7) return 'AAA'
  if (ratio >= 4.5) return 'AA'
  if (ratio >= 3) return 'UI'
  return 'Fail'
}
</script>

<template>
  <Card class="inspector" aria-label="Palette inspector">
    <Tabs v-model="tab" class="min-h-0 flex-1 gap-0">
      <TabsList
        variant="line"
        class="grid h-12 w-full grid-cols-3 rounded-none border-b bg-transparent px-3"
      >
        <TabsTrigger v-for="item in tabs" :key="item.id" :value="item.id">{{
          item.label
        }}</TabsTrigger>
      </TabsList>

      <TabsContent value="references" class="inspector-body">
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
              <div class="reference-style-row">
                <input
                  type="color"
                  :value="overlay.color"
                  :aria-label="`${overlay.name} line color`"
                  @input="
                    updateOverlay(overlay.name, {
                      color: ($event.target as HTMLInputElement).value,
                    })
                  "
                />
                <NativeSelect
                  :model-value="overlay.line"
                  :aria-label="`${overlay.name} line style`"
                  @update:model-value="
                    updateOverlay(overlay.name, {
                      line: $event as typeof overlay.line,
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
                  :model-value="overlay.marker"
                  :aria-label="`${overlay.name} marker shape`"
                  @update:model-value="
                    updateOverlay(overlay.name, {
                      marker: $event as typeof overlay.marker,
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
              </div>
              <div class="reference-action-row">
                <Button type="button" variant="ghost" size="xs" @click="soloOverlay(overlay.name)"
                  >Solo</Button
                >
                <Button type="button" variant="outline" size="xs" @click="fitFrom(overlay.name)"
                  >Fit selection</Button
                >
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  class="ms-auto"
                  :aria-label="`Remove ${overlay.name} reference`"
                  @click="removeOverlay(overlay.name)"
                  ><XIcon
                /></Button>
              </div>
            </div>
          </article>
        </div>
        <div class="inline-control">
          <NativeSelect v-model="addReferenceName" aria-label="Reference palette to add">
            <NativeSelectOption v-if="!availableReferences.length" value="" disabled
              >No palettes available</NativeSelectOption
            >
            <NativeSelectOption
              v-for="rank in availableReferences"
              :key="rank.family.name"
              :value="rank.family.name"
              >{{ rank.family.name }} · {{ rank.score.toFixed(0) }}%</NativeSelectOption
            >
          </NativeSelect>
          <Button
            type="button"
            size="sm"
            :disabled="!addReferenceName"
            @click="addSelectedReference"
            >Add</Button
          >
        </div>
      </TabsContent>

      <TabsContent value="selection" class="inspector-body selection-panel">
        <section v-if="selectedEntry && effectiveShades" class="shade-summary">
          <div class="shade-summary-head">
            <span
              class="shade-swatch"
              :style="{ background: selectedEntry.css }"
              aria-hidden="true"
            />
            <div class="min-w-0">
              <p class="shade-eyebrow">Selected shade</p>
              <h2>{{ selectedEntry.shade }}</h2>
            </div>
            <Badge variant="outline" class="ms-auto font-mono">{{ selectedEntry.hex }}</Badge>
          </div>
          <p class="shade-value">{{ formatOklch(selectedEntry.raw) }}</p>
          <div class="numeric-grid">
            <label v-for="channel in CHANNEL_MODES[channelMode]" :key="channel.key">
              {{ channel.label }}
              <Input
                :id="`inspector-channel-${channel.key}`"
                class="font-mono"
                type="number"
                :min="channel.min"
                :max="channel.max"
                :step="channel.step"
                :model-value="Number(channel.get(selectedEntry.raw).toFixed(4))"
                @change="
                  channelInput($event, channel.label, (value) =>
                    setShadeColor(
                      selectedEntry!.shade,
                      channel.set(effectiveShades![selectedEntry!.shade], value),
                    ),
                  )
                "
              />
            </label>
          </div>
          <div class="shade-results">
            <Badge variant="secondary" class="font-mono"
              >White {{ selectedEntry.contrastOnWhite.toFixed(2) }} ·
              {{ contrastBadge(selectedEntry.contrastOnWhite) }}</Badge
            >
            <Badge variant="secondary" class="font-mono"
              >Black {{ selectedEntry.contrastOnBlack.toFixed(2) }} ·
              {{ contrastBadge(selectedEntry.contrastOnBlack) }}</Badge
            >
            <Badge
              v-if="!selectedEntry.inGamut"
              variant="outline"
              class="border-amber-500/40 text-amber-700 dark:text-amber-300"
              >Gamut mapped</Badge
            >
          </div>
        </section>

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
            <Button type="button" variant="outline" size="sm" @click="setShadeSelection(50, 950)"
              >Select all</Button
            >
          </header>

          <div class="tool-switch" role="group" aria-label="Selection operation">
            <Button
              v-for="tool in ['shape', 'fit', 'smooth'] as const"
              :key="tool"
              type="button"
              size="sm"
              :variant="selectionTool === tool ? 'secondary' : 'ghost'"
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
            <Button type="button" variant="outline" size="sm" @click="resetSelectionCurve()"
              >Reset curve</Button
            >
          </template>

          <template v-else-if="selectionTool === 'fit'">
            <label
              >Reference
              <NativeSelect v-model="sourceName">
                <NativeSelectOption value="" disabled>Select a reference…</NativeSelectOption>
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
          <div class="empty-diagram" aria-hidden="true">
            <span></span><span></span><span></span>
          </div>
          <h2>Choose a tonal range</h2>
          <p>
            Click a shade, Shift-click a range, or drag across the strip to shape several shades
            together.
          </p>
          <div class="grid w-full max-w-64 gap-2">
            <Button type="button" @click="setShadeSelection(700, 950)">Select dark tail</Button>
            <Button type="button" variant="outline" @click="setShadeSelection(50, 950)"
              >Select full scale</Button
            >
          </div>
        </div>
      </TabsContent>

      <TabsContent value="history" class="inspector-body">
        <header>
          <h2>Edit history</h2>
          <p>Every applied selection operation and direct point edit is reversible.</p>
        </header>
        <div class="actions">
          <Button type="button" variant="outline" size="sm" :disabled="!canUndo" @click="undo"
            >Undo</Button
          ><Button type="button" variant="outline" size="sm" :disabled="!canRedo" @click="redo"
            >Redo</Button
          >
        </div>
        <ol class="history-list">
          <li v-for="(entry, index) in history" :key="`${index}-${entry.label}`">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              :class="{ current: index === historyIndex }"
              :aria-current="index === historyIndex ? 'step' : undefined"
              @click="restoreHistory(index)"
              ><span>{{ String(index + 1).padStart(2, '0') }}</span
              >{{ entry.label }}</Button
            >
          </li>
        </ol>
      </TabsContent>
    </Tabs>

    <footer v-if="previewShades" class="preview-bar">
      <div><span>PREVIEW</span>{{ previewLabel }}</div>
      <div class="actions">
        <Button type="button" variant="outline" size="sm" @click="cancelSelectionPreview"
          >Cancel</Button
        ><Button type="button" size="sm" @click="applySelectionPreview">Apply</Button>
      </div>
    </footer>
  </Card>
</template>

<style scoped>
.inspector {
  display: flex;
  min-width: 0;
  min-height: calc(clamp(480px, 62dvh, 760px) + 53px);
  max-height: calc(100dvh - 84px);
  flex-direction: column;
  gap: 0;
  padding: 0;
}
.inspector-body {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 14px;
  padding: 20px;
  overflow-y: auto;
  overscroll-behavior: contain;
}
.shade-summary {
  display: grid;
  gap: 12px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--border);
}
.shade-summary-head {
  display: flex;
  align-items: center;
  gap: 10px;
}
.shade-swatch {
  width: 34px;
  height: 34px;
  flex: 0 0 auto;
  border-radius: var(--radius-md);
  outline: 1px solid rgb(0 0 0 / 10%);
  outline-offset: -1px;
}
.shade-eyebrow {
  margin: 0;
  color: var(--muted-foreground);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.shade-summary h2 {
  margin-top: 1px;
  font-size: 14px;
  letter-spacing: 0;
  text-transform: none;
}
.shade-value {
  margin: 0;
  overflow-wrap: anywhere;
  font:
    11px/1.45 ui-monospace,
    monospace;
}
.shade-results {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
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
  gap: 12px;
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
.reference-list {
  display: flex;
  flex-direction: column;
  gap: 0;
}
.reference-row {
  padding: 12px 0;
  border-bottom: 1px solid var(--border);
}
.reference-row:last-child {
  border-bottom: 0;
}
.reference-row.off {
  opacity: 0.55;
}
.reference-title,
.reference-style-row,
.reference-action-row {
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
  display: grid;
  gap: 8px;
  margin-top: 8px;
}
.reference-style-row > :deep([data-slot='native-select-wrapper']) {
  min-width: 90px;
  flex: 1;
}
input[type='color']::-webkit-color-swatch {
  border: 0;
  border-radius: var(--radius-xs);
}
input[type='color']::-moz-color-swatch {
  border: 0;
  border-radius: var(--radius-xs);
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
  position: relative;
  display: flex;
  width: 112px;
  align-items: center;
  justify-content: space-between;
}
.empty-diagram::before {
  position: absolute;
  right: 8px;
  left: 8px;
  height: 2px;
  border-radius: 999px;
  background: color-mix(in oklch, var(--primary) 45%, transparent);
  content: '';
}
.empty-diagram span {
  z-index: 1;
  width: 16px;
  height: 16px;
  border: 3px solid var(--card);
  border-radius: 999px;
  background: var(--primary);
  box-shadow: 0 0 0 1px color-mix(in oklch, var(--primary) 65%, transparent);
}
.history-list {
  display: flex;
  flex-direction: column-reverse;
  gap: 0;
  margin: 0;
  padding: 0;
  list-style: none;
}
.history-list :deep(button) {
  width: 100%;
  justify-content: flex-start;
  min-height: 40px;
  border: 0;
  border-bottom: 1px solid var(--border);
  border-radius: 0;
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
  background: var(--muted);
  color: var(--foreground);
}
@media (min-width: 1792px) {
  .inspector {
    min-height: calc(clamp(560px, 68dvh, 920px) + 53px);
  }
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
  color: var(--muted-foreground);
  font:
    9px ui-monospace,
    monospace;
  letter-spacing: 0.1em;
}
</style>
