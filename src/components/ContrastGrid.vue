<script setup lang="ts">
import { ArrowLeftRightIcon, CheckIcon, XIcon } from '@lucide/vue'
import { computed, nextTick, ref } from 'vue'
import type { DisplayShade } from '@/app/palette-store'
import { contrastRatio } from '@/color'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import type { OklchColor, Shade } from '@/types'

type ContrastStandard = 'all' | 'ui' | 'aa' | 'aaa'
type MatrixColorId = 'white' | Shade | 'black'

interface ContrastPair {
  foreground: MatrixColorId
  background: MatrixColorId
}
interface MatrixColor {
  id: MatrixColorId
  label: string
  token: string
  css: string
  color: OklchColor
  metadataColor: '#000' | '#fff'
}

const props = defineProps<{ name: string; shades: DisplayShade[] }>()
const standard = ref<ContrastStandard>('aa')
const pinnedPair = ref<ContrastPair>({ foreground: 950, background: 50 })
const transientPair = ref<ContrastPair | null>(null)
// Start the single tab stop on the default pinned pair: shade 950 on shade 50.
const focusedIndex = ref(24)
const cellRefs = ref<(HTMLElement | null)[]>([])

const standards: { value: ContrastStandard; label: string; short: string; threshold: number }[] = [
  { value: 'all', label: 'Show all contrast ratios', short: 'All', threshold: 1 },
  { value: 'ui', label: 'UI and large text, 3 to 1', short: 'UI 3:1', threshold: 3 },
  { value: 'aa', label: 'WCAG AA body text, 4.5 to 1', short: 'AA 4.5:1', threshold: 4.5 },
  { value: 'aaa', label: 'WCAG AAA body text, 7 to 1', short: 'AAA 7:1', threshold: 7 },
]
const colors = computed<MatrixColor[]>(() => [
  {
    id: 'white',
    label: 'White',
    token: 'white',
    css: '#fff',
    color: { l: 1, c: 0, h: 0 },
    metadataColor: '#000',
  },
  ...props.shades.map((entry) => ({
    id: entry.shade,
    label: String(entry.shade),
    token: `${props.name}-${entry.shade}`,
    css: entry.css,
    color: entry.mapped,
    metadataColor:
      entry.contrastOnBlack >= entry.contrastOnWhite ? ('#000' as const) : ('#fff' as const),
  })),
  {
    id: 'black',
    label: 'Black',
    token: 'black',
    css: '#000',
    color: { l: 0, c: 0, h: 0 },
    metadataColor: '#fff',
  },
])
const currentStandard = computed(() => standards.find((item) => item.value === standard.value)!)
const threshold = computed(() => currentStandard.value.threshold)
const matrix = computed(() =>
  colors.value.map((background, row) => ({
    background,
    row,
    cells: colors.value.map((foreground, column) => {
      const ratio = contrastRatio(foreground.color, background.color)
      return { foreground, background, ratio, passes: ratio >= threshold.value, row, column }
    }),
  })),
)
const flatCells = computed(() => matrix.value.flatMap((row) => row.cells))
const passingCount = computed(() => flatCells.value.filter((cell) => cell.passes).length)
const summary = computed(() =>
  standard.value === 'all'
    ? `${flatCells.value.length} combinations`
    : `${passingCount.value} of ${flatCells.value.length} pass ${currentStandard.value.short}`,
)
const activePair = computed(() => transientPair.value ?? pinnedPair.value)
const activeForeground = computed(
  () => colors.value.find((color) => color.id === activePair.value.foreground) ?? colors.value[0]!,
)
const activeBackground = computed(
  () => colors.value.find((color) => color.id === activePair.value.background) ?? colors.value[0]!,
)
const activeRatio = computed(() =>
  contrastRatio(activeForeground.value.color, activeBackground.value.color),
)
const alternatives = computed(() =>
  colors.value
    .filter((color) => color.id !== activeBackground.value.id)
    .map((color) => ({ color, ratio: contrastRatio(color.color, activeBackground.value.color) }))
    .sort((a, b) => b.ratio - a.ratio)
    .slice(0, 4),
)

