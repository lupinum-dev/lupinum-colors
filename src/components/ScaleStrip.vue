<script setup lang="ts">
import { nextTick } from 'vue'
import { MapPinIcon, TriangleAlertIcon } from '@lucide/vue'
import { anchorShade, changedShades, committedPaletteName, displayShades, gamut, lastResult, nameIsValid, paletteName, selectedShade, selectShade, warnings } from '@/app/palette-store'
import type { DisplayShade } from '@/types'
const emit = defineEmits<{ hover: [index: number] }>()
function ink(e: DisplayShade): string { return e.contrastOnBlack >= e.contrastOnWhite ? '#000' : '#fff' }
function label(e: DisplayShade): string {
  const black = e.contrastOnBlack >= e.contrastOnWhite
  return `Shade ${e.shade}, ${e.hex ?? e.css}, ${black ? 'black' : 'white'} text ${(black ? e.contrastOnBlack : e.contrastOnWhite).toFixed(2)} to 1` + (e.shade === anchorShade.value ? ', your color' : '') + (changedShades.value.includes(e.shade) ? ', changed' : '') + (!e.inGamut ? `, mapped to ${gamut.value === 'srgb' ? 'sRGB' : 'Display P3'}` : '')
}
async function key(event: KeyboardEvent, index: number): Promise<void> {
  const direction = ['ArrowRight', 'ArrowDown'].includes(event.key) ? 1 : ['ArrowLeft', 'ArrowUp'].includes(event.key) ? -1 : 0
  const next = event.key === 'Home' ? 0 : event.key === 'End' ? 10 : direction ? Math.min(10, Math.max(0, index + direction)) : null
  if (next === null) return
  event.preventDefault(); const shade = displayShades.value[next]!.shade; selectShade(shade)
  await nextTick(); document.getElementById(`sw-${shade}`)?.focus()
}
</script>
<template>
  <section aria-label="Scale"><div class="wb-row">
    <div class="wb-gutter name-f"><label for="name">Name</label><input id="name" v-model="paletteName" spellcheck="false" autocomplete="off" :aria-invalid="!nameIsValid" :aria-describedby="nameIsValid ? 'name-hint' : 'name-error'" /><p v-if="nameIsValid" id="name-hint">Tokens use --color-{{ committedPaletteName }}-*</p><p v-else id="name-error" role="alert" style="color:var(--wb-bad)">Start with a letter; use letters, numbers or hyphens.</p></div>
    <div class="swatches" role="radiogroup" aria-label="Shades"><button v-for="(e,i) in displayShades" :id="`sw-${e.shade}`" :key="e.shade" class="sw" role="radio" :aria-checked="e.shade === selectedShade" :tabindex="e.shade === selectedShade ? 0 : -1" :style="{background:e.css,color:ink(e)}" :aria-label="label(e)" @click="selectShade(e.shade)" @keydown="key($event,i)" @mouseenter="emit('hover',i)" @mouseleave="emit('hover',-1)">
      <span class="sw-top"><b>{{ e.shade }}</b><span class="sw-icons"><span v-if="!e.inGamut" title="Mapped to the display range"><TriangleAlertIcon class="wb-ic" /></span><i v-if="changedShades.includes(e.shade)" class="wb-dot" title="Changed"></i></span></span>
      <span class="sw-bot"><span class="sw-hex">{{ e.hex ?? '' }}</span><span class="sw-aa">{{ Math.max(e.contrastOnBlack,e.contrastOnWhite) >= 7 ? 'AAA' : 'AA' }}<span class="sw-ratio">{{ Math.max(e.contrastOnBlack,e.contrastOnWhite).toFixed(1) }}</span></span></span>
    </button></div>
  </div><div class="wb-row"><div class="wb-gutter"></div><div class="marks" aria-hidden="true"><span v-for="e in displayShades" :key="e.shade" class="mark"><template v-if="e.shade === anchorShade"><MapPinIcon class="wb-ic" />{{ lastResult?.configuration.seed === 'exact' ? 'Your color' : 'Fitted' }}</template></span></div></div>
  <div v-if="warnings.length" class="wb-row"><div class="wb-gutter"></div><div class="notice" role="status"><TriangleAlertIcon class="wb-ic" /><ul><li v-for="w in warnings" :key="w">{{ w }}</li></ul></div></div></section>
