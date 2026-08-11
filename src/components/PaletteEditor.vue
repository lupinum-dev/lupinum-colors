<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import type { Channel } from '@/app/channels'
import { OVERLAY_DASH, trianglePoints } from '@/app/overlay-style'
import {
  activeOverlays,
  baselineVisible,
  beginContinuousEdit,
  cancelSelectionPreview,
  clearShadeSelection,
  displayShades,
  effectiveShades,
  endContinuousEdit,
  generatedShades,
  previewShades,
  protectAnchor,
  resolvedAnchor,
  selectedShade,
  selectedShadeRange,
  selectionChannel,
  selectionChannelKey,
  selectionCurve,
  selectionFeather,
  setSelectionChannel,
  setShadeColor,
  setShadeSelection,
  shadeSelection,
  shades,
  updateSelectionCurve,
  visibleChannels,
  type ActiveOverlay,
  type SelectionCurve,
} from '@/app/palette-store'
import { signedHueDelta } from '@/color'
import { SHADE_NAMES, type OklchColor, type Shade } from '@/types'

const PAD_TOP = 28
const PAD_BOTTOM = 20

const container = ref<HTMLElement | null>(null)
const strips = ref<HTMLElement | null>(null)
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

const selectionIndices = computed<[number, number] | null>(() => {
  if (!shadeSelection.value) return null
  return [
    SHADE_NAMES.indexOf(shadeSelection.value.from),
    SHADE_NAMES.indexOf(shadeSelection.value.to),
  ]
})

function isSelected(shade: Shade): boolean {
  return selectedShadeRange.value.includes(shade)
}

function isFeathered(shade: Shade): boolean {
  const range = selectionIndices.value
  if (!range || isSelected(shade)) return false
  const index = SHADE_NAMES.indexOf(shade)
  const distance = index < range[0] ? range[0] - index : index - range[1]
  return distance > 0 && distance <= selectionFeather.value
}

const selectionView = computed(() => {
  const range = selectionIndices.value
  const channel = selectionChannel.value
  if (!range || !channel || !shades.value || !size.value.width) return null
  const curve = curves.value.find((candidate) => candidate.channel.key === channel.key)
  if (!curve) return null
  const [startIndex, endIndex] = range
  const midPosition = (startIndex + endIndex) / 2
  const baseMid = valueAtPosition(channel, shades.value, midPosition)
  const midValue =
    baseMid +
    (selectionCurve.value.startDelta + selectionCurve.value.endDelta) / 2 +
    selectionCurve.value.curveDelta
  return {
    channel,
    startIndex,
    endIndex,
    x1: xAt(startIndex),
    x2: xAt(endIndex),
    midX: (xAt(startIndex) + xAt(endIndex)) / 2,
    start: curve.points[startIndex],
    end: curve.points[endIndex],
    midY: yFor(channel, midValue),
    segment: curve.points
      .slice(startIndex, endIndex + 1)
      .map(({ x, y }) => `${x},${y}`)
      .join(' '),
  }
})

function valueAtPosition(
  channel: Channel,
  palette: Record<Shade, OklchColor>,
  position: number,
): number {
  const before = Math.floor(position)
  const after = Math.ceil(position)
  const first = channel.get(palette[SHADE_NAMES[before]])
  if (before === after) return first
  const second = channel.get(palette[SHADE_NAMES[after]])
  const amount = position - before
  return channel.key === 'h'
    ? first + signedHueDelta(first, second) * amount
    : first + (second - first) * amount
}

interface BrushState {
  startIndex: number
  pointerId: number
}

const brush = ref<BrushState | null>(null)
let selectionAnchorIndex: number | null = null

function stripIndexFromEvent(event: PointerEvent): number {
  if (!strips.value) return 0
  const rect = strips.value.getBoundingClientRect()
  const relative = Math.min(rect.width - 1, Math.max(0, event.clientX - rect.left))
  return Math.floor((relative / rect.width) * SHADE_NAMES.length)
}

function onStripPointerDown(event: PointerEvent): void {
  if (!strips.value) return
  const index = stripIndexFromEvent(event)
  if (event.shiftKey && selectionAnchorIndex !== null) {
    setShadeSelection(SHADE_NAMES[selectionAnchorIndex], SHADE_NAMES[index])
    return
  }
  selectionAnchorIndex = index
  brush.value = { startIndex: index, pointerId: event.pointerId }
  strips.value.setPointerCapture(event.pointerId)
  setShadeSelection(SHADE_NAMES[index])
}

function onStripPointerMove(event: PointerEvent): void {
  if (!brush.value || brush.value.pointerId !== event.pointerId) return
  setShadeSelection(SHADE_NAMES[brush.value.startIndex], SHADE_NAMES[stripIndexFromEvent(event)])
}

