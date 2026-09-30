<script setup lang="ts">
import { ChevronDownIcon } from '@lucide/vue'
import { PopoverRoot, PopoverTrigger, PopoverPortal, PopoverContent } from 'reka-ui'
import {
  anchor,
  anchorShade,
  displayShades,
  gamut,
  hueDriftOptions,
  huePath,
  lastResult,
  seedMode,
  undo,
  updateGeneration,
  type GenerationSettings,
} from '@/app/palette-store'
import { showToast } from '@/app/toast'
function returnFocus(): void {
  requestAnimationFrame(() => document.querySelector<HTMLButtonElement>('.use')?.focus())
}
function update(patch: Partial<GenerationSettings>): void {
  const outcome = updateGeneration(patch)
  if (outcome.ok && outcome.replaced)
    showToast(
      `New scale generated. ${outcome.replaced} changed ${outcome.replaced === 1 ? 'shade was' : 'shades were'} replaced.`,
      { label: 'Undo', run: undo },
    )
}
</script>
<template>
  <PopoverRoot>
    <PopoverTrigger class="use" title="How your color is used" aria-haspopup="dialog"
      >{{ lastResult?.configuration.seed === 'exact' ? 'Exact' : 'Fitted' }} at {{ anchorShade
      }}<ChevronDownIcon class="wb-ic"
    /></PopoverTrigger>
    <PopoverPortal
      ><PopoverContent
        align="start"
        :side-offset="8"
        @close-auto-focus.prevent="returnFocus"
        as-child
      >
        <div class="pop" aria-labelledby="color-use-title">
          <h3 id="color-use-title">How your color is used</h3>
          <div class="wb-ctl">
            <div class="wb-seg full" role="radiogroup" aria-label="Color matching">
              <button
                role="radio"
                :aria-checked="seedMode === 'exact'"
                @click="update({ seedMode: 'exact' })"
              >
                Keep it exact
              </button>
              <button
                role="radio"
                :aria-checked="seedMode === 'canonical'"
                @click="update({ seedMode: 'canonical' })"
              >
                Fit to Tailwind
              </button>
            </div>
            <p class="wb-help">
              {{
                seedMode === 'exact'
                  ? `Your color appears unchanged as shade ${anchorShade}.`
                  : `Your color is moved onto Tailwind’s own curve for shade ${anchorShade}.`
              }}
            </p>
          </div>
          <div class="wb-ctl">
            <span id="place-label" class="wb-cl">Place it at</span>
            <div class="place" role="radiogroup" aria-labelledby="place-label">
              <button
                class="auto"
                role="radio"
                :aria-checked="anchor === 'auto'"
                @click="update({ anchor: 'auto' })"
              >
                Auto
              </button>
              <button
                v-for="e in displayShades"
                :key="e.shade"
                role="radio"
                :aria-checked="anchor === e.shade"
                :aria-label="`Shade ${e.shade}`"
                :style="{
                  background: e.css,
                  color: e.contrastOnBlack >= e.contrastOnWhite ? '#000' : '#fff',
                }"
                @click="update({ anchor: e.shade })"
              >
                {{ e.shade === anchorShade ? '●' : '' }}
              </button>
            </div>
            <p class="wb-help">
              {{
                anchor === 'auto'
                  ? `Auto picked ${anchorShade}, the shade your color resembles most.`
                  : `Placed at ${anchor} by you.`
              }}
            </p>
          </div>
          <div v-if="hueDriftOptions.length > 1" class="wb-ctl">
            <span id="hue-label" class="wb-cl">Hue drift across the scale</span>
            <div class="wb-seg full" role="radiogroup" aria-labelledby="hue-label">
              <button
                v-for="option in hueDriftOptions"
                :key="option"
                role="radio"
                :aria-checked="huePath === option"
                @click="update({ huePath: option })"
              >
                {{ option === 'balanced' ? 'Balanced' : `Like ${option}` }}
              </button>
            </div>
          </div>
          <div class="wb-ctl">
            <span id="gamut-label" class="wb-cl">Display range</span>
            <div class="wb-seg full" role="radiogroup" aria-labelledby="gamut-label">
              <button
                role="radio"
                :aria-checked="gamut === 'srgb'"
                @click="update({ gamut: 'srgb' })"
              >
                sRGB
              </button>
              <button
                role="radio"
                :aria-checked="gamut === 'display-p3'"
                @click="update({ gamut: 'display-p3' })"
              >
                Display P3
              </button>
              <button
                role="radio"
                :aria-checked="gamut === 'none'"
                @click="update({ gamut: 'none' })"
              >
                No limit
              </button>
            </div>
          </div>
        </div></PopoverContent
      ></PopoverPortal
    >
  </PopoverRoot>
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
.pop {
  position: relative;
  width: min(420px, calc(100vw - 24px));
  color: var(--wb-fg);
  font: 400 13px/1.45 var(--wb-font);
}
</style>
