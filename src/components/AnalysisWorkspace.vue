<script setup lang="ts">
import { CheckIcon, ClipboardIcon } from '@lucide/vue'
import { computed, ref } from 'vue'
import { formatExport, type ExportFormat } from '@/app/format'
import type { DisplayShade } from '@/app/palette-store'
import ContrastGrid from '@/components/ContrastGrid.vue'
import PalettePreview from '@/components/PalettePreview.vue'
import { Button } from '@/components/ui/button'
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'

type AnalysisMode = 'preview' | 'contrast' | 'tokens'

const props = defineProps<{
  name: string
  shades: DisplayShade[]
  appTheme: 'light' | 'dark'
}>()

const mode = ref<AnalysisMode>('preview')
const exportFormat = ref<ExportFormat>('tailwind')
const copied = ref(false)
const exportText = computed(() => formatExport(exportFormat.value, props.name, props.shades))

function selectExportFormat(value: unknown): void {
  if (value === 'tailwind' || value === 'css' || value === 'json') exportFormat.value = value
}

async function copyExport(): Promise<void> {
  await navigator.clipboard.writeText(exportText.value)
  copied.value = true
  setTimeout(() => (copied.value = false), 1200)
}
</script>

<template>
  <section class="analysis-workspace rounded-xl bg-card shadow-[var(--surface-shadow)]">
    <Tabs v-model="mode" class="gap-0">
      <div class="analysis-toolbar sticky top-[52px] z-20 border-b px-3 pt-3 sm:px-4">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 class="cn-font-heading text-sm font-medium">Test and export</h2>
            <p class="text-sm text-pretty text-muted-foreground">
              Preview the palette, check contrast, and copy production-ready values.
            </p>
          </div>
          <TabsList variant="line" class="h-9 bg-transparent p-0">
            <TabsTrigger value="preview">Preview</TabsTrigger>
            <TabsTrigger value="contrast">Contrast</TabsTrigger>
            <TabsTrigger value="tokens">Export</TabsTrigger>
          </TabsList>
        </div>
        <div
          class="mt-3 grid h-8 grid-cols-11 overflow-hidden rounded-md ring-1 ring-foreground/10"
          aria-label="Generated shade scale"
        >
          <div
            v-for="entry in shades"
            :key="entry.shade"
            class="flex min-w-0 items-center justify-center text-xs font-medium tabular-nums"
            :style="{
              background: entry.css,
              color: entry.contrastOnBlack >= entry.contrastOnWhite ? '#000' : '#fff',
            }"
          >
            <span class="hidden sm:inline">{{ entry.shade }}</span>
          </div>
        </div>
      </div>

      <TabsContent value="preview" class="m-0 p-3 sm:p-4">
        <PalettePreview :name="name" :shades="shades" :app-theme="appTheme" />
      </TabsContent>

      <TabsContent value="contrast" class="m-0 p-3 sm:p-4">
        <ContrastGrid :name="name" :shades="shades" />
      </TabsContent>

      <TabsContent value="tokens" class="m-0">
        <div class="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
          <div>
            <h3 class="cn-font-heading text-sm font-medium">Export palette</h3>
            <p class="text-sm text-pretty text-muted-foreground">
              Choose a format, then copy the displayed color values.
            </p>
          </div>
          <div class="flex items-center gap-2">
            <ToggleGroup
              type="single"
              variant="outline"
              size="sm"
              :model-value="exportFormat"
              aria-label="Token export format"
              @update:model-value="selectExportFormat"
            >
              <ToggleGroupItem
                v-for="format in ['tailwind', 'css', 'json']"
                :key="format"
                :value="format"
              >
                {{ format }}
              </ToggleGroupItem>
            </ToggleGroup>
            <Button variant="outline" size="sm" @click="copyExport">
              <CheckIcon v-if="copied" data-icon="inline-start" />
              <ClipboardIcon v-else data-icon="inline-start" />
              {{ copied ? 'Copied' : 'Copy code' }}
            </Button>
          </div>
        </div>
        <ScrollArea class="h-[480px] w-full rounded-b-xl bg-muted/20">
          <pre class="min-w-max p-4 font-mono text-xs leading-relaxed text-foreground">{{
            exportText
          }}</pre>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </TabsContent>
    </Tabs>
  </section>
</template>

<style scoped>
.analysis-toolbar {
  border-start-start-radius: var(--radius-xl);
  border-start-end-radius: var(--radius-xl);
  background: color-mix(in oklch, var(--card) 90%, transparent);
  backdrop-filter: blur(16px) saturate(135%);
}
@media (prefers-reduced-transparency: reduce) {
  .analysis-toolbar {
    background: var(--card);
    backdrop-filter: none;
  }
}
</style>
