<script setup lang="ts">
import type { DialogContentProps } from 'reka-ui'
import type { HTMLAttributes } from 'vue'
import { reactiveOmit } from '@vueuse/core'
import { DialogContent, DialogOverlay, DialogPortal } from 'reka-ui'
import { cn } from '@/lib/utils'

defineOptions({ inheritAttrs: false })

const props = defineProps<DialogContentProps & { class?: HTMLAttributes['class'] }>()
const delegatedProps = reactiveOmit(props, 'class')
</script>

<template>
  <DialogPortal>
    <DialogOverlay
      data-slot="sheet-overlay"
      class="fixed inset-0 z-40 bg-black/35 backdrop-blur-[2px] motion-safe:animate-in motion-safe:fade-in-0"
    />
    <DialogContent
      data-slot="sheet-content"
      v-bind="{ ...delegatedProps, ...$attrs }"
      :class="
        cn(
          'pointer-events-auto fixed inset-x-0 bottom-0 z-50 flex h-[88dvh] flex-col overflow-hidden rounded-t-xl bg-card shadow-2xl ring-1 ring-foreground/10 outline-none motion-safe:animate-in motion-safe:slide-in-from-bottom-4',
          props.class,
        )
      "
    >
      <slot />
    </DialogContent>
  </DialogPortal>
</template>
