<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { CHANNEL_MODES, type ChannelMode } from '@/app/channels'
import { formatExport, type ExportFormat } from '@/app/format'
import {
  anchor,
  baselineVisible,
  beginContinuousEdit,
  canRedo,
  canUndo,
  channelMode,
  displayShades,
  effectiveShades,
  endContinuousEdit,
  gamut,
  generate,
  generationError,
  hiddenChannels,
  huePath,
  huePathOptions,
  lastResult,
  paletteName,
  redo,
  resetToGenerated,
  seedColor,
  seedMode,
  selectedShade,
  setShadeColor,
  toggleChannel,
  undo,
  warnings,
} from '@/app/palette-store'
import PaletteEditor from '@/components/PaletteEditor.vue'
import PaletteInspector from '@/components/PaletteInspector.vue'
import { SHADE_NAMES, formatOklch } from '@/index'

const MODES: ChannelMode[] = ['oklch', 'hsv', 'hsl']

if (!lastResult.value) generate()

const selectedEntry = computed(() =>
  displayShades.value.find((entry) => entry.shade === selectedShade.value),
)

function channelInput(event: Event, channelLabel: string, set: (value: number) => void): void {
  const value = Number((event.target as HTMLInputElement).value)
  if (!Number.isFinite(value)) return
  beginContinuousEdit()
  set(value)
  endContinuousEdit(`Set ${channelLabel} at ${selectedShade.value}`)
}

const exportFormat = ref<ExportFormat>('tailwind')
const exportText = computed(() =>
  formatExport(exportFormat.value, paletteName.value, displayShades.value),
)
const copied = ref(false)

async function copyExport(): Promise<void> {
  await navigator.clipboard.writeText(exportText.value)
  copied.value = true
  setTimeout(() => (copied.value = false), 1200)
}

function contrastBadge(ratio: number): string {
  if (ratio >= 7) return 'AAA'
  if (ratio >= 4.5) return 'AA'
  if (ratio >= 3) return 'AA-lg'
  return '—'
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return Boolean(
    target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])'),
  )
}

function onHistoryShortcut(event: KeyboardEvent): void {
  if (!(event.ctrlKey || event.metaKey) || event.altKey || isEditableTarget(event.target)) return

  const key = event.key.toLowerCase()
  const wantsUndo = key === 'z' && !event.shiftKey
  const wantsRedo = (key === 'z' && event.shiftKey) || key === 'y'
  if (
    (!wantsUndo && !wantsRedo) ||
    (wantsUndo && !canUndo.value) ||
    (wantsRedo && !canRedo.value)
  ) {
    return
  }

  event.preventDefault()
  if (wantsRedo) redo()
  else undo()
}

onMounted(() => window.addEventListener('keydown', onHistoryShortcut))
onBeforeUnmount(() => window.removeEventListener('keydown', onHistoryShortcut))
</script>

