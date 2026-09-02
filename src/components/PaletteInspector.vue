<script setup lang="ts">
import { XIcon } from '@lucide/vue'
import { computed, ref, watch } from 'vue'
import { CHANNEL_MODES, type Channel } from '@/app/channels'
import {
  activeEndpointPreset,
  applyEndpointPreview,
  cancelEndpointPreview,
  endpointAfter,
  endpointBefore,
  endpointDarkLightness,
  endpointDarkLightnessMaximum,
  endpointDarkLightnessModel,
  endpointDarkTint,
  endpointDarkTintModel,
  endpointLightness,
  endpointLightnessMinimum,
  endpointLightnessModel,
  endpointLightTint,
  endpointLightTintModel,
  endpointPresets,
  endpointSpread,
  selectEndpointPreset,
  selectEndpointSpread,
} from '@/app/palette-end-store'
import {
  OVERLAY_DASH,
  OVERLAY_LINE_OPTIONS,
  OVERLAY_MARKER_OPTIONS,
  trianglePoints,
} from '@/app/overlay-style'
import {
  addOverlay,
  channelMode,
  commitPalette,
  displayShades,
  inspectorTab,
  overlayConfigs,
  type OverlayLine,
  type OverlayMarker,
  previewLabel,
  previewShades,
  referenceRanks,
  removeOverlay,
  selectedShade,
  shades,
  soloOverlay,
  updateOverlay,
} from '@/app/palette-store'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Slider } from '@/components/ui/slider'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { formatHex, formatOklch } from '@/color'
import { SHADE_NAMES, type OklchColor } from '@/types'

const tabs = [
  { id: 'references', label: 'References' },
  { id: 'selection', label: 'Scale ends' },
  { id: 'shade', label: 'Shade' },
] as const
const addReferenceName = ref('')
const availableReferences = computed(() => {
  const selected = new Set(overlayConfigs.value.map((overlay) => overlay.name))
  return referenceRanks.value.filter(({ family }) => !selected.has(family.name))
})

watch(
  availableReferences,
  (ranks) => {
    const isAvailable = ranks.some((rank) => rank.family.name === addReferenceName.value)
    if (!isAvailable) addReferenceName.value = ranks[0]?.family.name ?? ''
  },
  { immediate: true },
)

function addSelectedReference(): void {
  if (!addReferenceName.value) return
  addOverlay(addReferenceName.value)
  addReferenceName.value = availableReferences.value[0]?.family.name ?? ''
}

function setOverlayLine(name: string, line: string | undefined): void {
  if (line && isOverlayLine(line)) updateOverlay(name, { line })
}

function setOverlayMarker(name: string, marker: string | undefined): void {
  if (marker && isOverlayMarker(marker)) updateOverlay(name, { marker })
}

function isOverlayLine(value: string): value is OverlayLine {
  return OVERLAY_LINE_OPTIONS.some((option) => option.value === value)
}

function isOverlayMarker(value: string): value is OverlayMarker {
  return OVERLAY_MARKER_OPTIONS.some((marker) => marker === value)
}

const shadeChannels = computed(() => CHANNEL_MODES[channelMode.value])
const selectedColor = computed(() => shades.value?.[selectedShade.value] ?? null)
const selectedDisplay = computed(() =>
  displayShades.value.find((entry) => entry.shade === selectedShade.value),
)
const shadeDrafts = ref<Record<string, string>>({})
const shadeErrors = ref<Record<string, string>>({})

watch([selectedShade, channelMode, shades], () => resetShadeDrafts(), { immediate: true })

function resetShadeDrafts(): void {
  const color = selectedColor.value
  if (!color) return
  shadeDrafts.value = Object.fromEntries(
    shadeChannels.value.map((channel) => [channel.key, numericDraft(channel, color)]),
  )
  shadeErrors.value = {}
}

function commitShadeChannel(channel: Channel): void {
  const color = selectedColor.value
  if (!color || !shades.value) return
  const value = Number(shadeDrafts.value[channel.key])
  if (!Number.isFinite(value) || value < channel.min || value > channel.max) {
    shadeErrors.value = {
      ...shadeErrors.value,
      [channel.key]: `${channel.name} must be between ${channel.min} and ${channel.max}.`,
    }
    return
  }

  const nextColor = channel.set(color, value)
  const nextPalette = { ...shades.value, [selectedShade.value]: nextColor }
  commitPalette(nextPalette)
  shadeErrors.value = { ...shadeErrors.value, [channel.key]: '' }
  shadeDrafts.value = {
    ...shadeDrafts.value,
    [channel.key]: numericDraft(channel, nextColor),
  }
}

