<script setup lang="ts">
import type { TonalScope } from '@/app/palette-tools'
import { SHADE_NAMES, type Shade } from '@/types'

defineProps<{
  scope: TonalScope
  from: Shade
  to: Shade
  feather: number
}>()

const emit = defineEmits<{
  'update:scope': [value: TonalScope]
  'update:from': [value: Shade]
  'update:to': [value: Shade]
  'update:feather': [value: number]
}>()

function selectValue(event: Event): string {
  return (event.target as HTMLSelectElement).value
}
</script>

<template>
  <div class="scope-controls">
    <label>
      Scope
      <select :value="scope" @change="emit('update:scope', selectValue($event) as TonalScope)">
        <option value="all">all shades</option>
        <option value="lights">lights · 50–300</option>
        <option value="middle">middle · 400–600</option>
        <option value="darks">darks · 700–950</option>
        <option value="custom">custom</option>
      </select>
    </label>
    <div v-if="scope === 'custom'" class="split">
      <label>
        From
        <select :value="from" @change="emit('update:from', Number(selectValue($event)) as Shade)">
          <option v-for="shade in SHADE_NAMES" :key="shade" :value="shade">{{ shade }}</option>
        </select>
      </label>
      <label>
        To
        <select :value="to" @change="emit('update:to', Number(selectValue($event)) as Shade)">
          <option v-for="shade in SHADE_NAMES" :key="shade" :value="shade">{{ shade }}</option>
        </select>
      </label>
    </div>
    <label>
      Edge feather <output>{{ feather }}</output>
      <input
        :value="feather"
        type="range"
        min="0"
        max="3"
        step="1"
        @input="emit('update:feather', Number(($event.target as HTMLInputElement).value))"
      />
    </label>
  </div>
</template>

<style scoped>
.scope-controls {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.split {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
label {
  display: flex;
  flex-direction: column;
  gap: 5px;
  color: #a8aab3;
  font-size: 11px;
}
label output {
  margin-left: auto;
  color: #e7e8ec;
  font-family: ui-monospace, monospace;
}
input[type='range'] {
  width: 100%;
  padding: 0;
  accent-color: #7190ff;
}
</style>
