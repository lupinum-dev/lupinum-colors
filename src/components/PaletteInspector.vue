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
  applyPreview,
  canRedo,
  canUndo,
  channelMode,
  clearPreview,
  history,
  historyIndex,
  overlayConfigs,
  previewLabel,
  previewShades,
  protectAnchor,
  redo,
  referenceFamilies,
  referenceRanks,
  removeOverlay,
  resolvedAnchor,
  restoreHistory,
  setPreview,
  shades,
  soloOverlay,
  undo,
  updateOverlay,
} from '@/app/palette-store'
import {
  applyReferenceChannel,
  shapeChroma,
  smoothChannel,
  stabilizeHue,
  type ReferenceOperation,
  type TonalScope,
} from '@/app/palette-tools'
import type { Shade } from '@/types'
import ScopeControls from '@/components/ScopeControls.vue'

type InspectorTab = 'references' | 'borrow' | 'shape' | 'smooth' | 'history'

const tabs: { id: InspectorTab; label: string }[] = [
  { id: 'references', label: 'References' },
  { id: 'borrow', label: 'Borrow' },
  { id: 'shape', label: 'Tune' },
  { id: 'smooth', label: 'Smooth' },
  { id: 'history', label: 'History' },
]
const tab = ref<InspectorTab>('references')
const sourceName = ref('')
const channelKey = ref('c')
const operation = ref<ReferenceOperation>('shape')
const amount = ref(0.1)
const scope = ref<TonalScope>('all')
const scopeFrom = ref<Shade>(50)
const scopeTo = ref<Shade>(950)
const feather = ref(1)
const addReferenceName = ref('')

const PRESETS = {
  natural: { label: 'Natural', overall: 1, lights: 1, middle: 1, darks: 1, hue: 0 },
  soft: { label: 'Soft neutral', overall: 1, lights: 1, middle: 0.5, darks: 0.58, hue: 0.8 },
  'near-gray': { label: 'Near-gray', overall: 0.6, lights: 0.6, middle: 0.25, darks: 0.3, hue: 1 },
} as const
type PresetName = keyof typeof PRESETS
const presetNames = Object.keys(PRESETS) as PresetName[]
const stagedPreset = ref<PresetName | null>(null)
const tuneDirty = ref(false)
const hueStability = ref(0)

const smoothChannelKey = ref('c')
const smoothStrength = ref(0.35)
const smoothScope = ref<TonalScope>('all')
const protectEndpoints = ref(true)

const channels = computed(() => CHANNEL_MODES[channelMode.value])
const selectedSource = computed(() =>
  referenceFamilies.find((family) => family.name === sourceName.value),
)
const availableReferences = computed(() => {
  const selected = new Set(overlayConfigs.value.map((overlay) => overlay.name))
  return referenceRanks.value.filter(({ family }) => !selected.has(family.name))
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
  channelKey.value = channels.value[0]?.key ?? 'l'
  smoothChannelKey.value = channels.value[1]?.key ?? channels.value[0]?.key ?? 'l'
})

// Transform controls preview live; a pending preview never survives leaving its tab.
watch(tab, () => clearPreview())
watch(
  [sourceName, channelKey, operation, amount, scope, scopeFrom, scopeTo, feather, protectAnchor],
  () => {
    if (tab.value === 'borrow') previewBorrow()
  },
)
watch([hueStability, protectAnchor], () => {
  if (tab.value === 'shape') {
    tuneDirty.value = true
    previewTune(stagedPreset.value)
  }
})
watch([smoothChannelKey, smoothStrength, smoothScope, protectAnchor, protectEndpoints], () => {
  if (tab.value === 'smooth') previewSmooth()
})
// Once a preview is applied or cancelled, staged tune state is meaningless.
watch(previewShades, (value) => {
  if (!value) {
    stagedPreset.value = null
    tuneDirty.value = false
  }
})

function selectedChannel(key: string) {
  return channels.value.find((channel) => channel.key === key) ?? channels.value[0]
}

function previewBorrow(): void {
  const channel = selectedChannel(channelKey.value)
  if (!shades.value || !selectedSource.value || !channel) return
  setPreview(
    applyReferenceChannel(shades.value, selectedSource.value.colors, {
      channel,
      operation: operation.value,
      amount: amount.value,
      scope: scope.value,
      from: scopeFrom.value,
      to: scopeTo.value,
      feather: feather.value,
      anchor: resolvedAnchor.value,
      protectAnchor: protectAnchor.value,
    }),
    `${operation.value === 'shape' ? 'Borrowed' : 'Moved'} ${channel.label} ${Math.round(amount.value * 100)}% toward ${selectedSource.value.name}`,
  )
}

