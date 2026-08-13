<script setup lang="ts">
import { TriangleAlertIcon } from '@lucide/vue'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import type { Channel } from '@/app/channels'
import { OVERLAY_DASH, trianglePoints } from '@/app/overlay-style'
import {
  activeOverlays,
  baselineVisible,
  beginContinuousEdit,
  clearPreview,
  displayShades,
  effectiveShades,
  endContinuousEdit,
  generatedShades,
  previewShades,
  setShadeColor,
  shades,
  visibleChannels,
  type ActiveOverlay,
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
  path: string
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
    return { channel, points, path: smoothCurvePath(points) }
  })
}

// A monotone cubic keeps every shade on the curve without overshooting peaks.
// The line is C1-continuous, so changing direction never creates a sharp corner.
function smoothCurvePath(points: CurvePoint[]): string {
  if (!points.length) return ''
  if (points.length === 1) return `M ${coordinate(points[0].x)} ${coordinate(points[0].y)}`

  const slopes = points.slice(1).map((point, index) => {
    const previous = points[index]
    return (point.y - previous.y) / (point.x - previous.x)
  })
  const tangents = points.map((_, index) => {
    if (index === 0) return slopes[0]
    if (index === points.length - 1) return slopes.at(-1)!
    const before = slopes[index - 1]
    const after = slopes[index]
    if (before === 0 || after === 0 || Math.sign(before) !== Math.sign(after)) return 0
    return (2 * before * after) / (before + after)
  })

  let path = `M ${coordinate(points[0].x)} ${coordinate(points[0].y)}`
  for (let index = 0; index < points.length - 1; index += 1) {
    const from = points[index]
    const to = points[index + 1]
    const controlDistance = (to.x - from.x) / 3
    path += ` C ${coordinate(from.x + controlDistance)} ${coordinate(
      from.y + tangents[index] * controlDistance,
    )}, ${coordinate(to.x - controlDistance)} ${coordinate(
      to.y - tangents[index + 1] * controlDistance,
    )}, ${coordinate(to.x)} ${coordinate(to.y)}`
  }
  return path
}

function coordinate(value: number): string {
  return value.toFixed(2)
}

const curves = computed(() =>
  effectiveShades.value && size.value.width ? buildCurves(effectiveShades.value) : [],
)
const baselineCurves = computed(() =>
  baselineVisible.value && generatedShades.value && size.value.width
    ? buildCurves(generatedShades.value)
    : [],
)
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
  if (key === 'c' || key === 's') return '#a78bfa'
  return '#69d7ff'
}

function labelY(curve: Curve): number {
  return Math.min(Math.max(curve.points[0].y + 4, 16), size.value.height - PAD_BOTTOM - 8)
}

interface PointDrag {
  channel: Channel
  shade: Shade
  startColor: OklchColor
}

const drag = ref<PointDrag | null>(null)

function onPointPointerDown(event: PointerEvent, channel: Channel, shade: Shade): void {
  if (!shades.value) return
  beginContinuousEdit()
  drag.value = { channel, shade, startColor: { ...shades.value[shade] } }
  ;(event.currentTarget as Element).setPointerCapture(event.pointerId)
}

function onPointerMove(event: PointerEvent): void {
  const active = drag.value
  if (!active || !container.value || !shades.value) return
  const rect = container.value.getBoundingClientRect()
  const currentValue = valueAt(active.channel, event.clientY - rect.top)
  setShadeColor(active.shade, active.channel.set(active.startColor, currentValue))
}

function onPointerUp(): void {
  const active = drag.value
  if (active) {
    endContinuousEdit(`Adjusted ${active.channel.label} at ${active.shade}`)
  }
  drag.value = null
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
  setShadeColor(point.shade, channel.set(effectiveShades.value[point.shade], point.value + delta))
  endContinuousEdit(`Adjusted ${channel.label} at ${point.shade}`)
}

function onEditorKeydown(event: KeyboardEvent): void {
  if (event.key !== 'Escape' || !previewShades.value) return
  event.preventDefault()
  clearPreview()
}

