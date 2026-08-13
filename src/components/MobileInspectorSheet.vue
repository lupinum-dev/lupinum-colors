<script setup lang="ts">
import { XIcon } from '@lucide/vue'
import {
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle,
  DialogTrigger,
} from 'reka-ui'
import type { HTMLAttributes } from 'vue'
import PaletteInspector from '@/components/PaletteInspector.vue'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

defineProps<{ class?: HTMLAttributes['class'] }>()
</script>

<template>
  <DialogRoot>
    <DialogTrigger as-child :class="cn($props.class)">
      <slot name="trigger" />
    </DialogTrigger>
    <DialogPortal>
      <DialogOverlay
        class="fixed inset-0 z-40 bg-black/35 backdrop-blur-[2px] motion-safe:animate-in motion-safe:fade-in-0"
      />
      <DialogContent
        class="fixed inset-x-0 bottom-0 z-50 max-h-[88dvh] overflow-hidden rounded-t-[14px] bg-card shadow-2xl ring-1 ring-foreground/10 outline-none motion-safe:animate-in motion-safe:slide-in-from-bottom-4"
      >
        <div class="flex items-start justify-between gap-4 border-b px-4 py-3">
          <div>
            <DialogTitle class="text-sm font-semibold">Palette inspector</DialogTitle>
            <DialogDescription class="mt-0.5 text-[13px] text-muted-foreground">
              Compare references, refine selections, and restore earlier edits.
            </DialogDescription>
          </div>
          <DialogClose as-child>
            <Button variant="ghost" size="icon-sm" aria-label="Close palette inspector">
              <XIcon />
            </Button>
          </DialogClose>
        </div>
        <div class="max-h-[calc(88dvh-65px)] overflow-y-auto overscroll-contain p-3">
          <PaletteInspector class="min-h-[640px] border-0 shadow-none ring-0" />
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
