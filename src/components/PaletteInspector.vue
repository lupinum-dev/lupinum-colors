<script setup lang="ts">
import { XIcon } from '@lucide/vue'
import { computed, ref, watch } from 'vue'
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
  clearPreview,
  effectiveShades,
  history,
  historyIndex,
  overlayConfigs,
  type OverlayLine,
  type OverlayMarker,
  previewLabel,
  previewShades,
  redo,
  referenceRanks,
  removeOverlay,
  restoreHistory,
  setPreview,
  shades,
  soloOverlay,
  undo,
  updateOverlay,
} from '@/app/palette-store'
import { adjustPaletteEnds, clonePalette, type PaletteEndOptions } from '@/app/palette-tools'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Slider } from '@/components/ui/slider'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { formatHex } from '@/color'
import { formatOklch } from '@/index'
import { SHADE_NAMES, type OklchColor, type Shade } from '@/types'

type InspectorTab = 'references' | 'selection' | 'history'
type EndpointPreset = 'original' | 'neutral' | 'contrast'
interface EndpointControlState {
  lightness: number
  darkLightness: number
  lightTint: number
  darkTint: number
  spread: number
}

const tabs: { id: InspectorTab; label: string }[] = [
  { id: 'references', label: 'References' },
  { id: 'selection', label: 'Scale ends' },
  { id: 'history', label: 'History' },
]
const tab = ref<InspectorTab>('selection')
const addReferenceName = ref('')
const endpointLightness = ref(1)
const endpointDarkLightness = ref(0)
const endpointLightTint = ref(1)
const endpointDarkTint = ref(1)
const endpointSpread = ref(4)
const endpointPreviewActive = ref(false)
const endpointBase = ref<Record<Shade, OklchColor> | null>(null)
const appliedEndpointState = ref<EndpointControlState | null>(null)
let applyingEndpointPreview = false
const availableReferences = computed(() => {
  const selected = new Set(overlayConfigs.value.map((overlay) => overlay.name))
  return referenceRanks.value.filter(({ family }) => !selected.has(family.name))
})
const endpointLightnessModel = computed({
  get: () => [endpointLightness.value],
  set: (value: number[]) => {
    endpointLightness.value = value[0] ?? endpointLightness.value
    previewEndpointChanges()
  },
})
const endpointDarkLightnessModel = computed({
  get: () => [endpointDarkLightness.value],
  set: (value: number[]) => {
    endpointDarkLightness.value = value[0] ?? endpointDarkLightness.value
    previewEndpointChanges()
  },
})
const endpointLightTintModel = computed({
  get: () => [endpointLightTint.value],
  set: (value: number[]) => {
    endpointLightTint.value = value[0] ?? endpointLightTint.value
    previewEndpointChanges()
  },
})
const endpointDarkTintModel = computed({
  get: () => [endpointDarkTint.value],
  set: (value: number[]) => {
    endpointDarkTint.value = value[0] ?? endpointDarkTint.value
    previewEndpointChanges()
  },
})
const endpointLightnessMinimum = computed(() =>
  Math.min(1, (endpointBase.value?.[100].l ?? 0.85) + 0.001),
)
const endpointDarkLightnessMaximum = computed(() =>
  Math.max(0, (endpointBase.value?.[900].l ?? 0.45) - 0.001),
)
const endpointBefore = computed(() => {
  if (!endpointBase.value) return null
  return {
    light: endpointBase.value[50],
    dark: endpointBase.value[950],
  }
})
const endpointAfter = computed(() => {
  if (!effectiveShades.value) return null
  return {
    light: effectiveShades.value[50],
    dark: effectiveShades.value[950],
  }
})
const endpointPresets = computed(() => {
  const before = endpointBefore.value
  if (!before) return []
  return [
    {
      id: 'original' as const,
      label: 'Original',
      lightness: before.light.l,
      darkLightness: before.dark.l,
      lightTint: 1,
      darkTint: 1,
    },
    {
      id: 'neutral' as const,
      label: 'Neutral',
      lightness: before.light.l,
      darkLightness: before.dark.l,
      lightTint: 0,
      darkTint: 0,
    },
    {
      id: 'contrast' as const,
      label: 'White + ink',
      lightness: Math.max(before.light.l, 0.995),
      darkLightness: Math.min(before.dark.l, 0.16),
      lightTint: 0,
      darkTint: 0,
    },
  ]
})
const activeEndpointPreset = computed<EndpointPreset | null>(() => {
  const preset = endpointPresets.value.find(
    (candidate) =>
      close(candidate.lightness, endpointLightness.value) &&
      close(candidate.darkLightness, endpointDarkLightness.value) &&
      close(candidate.lightTint, endpointLightTint.value) &&
      close(candidate.darkTint, endpointDarkTint.value),
  )
  return preset?.id ?? null
})