function replaceBorrowedChannel(): void {
  amount.value = 1
  operation.value = 'values'
  previewBorrow()
}

function previewTune(name: PresetName | null, hue: number = hueStability.value): void {
  if (!shades.value) return
  const preset = PRESETS[name ?? 'natural']
  let result = shapeChroma(shades.value, {
    overall: preset.overall,
    lights: preset.lights,
    middle: preset.middle,
    darks: preset.darks,
    anchor: resolvedAnchor.value,
    protectAnchor: protectAnchor.value,
  })
  result = stabilizeHue(result, {
    strength: hue,
    scope: 'darks',
    feather: 1,
    anchor: resolvedAnchor.value,
    protectAnchor: protectAnchor.value,
  })
  setPreview(
    result,
    name ? `Applied ${preset.label} preset` : `Stabilized dark hues at ${Math.round(hue * 100)}%`,
  )
}

function hoverPreset(name: PresetName): void {
  previewTune(name, PRESETS[name].hue)
}

function leavePreset(): void {
  if (tuneDirty.value || stagedPreset.value) previewTune(stagedPreset.value)
  else clearPreview()
}

function stagePreset(name: PresetName): void {
  stagedPreset.value = name
  tuneDirty.value = true
  hueStability.value = PRESETS[name].hue
  previewTune(name)
}

function previewSmooth(): void {
  const channel = selectedChannel(smoothChannelKey.value)
  if (!shades.value || !channel) return
  setPreview(
    smoothChannel(shades.value, {
      channel,
      strength: smoothStrength.value,
      scope: smoothScope.value,
      feather: 1,
      anchor: resolvedAnchor.value,
      protectAnchor: protectAnchor.value,
      protectEndpoints: protectEndpoints.value,
    }),
    `Smoothed ${channel.label} curve at ${Math.round(smoothStrength.value * 100)}%`,
  )
}

function addSelectedReference(): void {
  if (!addReferenceName.value) return
  addOverlay(addReferenceName.value)
  addReferenceName.value = availableReferences.value[0]?.family.name ?? ''
}

function borrowFrom(name: string): void {
  sourceName.value = name
  tab.value = 'borrow'
}
</script>

