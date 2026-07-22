<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import type { Channel } from '@/app/channels'
import { OVERLAY_DASH, trianglePoints } from '@/app/overlay-style'
import {
  activeOverlays,
  baselineVisible,
  beginContinuousEdit,
  displayShades,
  effectiveShades,
  endContinuousEdit,
  generatedShades,
  previewShades,
  proportionalRadius,
  protectAnchor,
  replaceShades,
  resolvedAnchor,
  selectedShade,
  setShadeColor,
  shades,
  visibleChannels,
  type ActiveOverlay,
} from '@/app/palette-store'
import { clonePalette, falloffWeight, proportionalAdjust } from '@/app/palette-tools'
import { SHADE_NAMES, type OklchColor, type Shade } from '@/types'

const PAD_TOP = 28
const PAD_BOTTOM = 20

const container = ref<HTMLElement | null>(null)
const size = ref({ width: 0, height: 0 })
let observer: ResizeObserver | undefined

onMounted(() => {
  observer = new ResizeObserver((entries) => {
    const entry = entries[0]
    if (entry) size.value = { width: entry.contentRect.width, height: entry.contentRect.height }
  })
  if (container.value) observer.observe(container.value)
})
onBeforeUnmount(() => observer?.disconnect())

function xAt(index: number): number {
  return ((index + 0.5) * size.value.width) / SHADE_NAMES.length
}

function yFor(channel: Channel, value: number): number {
  const usable = size.value.height - PAD_TOP - PAD_BOTTOM
  const normalized = (value - channel.min) / (channel.max - channel.min)
  return PAD_TOP + (1 - Math.min(1, Math.max(0, normalized))) * usable
}

function valueAt(channel: Channel, y: number): number {
  const usable = size.value.height - PAD_TOP - PAD_BOTTOM
  const normalized = 1 - (y - PAD_TOP) / usable
  return channel.min + Math.min(1, Math.max(0, normalized)) * (channel.max - channel.min)
}

interface CurvePoint {
  shade: Shade
  x: number
  y: number
  value: number
}

interface Curve {
  channel: Channel
  points: CurvePoint[]
  polyline: string
}

interface OverlayCurve extends Curve {
  overlay: ActiveOverlay
}

function buildCurves(colors: Record<Shade, OklchColor>): Curve[] {
  return visibleChannels.value.map((channel) => {
    const points = SHADE_NAMES.map((shade, index) => {
      const value = channel.get(colors[shade])
      return { shade, value, x: xAt(index), y: yFor(channel, value) }
    })
    return { channel, points, polyline: points.map(({ x, y }) => `${x},${y}`).join(' ') }
  })
}

const curves = computed(() =>
  effectiveShades.value && size.value.width ? buildCurves(effectiveShades.value) : [],
)
const baselineCurves = computed(() =>
  baselineVisible.value && generatedShades.value && size.value.width
    ? buildCurves(generatedShades.value)
    : [],
)
// While a transform preview is active, keep the pre-preview curve visible for comparison.
const previewBaseCurves = computed(() =>
  previewShades.value && shades.value && size.value.width ? buildCurves(shades.value) : [],
)
const overlayCurves = computed<OverlayCurve[]>(() =>
  size.value.width
    ? activeOverlays.value.flatMap((overlay) =>
        buildCurves(overlay.colors).map((curve) => ({ ...curve, overlay })),
      )
    : [],
)

function channelColor(key: string): string {
  if (key === 'h') return '#f291d1'
  if (key === 'c' || key === 's') return '#ffc167'
  return '#69d7ff'
}

function labelY(curve: Curve): number {
  return Math.min(Math.max(curve.points[0].y + 4, 16), size.value.height - PAD_BOTTOM - 8)
}

interface DragState {
  channel: Channel
  shade: Shade
  proportional: boolean
  startPalette: Record<Shade, OklchColor>
  lastValue: number
}

const drag = ref<DragState | null>(null)

const dragPoint = computed(() => {
  const active = drag.value
  if (!active) return null
  const curve = curves.value.find((candidate) => candidate.channel.key === active.channel.key)
  const point = curve?.points.find((candidate) => candidate.shade === active.shade)
  if (!point) return null
  const radius = active.proportional ? ` · ±${proportionalRadius.value}` : ''
  return { ...point, label: `${active.channel.format(point.value)}${radius}` }
})

// Strips touched by the active proportional drag, for the highlight veil.
const affectedStrips = computed(() => {
  const active = drag.value
  if (!active?.proportional || !size.value.width) return []
  const center = SHADE_NAMES.indexOf(active.shade)
  return SHADE_NAMES.flatMap((shade, index) => {
    const weight = falloffWeight(Math.abs(index - center), proportionalRadius.value)
    return weight > 0 ? [{ shade, index, weight }] : []
  })
})

const pinnedShade = computed(() => (protectAnchor.value ? resolvedAnchor.value : null))

