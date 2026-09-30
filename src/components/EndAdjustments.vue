<script setup lang="ts">
import { computed, ref } from 'vue'
import { RotateCcwIcon } from '@lucide/vue'
import { adjustEnd, anchorShade, commit, endsState, resetEnds, shades } from '@/app/palette-store'
import {
  END_SHADE,
  END_STOPS,
  endTail,
  isAdjusted,
  withoutEnd,
  type EndSide,
} from '@/app/scale-ends'
interface Stop {
  label: string
  pos: number
  chroma?: number
}
interface Dial {
  id: string
  side: EndSide
  kind: 'chroma' | 'lightness'
  label: string
  max: number
  lo: number
  hi: number
  unadjustedLightness: number
  pos: number
  changed: boolean
  value: string
  stops: Stop[]
}
const anyAdjusted = computed(
  () => isAdjusted(endsState.value.dark) || isAdjusted(endsState.value.light),
)
const colorPos = (c: number, max: number) =>
  max > 1e-6 ? Math.round((1 - Math.sqrt(Math.min(1, Math.max(0, c) / max))) * 1000) : 0
const groups = computed(() => {
  const palette = shades.value,
    a = anchorShade.value
  if (!palette || !a) return []
  return (['dark', 'light'] as const).map((side) => {
    const state = endsState.value[side],
      tail = endTail(side, a),
      title = side === 'dark' ? 'Dark shades' : 'Light shades'
    const range =
      tail.length === 1 ? `${tail[0]}` : tail.length ? `${tail[0]} to ${tail.at(-1)}` : ''
    if (!tail.length)
      return {
        side,
        title,
        range,
        dials: [] as Dial[],
        lockedNote: `Your color is shade ${a}, so this end stays as it is.`,
      }
    const { base } = withoutEnd(palette, state),
      end = END_SHADE[side],
      now = palette[end],
      max = base[end].c
    const stops = [
      { label: 'Brand', chroma: max },
      ...END_STOPS[side].filter((s) => s.chroma < max - 0.002),
    ]
    const match = stops.find((s) => Math.abs(s.chroma - now.c) < 0.0015)
    const lo = side === 'dark' ? base[900].l : base[100].l,
      hi = side === 'dark' ? 0.08 : 1
    const toPos = (l: number) => Math.round(Math.min(1, Math.max(0, (l - lo) / (hi - lo))) * 1000)
    const color: Dial = {
      id: `${side}-c`,
      side,
      kind: 'chroma',
      label: 'Color',
      max,
      lo: 0,
      hi: 0,
      unadjustedLightness: base[end].l,
      pos: colorPos(now.c, max),
      changed: state.chroma !== null,
      value: match
        ? match.label === 'Brand'
          ? 'Brand'
          : match.chroma === 0
            ? match.label
            : `${match.label}-like`
        : `${Math.round((now.c / max) * 100)}% of brand`,
      stops: stops.map((s) => ({ ...s, pos: colorPos(s.chroma, max) })),
    }
    const light: Dial = {
      id: `${side}-l`,
      side,
      kind: 'lightness',
      label: side === 'dark' ? 'Depth' : 'Brightness',
      max: 0,
      lo,
      hi,
      unadjustedLightness: base[end].l,
      pos: toPos(now.l),
      changed: state.lightness !== null,
      value: `${end} at ${(now.l * 100).toFixed(1)}%`,
      stops: [
        { label: side === 'dark' ? 'Lighter' : 'Softer', pos: 0 },
        { label: '', pos: toPos(base[end].l) },
        { label: side === 'dark' ? 'Darker' : 'Brighter', pos: 1000 },
      ],
    }
    return { side, title, range, dials: [color, light], lockedNote: '' }
  })
})
const pointer = ref(false)
function apply(d: Dial, pos: number, snap = pointer.value): void {
  const stop = snap ? d.stops.find((s) => s.label && Math.abs(s.pos - pos) <= 18) : undefined
  if (d.kind === 'chroma') {
    const c = stop?.chroma ?? (1 - pos / 1000) ** 2 * d.max
    adjustEnd(d.side, { chroma: c >= d.max - 1e-4 ? null : c })
  } else {
    const lightness = d.lo + ((stop?.pos ?? pos) / 1000) * (d.hi - d.lo)
    adjustEnd(d.side, {
      lightness: Math.abs(lightness - d.unadjustedLightness) <= 0.0005 ? null : lightness,
    })
  }
}
function input(d: Dial, event: Event): void {
  apply(d, Number((event.target as HTMLInputElement).value))
}
function setStop(d: Dial, stop: Stop): void {
  apply(d, stop.pos, true)
  commit()
}
function reset(d: Dial): void {
  adjustEnd(d.side, d.kind === 'chroma' ? { chroma: null } : { lightness: null })
  commit()
}
</script>
<template>
  <section class="adjust" aria-labelledby="adj-h">
    <div class="wb-head">
      <h2 id="adj-h" class="wb-h">Adjust</h2>
      <span class="wb-grow"></span
      ><button v-if="anyAdjusted" class="wb-linkbtn" @click="resetEnds">Reset all</button>
    </div>
    <div v-for="g in groups" :key="g.side" class="grp">
      <div class="grp-h">
        <b>{{ g.title }}</b
        ><span>{{ g.range }}</span>
      </div>
      <p v-if="!g.dials.length" class="side-note">{{ g.lockedNote }}</p>
      <div v-for="d in g.dials" :key="d.id" class="dial">
        <div class="dial-h">
          <label :for="d.id">{{ d.label }}</label
          ><output :for="d.id" :class="{ on: d.changed }">{{ d.value }}</output
          ><button
            v-if="d.changed"
            class="wb-btn xs icon"
            title="Reset"
            :aria-label="`Reset ${d.label.toLowerCase()} of ${g.title.toLowerCase()}`"
            @click="reset(d)"
          >
            <RotateCcwIcon class="wb-ic" />
          </button>
        </div>
        <input
          :id="d.id"
          type="range"
          min="0"
          max="1000"
          step="5"
          :value="d.pos"
          :aria-valuetext="d.value"
          @pointerdown="pointer = true"
          @keydown="pointer = false"
          @input="input(d, $event)"
          @change="commit"
          @dblclick="reset(d)"
        />
        <div class="stops" aria-hidden="true">
          <template v-for="t in d.stops" :key="t.label"
            ><span
              v-if="t.label"
              class="stop"
              :class="{ first: t.pos === 0, last: t.pos === 1000 }"
              :style="{ left: `${t.pos / 10}%` }"
              @click="setStop(d, t)"
              >{{ t.label }}</span
            ><span v-else class="gen" :style="{ left: `${t.pos / 10}%` }"></span
          ></template>
        </div>
      </div>
    </div>
    <p class="side-note">
      Your hue stays. Slate and Zinc keep as much color as Tailwind’s own slate and zinc. Your color
      is never changed here.
    </p>
  </section>
