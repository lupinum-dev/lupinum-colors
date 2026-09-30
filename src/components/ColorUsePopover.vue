<script setup lang="ts">
import { computed } from 'vue'
import SegmentedChoice from './SegmentedChoice.vue'
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
  updateGeneration,
  type GenerationSettings,
} from '@/app/palette-store'
import { showRegenerationToast } from '@/app/toast'
const placementOptions = computed(() => [
  { value: 'auto' as const, label: 'Auto' },
  ...displayShades.value.map((e) => ({
    value: e.shade,
    label: e.shade === anchorShade.value ? '●' : '',
    ariaLabel: `Shade ${e.shade}`,
    style: { background: e.css, color: e.contrastOnBlack >= e.contrastOnWhite ? '#000' : '#fff' },
  })),
])
function returnFocus(): void {
  requestAnimationFrame(() => document.querySelector<HTMLButtonElement>('.use')?.focus())
}
function update(patch: Partial<GenerationSettings>): void {
  const outcome = updateGeneration(patch)
  if (outcome.ok && outcome.replaced) showRegenerationToast(outcome.replaced)
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
            <SegmentedChoice
              :model-value="seedMode"
              :options="[
                { value: 'exact', label: 'Keep it exact' },
                { value: 'canonical', label: 'Fit to Tailwind' },
              ]"
              aria-label="Color matching"
              full
              @update:model-value="update({ seedMode: $event })"
            />
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
            <SegmentedChoice
              class="place"
              :model-value="anchor"
              :options="placementOptions"
              aria-labelledby="place-label"
              @update:model-value="update({ anchor: $event })"
            />
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
            <SegmentedChoice
              :model-value="huePath"
              :options="
                hueDriftOptions.map((option) => ({
                  value: option,
                  label: option === 'balanced' ? 'Balanced' : `Like ${option}`,
                }))
              "
              aria-labelledby="hue-label"
              full
              @update:model-value="update({ huePath: $event })"
            />
          </div>
          <div class="wb-ctl">
            <span id="gamut-label" class="wb-cl">Display range</span>
            <SegmentedChoice
              :model-value="gamut"
              :options="[
                { value: 'srgb', label: 'sRGB' },
                { value: 'display-p3', label: 'Display P3' },
                { value: 'none', label: 'No limit' },
              ]"
              aria-labelledby="gamut-label"
              full
              @update:model-value="update({ gamut: $event })"
            />
          </div></div></PopoverContent
    ></PopoverPortal>
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