<template>
  <aside class="inspector" aria-label="Palette inspector">
    <nav class="tabs" aria-label="Inspector sections">
      <button
        v-for="item in tabs"
        :key="item.id"
        type="button"
        :class="{ active: tab === item.id }"
        @click="tab = item.id"
      >
        {{ item.label }}
      </button>
    </nav>

    <section v-if="tab === 'references'" class="inspector-body">
      <header>
        <div>
          <h2>Nearest Tailwind palettes</h2>
          <p>
            Ranked by mean OKLab distance. Overlays are visual references, not generation inputs.
          </p>
        </div>
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
              <input
                type="checkbox"
                :checked="overlay.enabled"
                @change="updateOverlay(overlay.name, { enabled: !overlay.enabled })"
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
            <span class="score">{{ overlay.score.toFixed(0) }}%</span>
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
            <select
              :value="overlay.line"
              :aria-label="`${overlay.name} line style`"
              @change="
                updateOverlay(overlay.name, {
                  line: ($event.target as HTMLSelectElement).value as typeof overlay.line,
                })
              "
            >
              <option
                v-for="option in OVERLAY_LINE_OPTIONS"
                :key="option.value"
                :value="option.value"
              >
                {{ option.label }}
              </option>
            </select>
            <select
              :value="overlay.marker"
              :aria-label="`${overlay.name} marker shape`"
              @change="
                updateOverlay(overlay.name, {
                  marker: ($event.target as HTMLSelectElement).value as typeof overlay.marker,
                })
              "
            >
              <option v-for="marker in OVERLAY_MARKER_OPTIONS" :key="marker" :value="marker">
                {{ marker }}
              </option>
            </select>
            <button type="button" @click="soloOverlay(overlay.name)">Solo</button>
            <button
              type="button"
              :aria-label="`Borrow a channel from ${overlay.name}`"
              @click="borrowFrom(overlay.name)"
            >
              Borrow
            </button>
            <button
              type="button"
              aria-label="Remove reference"
              @click="removeOverlay(overlay.name)"
            >
              ×
            </button>
          </div>
        </article>
      </div>

      <div class="inline-control">
        <select v-model="addReferenceName" aria-label="Reference palette to add">
          <option
            v-for="rank in availableReferences"
            :key="rank.family.name"
            :value="rank.family.name"
          >
            {{ rank.family.name }} · {{ rank.score.toFixed(0) }}%
          </option>
        </select>
        <button type="button" :disabled="!addReferenceName" @click="addSelectedReference">
          Add
        </button>
      </div>
    </section>

    <section v-else-if="tab === 'borrow'" class="inspector-body">
      <header>
        <div>
          <h2>Borrow a channel</h2>
          <p>
            Move toward literal values, or borrow only the reference curve’s shape around your
            anchor.
          </p>
        </div>
      </header>
      <label
        >Reference
        <select v-model="sourceName">
          <option v-for="rank in referenceRanks" :key="rank.family.name" :value="rank.family.name">
            {{ rank.family.name }} · ΔE {{ rank.meanDelta.toFixed(3) }}
          </option>
        </select>
      </label>
      <div class="split">
        <label
          >Channel
          <select v-model="channelKey">
            <option v-for="channel in channels" :key="channel.key" :value="channel.key">
              {{ channel.label }}
            </option>
          </select>
        </label>
        <label
          >Method
          <select v-model="operation">
            <option value="shape">shape</option>
            <option value="values">values</option>
          </select>
        </label>
      </div>
      <label
        >Amount <output>{{ Math.round(amount * 100) }}%</output>
        <input v-model.number="amount" type="range" min="0" max="1" step="0.01" />
      </label>
      <ScopeControls
        v-model:scope="scope"
        v-model:from="scopeFrom"
        v-model:to="scopeTo"
        v-model:feather="feather"
      />
      <label class="check"
        ><input v-model="protectAnchor" type="checkbox" /> Preserve anchor
        {{ resolvedAnchor }}</label
      >
      <div class="actions">
        <button type="button" @click="replaceBorrowedChannel">Replace 100%</button>
      </div>
      <p class="hint">Changes preview live — commit them with Apply below.</p>
    </section>

    <section v-else-if="tab === 'shape'" class="inspector-body">
      <header>
        <div>
          <h2>Tonal presets</h2>
          <p>Hover a preset to compare it live, click to stage it.</p>
        </div>
      </header>
      <div class="preset-row">
        <button
          v-for="name in presetNames"
          :key="name"
          type="button"
          :class="{ staged: stagedPreset === name }"
          @mouseenter="hoverPreset(name)"
          @mouseleave="leavePreset"
          @focus="hoverPreset(name)"
          @blur="leavePreset"
          @click="stagePreset(name)"
        >
          {{ PRESETS[name].label }}
        </button>
      </div>
      <label
        >Dark hue stability <output>{{ Math.round(hueStability * 100) }}%</output>
        <input v-model.number="hueStability" type="range" min="0" max="1" step="0.01" />
      </label>
      <label class="check"
        ><input v-model="protectAnchor" type="checkbox" /> Preserve anchor
        {{ resolvedAnchor }}</label
      >
      <p class="hint">
        For regional chroma, work on the canvas: ⇧-drag a C point to scale its neighborhood —
        scrolling while dragging widens or narrows the affected region.
      </p>
    </section>

    <section v-else-if="tab === 'smooth'" class="inspector-body">
      <header>
        <div>
          <h2>Curve regularization</h2>
          <p>Savitzky–Golay smoothing removes local kinks without flattening the entire palette.</p>
        </div>
      </header>
      <label
        >Channel
        <select v-model="smoothChannelKey">
          <option v-for="channel in channels" :key="channel.key" :value="channel.key">
            {{ channel.label }}
          </option>
        </select>
      </label>
      <label
        >Strength <output>{{ Math.round(smoothStrength * 100) }}%</output>
        <input v-model.number="smoothStrength" type="range" min="0" max="1" step="0.01" />
      </label>
      <label
        >Scope
        <select v-model="smoothScope">
          <option value="all">all shades</option>
          <option value="lights">lights · 50–300</option>
          <option value="middle">middle · 400–600</option>
          <option value="darks">darks · 700–950</option>
        </select>
      </label>
      <label class="check"
        ><input v-model="protectAnchor" type="checkbox" /> Preserve anchor
        {{ resolvedAnchor }}</label
      >
      <label class="check"
        ><input v-model="protectEndpoints" type="checkbox" /> Preserve endpoints</label
      >
      <p class="hint">Changes preview live — commit them with Apply below.</p>
    </section>

    <section v-else class="inspector-body">
      <header>
        <div>
          <h2>Edit history</h2>
          <p>Every committed transform and curve edit is reversible.</p>
        </div>
      </header>
      <div class="actions">
        <button type="button" :disabled="!canUndo" @click="undo">Undo</button>
        <button type="button" :disabled="!canRedo" @click="redo">Redo</button>
      </div>
      <ol class="history-list">
        <li v-for="(entry, index) in history" :key="`${index}-${entry.label}`">
          <button
            type="button"
            :class="{ current: index === historyIndex }"
            :aria-current="index === historyIndex ? 'step' : undefined"
            @click="restoreHistory(index)"
          >
            <span>{{ String(index + 1).padStart(2, '0') }}</span
            >{{ entry.label }}
          </button>
        </li>
      </ol>
    </section>

    <footer v-if="previewShades" class="preview-bar">
      <div><span>PREVIEW</span>{{ previewLabel }}</div>
      <div class="actions">
        <button type="button" @click="clearPreview">Cancel</button>
        <button type="button" class="primary" @click="applyPreview">Apply</button>
      </div>
    </footer>
  </aside>