watch(
  availableReferences,
  (ranks) => {
    const isAvailable = ranks.some((rank) => rank.family.name === addReferenceName.value)
    if (!isAvailable) addReferenceName.value = ranks[0]?.family.name ?? ''
  },
  { immediate: true },
)
watch(
  shades,
  (palette) => {
    if (!palette) return
    if (applyingEndpointPreview) {
      applyingEndpointPreview = false
      return
    }
    beginEndpointSession(palette)
  },
  { immediate: true, flush: 'sync' },
)

function endpointOptions(): PaletteEndOptions {
  return {
    light: {
      lightness: endpointLightness.value,
      tintRetention: endpointLightTint.value,
    },
    dark: {
      lightness: endpointDarkLightness.value,
      tintRetention: endpointDarkTint.value,
    },
    spread: endpointSpread.value,
  }
}

function previewEndpointChanges(): void {
  if (!shades.value || !endpointBase.value) return
  const target = adjustPaletteEnds(endpointBase.value, endpointOptions())
  if (palettesMatch(target, shades.value)) {
    if (endpointPreviewActive.value) clearPreview()
    endpointPreviewActive.value = false
    return
  }

  setPreview(target, `Adjusting scale ends across ${endpointSpread.value} shades`)
  endpointPreviewActive.value = true
}

function beginEndpointSession(palette: Record<Shade, OklchColor>): void {
  endpointBase.value = clonePalette(palette)
  appliedEndpointState.value = {
    lightness: palette[50].l,
    darkLightness: palette[950].l,
    lightTint: 1,
    darkTint: 1,
    spread: endpointSpread.value,
  }
  endpointPreviewActive.value = false
  syncEndpointControls(appliedEndpointState.value)
}

function currentEndpointState(): EndpointControlState {
  return {
    lightness: endpointLightness.value,
    darkLightness: endpointDarkLightness.value,
    lightTint: endpointLightTint.value,
    darkTint: endpointDarkTint.value,
    spread: endpointSpread.value,
  }
}

function syncEndpointControls(state: EndpointControlState | null): void {
  if (!state) return
  endpointLightness.value = state.lightness
  endpointDarkLightness.value = state.darkLightness
  endpointLightTint.value = state.lightTint
  endpointDarkTint.value = state.darkTint
  endpointSpread.value = state.spread
}

function applyEndpointPreset(preset: (typeof endpointPresets.value)[number]): void {
  endpointLightness.value = preset.lightness
  endpointDarkLightness.value = preset.darkLightness
  endpointLightTint.value = preset.lightTint
  endpointDarkTint.value = preset.darkTint
  previewEndpointChanges()
}

function selectEndpointPreset(value: unknown): void {
  const preset = endpointPresets.value.find((candidate) => candidate.id === value)
  if (preset) applyEndpointPreset(preset)
}

function setEndpointSpread(value: number): void {
  endpointSpread.value = value
  previewEndpointChanges()
}