function onStripPointerUp(event: PointerEvent): void {
  if (brush.value?.pointerId !== event.pointerId) return
  brush.value = null
}

type CageControl = 'start' | 'curve' | 'end' | 'body'

interface PointDrag {
  kind: 'point'
  channel: Channel
  shade: Shade
  startColor: OklchColor
}

interface CageDrag {
  kind: 'cage'
  control: CageControl
  channel: Channel
  initial: SelectionCurve
  pointerStartValue: number
}

const drag = ref<PointDrag | CageDrag | null>(null)

function onPointPointerDown(event: PointerEvent, channel: Channel, shade: Shade): void {
  if (!shades.value) return
  setSelectionChannel(channel.key)
  if (!isSelected(shade)) setShadeSelection(shade)
  selectedShade.value = shade
  beginContinuousEdit()
  drag.value = { kind: 'point', channel, shade, startColor: { ...shades.value[shade] } }
  ;(event.currentTarget as Element).setPointerCapture(event.pointerId)
}

function onCagePointerDown(event: PointerEvent, control: CageControl): void {
  const view = selectionView.value
  if (!view || !container.value) return
  const rect = container.value.getBoundingClientRect()
  drag.value = {
    kind: 'cage',
    control,
    channel: view.channel,
    initial: { ...selectionCurve.value },
    pointerStartValue: valueAt(view.channel, event.clientY - rect.top),
  }
  ;(event.currentTarget as Element).setPointerCapture(event.pointerId)
}

function onPointerMove(event: PointerEvent): void {
  const active = drag.value
  if (!active || !container.value || !shades.value) return
  const rect = container.value.getBoundingClientRect()
  const currentValue = valueAt(active.channel, event.clientY - rect.top)
  if (active.kind === 'point') {
    setShadeColor(active.shade, active.channel.set(active.startColor, currentValue))
    return
  }

  const range = selectionIndices.value
  if (!range) return
  if (active.control === 'body') {
    const delta = currentValue - active.pointerStartValue
    updateSelectionCurve({
      startDelta: active.initial.startDelta + delta,
      endDelta: active.initial.endDelta + delta,
    })
  } else if (active.control === 'start') {
    const base = active.channel.get(shades.value[SHADE_NAMES[range[0]]])
    updateSelectionCurve({ startDelta: currentValue - base })
  } else if (active.control === 'end') {
    const base = active.channel.get(shades.value[SHADE_NAMES[range[1]]])
    updateSelectionCurve({ endDelta: currentValue - base })
  } else {
    const baseMid = valueAtPosition(active.channel, shades.value, (range[0] + range[1]) / 2)
    updateSelectionCurve({
      curveDelta:
        currentValue -
        baseMid -
        (selectionCurve.value.startDelta + selectionCurve.value.endDelta) / 2,
    })
  }
}

function onPointerUp(): void {
  const active = drag.value
  if (active?.kind === 'point') {
    endContinuousEdit(`Adjusted ${active.channel.label} at ${active.shade}`)
  }
  drag.value = null
}

function nudgeCage(event: KeyboardEvent, control: CageControl): void {
  const channel = selectionChannel.value
  if (!channel) return
  const direction =
    event.key === 'ArrowUp' || event.key === 'ArrowRight'
      ? 1
      : event.key === 'ArrowDown' || event.key === 'ArrowLeft'
        ? -1
        : 0
  if (!direction) return
  event.preventDefault()
  const delta = channel.step * (event.shiftKey ? 10 : 1) * direction
  if (control === 'body') {
    updateSelectionCurve({
      startDelta: selectionCurve.value.startDelta + delta,
      endDelta: selectionCurve.value.endDelta + delta,
    })
  } else {
    const key = `${control}Delta` as keyof SelectionCurve
    updateSelectionCurve({ [key]: selectionCurve.value[key] + delta })
  }
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

function onEditorKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    event.preventDefault()
    if (previewShades.value) cancelSelectionPreview()
    else clearShadeSelection()
    return
  }
  if (!shadeSelection.value || (event.key !== '[' && event.key !== ']')) return
  event.preventDefault()
  const start = SHADE_NAMES.indexOf(shadeSelection.value.from)
  const end = SHADE_NAMES.indexOf(shadeSelection.value.to)
  if (event.key === '[' && end > start) setShadeSelection(SHADE_NAMES[start], SHADE_NAMES[end - 1])
  if (event.key === ']' && end < SHADE_NAMES.length - 1)
    setShadeSelection(SHADE_NAMES[start], SHADE_NAMES[end + 1])
}

function textColor(entry: { contrastOnWhite: number; contrastOnBlack: number }): string {
  return entry.contrastOnBlack >= entry.contrastOnWhite ? '#000' : '#fff'
}
</script>