</template>

<style scoped>
.inspector {
  display: flex;
  min-width: 0;
  min-height: 560px;
  flex-direction: column;
  border: 1px solid #2a2c33;
  border-radius: 10px;
  background: #1b1c21;
  overflow: hidden;
}
.tabs {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  border-bottom: 1px solid #2a2c33;
}
.tabs button {
  padding: 10px 3px;
  border: 0;
  border-right: 1px solid #2a2c33;
  border-radius: 0;
  background: #18191d;
  color: #8f929d;
  font-size: 10px;
  letter-spacing: 0.025em;
}
.tabs button:last-child {
  border-right: 0;
}
.tabs button.active {
  color: #f1f2f5;
  background: #23252b;
  box-shadow: inset 0 -2px #7190ff;
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
  color: #e6e7eb;
  font-size: 12px;
  letter-spacing: 0.07em;
  text-transform: uppercase;
}
header p {
  margin: 5px 0 0;
  color: #8f929d;
  font-size: 11.5px;
  line-height: 1.5;
}
label {
  display: flex;
  flex-direction: column;
  gap: 5px;
  color: #a8aab3;
  font-size: 11px;
}
label output {
  margin-left: auto;
  color: #e7e8ec;
  font-family: ui-monospace, monospace;
}
input[type='range'] {
  width: 100%;
  padding: 0;
  accent-color: #7190ff;
}
input[type='color'] {
  width: 28px;
  height: 28px;
  padding: 3px;
}
select,
button,
input {
  min-width: 0;
}
.split {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
.check {
  flex-direction: row;
  align-items: center;
  gap: 7px;
}
.check input {
  margin: 0;
}
.actions,
.inline-control,
.preset-row {
  display: flex;
  gap: 7px;
}
.actions button,
.preset-row button {
  flex: 1;
}
.preset-row button.staged {
  border-color: #586b9e;
  background: #283048;
  color: #cbd6ff;
}
.inline-control select {
  flex: 1;
}
.reference-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.reference-row {
  padding: 9px;
  border: 1px solid #30323a;
  background: #202127;
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
  color: #e7e8ec;
  text-transform: capitalize;
}
.reference-controls {
  margin-top: 8px;
  flex-wrap: wrap;
}
.reference-controls select {
  flex: 1;
}
.sample {
  flex: 0 0 auto;
}
.sample circle,
.sample rect,
.sample polygon {
  fill: #202127;
  stroke-width: 1.5;
}
.reference-row.off .sample,
.reference-row.off strong {
  opacity: 0.4;
}
.score {
  color: #8f929d;
  font:
    11px ui-monospace,
    monospace;
}
.hint {
  margin: 0;
  color: #767a85;
  font-size: 10.5px;
}
.history-list {
  display: flex;
  flex-direction: column-reverse;
  gap: 3px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.history-list button {
  width: 100%;
  border-color: transparent;
  background: transparent;
  text-align: left;
}
.history-list button span {
  display: inline-block;
  width: 28px;
  color: #777a84;
  font-family: ui-monospace, monospace;
}
.history-list button.current {
  border-color: #465067;
  background: #242832;
  color: #fff;
}
.preview-bar {
  position: sticky;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 11px 14px;
  border-top: 1px solid #3c465f;
  background: #222733;
  color: #cfd5e6;
  font-size: 11px;
}
.preview-bar span {
  margin-right: 7px;
  color: #8da7ff;
  font:
    9px ui-monospace,
    monospace;
  letter-spacing: 0.1em;
}
button:disabled {
  cursor: not-allowed;
  opacity: 0.38;
}
</style>