function applyDrag(): void {
  const active = drag.value
  if (!active) return
  if (active.proportional) {
    replaceShades(
      proportionalAdjust(active.startPalette, {
        channel: active.channel,
        shade: active.shade,
        value: active.lastValue,
        radius: proportionalRadius.value,
        anchor: resolvedAnchor.value,
        protectAnchor: protectAnchor.value,
      }),
    )
  } else {
    setShadeColor(
      active.shade,
      active.channel.set(active.startPalette[active.shade], active.lastValue),
    )
  }
}

function onPointerDown(event: PointerEvent, channel: Channel, shade: Shade): void {
  selectedShade.value = shade
  beginContinuousEdit()
  if (!shades.value) return
  drag.value = {
    channel,
    shade,
    proportional: event.shiftKey,
    startPalette: clonePalette(shades.value),
    lastValue: channel.get(shades.value[shade]),
  }
  ;(event.currentTarget as Element).setPointerCapture(event.pointerId)
}

function onPointerMove(event: PointerEvent): void {
  const active = drag.value
  if (!active || !container.value) return
  const rect = container.value.getBoundingClientRect()
  active.lastValue = valueAt(active.channel, event.clientY - rect.top)
  applyDrag()
}

function onPointerUp(): void {
  const active = drag.value
  if (active) {
    endContinuousEdit(
      active.proportional
        ? `Scaled ${active.channel.label} region around ${active.shade}`
        : `Adjusted ${active.channel.label} at ${active.shade}`,
    )
  }
  drag.value = null
}

function onWheel(event: WheelEvent): void {
  const active = drag.value
  if (!active?.proportional) return
  event.preventDefault()
  const step = event.deltaY > 0 ? -1 : 1
  proportionalRadius.value = Math.min(5, Math.max(0, proportionalRadius.value + step))
  applyDrag()
}

function onHandleKeydown(event: KeyboardEvent, channel: Channel, point: CurvePoint): void {
  const direction =
    event.key === 'ArrowUp' || event.key === 'ArrowRight'
      ? 1
      : event.key === 'ArrowDown' || event.key === 'ArrowLeft'
        ? -1
        : 0
  if (!direction || !effectiveShades.value) return
  event.preventDefault()
  const delta = channel.step * (event.shiftKey ? 10 : 1) * direction
  beginContinuousEdit()
  selectedShade.value = point.shade
  setShadeColor(point.shade, channel.set(effectiveShades.value[point.shade], point.value + delta))
  endContinuousEdit(`Adjusted ${channel.label} at ${point.shade}`)
}

function textColor(entry: { contrastOnWhite: number; contrastOnBlack: number }): string {
  return entry.contrastOnBlack >= entry.contrastOnWhite ? '#000' : '#fff'
}
</script>

<template>
  <div ref="container" class="editor" @wheel="onWheel">
    <div class="strips">
      <button
        v-for="entry in displayShades"
        :key="entry.shade"
        type="button"
        class="strip"
        :class="{ selected: entry.shade === selectedShade }"
        :style="{ background: entry.css, color: textColor(entry) }"
        @click="selectedShade = entry.shade"
      >
        <span class="strip-shade">{{ entry.shade }}</span>
        <span class="strip-hex">{{ entry.hex }}</span>
      </button>
    </div>

    <svg v-if="size.width" class="overlay" :width="size.width" :height="size.height">
      <rect
        v-for="strip in affectedStrips"
        :key="`affected-${strip.shade}`"
        class="affected"
        :x="(strip.index * size.width) / SHADE_NAMES.length"
        y="0"
        :width="size.width / SHADE_NAMES.length"
        :height="size.height"
        :fill-opacity="0.12 * strip.weight"
      />

      <g v-for="curve in baselineCurves" :key="`baseline-${curve.channel.key}`" class="baseline">
        <polyline :points="curve.polyline" />
        <circle
          v-for="point in curve.points"
          :key="point.shade"
          :cx="point.x"
          :cy="point.y"
          r="3"
        />
      </g>

      <g
        v-for="curve in overlayCurves"
        :key="`${curve.overlay.name}-${curve.channel.key}`"
        class="reference"
        :style="{ color: curve.overlay.color, opacity: curve.overlay.opacity }"
      >
        <polyline :points="curve.polyline" :stroke-dasharray="OVERLAY_DASH[curve.overlay.line]" />
        <template v-for="point in curve.points" :key="point.shade">
          <circle v-if="curve.overlay.marker === 'circle'" :cx="point.x" :cy="point.y" r="3.5" />
          <rect
            v-else-if="curve.overlay.marker === 'square'"
            :x="point.x - 3.3"
            :y="point.y - 3.3"
            width="6.6"
            height="6.6"
          />
          <rect
            v-else-if="curve.overlay.marker === 'diamond'"
            :x="point.x - 3.2"
            :y="point.y - 3.2"
            width="6.4"
            height="6.4"
            :transform="`rotate(45 ${point.x} ${point.y})`"
          />
          <polygon v-else :points="trianglePoints(point.x, point.y, 4.4)" />
        </template>
      </g>

      <g
        v-for="curve in previewBaseCurves"
        :key="`preview-base-${curve.channel.key}`"
        class="preview-base"
        :style="{ color: channelColor(curve.channel.key) }"
      >
        <polyline :points="curve.polyline" />
      </g>

      <g v-for="curve in curves" :key="curve.channel.key">
        <text class="curve-label" :x="curve.points[0].x - 18" :y="labelY(curve)">
          {{ curve.channel.label }}
        </text>
        <polyline class="halo" :points="curve.polyline" />
        <polyline
          class="line"
          :points="curve.polyline"
          :style="{ stroke: channelColor(curve.channel.key) }"
        />
        <template v-for="point in curve.points" :key="`pin-${point.shade}`">
          <circle
            v-if="point.shade === pinnedShade"
            class="pin-ring"
            :cx="point.x"
            :cy="point.y"
            r="11"
          />
        </template>
        <circle
          v-for="point in curve.points"
          :key="point.shade"
          class="handle"
          :class="{ selected: point.shade === selectedShade }"
          :cx="point.x"
          :cy="point.y"
          r="7"
          role="slider"
          tabindex="0"
          :aria-label="`${curve.channel.label}, shade ${point.shade}`"
          :aria-valuemin="curve.channel.min"
          :aria-valuemax="curve.channel.max"
          :aria-valuenow="Number(point.value.toFixed(4))"
          @keydown="onHandleKeydown($event, curve.channel, point)"
          @pointerdown="onPointerDown($event, curve.channel, point.shade)"
          @pointermove="onPointerMove"
          @pointerup="onPointerUp"
          @pointercancel="onPointerUp"
        />
      </g>

      <text
        v-if="dragPoint"
        class="drag-value"
        :x="dragPoint.x"
        :y="Math.max(dragPoint.y - 14, 14)"
        text-anchor="middle"
      >
        {{ dragPoint.label }}
      </text>
    </svg>
  </div>
