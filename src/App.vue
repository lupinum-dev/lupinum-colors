<script setup lang="ts">
import { computed, ref } from 'vue'
import { CHANNEL_MODES, type ChannelMode } from '@/app/channels'
import { formatExport, type ExportFormat } from '@/app/format'
import {
  anchor,
  channelMode,
  displayShades,
  gamut,
  generate,
  generationError,
  ghostFamilyName,
  hiddenChannels,
  huePath,
  huePathOptions,
  lastResult,
  paletteName,
  referenceFamilies,
  resetToGenerated,
  seedColor,
  seedMode,
  selectedShade,
  setShadeColor,
  shades,
  toggleChannel,
  warnings,
} from '@/app/palette-store'
import PaletteEditor from '@/components/PaletteEditor.vue'
import { SHADE_NAMES, formatOklch } from '@/index'

const MODES: ChannelMode[] = ['oklch', 'hsv', 'hsl']

if (!lastResult.value) generate()

const selectedEntry = computed(() =>
  displayShades.value.find((entry) => entry.shade === selectedShade.value),
)

function channelInput(event: Event, set: (value: number) => void): void {
  const value = Number((event.target as HTMLInputElement).value)
  if (Number.isFinite(value)) set(value)
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
</script>

<template>
  <main class="page">
    <header class="bar">
      <h1>Tailwind OKLCH Palette</h1>
      <div class="field">
        <label for="name">Name</label>
        <input id="name" v-model="paletteName" spellcheck="false" />
      </div>
      <div class="field grow">
        <label for="seed">Seed color</label>
        <div class="seed">
          <span
            class="seed-preview"
            :style="{ background: displayShades[5]?.css ?? seedColor }"
          ></span>
          <input
            id="seed"
            v-model="seedColor"
            spellcheck="false"
            placeholder="#16661f, oklch(62% 0.19 245), …"
            @keydown.enter="generate"
          />
        </div>
      </div>
      <div class="field">
        <label for="seed-mode">Seed</label>
        <select id="seed-mode" v-model="seedMode">
          <option value="exact">exact</option>
          <option value="canonical">canonical</option>
        </select>
      </div>
      <div class="field">
        <label for="anchor">Anchor</label>
        <select id="anchor" v-model="anchor">
          <option value="auto">auto</option>
          <option v-for="shade in SHADE_NAMES" :key="shade" :value="shade">
            {{ shade }}
          </option>
        </select>
      </div>
      <div class="field">
        <label for="hue-path">Hue path</label>
        <select id="hue-path" v-model="huePath">
          <option v-for="option in huePathOptions" :key="option" :value="option">
            {{ option }}
          </option>
        </select>
      </div>
      <div class="field">
        <label for="gamut">Gamut</label>
        <select id="gamut" v-model="gamut">
          <option value="srgb">srgb</option>
          <option value="display-p3">display-p3</option>
          <option value="none">none</option>
        </select>
      </div>
      <button type="button" class="primary" @click="generate">Generate</button>
      <button type="button" @click="resetToGenerated">Reset edits</button>
    </header>

    <p v-if="generationError" class="error">{{ generationError }}</p>

    <div class="bar secondary">
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
      <div class="chips" role="group" aria-label="Visible channels">
        <button
          v-for="channel in CHANNEL_MODES[channelMode]"
          :key="channel.key"
          type="button"
          class="chip"
          :class="{ active: !hiddenChannels.includes(channel.key) }"
          @click="toggleChannel(channel.key)"
        >
          {{ channel.label }}
        </button>
      </div>
      <div class="field">
        <label for="ghost">Tailwind overlay</label>
        <select id="ghost" v-model="ghostFamilyName">
          <option value="none">none</option>
          <option v-for="family in referenceFamilies" :key="family.name" :value="family.name">
            {{ family.name }}
          </option>
        </select>
      </div>
      <span v-if="lastResult" class="meta">
        {{ lastResult.reference.kind }} · anchor {{ lastResult.configuration.anchor
        }}{{ lastResult.configuration.anchorWasInferred ? ' (auto)' : '' }} · between
        {{ lastResult.reference.neighbors.join(' and ') }}
      </span>
    </div>

    <PaletteEditor />

    <ul v-if="warnings.length" class="warnings">
      <li v-for="warning in warnings" :key="warning">{{ warning }}</li>
    </ul>

    <section v-if="selectedEntry && shades" class="panel">
      <h2>Shade {{ selectedEntry.shade }}</h2>
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
              channelInput($event, (value) =>
                setShadeColor(
                  selectedEntry!.shade,
                  channel.set(shades![selectedEntry!.shade], value),
                ),
              )
            "
          />
        </div>
        <code>{{ selectedEntry.hex }}</code>
        <code>{{ formatOklch(selectedEntry.raw) }}</code>
        <span class="meta">
          on white {{ selectedEntry.contrastOnWhite.toFixed(2) }} ({{
            contrastBadge(selectedEntry.contrastOnWhite)
          }}) · on black {{ selectedEntry.contrastOnBlack.toFixed(2) }} ({{
            contrastBadge(selectedEntry.contrastOnBlack)
          }})
          <template v-if="!selectedEntry.inGamut"> · gamut-mapped</template>
        </span>
      </div>
    </section>

    <section class="panel">
      <div class="export-head">
        <h2>Export</h2>
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
        <button type="button" @click="copyExport">
          {{ copied ? 'Copied' : 'Copy' }}
        </button>
      </div>
      <pre>{{ exportText }}</pre>
    </section>
  </main>
</template>

<style>
* {
  box-sizing: border-box;
}

body {
  margin: 0;
  background: #17181c;
  color: #e6e6e9;
  font-family:
    ui-sans-serif,
    system-ui,
    -apple-system,
    sans-serif;
  font-size: 14px;
}
</style>

<style scoped>
.page {
  max-width: 1280px;
  margin: 0 auto;
  padding: 20px 24px 48px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

h1 {
  font-size: 16px;
  margin: 0 12px 0 0;
}

h2 {
  font-size: 13px;
  margin: 0;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #9a9aa3;
}

.bar {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 10px;
}

.bar.secondary {
  align-items: center;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.field.grow {
  flex: 1;
  min-width: 220px;
}

label {
  font-size: 11px;
  color: #9a9aa3;
}

input,
select,
button {
  font: inherit;
  color: inherit;
  background: #23242a;
  border: 1px solid #34353d;
  border-radius: 7px;
  padding: 6px 9px;
}

button {
  cursor: pointer;
}

button:hover {
  border-color: #4a4b55;
}

button.primary {
  background: #3563e9;
  border-color: #3563e9;
  font-weight: 600;
}

.seed {
  display: flex;
  align-items: center;
  gap: 6px;
}

.seed input {
  flex: 1;
}

.seed-preview {
  width: 28px;
  height: 28px;
  border-radius: 7px;
  border: 1px solid #34353d;
}

.chips {
  display: flex;
  gap: 4px;
}

.chip {
  padding: 5px 10px;
  border-radius: 999px;
  font-size: 12px;
  opacity: 0.6;
}

.chip.active {
  opacity: 1;
  border-color: #6b8afd;
  color: #aebffd;
}

.meta {
  font-size: 12px;
  color: #9a9aa3;
}

.error {
  margin: 0;
  color: #ff8080;
}

.warnings {
  margin: 0;
  padding: 10px 14px 10px 30px;
  background: #2a2417;
  border: 1px solid #4d4023;
  border-radius: 8px;
  color: #e8c675;
  font-size: 13px;
}

.panel {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px;
  background: #1d1e23;
  border: 1px solid #2a2b31;
  border-radius: 10px;
}

.details {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 12px;
}

.details input[type='number'] {
  width: 90px;
}

code {
  font-family: ui-monospace, monospace;
  font-size: 13px;
  background: #23242a;
  padding: 6px 9px;
  border-radius: 7px;
}

.export-head {
  display: flex;
  align-items: center;
  gap: 12px;
}

pre {
  margin: 0;
  padding: 12px;
  background: #141518;
  border-radius: 8px;
  font-family: ui-monospace, monospace;
  font-size: 12.5px;
  line-height: 1.55;
  overflow-x: auto;
}
</style>