<template>
  <div ref="container" class="editor" @keydown="onEditorKeydown">
    <div
      ref="strips"
      class="strips"
      @pointerdown="onStripPointerDown"
      @pointermove="onStripPointerMove"
      @pointerup="onStripPointerUp"
      @pointercancel="onStripPointerUp"
    >
      <button
        v-for="entry in displayShades"
        :key="entry.shade"
        type="button"
        class="strip"
        :class="{
          active: entry.shade === selectedShade,
          selected: isSelected(entry.shade),
          feathered: isFeathered(entry.shade),
        }"
        :data-shade="entry.shade"
        :style="{ background: entry.css, color: textColor(entry) }"
        :aria-pressed="isSelected(entry.shade)"
      >
        <span class="strip-shade">{{ entry.shade }}</span>
        <span class="strip-hex">{{ entry.hex }}</span>
      </button>
    </div>

    <div v-if="shadeSelection" class="selection-badge">
      <strong>{{ shadeSelection.from }}–{{ shadeSelection.to }}</strong>
      <span>{{ selectedShadeRange.length }} shade{{ selectedShadeRange.length === 1 ? '' : 's' }}</span>
      <button type="button" aria-label="Clear shade selection" @click="clearShadeSelection">×</button>
    </div>

    <svg v-if="size.width" class="overlay" :width="size.width" :height="size.height">
      <g v-if="selectionView" class="selection-region">
        <rect
          :x="selectionView.x1 - size.width / SHADE_NAMES.length / 2"
          y="0"
          :width="selectionView.x2 - selectionView.x1 + size.width / SHADE_NAMES.length"
          :height="size.height"
        />
        <path :d="`M ${selectionView.x1 - 10} 18 h -7 v ${size.height - 36} h 7`" />
        <path :d="`M ${selectionView.x2 + 10} 18 h 7 v ${size.height - 36} h -7`" />
      </g>

      <g v-for="curve in baselineCurves" :key="`baseline-${curve.channel.key}`" class="baseline">
        <polyline :points="curve.polyline" />
        <circle v-for="point in curve.points" :key="point.shade" :cx="point.x" :cy="point.y" r="3" />
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
          <rect v-else-if="curve.overlay.marker === 'square'" :x="point.x - 3.3" :y="point.y - 3.3" width="6.6" height="6.6" />
          <rect v-else-if="curve.overlay.marker === 'diamond'" :x="point.x - 3.2" :y="point.y - 3.2" width="6.4" height="6.4" :transform="`rotate(45 ${point.x} ${point.y})`" />
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

      <g v-for="curve in curves" :key="curve.channel.key" :class="{ muted: shadeSelection && curve.channel.key !== selectionChannelKey }">
        <text class="curve-label" :x="curve.points[0].x - 18" :y="labelY(curve)">{{ curve.channel.label }}</text>
        <polyline class="halo" :points="curve.polyline" />
        <polyline class="line" :points="curve.polyline" :style="{ stroke: channelColor(curve.channel.key) }" />
        <circle v-if="protectAnchor" class="pin-ring" :cx="curve.points[SHADE_NAMES.indexOf(resolvedAnchor)].x" :cy="curve.points[SHADE_NAMES.indexOf(resolvedAnchor)].y" r="11" />
        <circle
          v-for="point in curve.points"
          :key="point.shade"
          class="handle"
          :class="{
            active: point.shade === selectedShade,
            selected: isSelected(point.shade) && curve.channel.key === selectionChannelKey,
            feathered: isFeathered(point.shade) && curve.channel.key === selectionChannelKey,
          }"
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

      <g v-if="selectionView && selectedShadeRange.length > 1" class="curve-cage" :style="{ color: channelColor(selectionView.channel.key) }">
        <polyline class="cage-visible" :points="selectionView.segment" />
        <polyline
          class="cage-hit"
          :points="selectionView.segment"
          role="slider"
          tabindex="0"
          aria-label="Move selected curve"
          @keydown="nudgeCage($event, 'body')"
          @pointerdown="onCagePointerDown($event, 'body')"
          @pointermove="onPointerMove"
          @pointerup="onPointerUp"
          @pointercancel="onPointerUp"
        />
        <line :x1="selectionView.start.x" :y1="selectionView.start.y" :x2="selectionView.midX" :y2="selectionView.midY" />
        <line :x1="selectionView.midX" :y1="selectionView.midY" :x2="selectionView.end.x" :y2="selectionView.end.y" />
        <g v-for="control in [
          { key: 'start' as const, x: selectionView.start.x, y: selectionView.start.y, label: 'START' },
          { key: 'curve' as const, x: selectionView.midX, y: selectionView.midY, label: 'CURVE' },
          { key: 'end' as const, x: selectionView.end.x, y: selectionView.end.y, label: 'END' },
        ]" :key="control.key">
          <rect
            class="cage-control"
            :x="control.x - 6"
            :y="control.y - 6"
            width="12"
            height="12"
            role="slider"
            tabindex="0"
            :aria-label="`${control.label} ${selectionView.channel.label} adjustment`"
            @keydown="nudgeCage($event, control.key)"
            @pointerdown="onCagePointerDown($event, control.key)"
            @pointermove="onPointerMove"
            @pointerup="onPointerUp"
            @pointercancel="onPointerUp"
          />
          <text class="cage-label" :x="control.x" :y="Math.min(size.height - 30, control.y + 24)" text-anchor="middle">{{ control.label }}</text>
        </g>
      </g>
    </svg>
  </div>