</template>

<style scoped>
.editor {
  position: relative;
  height: clamp(360px, 55vh, 560px);
  overflow: hidden;
  border: 1px solid #2e3038;
  border-radius: 10px;
  background: #15161a;
}

.strips {
  display: flex;
  height: 100%;
}
.strip {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  align-items: center;
  gap: 2px;
  padding: 10px 0;
  border: 0;
  border-radius: 0;
  cursor: pointer;
  font: inherit;
}
.strip + .strip {
  border-left: 1px solid rgb(255 255 255 / 8%);
}
.strip.selected {
  box-shadow: inset 0 0 0 2px currentColor;
}
.strip-shade {
  font-weight: 700;
  font-size: 12px;
}
.strip-hex {
  font-size: 10px;
  opacity: 0.72;
  font-family: ui-monospace, monospace;
}

.overlay {
  position: absolute;
  inset: 0;
  pointer-events: none;
}
.baseline polyline {
  fill: none;
  stroke: #d8d9df;
  stroke-width: 1.2;
  stroke-dasharray: 14 7;
  opacity: 0.5;
}
.baseline circle {
  fill: #15161a;
  stroke: #d8d9df;
  stroke-width: 1.2;
  opacity: 0.65;
}
.reference polyline {
  fill: none;
  stroke: currentColor;
  stroke-width: 1.55;
}
.reference circle,
.reference rect,
.reference polygon {
  fill: #15161a;
  stroke: currentColor;
  stroke-width: 1.5;
}
.preview-base polyline {
  fill: none;
  stroke: currentColor;
  stroke-width: 1.4;
  opacity: 0.32;
}
.affected {
  fill: #fff;
}
.pin-ring {
  fill: none;
  stroke: rgb(255 255 255 / 70%);
  stroke-width: 1.3;
  stroke-dasharray: 2.5 3;
}
.drag-value {
  font-size: 11px;
  font-weight: 650;
  fill: #f4f4f6;
  paint-order: stroke;
  stroke: rgb(8 9 12 / 85%);
  stroke-width: 3px;
}
.halo {
  fill: none;
  stroke: rgb(8 9 12 / 75%);
  stroke-width: 5;
}
.line {
  fill: none;
  stroke-width: 2;
}
.curve-label {
  font-size: 11px;
  font-weight: 750;
  fill: #f4f4f6;
  paint-order: stroke;
  stroke: rgb(8 9 12 / 85%);
  stroke-width: 3px;
}
.handle {
  fill: #f4f4f6;
  stroke: #111217;
  stroke-width: 2;
  cursor: grab;
  pointer-events: auto;
}
.handle.selected {
  fill: #111217;
  stroke: #fff;
}
.handle:focus-visible {
  outline: none;
  stroke: #87a4ff;
  stroke-width: 4;
}
.handle:active {
  cursor: grabbing;
}
</style>
