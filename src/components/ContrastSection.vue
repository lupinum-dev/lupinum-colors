<script setup lang="ts">
import { computed, ref } from 'vue'
import { CheckIcon, XIcon, MinusIcon } from '@lucide/vue'
import { displayShades } from '@/app/palette-store'
import { contrastRatio } from '@/color'
import { SHADE_NAMES, type Shade, type OklchColor } from '@/types'
type ColorId = Shade | 'white' | 'black'
const white: OklchColor = { l: 1, c: 0, h: 0 },
  black: OklchColor = { l: 0, c: 0, h: 0 }
const colorOf = (id: ColorId) =>
  id === 'white'
    ? white
    : id === 'black'
      ? black
      : displayShades.value.find((e) => e.shade === id)!.mapped
const cssOf = (id: ColorId) =>
  id === 'white'
    ? '#fff'
    : id === 'black'
      ? '#000'
      : displayShades.value.find((e) => e.shade === id)!.css
const definitions: {
  mode: string
  rows: { use: string; fg: ColorId; bg: ColorId; min: number }[]
}[] = [
  {
    mode: 'Light',
    rows: [
      { use: 'Text on page tint', fg: 900, bg: 50, min: 4.5 },
      { use: 'Badge', fg: 800, bg: 100, min: 4.5 },
      { use: 'Link in a card', fg: 600, bg: 'white', min: 4.5 },
      { use: 'Button label', fg: 'white', bg: 600, min: 4.5 },
      { use: 'Focus ring', fg: 500, bg: 'white', min: 3 },
    ],
  },
  {
    mode: 'Dark',
    rows: [
      { use: 'Text on page tint', fg: 100, bg: 950, min: 4.5 },
      { use: 'Badge', fg: 200, bg: 800, min: 4.5 },
      { use: 'Link in a card', fg: 400, bg: 900, min: 4.5 },
      { use: 'Button label', fg: 'white', bg: 500, min: 4.5 },
      { use: 'Focus ring', fg: 500, bg: 900, min: 3 },
    ],
  },
]
const groups = computed(() =>
  displayShades.value.length
    ? definitions.map((g) => ({
        ...g,
        rows: g.rows.map((p) => {
          const ratio = contrastRatio(colorOf(p.fg), colorOf(p.bg)),
            pass = ratio >= p.min
          const text =
            p.min === 3
              ? pass
                ? 'Passes 3:1'
                : 'Fails 3:1'
              : ratio >= 7
                ? 'Passes AAA'
                : ratio >= 4.5
                  ? 'Passes AA'
                  : ratio >= 3
                    ? 'Large text only'
                    : 'Fails'
          const partial = p.min === 4.5 && ratio >= 3 && !pass
          return {
            ...p,
            ratio,
            text,
            cls: pass ? 'pass' : partial ? 'part' : 'fail',
            icon: pass ? CheckIcon : partial ? MinusIcon : XIcon,
            fgCss: cssOf(p.fg),
            bgCss: cssOf(p.bg),
          }
        }),
      }))
    : [],
)
const showMatrix = ref(false)
const colors = computed(() =>
  ['white', ...SHADE_NAMES, 'black'].map((id) => ({
    id: id as ColorId,
    label: String(id),
    css: cssOf(id as ColorId),
    color: colorOf(id as ColorId),
  })),
)
const matrix = computed(() =>
  colors.value.map((bg) => ({
    bg,
    cells: colors.value.map((fg) => ({ fg, ratio: contrastRatio(fg.color, bg.color) })),
  })),
)
const summary = computed(() => {
  const pairs = matrix.value.flatMap((row) => row.cells.filter((c) => c.fg.id !== row.bg.id))
  return `${pairs.filter((c) => c.ratio >= 4.5).length} of ${pairs.length} pairs pass.`
})
</script>
<template>
  <section class="contrast" aria-labelledby="con-h">
    <div class="wb-head">
      <h2 id="con-h" class="wb-h">Contrast</h2>
      <span class="wb-sub"
        >The pairs the preview uses. WCAG 2 ratios, a first check rather than a guarantee.</span
      ><span class="wb-grow"></span
      ><button
        class="wb-btn sm outline"
        :aria-expanded="showMatrix"
        aria-controls="matrix"
        @click="showMatrix = !showMatrix"
      >
        {{ showMatrix ? 'Hide all combinations' : 'Show all combinations' }}
      </button>
    </div>
    <div class="pairs-wrap">
      <table v-for="g in groups" :key="g.mode" class="pairs">
        <caption>
          {{
            g.mode
          }}
        </caption>
        <tbody>
          <tr v-for="p in g.rows" :key="p.use">
            <td style="width: 48px">
              <span class="sample" :style="{ background: p.bgCss, color: p.fgCss }">Aa</span>
            </td>
            <td>{{ p.use }}</td>
            <td class="wb-mono" style="color: var(--wb-fg-2)">{{ p.fg }} on {{ p.bg }}</td>
            <td class="num">{{ p.ratio.toFixed(2) }}</td>
            <td>
              <span class="status" :class="p.cls"
                ><component :is="p.icon" class="wb-ic" />{{ p.text }}</span
              >
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <div v-if="showMatrix" id="matrix" class="tbl-wrap">
      <p class="wb-help" style="margin-bottom: 8px">
        Rows are backgrounds, columns are text colors. Colored cells pass AA for normal text (4.5 :
        1). {{ summary }}
      </p>
      <table class="matrix" aria-label="Contrast of every text color on every background">
        <thead>
          <tr>
            <th class="hd"></th>
            <th v-for="c in colors" :key="c.id" class="hd" scope="col">{{ c.label }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in matrix" :key="row.bg.id">
            <th class="rh" scope="row">
              <i :style="{ background: row.bg.css }"></i>{{ row.bg.label }}
            </th>
            <td
              v-for="cell in row.cells"
              :key="cell.fg.id"
              class="cell"
              :class="{
                no: cell.ratio < 4.5 && cell.fg.id !== row.bg.id,
                self: cell.fg.id === row.bg.id,
              }"
              :style="{ background: row.bg.css, color: cell.fg.css }"
              :aria-label="`${cell.fg.label} on ${row.bg.label}: ${cell.ratio.toFixed(2)}`"
            >
              {{ cell.fg.id === row.bg.id ? '' : cell.ratio.toFixed(1) }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<style scoped>
.contrast {
  border-top: 1px solid var(--wb-line);
  padding: 16px;
  display: grid;
  gap: 12px;
}
.pairs-wrap {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px 32px;
}
.pairs {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
.pairs caption {
  text-align: left;
  font-weight: 600;
  font-size: 12px;
  color: var(--wb-fg-2);
  padding-bottom: 6px;
}
.pairs td {
  padding: 6px 8px 6px 0;
  border-top: 1px solid var(--wb-line);
  vertical-align: middle;
}
.pairs .num {
  text-align: right;
  font-family: var(--wb-mono);
  font-variant-numeric: tabular-nums;
}
.sample {
  display: inline-grid;
  place-items: center;
  width: 40px;
  height: 26px;
  border-radius: 6px;
  font-weight: 600;
  box-shadow: inset 0 0 0 1px oklch(0% 0 0 / 0.1);
}
.status {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-weight: 500;
  white-space: nowrap;
}
.status .wb-ic {
  width: 14px;
  height: 14px;
}
.status.pass {
  color: var(--wb-ok);
}
.status.fail {
  color: var(--wb-bad);
}
.status.part {
  color: var(--wb-warn);
}
.tbl-wrap {
  overflow-x: auto;
}
.matrix {
  display: grid;
  grid-template-columns: 56px repeat(13, minmax(38px, 1fr));
  gap: 2px;
  min-width: 620px;
  font-size: 11px;
}
.matrix .hd {
  display: grid;
  place-items: center;
  color: var(--wb-fg-3);
  font-family: var(--wb-mono);
  height: 24px;
}
.matrix .rh {
  display: flex;
  align-items: center;
  gap: 6px;
  font-family: var(--wb-mono);
  color: var(--wb-fg-2);
}
.matrix .rh i {
  width: 12px;
  height: 12px;
  border-radius: 3px;
  box-shadow: inset 0 0 0 1px oklch(0% 0 0 / 0.15);
}
.cell {
  height: 30px;
  display: grid;
  place-items: center;
  border-radius: 4px;
  font-family: var(--wb-mono);
  font-variant-numeric: tabular-nums;
  font-weight: 600;
}
.cell.no {
  background: var(--wb-sunken) !important;
  color: var(--wb-fg-3) !important;
  font-weight: 400;
}
.cell.self {
  background: transparent !important;
  color: var(--wb-line-strong) !important;
}

.matrix thead,
.matrix tbody,
.matrix tr {
  display: contents;
}
.matrix th {
  font-weight: inherit;
}
@media (max-width: 880px) {
  .pairs-wrap {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
