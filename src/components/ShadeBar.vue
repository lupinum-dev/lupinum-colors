<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
import { CopyIcon, MapPinIcon, RotateCcwIcon, TriangleAlertIcon } from '@lucide/vue'
import {
  anchorShade,
  changedShades,
  commitShade,
  displayShades,
  gamut,
  lastResult,
  resetShade,
  selectedShade,
  shades,
} from '@/app/palette-store'
import { writeClipboard } from '@/app/clipboard'
import { showToast } from '@/app/toast'
const selected = computed(() => displayShades.value.find((e) => e.shade === selectedShade.value))
const range = computed(() => (gamut.value === 'srgb' ? 'sRGB' : 'Display P3'))
const changed = computed(() => changedShades.value.includes(selectedShade.value))
const fields = [
  { key: 'l', label: 'Lightness', min: 0, max: 100, step: 0.1, unit: '%', factor: 100, digits: 1 },
  { key: 'c', label: 'Chroma', min: 0, max: 0.4, step: 0.001, unit: '', factor: 1, digits: 3 },
  { key: 'h', label: 'Hue', min: 0, max: 360, step: 0.1, unit: '°', factor: 1, digits: 1 },
] as const
const drafts = reactive({ l: '', c: '', h: '' })
const errors = reactive({ l: '', c: '', h: '' })
function resetDrafts(): void {
  const color = shades.value?.[selectedShade.value]
  if (!color) return
  for (const f of fields) {
    drafts[f.key] = (color[f.key] * f.factor).toFixed(f.digits)
    errors[f.key] = ''
  }
}
watch([selectedShade, shades], resetDrafts, { immediate: true })
function apply(f: (typeof fields)[number]): void {
  const value = String(drafts[f.key]).trim() === '' ? NaN : Number(drafts[f.key])
  if (!Number.isFinite(value) || value < f.min || value > f.max) {
    errors[f.key] = `${f.label} must be between ${f.min} and ${f.max}${f.unit}.`
    return
  }
  const color = shades.value?.[selectedShade.value]
  if (color) commitShade(selectedShade.value, { ...color, [f.key]: value / f.factor })
  resetDrafts()
}
function rating(ratio: number): string {
  return ratio >= 7 ? 'AAA' : ratio >= 4.5 ? 'AA' : ratio >= 3 ? 'large text only' : 'fails'
}
async function copy(value: string | undefined, format: 'HEX' | 'OKLCH'): Promise<void> {
  if (!value) return
  showToast(
    (await writeClipboard(value))
      ? `Copied ${format}: ${value}`
      : `Copy was blocked. ${format}: ${value}`,
  )
}
function reset(): void {
  const n = selectedShade.value
  resetShade(n)
  showToast(`Shade ${n} is back to the generated color.`)
}
</script>
<template>
  <section v-if="selected" class="shade" aria-label="Selected shade">
    <span class="ssw" :style="{ background: selected.css }" aria-hidden="true"></span>
    <div class="id">
      <h3>
        Shade {{ selectedShade
        }}<span v-if="selectedShade === anchorShade" class="wb-tag"
          ><MapPinIcon class="wb-ic" />{{
            lastResult?.configuration.seed !== 'exact'
              ? 'Fitted to Tailwind'
              : changed
                ? 'Your color'
                : 'Your color, exact'
          }}</span
        ><span v-if="changed" class="wb-tag"><i class="wb-dot"></i>Changed</span
        ><span v-if="!selected.inGamut" class="wb-tag warn"
          ><TriangleAlertIcon class="wb-ic" />Mapped to {{ range }}</span
        >
      </h3>
      <p>
        White text {{ selected.contrastOnWhite.toFixed(2) }} {{ rating(selected.contrastOnWhite) }},
        black text {{ selected.contrastOnBlack.toFixed(2) }} {{ rating(selected.contrastOnBlack) }}
      </p>
    </div>
    <div class="vals">
      <button
        class="copyv"
        :disabled="!selected.hex"
        :aria-label="`Copy HEX ${selected.hex ?? ''}`"
        @click="copy(selected.hex, 'HEX')"
      >
        <small>HEX</small><span>{{ selected.hex ?? `not in ${range}` }}</span
        ><CopyIcon class="wb-ic" /></button
      ><button
        class="copyv"
        :aria-label="`Copy OKLCH ${selected.css}`"
        @click="copy(selected.css, 'OKLCH')"
      >
        <small>OKLCH</small><span>{{ selected.css }}</span
        ><CopyIcon class="wb-ic" /></button
      ><span class="wb-grow"></span
      ><button v-if="changed" class="wb-btn xs outline" @click="reset">
        <RotateCcwIcon class="wb-ic" />Reset shade
      </button>
    </div>
    <div class="fields">
      <div v-for="f in fields" :key="f.key" class="f">
        <label :for="`f-${f.key}`">{{ f.label }}</label>
        <div class="wb-inp" :data-invalid="!!errors[f.key]">
          <input
            :id="`f-${f.key}`"
            v-model="drafts[f.key]"
            type="number"
            inputmode="decimal"
            :min="f.min"
            :max="f.max"
            :step="f.step"
            :aria-invalid="!!errors[f.key]"
            :aria-describedby="errors[f.key] ? `error-${f.key}` : undefined"
            @change="apply(f)"
            @keydown.enter.prevent="apply(f)"
            @keydown.esc.prevent="resetDrafts"
          /><span class="unit">{{ f.unit }}</span>
        </div>
      </div>
      <template v-for="f in fields" :key="`err-${f.key}`"
        ><p v-if="errors[f.key]" :id="`error-${f.key}`" class="err" role="alert">
          {{ errors[f.key] }}
        </p></template
      >
    </div>
  </section>
