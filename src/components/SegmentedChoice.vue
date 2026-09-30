<script setup lang="ts" generic="T extends string | number">
import { nextTick, ref, type CSSProperties } from 'vue'
defineOptions({ inheritAttrs: false })
const props = defineProps<{
  modelValue: T
  options: readonly { value: T; label: string; ariaLabel?: string; style?: CSSProperties }[]
  ariaLabel?: string
  ariaLabelledby?: string
  full?: boolean
}>()
const emit = defineEmits<{ 'update:modelValue': [value: T] }>()
const group = ref<HTMLElement>()
async function keydown(event: KeyboardEvent, index: number): Promise<void> {
  let next: number
  switch (event.key) {
    case 'ArrowRight':
    case 'ArrowDown':
      next = (index + 1) % props.options.length
      break
    case 'ArrowLeft':
    case 'ArrowUp':
      next = (index + props.options.length - 1) % props.options.length
      break
    case 'Home':
      next = 0
      break
    case 'End':
      next = props.options.length - 1
      break
    case ' ':
    case 'Enter':
      next = index
      break
    default:
      return
  }
  event.preventDefault()
  emit('update:modelValue', props.options[next]!.value)
  await nextTick()
  group.value?.querySelectorAll<HTMLButtonElement>('button')[next]?.focus()
}
</script>
<template>
  <div
    ref="group"
    v-bind="$attrs"
    :class="[$attrs.class ?? 'wb-seg', { full }]"
    role="radiogroup"
    :aria-label="ariaLabel"
    :aria-labelledby="ariaLabelledby"
  >
    <button
      v-for="(option, index) in options"
      :key="option.value"
      type="button"
      role="radio"
      :class="{ auto: option.value === 'auto' }"
      :aria-checked="modelValue === option.value"
      :tabindex="modelValue === option.value ? 0 : -1"
      :aria-label="option.ariaLabel"
      :style="option.style"
      @click="emit('update:modelValue', option.value)"
      @keydown="keydown($event, index)"
    >
      {{ option.label }}
    </button>
  </div>
</template>
<style scoped>
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
</style>
