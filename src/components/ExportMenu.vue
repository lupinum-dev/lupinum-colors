<script setup lang="ts">
import SegmentedChoice from './SegmentedChoice.vue'
import { computed, ref } from 'vue'
import { CopyIcon, ChevronDownIcon } from '@lucide/vue'
import { PopoverRoot, PopoverTrigger, PopoverPortal, PopoverContent } from 'reka-ui'
import { formatExport, type ExportFormat } from '@/app/format'
import { committedPaletteName, displayShades, gamut } from '@/app/palette-store'
import { writeClipboard } from '@/app/clipboard'
import { showToast } from '@/app/toast'
const open = ref(false)
const format = ref<ExportFormat>('tailwind')
const formats = [
  { value: 'tailwind', label: 'Tailwind v4' },
  { value: 'css', label: 'CSS' },
  { value: 'json', label: 'JSON' },
] as const
const copyLabel = computed(
  () =>
    ({ tailwind: 'Copy for Tailwind', css: 'Copy CSS variables', json: 'Copy JSON' })[format.value],
)
const code = computed(() =>
  formatExport(format.value, committedPaletteName.value, displayShades.value),
)
const note = computed(() =>
  gamut.value === 'srgb'
    ? 'Mapped to sRGB, so the colors look the same on every screen.'
    : gamut.value === 'display-p3'
      ? 'Mapped to Display P3. HEX is not available.'
      : 'Not mapped. Some colors may fall outside what screens can show.',
)
async function copy(): Promise<void> {
  if (await writeClipboard(code.value))
    showToast(
      `Copied ${{ tailwind: 'Tailwind @theme block', css: 'CSS variables', json: 'JSON' }[format.value]} for ${committedPaletteName.value}, 11 colors.`,
    )
  else {
    showToast('Copy was blocked. Select the code and copy it manually.')
    open.value = true
  }
}
</script>
<template>
  <div class="wb-split">
    <button class="wb-btn primary" :aria-label="copyLabel" @click="copy">
      <CopyIcon class="wb-ic" /><span class="wb-hide-sm">{{ copyLabel }}</span
      ><span class="wb-show-sm">Copy</span>
    </button>
    <PopoverRoot v-model:open="open"
      ><PopoverTrigger class="wb-btn primary" aria-label="Export options" aria-haspopup="dialog"
        ><ChevronDownIcon class="wb-ic"
      /></PopoverTrigger>
      <PopoverPortal
        ><PopoverContent align="end" :side-offset="8" as-child>
          <div class="pop" aria-labelledby="export-title">
            <div class="pop-head">
              <h3 id="export-title">Export {{ committedPaletteName }}</h3>
              <SegmentedChoice v-model="format" :options="formats" aria-label="Format" />
            </div>
            <pre tabindex="0" aria-label="Export code">{{ code }}</pre>
            <div class="pop-foot">
              <p class="wb-help">{{ note }}</p>
              <button class="wb-btn primary sm" @click="copy">
                <CopyIcon class="wb-ic" />Copy
              </button>
            </div>
          </div></PopoverContent
        ></PopoverPortal
      >
    </PopoverRoot>
  </div>
</template>

<style scoped>
.pop {
  position: absolute;
  z-index: 20;
  width: min(420px, calc(100% - 24px));
  background: var(--wb-panel);
  border: 1px solid var(--wb-line);
  border-radius: 12px;
  box-shadow: var(--wb-pop-shadow);
  display: grid;
  gap: 14px;
  padding: 14px;
}
.pop-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.pop h3 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
}
.pop pre {
  margin: 0;
  max-height: 280px;
  overflow: auto;
  padding: 12px;
  border-radius: var(--wb-r-ctl);
  background: var(--wb-sunken);
  border: 1px solid var(--wb-line);
  font: 12px/1.6 var(--wb-mono);
}
.pop-foot {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}
.wb-ctl {
  display: grid;
  gap: 6px;
}
.wb-cl {
  font-size: 12px;
  font-weight: 500;
  color: var(--wb-fg-2);
}
.wb-help {
  margin: 0;
  color: var(--wb-fg-3);
  font-size: 12px;
  text-wrap: pretty;
}
.place {
  display: grid;
  grid-template-columns: auto repeat(11, minmax(0, 1fr));
  gap: 3px;
}
.place button {
  height: 30px;
  border: 0;
  border-radius: 5px;
  font-size: 10px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  padding: 0;
}
.place button.auto {
  padding: 0 10px;
  background: var(--wb-sunken);
  border: 1px solid var(--wb-line);
  color: var(--wb-fg);
  font-size: 12px;
  font-weight: 500;
}
.place button[aria-checked='true'] {
  box-shadow:
    0 0 0 2px var(--wb-panel),
    0 0 0 3.5px var(--wb-fg);
}

.pop {
  position: relative;
  width: min(420px, calc(100vw - 24px));
  color: var(--wb-fg);
  font: 400 13px/1.45 var(--wb-font);
}
</style>