function selectEndpointSpread(value: unknown): void {
  const spread = Number(value)
  if (spread === 2 || spread === 3 || spread === 4) setEndpointSpread(spread)
}

function cancelEndpointPreview(): void {
  clearPreview()
  endpointPreviewActive.value = false
  syncEndpointControls(appliedEndpointState.value)
}

function applyEndpointPreview(): void {
  appliedEndpointState.value = currentEndpointState()
  applyingEndpointPreview = true
  endpointPreviewActive.value = false
  applyPreview()
}

function close(first: number, second: number): boolean {
  return Math.abs(first - second) < 1e-6
}

function palettesMatch(
  first: Record<Shade, OklchColor>,
  second: Record<Shade, OklchColor>,
): boolean {
  return SHADE_NAMES.every(
    (shade) =>
      close(first[shade].l, second[shade].l) &&
      close(first[shade].c, second[shade].c) &&
      close(first[shade].h, second[shade].h),
  )
}

function addSelectedReference(): void {
  if (!addReferenceName.value) return
  addOverlay(addReferenceName.value)
  addReferenceName.value = availableReferences.value[0]?.family.name ?? ''
}

function setOverlayLine(name: string, line: string | undefined): void {
  if (!line || !OVERLAY_LINE_OPTIONS.some((option) => option.value === line)) return
  updateOverlay(name, { line: line as OverlayLine })
}