<template>
  <main class="page">
    <header class="masthead">
      <div class="title-block">
        <span class="eyebrow">OKLCH / PALETTE LAB</span>
        <h1>Tailwind shade generator</h1>
      </div>
      <div class="history-actions">
        <button
          type="button"
          :disabled="!canUndo"
          title="Undo (Ctrl/⌘ Z)"
          aria-keyshortcuts="Control+Z Meta+Z"
          @click="undo"
        >
          ↶ Undo <kbd>Ctrl/⌘ Z</kbd>
        </button>
        <button
          type="button"
          :disabled="!canRedo"
          title="Redo (Ctrl/⌘ Shift+Z or Ctrl/⌘ Y)"
          aria-keyshortcuts="Control+Shift+Z Meta+Shift+Z Control+Y Meta+Y"
          @click="redo"
        >
          ↷ Redo <kbd>⇧ Ctrl/⌘ Z</kbd>
        </button>
        <button type="button" @click="resetToGenerated">Reset</button>
      </div>
    </header>

    <section class="generation-bar" aria-label="Palette generation">
      <div class="field name-field">
        <label for="name">Token name</label>
        <input id="name" v-model="paletteName" spellcheck="false" />
      </div>
      <div class="field seed-field">
        <label for="seed">Seed color · hex, rgb, hsl or oklch</label>
        <div class="seed">
          <span
            class="seed-preview"
            :style="{ background: displayShades[5]?.css ?? seedColor }"
          ></span>
          <input
            id="seed"
            v-model="seedColor"
            spellcheck="false"
            placeholder="#89E5D2 or oklch(86% 0.08 174)"
            @keydown.enter="generate"
          />
        </div>
      </div>
      <div class="field compact-field">
        <label for="seed-mode">Seed behavior</label>
        <select id="seed-mode" v-model="seedMode">
          <option value="exact">preserve exact</option>
          <option value="canonical">fit canonical</option>
        </select>
      </div>
      <div class="field compact-field">
        <label for="anchor">Anchor shade</label>
        <select id="anchor" v-model="anchor">
          <option value="auto">auto</option>
          <option v-for="shade in SHADE_NAMES" :key="shade" :value="shade">{{ shade }}</option>
        </select>
      </div>
      <div class="field compact-field">
        <label for="hue-path">Hue path</label>
        <select id="hue-path" v-model="huePath">
          <option v-for="option in huePathOptions" :key="option" :value="option">
            {{ option }}
          </option>
        </select>
      </div>
      <div class="field compact-field">
        <label for="gamut">Output gamut</label>
        <select id="gamut" v-model="gamut">
          <option value="srgb">sRGB</option>
          <option value="display-p3">Display P3</option>
          <option value="none">Unbounded</option>
        </select>
      </div>
      <button type="button" class="primary generate" @click="generate">Generate</button>
    </section>

    <p v-if="generationError" class="error" role="alert">{{ generationError }}</p>

    <div class="view-bar">
      <div class="chips" role="group" aria-label="Channel mode">
        <button
          v-for="mode in MODES"
          :key="mode"
          type="button"
          class="chip"
          :class="{ active: channelMode === mode }"
          @click="channelMode = mode"
        >
          {{ mode.toUpperCase() }}
        </button>
      </div>
      <div class="channel-toggles" role="group" aria-label="Visible channels">
        <button
          v-for="channel in CHANNEL_MODES[channelMode]"
          :key="channel.key"
          type="button"
          :class="{
            active: !hiddenChannels.includes(channel.key),
            [`channel-${channel.key}`]: true,
          }"
          @click="toggleChannel(channel.key)"
        >
          <span></span>{{ channel.label }}
        </button>
      </div>
      <label class="baseline-toggle">
        <input v-model="baselineVisible" type="checkbox" /> Generated baseline
      </label>
      <span v-if="lastResult" class="meta result-meta">
        {{ lastResult.reference.kind }} · anchor {{ lastResult.configuration.anchor
        }}{{ lastResult.configuration.anchorWasInferred ? ' auto' : '' }} ·
        {{ lastResult.reference.neighbors.join(' ↔ ') }}
      </span>
    </div>

    <div class="workspace">
      <div class="canvas-column">
        <PaletteEditor />
        <p class="gesture-hint">
          Drag a point to edit one shade · ⇧-drag to scale its region (scroll sets the radius) ·
          arrow keys nudge the focused point
        </p>

        <ul v-if="warnings.length" class="warnings">
          <li v-for="warning in warnings" :key="warning">{{ warning }}</li>
        </ul>

        <section v-if="selectedEntry && effectiveShades" class="panel selected-panel">
          <div class="panel-heading">
            <div>
              <span class="eyebrow">SELECTED SHADE</span>
              <h2>{{ paletteName }}-{{ selectedEntry.shade }}</h2>
            </div>
            <div class="value-pair">
              <code>{{ selectedEntry.hex }}</code
              ><code>{{ formatOklch(selectedEntry.raw) }}</code>
            </div>
          </div>
          <div class="details">
            <div v-for="channel in CHANNEL_MODES[channelMode]" :key="channel.key" class="field">
              <label :for="`channel-${channel.key}`">{{ channel.label }}</label>
              <input
                :id="`channel-${channel.key}`"
                type="number"
                :min="channel.min"
                :max="channel.max"
                :step="channel.step"
                :value="Number(channel.get(selectedEntry.raw).toFixed(4))"
                @change="
                  channelInput($event, channel.label, (value) =>
                    setShadeColor(
                      selectedEntry!.shade,
                      channel.set(effectiveShades![selectedEntry!.shade], value),
                    ),
                  )
                "
              />
            </div>
            <div class="contrast">
              <span
                >WHITE <b>{{ selectedEntry.contrastOnWhite.toFixed(2) }}</b>
                {{ contrastBadge(selectedEntry.contrastOnWhite) }}</span
              >
              <span
                >BLACK <b>{{ selectedEntry.contrastOnBlack.toFixed(2) }}</b>
                {{ contrastBadge(selectedEntry.contrastOnBlack) }}</span
              >
              <span v-if="!selectedEntry.inGamut" class="mapped">GAMUT-MAPPED</span>
            </div>
          </div>
        </section>
      </div>

      <PaletteInspector />
    </div>

    <section class="panel export-panel">
      <div class="export-head">
        <div>
          <span class="eyebrow">OUTPUT</span>
          <h2>Production tokens</h2>
        </div>
        <div class="chips">
          <button
            v-for="format in ['tailwind', 'css', 'json'] as const"
            :key="format"
            type="button"
            class="chip"
            :class="{ active: exportFormat === format }"
            @click="exportFormat = format"
          >
            {{ format }}
          </button>
        </div>
        <button type="button" @click="copyExport">{{ copied ? 'Copied' : 'Copy output' }}</button>
      </div>
      <pre>{{ exportText }}</pre>
    </section>
  </main>