</template>

<style scoped>
.adjust {
  display: grid;
  gap: 16px;
}
.grp {
  display: grid;
  gap: 14px;
  padding-top: 14px;
  border-top: 1px solid var(--wb-line);
}
.grp-h {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}
.grp-h b {
  font-size: 13px;
}
.grp-h span {
  font-size: 12px;
  color: var(--wb-fg-3);
}
.dial {
  display: grid;
  gap: 2px;
}
.dial-h {
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 24px;
}
.dial-h label {
  font-size: 12.5px;
  font-weight: 500;
}
.dial-h output {
  margin-left: auto;
  font-size: 12px;
  color: var(--wb-fg-2);
  font-variant-numeric: tabular-nums;
}
.dial-h output.on {
  color: var(--wb-fg);
  font-weight: 600;
}
.dial input[type='range'] {
  width: 100%;
  height: 22px;
  margin: 0;
  accent-color: var(--wb-fg);
  background: transparent;
}
.stops {
  position: relative;
  height: 18px;
  margin: 0 8px;
}
.stops span {
  position: absolute;
  top: 0;
  transform: translateX(-50%);
  padding: 0 2px;
  font-size: 11px;
  color: var(--wb-fg-3);
  white-space: nowrap;
}
.stops .stop {
  cursor: pointer;
}
.stops .stop:hover {
  color: var(--wb-fg);
  text-decoration: underline;
  text-underline-offset: 2px;
}
.stops .first {
  transform: translateX(-8px);
}
.stops .last {
  transform: translateX(calc(-100% + 8px));
}
.stops .gen {
  top: -7px;
  width: 1px;
  height: 6px;
  padding: 0;
  background: var(--wb-line-strong);
}
.side-note {
  margin: 0;
  color: var(--wb-fg-3);
  font-size: 12px;
}
</style>