function textColor(entry: { contrastOnWhite: number; contrastOnBlack: number }): string {
  return entry.contrastOnBlack >= entry.contrastOnWhite ? '#000' : '#fff'
}
</script>

<template>
  <div ref="container" class="editor" :class="{ dragging: drag }" @keydown="onEditorKeydown">
    <div class="strips">
      <div
        v-for="entry in displayShades"
        :key="entry.shade"
        class="strip"
        :data-shade="entry.shade"
        :style="{ background: entry.css, color: textColor(entry) }"
      >
        <span
          v-if="!entry.inGamut"
          class="gamut-indicator"
          :style="{
            background: textColor(entry) === '#000' ? 'rgb(255 255 255 / 72%)' : 'rgb(0 0 0 / 56%)',
          }"
          :aria-label="`Shade ${entry.shade} is adjusted to fit the selected display range`"
          :title="`Shade ${entry.shade} is adjusted to fit the selected display range.`"
        >
          <TriangleAlertIcon />
        </span>
        <span class="strip-shade">{{ entry.shade }}</span>
        <span class="strip-hex">{{ entry.hex }}</span>
      </div>
    </div>

    <svg v-if="size.width" class="overlay" :width="size.width" :height="size.height">
      <g v-for="curve in baselineCurves" :key="`baseline-${curve.channel.key}`" class="baseline">
        <path :d="curve.path" />
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
        <path :d="curve.path" :stroke-dasharray="OVERLAY_DASH[curve.overlay.line]" />
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
        <path :d="curve.path" />
      </g>

      <g v-for="curve in curves" :key="curve.channel.key">
        <text class="curve-label" :x="curve.points[0].x - 18" :y="labelY(curve)">
          {{ curve.channel.label }}
        </text>
        <path class="halo" :d="curve.path" />
        <path class="line" :d="curve.path" :style="{ stroke: channelColor(curve.channel.key) }" />
        <circle
          v-for="point in curve.points"
          :key="point.shade"
          class="handle"
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
          @pointerdown="onPointPointerDown($event, curve.channel, point.shade)"
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
  height: clamp(480px, 62dvh, 760px);
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: 0 0 var(--radius-xl) var(--radius-xl);
  background: var(--background);
}
@media (min-width: 1792px) {
  .editor {
    height: clamp(560px, 68dvh, 920px);
  }
}
.strips {
  display: flex;
  height: 100%;
}
.strip {
  position: relative;
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  align-items: center;
  gap: 2px;
  padding: 10px 0;
  border: 0;
  border-radius: 0;
  font: inherit;
}
.gamut-indicator {
  position: absolute;
  inset-block-start: 8px;
  inset-inline-end: 8px;
  display: inline-flex;
  width: 22px;
  height: 22px;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-md);
  color: inherit;
}
.gamut-indicator svg {
  width: 14px;
  height: 14px;
}
.strip + .strip {
  border-left: 1px solid rgb(255 255 255 / 8%);
}
.strip-shade {
  font-weight: 700;
  font-size: 12px;
}
.strip-hex {
  font-size: 11px;
  opacity: 0.72;
  font-family: ui-monospace, monospace;
}
.overlay {
  position: absolute;
  inset: 0;
  pointer-events: none;
}
.baseline path {
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
.reference path {
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
.preview-base path {
  fill: none;
  stroke: currentColor;
  stroke-width: 1.4;
  stroke-dasharray: 3 4;
  opacity: 0.5;
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
.handle:focus-visible {
  outline: none;
  stroke: #87a4ff;
  stroke-width: 4;
}
@media (prefers-reduced-motion: no-preference) {
  .strip {
    transition-property: background-color, color;
    transition-duration: 140ms;
    transition-timing-function: cubic-bezier(0.2, 0, 0, 1);
  }
  .line,
  .halo,
  .preview-base path,
  .handle {
    transition-property: d, cx, cy;
    transition-duration: 140ms;
    transition-timing-function: cubic-bezier(0.2, 0, 0, 1);
  }
  .editor.dragging .line,
  .editor.dragging .halo,
  .editor.dragging .handle {
    transition-duration: 0ms;
  }
}
</style>
