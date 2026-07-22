<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import type { Channel } from '@/app/channels'
import {
  displayShades,
  ghostShades,
  selectedShade,
  setShadeColor,
  shades,
  visibleChannels,
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
    if (entry) {
      size.value = {
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      }
    }
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
  const clamped = Math.min(1, Math.max(0, normalized))
  return channel.min + clamped * (channel.max - channel.min)
}

interface CurvePoint {
  shade: Shade
  x: number
  y: number
}

interface Curve {
  channel: Channel
  points: CurvePoint[]
  polyline: string
}

function buildCurves(colors: Record<Shade, OklchColor>): Curve[] {
  return visibleChannels.value.map((channel) => {
    const points = SHADE_NAMES.map((shade, index) => ({
      shade,
      x: xAt(index),
      y: yFor(channel, channel.get(colors[shade])),
    }))
    return {
      channel,
      points,
      polyline: points.map((point) => `${point.x},${point.y}`).join(' '),
    }
  })
}

const curves = computed<Curve[]>(() =>
  shades.value && size.value.width ? buildCurves(shades.value) : [],
)
const ghostCurves = computed<Curve[]>(() =>
  ghostShades.value && size.value.width ? buildCurves(ghostShades.value) : [],
)

let drag: { channel: Channel; shade: Shade } | null = null

function onPointerDown(event: PointerEvent, channel: Channel, shade: Shade): void {
  drag = { channel, shade }
  selectedShade.value = shade
  ;(event.currentTarget as Element).setPointerCapture(event.pointerId)
}

function onPointerMove(event: PointerEvent): void {
  if (!drag || !container.value || !shades.value) return
  const rect = container.value.getBoundingClientRect()
  const value = valueAt(drag.channel, event.clientY - rect.top)
  setShadeColor(drag.shade, drag.channel.set(shades.value[drag.shade], value))
}

function onPointerUp(): void {
  drag = null
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
      <g v-for="curve in ghostCurves" :key="`ghost-${curve.channel.key}`" class="ghost">
        <polyline :points="curve.polyline" />
        <circle
          v-for="point in curve.points"
          :key="point.shade"
          :cx="point.x"
          :cy="point.y"
          r="3"
        />
      </g>

      <g v-for="curve in curves" :key="curve.channel.key">
        <text class="curve-label" :x="curve.points[0].x - 18" :y="curve.points[0].y + 4">
          {{ curve.channel.label }}
        </text>
        <polyline class="halo" :points="curve.polyline" />
        <polyline class="line" :points="curve.polyline" />
        <circle
          v-for="point in curve.points"
          :key="point.shade"
          class="handle"
          :class="{ selected: point.shade === selectedShade }"
          :cx="point.x"
          :cy="point.y"
          r="7"
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
  border-radius: 12px;
  overflow: hidden;
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
  border: none;
  cursor: pointer;
  font: inherit;
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
  opacity: 0.75;
  font-family: ui-monospace, monospace;
}

.overlay {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.ghost polyline {
  fill: none;
  stroke: #fff;
  stroke-width: 1.5;
  stroke-dasharray: 5 4;
  opacity: 0.45;
  mix-blend-mode: difference;
}

.ghost circle {
  fill: #fff;
  opacity: 0.45;
  mix-blend-mode: difference;
}

.halo {
  fill: none;
  stroke: rgba(255, 255, 255, 0.85);
  stroke-width: 4;
}

.line {
  fill: none;
  stroke: #111;
  stroke-width: 1.75;
}

.curve-label {
  font-size: 11px;
  font-weight: 700;
  fill: #fff;
  paint-order: stroke;
  stroke: rgba(0, 0, 0, 0.6);
  stroke-width: 2.5;
}

.handle {
  fill: #fff;
  stroke: #111;
  stroke-width: 1.75;
  cursor: grab;
  pointer-events: auto;
}

.handle.selected {
  fill: #111;
  stroke: #fff;
}

.handle:active {
  cursor: grabbing;
}
</style>