</template>

<style scoped>

.name-f { display: grid; gap: 4px; align-content: start; }
.name-f label { font-size: 12px; color: var(--wb-fg-3); }
.name-f input { width: 100%; height: 30px; padding: 0 8px; border: 1px solid transparent; border-radius: 6px; background: var(--wb-sunken); font-weight: 600; font-size: 14px; outline: none; }
.name-f input:hover { border-color: var(--wb-line); }
.name-f input:focus { border-color: var(--wb-focus); box-shadow: 0 0 0 3px color-mix(in oklch, var(--wb-focus) 22%, transparent); background: var(--wb-panel); }
.name-f input[aria-invalid="true"] { border-color: var(--wb-bad); }
.name-f p { margin: 0; font-size: 11.5px; color: var(--wb-fg-3); overflow-wrap: anywhere; }

/* Scale strip */
.swatches { display: grid; grid-template-columns: repeat(11, minmax(0, 1fr)); border-radius: 10px; container-type: inline-size; }
@container (max-width: 760px) { .sw-hex, .sw-ratio { display: none; } }
.sw { position: relative; display: flex; flex-direction: column; justify-content: space-between; height: 120px; padding: 8px; border: 0; text-align: left; font-size: 12px; transition: transform 140ms cubic-bezier(.16,1,.3,1), box-shadow 140ms; }
.sw:first-child { border-radius: 10px 0 0 10px; }
.sw:last-child { border-radius: 0 10px 10px 0; }
.sw:hover { z-index: 1; }
.sw[aria-checked="true"] { z-index: 2; border-radius: 8px; transform: scale(1.04, 1.06); box-shadow: 0 0 0 2px var(--wb-panel), 0 0 0 3.5px var(--wb-fg), 0 10px 20px -8px oklch(0% 0 0 / 0.4); }
.sw:focus-visible { outline: none; box-shadow: 0 0 0 2px var(--wb-panel), 0 0 0 4px var(--wb-focus); z-index: 3; }
.sw-top { display: flex; align-items: center; justify-content: space-between; gap: 4px; }
.sw-top b { font-weight: 650; font-size: 13px; font-variant-numeric: tabular-nums; }
.sw-icons { display: flex; align-items: center; gap: 3px; }
.sw-icons .wb-ic { width: 13px; height: 13px; }
.wb-dot { width: 7px; height: 7px; border-radius: 99px; background: currentColor; display: inline-block; }
.sw-bot { display: grid; gap: 1px; }
.sw-hex { font: 11px/1.3 var(--wb-mono); opacity: .82; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sw-aa { font-size: 11px; font-weight: 600; font-variant-numeric: tabular-nums; white-space: nowrap; }
.sw-ratio { margin-left: 4px; }
.marks { display: grid; grid-template-columns: repeat(11, minmax(0, 1fr)); height: 18px; margin-top: 6px; }
.mark { display: flex; justify-content: center; align-items: flex-start; font-size: 11px; font-weight: 500; color: var(--wb-fg-2); white-space: nowrap; }
.mark .wb-ic { width: 12px; height: 12px; margin-right: 3px; margin-top: 1px; }
.notice { display: flex; gap: 10px; align-items: flex-start; margin-top: 8px; padding: 10px 12px; border-radius: var(--wb-r-ctl); background: color-mix(in oklch, var(--wb-warn) 10%, var(--wb-panel)); border: 1px solid color-mix(in oklch, var(--wb-warn) 35%, var(--wb-line)); }
.notice .wb-ic { color: var(--wb-warn); margin-top: 1px; }
.notice ul { margin: 0; padding: 0; list-style: none; display: grid; gap: 4px; }

@media(max-width:640px) { .name-f { grid-template-columns:auto minmax(0,1fr); align-items:center; gap:4px 8px; margin-bottom:8px; } .name-f p {grid-column:1/-1;} .sw {height:84px;padding:6px 3px;align-items:center;} .sw-top b {font-size:11px;} .sw-icons,.sw-hex,.sw-aa {display:none;} .mark {font-size:10px;} .mark .wb-ic {display:none;} }
</style>