</template>

<style scoped>
.editor { position: relative; height: clamp(360px, 55vh, 560px); overflow: hidden; border: 1px solid #2e3038; border-radius: 10px; background: #15161a; }
.strips { display: flex; height: 100%; touch-action: none; }
.strip { flex: 1; display: flex; flex-direction: column; justify-content: flex-end; align-items: center; gap: 2px; padding: 10px 0; border: 0; border-radius: 0; cursor: crosshair; font: inherit; }
.strip + .strip { border-left: 1px solid rgb(255 255 255 / 8%); }
.strip.selected { box-shadow: inset 0 -4px #fff, inset 0 3px #fff; }
.strip.active { outline: 2px solid currentColor; outline-offset: -3px; }
.strip.feathered { box-shadow: inset 0 -3px rgb(255 255 255 / 65%); }
.strip-shade { font-weight: 700; font-size: 12px; }
.strip-hex { font-size: 10px; opacity: .72; font-family: ui-monospace, monospace; }
.selection-badge { position: absolute; z-index: 2; top: 10px; left: 50%; display: flex; align-items: center; gap: 8px; padding: 5px 7px 5px 9px; transform: translateX(-50%); border: 1px solid rgb(255 255 255 / 42%); border-radius: 5px; background: rgb(15 16 20 / 88%); color: #f2f3f5; font: 10px ui-monospace, monospace; }
.selection-badge span { color: #9699a3; }
.selection-badge button { min-height: 20px; padding: 0 4px; border: 0; background: transparent; }
.overlay { position: absolute; inset: 0; pointer-events: none; }
.selection-region rect { fill: rgb(255 255 255 / 5%); }
.selection-region path { fill: none; stroke: #fff; stroke-width: 1.5; }
.baseline polyline { fill: none; stroke: #d8d9df; stroke-width: 1.2; stroke-dasharray: 14 7; opacity: .5; }
.baseline circle { fill: #15161a; stroke: #d8d9df; stroke-width: 1.2; opacity: .65; }
.reference polyline { fill: none; stroke: currentColor; stroke-width: 1.55; }
.reference circle, .reference rect, .reference polygon { fill: #15161a; stroke: currentColor; stroke-width: 1.5; }
.preview-base polyline { fill: none; stroke: currentColor; stroke-width: 1.4; stroke-dasharray: 3 4; opacity: .5; }
.pin-ring { fill: none; stroke: rgb(255 255 255 / 70%); stroke-width: 1.3; stroke-dasharray: 2.5 3; }
.halo { fill: none; stroke: rgb(8 9 12 / 75%); stroke-width: 5; }
.line { fill: none; stroke-width: 2; }
.muted { opacity: .3; }
.curve-label { font-size: 11px; font-weight: 750; fill: #f4f4f6; paint-order: stroke; stroke: rgb(8 9 12 / 85%); stroke-width: 3px; }
.handle { fill: #f4f4f6; stroke: #111217; stroke-width: 2; cursor: grab; pointer-events: auto; }
.handle.active { stroke: #fff; stroke-width: 3; }
.handle.selected { fill: currentColor; stroke: #fff; stroke-width: 2; }
.handle.feathered { fill: #15161a; stroke: #fff; stroke-width: 2; }
.handle:focus-visible, .cage-control:focus-visible, .cage-hit:focus-visible { outline: none; stroke: #87a4ff; stroke-width: 4; }
.curve-cage line { stroke: rgb(255 255 255 / 52%); stroke-width: 1; stroke-dasharray: 3 4; }
.cage-visible { fill: none; stroke: currentColor; stroke-width: 4; }
.cage-hit { fill: none; stroke: transparent; stroke-width: 18; cursor: ns-resize; pointer-events: stroke; }
.cage-control { fill: #15161a; stroke: #fff; stroke-width: 2; cursor: ns-resize; pointer-events: auto; }
.cage-label { fill: #fff; font: 9px ui-monospace, monospace; paint-order: stroke; stroke: #15161a; stroke-width: 3px; letter-spacing: .08em; }
</style>
