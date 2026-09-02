<script setup lang="ts">
import { XIcon } from '@lucide/vue'
import type { HTMLAttributes } from 'vue'
import PaletteInspector from '@/components/PaletteInspector.vue'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { cn } from '@/lib/utils'

defineProps<{ class?: HTMLAttributes['class'] }>()
</script>

<template>
  <Sheet>
    <SheetTrigger as-child :class="cn($props.class)">
      <slot name="trigger" />
    </SheetTrigger>
    <SheetContent>
      <div class="flex items-start justify-between gap-4 border-b px-4 py-3">
        <SheetHeader>
          <SheetTitle class="text-sm">Palette inspector</SheetTitle>
          <SheetDescription>
            Adjust the scale, compare Tailwind references, or edit exact shade values.
          </SheetDescription>
        </SheetHeader>
        <SheetClose as-child>
          <Button variant="ghost" size="icon-sm" aria-label="Close palette inspector">
            <XIcon />
          </Button>
        </SheetClose>
      </div>
      <div class="min-h-0 flex-1 p-3">
        <PaletteInspector class="mobile-palette-inspector border-0 shadow-none ring-0" />
      </div>
    </SheetContent>
  </Sheet>
</template>

<style scoped>
.mobile-palette-inspector {
  height: 100%;
  min-height: 0;
  max-height: none;
}
</style>