function setOverlayMarker(name: string, marker: string | undefined): void {
  if (!marker || !OVERLAY_MARKER_OPTIONS.includes(marker as OverlayMarker)) return
  updateOverlay(name, { marker: marker as OverlayMarker })
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
          <h2 class="cn-font-heading">Compare with Tailwind</h2>
          <p>Overlay this palette with the closest Tailwind color scales.</p>
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
              <Badge
                variant="secondary"
                class="font-mono tabular-nums"
                :aria-label="`${overlay.score.toFixed(0)} percent similarity`"
                :title="`${overlay.score.toFixed(0)}% similarity`"
                >{{ overlay.score.toFixed(0) }}%</Badge
              >
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
                  @update:model-value="setOverlayLine(overlay.name, $event)"
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
                  @update:model-value="setOverlayMarker(overlay.name, $event)"
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
                  >Show only</Button
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
              >All references added</NativeSelectOption
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
            >Add reference</Button
          >
        </div>
      </TabsContent>

      <TabsContent value="selection" class="inspector-body selection-panel">
        <section class="endpoint-panel">
          <header class="endpoint-intro">
            <div>
              <h2 class="cn-font-heading">Scale ends</h2>
              <p>Control how close shades 50 and 950 are to white, black, or neutral gray.</p>
            </div>
          </header>

          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            class="preset-group w-full"
            :model-value="activeEndpointPreset ?? undefined"
            aria-label="Endpoint preset"
            @update:model-value="selectEndpointPreset"
          >
            <ToggleGroupItem
              v-for="preset in endpointPresets"
              :key="preset.id"
              :value="preset.id"
              class="preset-option h-12 min-w-0 flex-1 flex-col gap-1 px-1.5 text-xs"
            >
              <span class="preset-swatches" aria-hidden="true">
                <span
                  :style="{
                    background: formatOklch({
                      ...endpointBefore!.light,
                      l: preset.lightness,
                      c: endpointBefore!.light.c * preset.lightTint,
                    }),
                  }"
                />
                <span
                  :style="{
                    background: formatOklch({
                      ...endpointBefore!.dark,
                      l: preset.darkLightness,
                      c: endpointBefore!.dark.c * preset.darkTint,
                    }),
                  }"
                />
              </span>
              {{ preset.label }}
            </ToggleGroupItem>
          </ToggleGroup>

          <div v-if="endpointBefore && endpointAfter" class="endpoint-controls">
            <article class="endpoint-card">
              <div class="endpoint-card-head">
                <div>
                  <p class="endpoint-eyebrow">Light end · 50</p>
                  <p class="endpoint-change">
                    <span>{{ formatHex(endpointBefore.light) }}</span>
                    <span aria-hidden="true">→</span>
                    <strong>{{ formatHex(endpointAfter.light) }}</strong>
                  </p>
                </div>
                <div class="endpoint-swatches" aria-hidden="true">
                  <span :style="{ background: formatOklch(endpointBefore.light) }" />
                  <span :style="{ background: formatOklch(endpointAfter.light) }" />
                </div>
              </div>
              <label>
                <span
                  >Lightness <output>{{ (endpointLightness * 100).toFixed(1) }}%</output></span
                >
                <Slider
                  v-model="endpointLightnessModel"
                  :min="endpointLightnessMinimum"
                  :max="1"
                  :step="0.001"
                  aria-label="Light endpoint lightness"
                />
              </label>
              <label>
                <span
                  >Color tint <output>{{ Math.round(endpointLightTint * 100) }}%</output></span
                >
                <Slider
                  v-model="endpointLightTintModel"
                  :min="0"
                  :max="1"
                  :step="0.01"
                  aria-label="Light endpoint color tint"
                />
                <span class="range-labels"><span>Neutral</span><span>Original tint</span></span>
              </label>
            </article>

            <article class="endpoint-card">
              <div class="endpoint-card-head">
                <div>
                  <p class="endpoint-eyebrow">Dark end · 950</p>
                  <p class="endpoint-change">
                    <span>{{ formatHex(endpointBefore.dark) }}</span>
                    <span aria-hidden="true">→</span>
                    <strong>{{ formatHex(endpointAfter.dark) }}</strong>
                  </p>
                </div>
                <div class="endpoint-swatches" aria-hidden="true">
                  <span :style="{ background: formatOklch(endpointBefore.dark) }" />
                  <span :style="{ background: formatOklch(endpointAfter.dark) }" />
                </div>
              </div>
              <label>
                <span
                  >Lightness <output>{{ (endpointDarkLightness * 100).toFixed(1) }}%</output></span
                >
                <Slider
                  v-model="endpointDarkLightnessModel"
                  :min="0"
                  :max="endpointDarkLightnessMaximum"
                  :step="0.001"
                  aria-label="Dark endpoint lightness"
                />
              </label>
              <label>
                <span>
                  Color tint <output>{{ Math.round(endpointDarkTint * 100) }}%</output></span
                >
                <Slider
                  v-model="endpointDarkTintModel"
                  :min="0"
                  :max="1"
                  :step="0.01"
                  aria-label="Dark endpoint color tint"
                />
                <span class="range-labels"><span>Neutral</span><span>Original tint</span></span>
              </label>
            </article>
          </div>

          <div class="endpoint-spread">
            <div>
              <strong>Blend across nearby shades</strong>
              <p>Choose how many shades change with each end.</p>
            </div>
            <ToggleGroup
              type="single"
              variant="outline"
              size="sm"
              class="spread-options w-full"
              :model-value="String(endpointSpread)"
              aria-label="Smooth blend length"
              @update:model-value="selectEndpointSpread"
            >
              <ToggleGroupItem
                v-for="value in [2, 3, 4]"
                :key="value"
                :value="String(value)"
                class="min-w-0 flex-1 px-1.5 text-xs"
                >{{ value }} shades</ToggleGroupItem
              >
            </ToggleGroup>
          </div>

          <p class="endpoint-note">
            Changes blend smoothly into nearby shades. Middle shades stay unchanged.
          </p>
        </section>
      </TabsContent>

      <TabsContent value="history" class="inspector-body">
        <header>
          <h2 class="cn-font-heading">Edit history</h2>
          <p>Select any step to restore it. You can still undo or redo.</p>
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
      <div class="preview-status">
        <Badge variant="secondary" class="font-mono">Previewing</Badge>
        <span>{{ previewLabel }}</span>
      </div>
      <div class="actions">
        <Button type="button" variant="outline" size="sm" @click="cancelEndpointPreview"
          >Discard preview</Button
        ><Button type="button" size="sm" @click="applyEndpointPreview">Apply changes</Button>
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
  gap: 16px;
  padding: 16px;
  overflow-y: auto;
  overscroll-behavior: contain;
}
.endpoint-panel {
  display: grid;
  gap: 16px;
}
.endpoint-intro {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}
.endpoint-intro p {
  max-width: 34ch;
  text-wrap: pretty;
}
.preset-group {
  display: flex;
}
.preset-option {
  white-space: normal;
  line-height: 1;
}
.preset-swatches {
  display: flex;
  overflow: hidden;
  width: 30px;
  height: 10px;
  border: 1px solid rgb(127 127 127 / 22%);
  border-radius: 999px;
}
.preset-swatches span {
  flex: 1;
}
.endpoint-controls {
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: color-mix(in oklch, var(--muted) 42%, transparent);
}
.endpoint-card {
  display: grid;
  gap: 16px;
  padding: 16px;
}
.endpoint-card + .endpoint-card {
  border-top: 1px solid var(--border);
}
.endpoint-card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.endpoint-eyebrow,
.endpoint-change {
  margin: 0;
}
.endpoint-eyebrow {
  color: var(--muted-foreground);
  font-size: 12px;
  font-weight: 650;
  letter-spacing: 0.07em;
  text-transform: uppercase;
}
.endpoint-change {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 4px;
  font:
    12px ui-monospace,
    monospace;
  font-variant-numeric: tabular-nums;
}
.endpoint-change > span {
  color: var(--muted-foreground);
}
.endpoint-swatches {
  display: flex;
  overflow: hidden;
  width: 58px;
  height: 32px;
  flex: 0 0 auto;
  border: 1px solid rgb(127 127 127 / 20%);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-xs);
}
.endpoint-swatches span {
  flex: 1;
}
.endpoint-card label > span:first-child {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.endpoint-card :deep([data-slot='slider']) {
  min-height: 24px;
}
.range-labels {
  display: flex;
  justify-content: space-between;
  color: var(--muted-foreground);
  font-size: 12px;
}
.endpoint-spread {
  display: grid;
  gap: 12px;
}
.endpoint-spread strong {
  font-size: 14px;
  font-weight: 500;
}
.endpoint-spread p {
  margin: 2px 0 0;
  color: var(--muted-foreground);
  font-size: 12px;
  line-height: 1.4;
}
.spread-options {
  display: flex;
}
.endpoint-note {
  margin: 0;
  padding: 9px 10px;
  border-radius: var(--radius-md);
  background: var(--muted);
  color: var(--muted-foreground);
  font-size: 12px;
  line-height: 1.5;
  text-wrap: pretty;
}
.endpoint-note strong {
  color: var(--foreground);
}
header h2 {
  margin: 0;
  color: var(--foreground);
  font-size: 14px;
  font-weight: 500;
  letter-spacing: -0.01em;
}
header p {
  margin: 3px 0 0;
  color: var(--muted-foreground);
  font-size: 14px;
  line-height: 1.45;
}
label {
  display: flex;
  flex-direction: column;
  gap: 6px;
  color: var(--foreground);
  font-size: 14px;
  font-weight: 500;
}
label output {
  margin-left: auto;
  color: var(--foreground);
  font-family: ui-monospace, monospace;
  font-variant-numeric: tabular-nums;
}
input[type='color'] {
  width: 32px;
  height: 32px;
  padding: 3px;
  border: 1px solid var(--input);
  border-radius: var(--radius-md);
  background: transparent;
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
  font-size: 12px;
}
.preview-status {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 8px;
}
.preview-status > span {
  color: var(--foreground);
  line-height: 1.35;
}
</style>