</template>

<style scoped>
.shade {
  display: grid;
  grid-template-columns: 52px minmax(0, 1fr) auto;
  grid-template-areas: 'sw id fields' 'sw vals vals';
  gap: 10px 16px;
  align-items: center;
  padding: 12px;
  border: 1px solid var(--wb-line);
  border-radius: 12px;
}
.shade .ssw {
  grid-area: sw;
  align-self: stretch;
  border-radius: 8px;
  box-shadow: inset 0 0 0 1px oklch(0% 0 0 / 0.1);
  min-height: 52px;
}
.shade .id {
  grid-area: id;
  display: grid;
  gap: 2px;
  min-width: 0;
}
.shade .id h3 {
  margin: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  font-size: 15px;
  font-weight: 600;
  letter-spacing: -0.01em;
  font-variant-numeric: tabular-nums;
}
.shade .id p {
  margin: 0;
  color: var(--wb-fg-2);
  font-size: 12px;
}
.fields {
  grid-area: fields;
  display: grid;
  grid-template-columns: repeat(3, 108px);
  gap: 8px;
}
.f {
  display: grid;
  gap: 3px;
  min-width: 0;
}
.f label {
  font-size: 11.5px;
  color: var(--wb-fg-3);
  font-weight: 500;
}
.f .wb-inp input {
  padding: 0 2px 0 8px;
  font-family: var(--wb-mono);
  font-variant-numeric: tabular-nums;
  font-size: 12.5px;
}
.f .unit {
  padding-right: 8px;
  color: var(--wb-fg-3);
  font-size: 12px;
}
.vals {
  grid-area: vals;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 16px;
  min-width: 0;
}
.copyv {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  max-width: 100%;
  height: 26px;
  padding: 0 8px;
  margin-left: -8px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  font: 12px var(--wb-mono);
  color: var(--wb-fg);
  min-width: 0;
}
.copyv span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.copyv small {
  font-family: var(--wb-font);
  color: var(--wb-fg-3);
  font-size: 11.5px;
}
.copyv .wb-ic {
  width: 13px;
  height: 13px;
  color: var(--wb-fg-3);
}
.copyv:hover {
  background: var(--wb-hover);
}
.copyv:hover .wb-ic {
  color: var(--wb-fg);
}
.err {
  margin: 0;
  color: var(--wb-bad);
  font-size: 12px;
  grid-column: 1 / -1;
}

@media (max-width: 1180px) {
  .shade {
    grid-template-columns: 52px minmax(0, 1fr);
    grid-template-areas: 'sw id' 'fields fields' 'vals vals';
  }
  .fields {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
</style>