function selectStandard(value: unknown): void {
  if (value === 'all' || value === 'ui' || value === 'aa' || value === 'aaa') standard.value = value
}
function pairFor(row: number, column: number): ContrastPair {
  return { foreground: colors.value[column]!.id, background: colors.value[row]!.id }
}
function pinPair(pair: ContrastPair): void {
  pinnedPair.value = pair
  transientPair.value = null
}
function swapPair(): void {
  pinnedPair.value = {
    foreground: activePair.value.background,
    background: activePair.value.foreground,
  }
  transientPair.value = null
}
function setCellRef(index: number, element: unknown): void {
  cellRefs.value[index] = element instanceof HTMLElement ? element : null
}
async function moveFocus(index: number): Promise<void> {
  focusedIndex.value = Math.max(0, Math.min(flatCells.value.length - 1, index))
  transientPair.value = pairFor(
    Math.floor(focusedIndex.value / colors.value.length),
    focusedIndex.value % colors.value.length,
  )
  await nextTick()
  cellRefs.value[focusedIndex.value]?.focus()
}
function onCellKeydown(event: KeyboardEvent, row: number, column: number): void {
  const width = colors.value.length
  const current = row * width + column
  let target: number | null = null
  if (event.key === 'ArrowRight') target = current + (column < width - 1 ? 1 : 0)
  else if (event.key === 'ArrowLeft') target = current - (column > 0 ? 1 : 0)
  else if (event.key === 'ArrowDown') target = current + (row < width - 1 ? width : 0)
  else if (event.key === 'ArrowUp') target = current - (row > 0 ? width : 0)
  else if (event.key === 'Home') target = event.ctrlKey || event.metaKey ? 0 : row * width
  else if (event.key === 'End')
    target = event.ctrlKey || event.metaKey ? flatCells.value.length - 1 : row * width + width - 1
  else if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    pinPair(pairFor(row, column))
    return
  } else if (event.key === 'Escape') {
    event.preventDefault()
    transientPair.value = null
    return
  }
  if (target !== null) {
    event.preventDefault()
    void moveFocus(target)
  }
}
function outcome(ratio: number, minimum: number): string {
  return ratio >= minimum ? 'Pass' : 'Fail'
}
</script>