function numericDraft(channel: Channel, color: OklchColor): string {
  const decimals = Math.max(0, (String(channel.step).split('.')[1] ?? '').length)
  return channel.get(color).toFixed(decimals)
}

function onShadeFieldKeydown(event: KeyboardEvent, channel: Channel): void {
  if (event.key === 'Enter') {
    event.preventDefault()
    commitShadeChannel(channel)
  } else if (event.key === 'Escape') {
    event.preventDefault()
    resetShadeDrafts()
  }
}

function channelUnit(channel: Channel): string {
  return channel.key === 'h' ? 'degrees' : channel.key === 'c' ? 'OKLCH chroma' : '0 to 1'
}
</script>

<template>
  <Card class="inspector" aria-label="Palette inspector">
    <Tabs v-model="inspectorTab" class="min-h-0 flex-1 gap-0">
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

        </section>
      </TabsContent>

      <TabsContent value="shade" class="inspector-body shade-panel">
        <header>
          <h2 class="cn-font-heading">Shade {{ selectedShade }}</h2>
          <p>Edit the selected shade exactly. Changes remain in canonical OKLCH.</p>
        </header>

        <div v-if="selectedColor" class="shade-summary">
          <span
            class="shade-swatch"
            :style="{ background: selectedDisplay?.css ?? formatOklch(selectedColor) }"
            aria-hidden="true"
          />
          <div>
            <strong>{{ selectedDisplay?.hex ?? formatHex(selectedColor) }}</strong>
            <code>{{ formatOklch(selectedColor) }}</code>
          </div>
        </div>

        <div class="shade-fields">
          <label v-for="channel in shadeChannels" :key="channel.key">
            <span>
              {{ channel.name }}
              <small
                >{{ channelUnit(channel) }} ·
                {{ channel.format(channel.get(selectedColor!)) }}</small
              >
            </span>
            <Input
              v-model="shadeDrafts[channel.key]"
              type="number"
              inputmode="decimal"
              :min="channel.min"
              :max="channel.max"
              :step="channel.step"
              :aria-invalid="Boolean(shadeErrors[channel.key])"
              :aria-describedby="
                shadeErrors[channel.key] ? `shade-${channel.key}-error` : undefined
              "
              @change="commitShadeChannel(channel)"
              @keydown="onShadeFieldKeydown($event, channel)"
            />
            <span
              v-if="shadeErrors[channel.key]"
              :id="`shade-${channel.key}-error`"
              class="field-error"
              >{{ shadeErrors[channel.key] }}</span
            >
          </label>
        </div>

        <div class="shade-picker" aria-label="Select shade">
          <Button
            v-for="shade in SHADE_NAMES"
            :key="shade"
            type="button"
            size="xs"
            :variant="shade === selectedShade ? 'default' : 'outline'"
            :aria-pressed="shade === selectedShade"
            @click="selectedShade = shade"
            >{{ shade }}</Button
          >
        </div>
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
  border: 1px solid var(--border);
  border-radius: 999px;
}
.preset-swatches span {
  flex: 1;
}
.endpoint-controls {
  border-block: 1px solid var(--border);
}
.endpoint-card {
  display: grid;
  gap: 16px;
  padding: 16px 0;
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
  border: 1px solid var(--border);
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
.shade-summary {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border-radius: var(--radius-lg);
  background: color-mix(in oklch, var(--muted) 68%, transparent);
}
.shade-swatch {
  width: 54px;
  height: 54px;
  flex: 0 0 auto;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
}
.shade-summary div {
  display: grid;
  min-width: 0;
  gap: 4px;
}
.shade-summary code {
  overflow-wrap: anywhere;
  color: var(--muted-foreground);
  font-size: 11px;
}
.shade-fields {
  display: grid;
  gap: 14px;
}
.shade-fields label > span:first-child {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}
.shade-fields small {
  color: var(--muted-foreground);
  font-size: 11px;
  font-weight: 400;
}
.field-error {
  color: var(--destructive);
  font-size: 12px;
  font-weight: 450;
}
.shade-picker {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 6px;
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
