<script setup lang="ts">
import { computed, onBeforeUnmount } from 'vue'
import { Undo2Icon, Redo2Icon, SunIcon, MoonIcon, LinkIcon, TriangleAlertIcon } from '@lucide/vue'
import { formatHex } from '@/color'
import {
  anchorShade,
  canUndo,
  canRedo,
  committedPaletteName,
  displayShades,
  generate,
  generationError,
  history,
  historyIndex,
  redo,
  seedColor,
  undo,
} from '@/app/palette-store'
import { encodeSharedPalette, paletteToTuple } from '@/app/shared-palette'
import { writeClipboard } from '@/app/clipboard'
import { showToast } from '@/app/toast'
import ColorUsePopover from './ColorUsePopover.vue'
import ExportMenu from './ExportMenu.vue'
defineProps<{ isDark: boolean }>()
const emit = defineEmits<{ toggleTheme: [] }>()
const anchorDisplay = computed(() => displayShades.value.find((e) => e.shade === anchorShade.value))
const pickerHex = computed(() =>
  anchorDisplay.value ? formatHex(anchorDisplay.value.mapped) : '#16661f',
)
let timer: ReturnType<typeof setTimeout> | undefined
function regenerate(): void {
  const outcome = generate()
  if (outcome.ok && outcome.replaced)
    showToast(
      `New scale generated. ${outcome.replaced} changed ${outcome.replaced === 1 ? 'shade was' : 'shades were'} replaced.`,
      { label: 'Undo', run: undo },
    )
}
function input(event: Event): void {
  seedColor.value = (event.target as HTMLInputElement).value
  clearTimeout(timer)
  timer = setTimeout(regenerate, 260)
}
function pick(event: Event): void {
  clearTimeout(timer)
  seedColor.value = (event.target as HTMLInputElement).value
  regenerate()
}
async function copyLink(): Promise<void> {
  const saved = history.value[historyIndex.value]
  if (!saved) return
  const link =
    'https://colors.lupinum.com/' +
    encodeSharedPalette({
      v: 1,
      r: [
        committedPaletteName.value,
        saved.settings.seedColor,
        saved.settings.seedMode,
        saved.settings.anchor,
        saved.settings.gamut,
        saved.settings.huePath,
      ],
      b: paletteToTuple(saved.generated),
      p: paletteToTuple(saved.palette),
    })
  showToast(
    (await writeClipboard(link))
      ? 'Link copied. It opens this palette in Lupinum Colors. The palette lives in the link, not on a server.'
      : 'Copy was blocked by this browser.',
  )
}
onBeforeUnmount(() => clearTimeout(timer))
</script>
<template>
  <header class="bar">
    <div class="brand">
      <svg viewBox="0 0 64 64" aria-hidden="true">
        <rect width="64" height="64" rx="14" fill="#171717" />
        <path d="M15 15h34v8H15z" fill="#dbeafe" />
        <path d="M15 23h34v8H15z" fill="#60a5fa" />
        <path d="M15 31h34v8H15z" fill="#2563eb" />
        <path d="M15 39h34v10H15z" fill="#172554" /></svg
      ><span>Lupinum Colors</span>
    </div>
    <div class="source">
      <label class="pick" :style="{ background: anchorDisplay?.css }"
        ><input
          type="color"
          :value="pickerHex"
          aria-label="Pick your color"
          title="Pick a color"
          @input="pick"
      /></label>
      <div class="wb-inp src wb-mono" :data-invalid="!!generationError">
        <label class="wb-sr-only" for="seed">Your color</label
        ><input
          id="seed"
          class="wb-mono"
          :value="seedColor"
          spellcheck="false"
          autocomplete="off"
          :aria-invalid="!!generationError"
          :aria-describedby="generationError ? 'seed-error' : undefined"
          placeholder="#6f5bd6 or oklch(55% 0.18 286)"
          @input="input"
        />
      </div>
      <ColorUsePopover />
    </div>
    <div class="actions">
      <button
        class="wb-btn icon"
        :disabled="!canUndo"
        aria-label="Undo"
        title="Undo (⌘Z)"
        @click="undo"
      >
        <Undo2Icon class="wb-ic" /></button
      ><button
        class="wb-btn icon"
        :disabled="!canRedo"
        aria-label="Redo"
        title="Redo (⇧⌘Z)"
        @click="redo"
      >
        <Redo2Icon class="wb-ic" />
      </button>
      <button
        class="wb-btn icon"
        :aria-label="`Switch to ${isDark ? 'light' : 'dark'} mode`"
        :title="`Switch to ${isDark ? 'light' : 'dark'} mode`"
        @click="emit('toggleTheme')"
      >
        <SunIcon v-if="isDark" class="wb-ic" /><MoonIcon v-else class="wb-ic" />
      </button>
      <span class="sep wb-hide-sm"></span
      ><button
        class="wb-btn outline"
        aria-label="Copy link"
        title="Copy a link that opens this palette in Lupinum Colors"
        @click="copyLink"
      >
        <LinkIcon class="wb-ic" /><span class="wb-hide-sm">Copy link</span></button
      ><ExportMenu />
    </div>
  </header>
  <p v-if="generationError" id="seed-error" class="bar-msg" role="alert">
    <TriangleAlertIcon class="wb-ic" /><span
      >{{ generationError.replace(/\.$/, '') }}. The scale still shows the last valid color.</span
    >
  </p>
</template>

<style scoped>
.bar {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 56px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--wb-line);
  flex-wrap: wrap;
}
.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  font-weight: 600;
  letter-spacing: -0.01em;
  padding-inline: 4px 8px;
  white-space: nowrap;
}
.brand svg {
  width: 22px;
  height: 22px;
}
.source {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1 1 320px;
  min-width: 0;
  max-width: 560px;
}
.pick {
  position: relative;
  width: 32px;
  height: 32px;
  flex: none;
  border-radius: var(--wb-r-ctl);
  box-shadow: inset 0 0 0 1px oklch(0% 0 0 / 0.14);
  cursor: pointer;
}
.pick input {
  position: absolute;
  inset: 0;
  opacity: 0;
  width: 100%;
  height: 100%;
  cursor: pointer;
}
.pick:focus-within {
  outline: 2px solid var(--wb-focus);
  outline-offset: 2px;
}
.src {
  flex: 1 1 160px;
}
.use {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 8px 0 10px;
  border: 1px solid var(--wb-line);
  border-radius: var(--wb-r-ctl);
  background: var(--wb-sunken);
  color: var(--wb-fg-2);
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
}
.use:hover,
.use[aria-expanded='true'] {
  border-color: var(--wb-line-strong);
  color: var(--wb-fg);
}
.use .wb-ic {
  width: 14px;
  height: 14px;
}
.actions {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-left: auto;
}
.sep {
  width: 1px;
  height: 20px;
  background: var(--wb-line);
  margin-inline: 6px;
}
.bar-msg {
  display: flex;
  gap: 8px;
  align-items: flex-start;
  margin: 0;
  padding: 8px 16px;
  border-bottom: 1px solid var(--wb-line);
  background: color-mix(in oklch, var(--wb-bad) 8%, var(--wb-panel));
  color: var(--wb-fg);
  font-size: 13px;
}
.bar-msg .wb-ic {
  color: var(--wb-bad);
  margin-top: 1px;
}

@media (max-width: 880px) {
  .source {
    flex-basis: 100%;
    max-width: none;
    order: 2;
  }
}
@media (max-width: 640px) {
  .brand span {
    display: none;
  }
}
</style>