<template>
  <div class="contrast-analysis">
    <div class="flex flex-wrap items-end justify-between gap-3 pb-3">
      <div>
        <h3 class="text-[13px] font-semibold">Contrast matrix</h3>
        <p class="text-[13px] text-muted-foreground">Foreground columns against background rows.</p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <span class="text-xs font-medium text-muted-foreground">Requirement</span>
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          :model-value="standard"
          aria-label="Contrast requirement"
          @update:model-value="selectStandard"
        >
          <ToggleGroupItem
            v-for="item in standards"
            :key="item.value"
            :value="item.value"
            :aria-label="item.label"
            >{{ item.short }}</ToggleGroupItem
          >
        </ToggleGroup>
        <Badge variant="outline" class="font-mono tabular-nums">{{ summary }}</Badge>
      </div>
      <p class="sr-only" role="status" aria-live="polite">{{ summary }}</p>
    </div>

    <div class="analysis-split">
      <div class="min-w-0">
        <div
          class="mb-2 flex items-center justify-between text-[11px] font-medium text-muted-foreground"
        >
          <span>Background ↓</span><span>Foreground →</span>
        </div>
        <div
          class="matrix-scroll overflow-auto rounded-[10px] bg-muted/35 p-2 ring-1 ring-foreground/10 sm:p-3"
        >
          <table class="contrast-matrix border-separate border-spacing-1">
            <caption class="sr-only">
              WCAG contrast ratios. Columns are foreground colors and rows are background colors.
            </caption>
            <thead>
              <tr>
                <th scope="col" class="matrix-corner sticky start-0 z-30 bg-muted" />
                <th
                  v-for="color in colors"
                  :key="`column-${color.id}`"
                  scope="col"
                  class="matrix-heading sticky top-0 z-20 bg-muted pb-1"
                >
                  {{ color.label }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in matrix" :key="`row-${row.background.id}`">
                <th scope="row" class="matrix-heading sticky start-0 z-10 bg-muted pe-2 text-end">
                  {{ row.background.label }}
                </th>
                <td v-for="cell in row.cells" :key="`${cell.background.id}-${cell.foreground.id}`">
                  <button
                    :ref="(element) => setCellRef(cell.row * colors.length + cell.column, element)"
                    type="button"
                    class="matrix-cell"
                    :class="{
                      'matrix-cell-failed': standard !== 'all' && !cell.passes,
                      'matrix-cell-pinned':
                        pinnedPair.foreground === cell.foreground.id &&
                        pinnedPair.background === cell.background.id,
                    }"
                    :style="{ background: cell.background.css, color: cell.foreground.css }"
                    :tabindex="focusedIndex === cell.row * colors.length + cell.column ? 0 : -1"
                    :aria-label="`${cell.foreground.token} on ${cell.background.token}, ${cell.ratio.toFixed(2)} to 1, ${standard === 'all' ? 'ratio only' : cell.passes ? 'passes' : 'fails'} ${currentStandard.short}`"
                    @focus="transientPair = pairFor(cell.row, cell.column)"
                    @blur="transientPair = null"
                    @mouseenter="transientPair = pairFor(cell.row, cell.column)"
                    @mouseleave="transientPair = null"
                    @click="pinPair(pairFor(cell.row, cell.column))"
                    @keydown="onCellKeydown($event, cell.row, cell.column)"
                  >
                    <span class="text-sm font-semibold leading-none">Aa</span>
                    <span
                      class="cell-meta"
                      :style="{
                        background:
                          cell.background.metadataColor === '#000'
                            ? 'rgb(255 255 255 / 78%)'
                            : 'rgb(0 0 0 / 66%)',
                        color: cell.background.metadataColor,
                      }"
                    >
                      <template v-if="standard !== 'all'"
                        ><CheckIcon v-if="cell.passes" /><XIcon v-else
                      /></template>
                      {{ cell.ratio.toFixed(2) }}
                    </span>
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <aside class="pair-detail" aria-label="Selected contrast pair">
        <div class="flex items-start justify-between gap-3">
          <div>
            <p class="text-[11px] font-medium tracking-[0.08em] text-muted-foreground uppercase">
              Selected pair
            </p>
            <h4 class="mt-1 text-sm font-semibold">
              {{ activeForeground.token }} on {{ activeBackground.token }}
            </h4>
          </div>
          <Button variant="outline" size="sm" @click="swapPair"
            ><ArrowLeftRightIcon data-icon="inline-start" />Swap</Button
          >
        </div>
        <div
          class="pair-sample mt-4"
          :style="{ background: activeBackground.css, color: activeForeground.css }"
        >
          <p class="text-xl font-semibold tracking-tight">Design with confidence.</p>
          <p class="mt-2 text-sm">
            Body text, icons, and control boundaries need different contrast levels.
          </p>
          <span
            class="mt-4 inline-flex rounded-md border border-current px-3 py-2 text-sm font-medium"
            >Example action</span
          >
        </div>
        <div class="mt-4 flex items-end justify-between gap-3 border-b pb-4">
          <div>
            <p class="text-xs text-muted-foreground">Contrast ratio</p>
            <p class="font-mono text-2xl font-semibold tabular-nums">
              {{ activeRatio.toFixed(2) }}:1
            </p>
          </div>
          <Badge :variant="activeRatio >= threshold ? 'secondary' : 'outline'">{{
            standard === 'all' ? 'Measured' : outcome(activeRatio, threshold)
          }}</Badge>
        </div>
        <div class="mt-4 grid grid-cols-3 gap-2">
          <div
            v-for="result in [
              { label: 'UI', value: 3 },
              { label: 'AA', value: 4.5 },
              { label: 'AAA', value: 7 },
            ]"
            :key="result.label"
            class="result-tile"
          >
            <component :is="activeRatio >= result.value ? CheckIcon : XIcon" class="size-3.5" />
            <strong>{{ result.label }}</strong>
            <span>{{ result.value }}:1</span>
          </div>
        </div>
        <div class="mt-5">
          <p class="text-xs font-medium">Strong foreground alternatives</p>
          <div class="mt-2 space-y-2">
            <button
              v-for="alternative in alternatives"
              :key="alternative.color.id"
              class="alternative-row"
              @click="
                pinPair({ foreground: alternative.color.id, background: activeBackground.id })
              "
            >
              <span
                class="size-6 rounded-md ring-1 ring-black/10 dark:ring-white/10"
                :style="{ background: alternative.color.css }"
              />
              <span>{{ alternative.color.token }}</span>
              <span class="ms-auto font-mono text-xs tabular-nums"
                >{{ alternative.ratio.toFixed(2) }}:1</span
              >
            </button>
          </div>
        </div>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.analysis-split {
  display: grid;
  gap: 16px;
}
.matrix-scroll {
  max-height: min(78vh, 1120px);
  scrollbar-gutter: stable;
}
.contrast-matrix {
  min-width: max-content;
}
.matrix-heading {
  min-width: var(--matrix-cell);
  color: var(--muted-foreground);
  font-size: 11px;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
}
.matrix-corner {
  width: 48px;
  min-width: 48px;
}
.matrix-cell {
  position: relative;
  display: flex;
  width: var(--matrix-cell);
  height: var(--matrix-cell);
  min-width: 56px;
  min-height: 56px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border: 0;
  border-radius: 6px;
  outline: 1px solid rgb(0 0 0 / 10%);
  outline-offset: -1px;
  transition:
    opacity 120ms ease-out,
    outline-color 120ms ease-out,
    box-shadow 120ms ease-out;
}
.matrix-cell:hover,
.matrix-cell:focus-visible {
  z-index: 2;
  outline: 2px solid var(--ring);
  outline-offset: -2px;
}
.matrix-cell:focus-visible {
  box-shadow:
    0 0 0 2px var(--card),
    0 0 0 4px var(--ring);
}
.matrix-cell-failed {
  opacity: 0.55;
}
.matrix-cell-failed:hover,
.matrix-cell-failed:focus-visible {
  opacity: 1;
}
.matrix-cell-pinned {
  outline: 3px solid var(--foreground);
  outline-offset: -3px;
}
.cell-meta {
  position: absolute;
  inset-inline: 4px;
  bottom: 4px;
  display: flex;
  min-height: 16px;
  align-items: center;
  justify-content: center;
  gap: 2px;
  border-radius: 4px;
  padding-inline: 3px;
  font-size: 9px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.cell-meta svg {
  width: 10px;
  height: 10px;
}
.pair-detail {
  border-radius: 10px;
  background: var(--muted);
  padding: 16px;
  box-shadow: inset 0 0 0 1px var(--border);
}
.pair-sample {
  min-height: 180px;
  border-radius: 8px;
  padding: 20px;
  outline: 1px solid rgb(0 0 0 / 10%);
  outline-offset: -1px;
}
.result-tile {
  display: grid;
  grid-template-columns: auto 1fr;
  align-items: center;
  gap: 2px 6px;
  border-radius: 8px;
  background: var(--card);
  padding: 10px;
  box-shadow: 0 0 0 1px var(--border);
  font-size: 11px;
}
.result-tile span {
  grid-column: 2;
  color: var(--muted-foreground);
}
.alternative-row {
  display: flex;
  width: 100%;
  min-height: 40px;
  align-items: center;
  gap: 9px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  padding: 6px;
  color: inherit;
  text-align: start;
  transition: background-color 120ms ease-out;
}
.alternative-row:hover,
.alternative-row:focus-visible {
  background: var(--accent);
}
.contrast-analysis {
  --matrix-cell: clamp(56px, 4.1vw, 88px);
}
@media (min-width: 1280px) {
  .analysis-split {
    grid-template-columns: minmax(0, 1fr) minmax(340px, 400px);
  }
  .pair-detail {
    position: sticky;
    top: 164px;
    align-self: start;
  }
}
@media (min-width: 1800px) {
  .analysis-split {
    grid-template-columns: max-content 400px;
    justify-content: center;
  }
}
@media (prefers-reduced-motion: reduce) {
  .matrix-cell,
  .alternative-row {
    transition: none;
  }
}
@media (forced-colors: active) {
  .matrix-cell-pinned {
    outline-color: Highlight;
  }
}
</style>