</template>

<style>
:root {
  color-scheme: dark;
}
* {
  box-sizing: border-box;
}
body {
  margin: 0;
  background: #15161a;
  color: #e6e7eb;
  font-family:
    Inter,
    ui-sans-serif,
    system-ui,
    -apple-system,
    sans-serif;
  font-size: 13px;
  font-variant-numeric: tabular-nums;
}
button,
input,
select {
  font: inherit;
  color: inherit;
}
input,
select,
button {
  min-height: 31px;
  padding: 6px 9px;
  border: 1px solid #34363f;
  border-radius: 6px;
  background: #23242a;
}
button {
  cursor: pointer;
}
button:hover:not(:disabled) {
  border-color: #555965;
  background: #292b32;
}
button:focus-visible,
input:focus-visible,
select:focus-visible {
  outline: 2px solid #7895ff;
  outline-offset: 2px;
}
button:disabled {
  cursor: not-allowed;
  opacity: 0.38;
}
button.primary {
  border-color: #5979ef;
  background: #5979ef;
  color: #fff;
  font-weight: 650;
}
button.primary:hover:not(:disabled) {
  border-color: #7390fa;
  background: #6684f2;
}
</style>

<style scoped>
.page {
  max-width: 1560px;
  margin: 0 auto;
  padding: 20px 24px 52px;
  display: flex;
  flex-direction: column;
  gap: 13px;
}
.masthead,
.generation-bar,
.view-bar,
.panel-heading,
.export-head {
  display: flex;
  align-items: center;
}
.masthead {
  justify-content: space-between;
}
.title-block h1 {
  margin: 3px 0 0;
  font-size: 20px;
  font-weight: 620;
  letter-spacing: -0.02em;
}
.eyebrow {
  color: #777b86;
  font:
    9px ui-monospace,
    monospace;
  letter-spacing: 0.13em;
}
.history-actions {
  display: flex;
  gap: 6px;
}
.history-actions kbd {
  margin-left: 5px;
  color: #8f929d;
  font:
    9px ui-monospace,
    monospace;
}
.generation-bar {
  align-items: flex-end;
  gap: 8px;
  padding: 12px;
  border: 1px solid #292b32;
  border-radius: 9px;
  background: #1a1b20;
}
.field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.field label {
  color: #91949f;
  font-size: 10.5px;
}
.name-field {
  width: 112px;
}
.seed-field {
  flex: 1;
  min-width: 250px;
}
.compact-field {
  min-width: 118px;
}
.seed {
  display: flex;
  align-items: center;
  gap: 6px;
}
.seed input {
  width: 100%;
}
.seed-preview {
  width: 31px;
  height: 31px;
  flex: 0 0 auto;
  border: 1px solid #40424a;
  border-radius: 5px;
}
.generate {
  min-width: 92px;
}
.view-bar {
  min-height: 38px;
  gap: 14px;
}
.chips,
.channel-toggles {
  display: flex;
  gap: 4px;
}
.chip {
  min-height: 27px;
  padding: 4px 9px;
  border-radius: 999px;
  color: #92959f;
  font-size: 10.5px;
  text-transform: uppercase;
}
.chip.active {
  border-color: #586b9e;
  background: #283048;
  color: #cbd6ff;
}
.channel-toggles button {
  display: flex;
  align-items: center;
  gap: 5px;
  min-height: 27px;
  padding: 4px 8px;
  color: #727681;
  font-size: 11px;
}
.channel-toggles button span {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #555;
}
.channel-toggles button.active {
  color: #dddfe4;
}
.channel-toggles .channel-h span {
  background: #f291d1;
}
.channel-toggles .channel-c span,
.channel-toggles .channel-s span {
  background: #ffc167;
}
.channel-toggles .channel-l span,
.channel-toggles .channel-v span {
  background: #69d7ff;
}
.baseline-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #9699a3;
  font-size: 11px;
  white-space: nowrap;
}
.result-meta {
  margin-left: auto;
}
.meta {
  color: #858994;
  font-size: 10.5px;
  font-family: ui-monospace, monospace;
}
.gesture-hint {
  margin: -6px 0 0;
  color: #6f7380;
  font-size: 10.5px;
}
.workspace {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 360px;
  gap: 13px;
  align-items: start;
}
.canvas-column {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 12px;
}
.panel {
  padding: 14px;
  border: 1px solid #2a2c33;
  border-radius: 9px;
  background: #1b1c21;
}
.panel h2 {
  margin: 3px 0 0;
  font-size: 14px;
  font-weight: 620;
}
.panel-heading {
  justify-content: space-between;
  gap: 18px;
}
.value-pair {
  display: flex;
  gap: 7px;
}
code {
  padding: 6px 8px;
  border: 1px solid #30323a;
  border-radius: 5px;
  background: #202127;
  color: #d7d9df;
  font:
    11px ui-monospace,
    monospace;
}
.details {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 10px;
  margin-top: 12px;
}
.details input[type='number'] {
  width: 92px;
}
.contrast {
  display: flex;
  gap: 7px;
  margin-left: auto;
}
.contrast span {
  padding: 7px 8px;
  border: 1px solid #30323a;
  color: #9396a1;
  font:
    9.5px ui-monospace,
    monospace;
}
.contrast b {
  margin-left: 5px;
  color: #e6e7eb;
}
.contrast .mapped {
  color: #ebbd70;
}
.warnings {
  margin: 0;
  padding: 9px 12px 9px 30px;
  border: 1px solid #514325;
  background: #292318;
  color: #e0be72;
  font-size: 11px;
}
.error {
  margin: 0;
  padding: 8px 10px;
  border: 1px solid #6c3439;
  background: #2d1d20;
  color: #ff9da5;
}
.export-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.export-head {
  gap: 12px;
}
.export-head .chips {
  margin-left: auto;
}
pre {
  max-height: 420px;
  margin: 0;
  padding: 14px;
  overflow: auto;
  border: 1px solid #262830;
  background: #121317;
  color: #d8dae1;
  font:
    12px/1.55 ui-monospace,
    monospace;
}

@media (max-width: 1180px) {
  .generation-bar {
    flex-wrap: wrap;
  }
  .workspace {
    grid-template-columns: 1fr;
  }
}
@media (max-width: 720px) {
  .page {
    padding: 14px 12px 36px;
  }
  .masthead,
  .view-bar,
  .panel-heading,
  .export-head {
    align-items: flex-start;
    flex-wrap: wrap;
  }
  .result-meta {
    width: 100%;
    margin-left: 0;
  }
  .generation-bar > .field {
    width: calc(50% - 4px);
    min-width: 0;
  }
  .generation-bar .seed-field {
    width: 100%;
  }
  .value-pair,
  .contrast {
    width: 100%;
    margin-left: 0;
    overflow-x: auto;
  }
}
</style>
