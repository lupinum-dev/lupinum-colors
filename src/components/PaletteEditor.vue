<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import type { Channel } from '@/app/channels'
import {
  activeOverlays,
  baselineVisible,
  beginContinuousEdit,
  displayShades,
  effectiveShades,
  endContinuousEdit,
  generatedShades,
  selectedShade,
  setShadeColor,
  visibleChannels,
  type ActiveOverlay,
  type OverlayLine,
} from '@/app/palette-store'
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
const overlayCurves = computed<OverlayCurve[]>(() =>
  size.value.width
    ? activeOverlays.value.flatMap((overlay) =>
        buildCurves(overlay.colors).map((curve) => ({ ...curve, overlay })),
      )
    : [],
)

const dashPattern: Record<OverlayLine, string> = {
  dash: '7 5',
  dot: '2 5',
  'dash-dot': '10 4 2 4',
  'long-dash': '14 7',
}

function channelColor(key: string): string {
  if (key === 'h') return '#f291d1'
  if (key === 'c' || key === 's') return '#ffc167'
  return '#69d7ff'
}

function trianglePoints(point: CurvePoint): string {
  return `${point.x},${point.y - 4.5} ${point.x - 4.2},${point.y + 3.5} ${point.x + 4.2},${point.y + 3.5}`
}

let drag: { channel: Channel; shade: Shade } | null = null

function onPointerDown(event: PointerEvent, channel: Channel, shade: Shade): void {
  drag = { channel, shade }
  selectedShade.value = shade
  beginContinuousEdit()
  ;(event.currentTarget as Element).setPointerCapture(event.pointerId)
}

function onPointerMove(event: PointerEvent): void {
  if (!drag || !container.value || !effectiveShades.value) return
  const rect = container.value.getBoundingClientRect()
  const value = valueAt(drag.channel, event.clientY - rect.top)
  setShadeColor(drag.shade, drag.channel.set(effectiveShades.value[drag.shade], value))
}

function onPointerUp(): void {
  if (drag) endContinuousEdit(`Adjusted ${drag.channel.label} at ${drag.shade}`)
  drag = null
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
  <div ref="container" class="editor">
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
        <polyline :points="curve.polyline" :stroke-dasharray="dashPattern[curve.overlay.line]" />
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
          <polygon v-else :points="trianglePoints(point)" />
        </template>
      </g>

      <g v-for="curve in curves" :key="curve.channel.key">
        <text class="curve-label" :x="curve.points[0].x - 18" :y="curve.points[0].y + 4">
          {{ curve.channel.label }}
        </text>
        <polyline class="halo" :points="curve.polyline" />
        <polyline
          class="line"
          :points="curve.polyline"
          :style="{ stroke: channelColor(curve.channel.key) }"
        />
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
