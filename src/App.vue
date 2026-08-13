<script setup lang="ts">
import {
  MoonIcon,
  PaletteIcon,
  PanelRightIcon,
  Redo2Icon,
  RotateCcwIcon,
  SlidersHorizontalIcon,
  SunIcon,
  TriangleAlertIcon,
  Undo2Icon,
  WandSparklesIcon,
} from '@lucide/vue'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { CHANNEL_MODES, type ChannelMode } from '@/app/channels'
import {
  anchor,
  baselineVisible,
  canRedo,
  canUndo,
  channelMode,
  displayShades,
  gamut,
  generate,
  generationError,
  hiddenChannels,
  huePath,
  huePathOptions,
  lastResult,
  paletteName,
  redo,
  resetToGenerated,
  seedColor,
  seedMode,
  toggleChannel,
  undo,
  warnings,
} from '@/app/palette-store'
import AnalysisWorkspace from '@/components/AnalysisWorkspace.vue'
import MobileInspectorSheet from '@/components/MobileInspectorSheet.vue'
import PaletteEditor from '@/components/PaletteEditor.vue'
import PaletteInspector from '@/components/PaletteInspector.vue'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Kbd, KbdGroup } from '@/components/ui/kbd'
import { Label } from '@/components/ui/label'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { TooltipProvider } from '@/components/ui/tooltip'
import { SHADE_NAMES } from '@/index'

const MODES: ChannelMode[] = ['oklch', 'hsv', 'hsl']
type Theme = 'light' | 'dark'

if (!lastResult.value) generate()

const visibleChannelKeys = computed(() =>
  CHANNEL_MODES[channelMode.value]
    .filter((channel) => !hiddenChannels.value.includes(channel.key))
    .map((channel) => channel.key),
)

function selectChannelMode(value: unknown): void {
  if (typeof value === 'string' && MODES.includes(value as ChannelMode)) {
    channelMode.value = value as ChannelMode
  }
}

function selectVisibleChannels(value: unknown): void {
  if (!Array.isArray(value)) return
  const selected = new Set(value.filter((key): key is string => typeof key === 'string'))
  for (const channel of CHANNEL_MODES[channelMode.value]) {
    const isVisible = !hiddenChannels.value.includes(channel.key)
    if (selected.has(channel.key) !== isVisible) toggleChannel(channel.key)
  }
}

const theme = ref<Theme>('dark')

function setTheme(nextTheme: Theme): void {
  theme.value = nextTheme
  document.documentElement.classList.toggle('dark', nextTheme === 'dark')
  document.documentElement.style.colorScheme = nextTheme
  localStorage.setItem('theme', nextTheme)
}

function toggleTheme(): void {
  setTheme(theme.value === 'dark' ? 'light' : 'dark')
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return Boolean(
    target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])'),
  )
}

function onHistoryShortcut(event: KeyboardEvent): void {
  if (!(event.ctrlKey || event.metaKey) || event.altKey || isEditableTarget(event.target)) return

  const key = event.key.toLowerCase()
  const wantsUndo = key === 'z' && !event.shiftKey
  const wantsRedo = (key === 'z' && event.shiftKey) || key === 'y'
  if (
    (!wantsUndo && !wantsRedo) ||
    (wantsUndo && !canUndo.value) ||
    (wantsRedo && !canRedo.value)
  ) {
    return
  }

  event.preventDefault()
  if (wantsRedo) redo()
  else undo()
}

onMounted(() => {
  theme.value = document.documentElement.classList.contains('dark') ? 'dark' : 'light'
  window.addEventListener('keydown', onHistoryShortcut)
})
onBeforeUnmount(() => window.removeEventListener('keydown', onHistoryShortcut))
</script>

<template>
  <TooltipProvider>
    <main id="main-content" class="min-h-screen overflow-x-clip bg-background text-foreground">
      <header class="app-toolbar sticky top-0 z-30 border-b">
        <div class="app-shell flex h-[52px] items-center justify-between gap-3">
          <div class="flex min-w-0 items-center gap-2.5">
            <PaletteIcon class="size-4 shrink-0 text-muted-foreground" />
            <h1 class="truncate text-[13px] font-semibold tracking-[-0.01em]">
              <span class="sm:hidden">Palette lab</span>
              <span class="hidden sm:inline">Tailwind shade generator</span>
            </h1>
            <Badge variant="outline" class="hidden font-mono text-[10px] lg:inline-flex">
              OKLCH
            </Badge>
          </div>
          <div class="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              :aria-label="`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`"
              :title="`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`"
              @click="toggleTheme"
            >
              <span class="relative size-4" aria-hidden="true">
                <SunIcon
                  class="absolute inset-0 transition-[opacity,scale,filter] duration-150"
                  :class="
                    theme === 'light'
                      ? 'scale-100 opacity-100 blur-0'
                      : 'scale-25 opacity-0 blur-[4px]'
                  "
                />
                <MoonIcon
                  class="absolute inset-0 transition-[opacity,scale,filter] duration-150"
                  :class="
                    theme === 'dark'
                      ? 'scale-100 opacity-100 blur-0'
                      : 'scale-25 opacity-0 blur-[4px]'
                  "
                />
              </span>
            </Button>
            <Button variant="ghost" size="sm" :disabled="!canUndo" title="Undo" @click="undo">
              <Undo2Icon data-icon="inline-start" />
              <span class="hidden sm:inline">Undo</span>
              <KbdGroup class="hidden lg:flex"><Kbd>⌘</Kbd><Kbd>Z</Kbd></KbdGroup>
            </Button>
            <Button variant="ghost" size="sm" :disabled="!canRedo" title="Redo" @click="redo">
              <Redo2Icon data-icon="inline-start" />
              <span class="hidden sm:inline">Redo</span>
            </Button>
            <Button variant="outline" size="sm" @click="resetToGenerated">
              <RotateCcwIcon data-icon="inline-start" />
              <span class="hidden sm:inline">Reset</span>
            </Button>
          </div>
        </div>
      </header>

      <div class="app-shell py-4 sm:py-5">
        <div class="workstation">
          <Card size="sm" class="source-panel">
            <CardHeader class="border-b">
              <div>
                <CardTitle>Palette source</CardTitle>
                <CardDescription>Generate the scale from one canonical seed.</CardDescription>
              </div>
              <CardAction>
                <Badge
                  v-if="lastResult"
                  variant="outline"
                  class="hidden font-mono text-[10px] sm:inline-flex"
                >
                  {{ lastResult.reference.kind }} · anchor {{ lastResult.configuration.anchor }}
                </Badge>
              </CardAction>
            </CardHeader>
            <CardContent class="source-fields">
              <div class="source-identity">
                <div class="grid gap-2">
                  <Label for="name">Token name</Label>
                  <Input id="name" v-model="paletteName" spellcheck="false" />
                </div>
                <div class="grid gap-2">
                  <Label for="seed">Seed color</Label>
                  <div class="flex items-center gap-2">
                    <span
                      class="size-9 shrink-0 rounded-md border shadow-xs ring-1 ring-white/10"
                      :style="{ background: displayShades[5]?.css ?? seedColor }"
                      aria-hidden="true"
                    />
                    <Input
                      id="seed"
                      v-model="seedColor"
                      class="font-mono"
                      spellcheck="false"
                      placeholder="#89E5D2 or oklch(86% 0.08 174)"
                      @keydown.enter="generate"
                    />
                  </div>
                </div>
              </div>
              <div class="source-options">
                <div class="grid gap-2">
                  <Label for="seed-mode" class="text-xs">Seed behavior</Label>
                  <NativeSelect id="seed-mode" v-model="seedMode" class="w-full" size="sm">
                    <NativeSelectOption value="exact">Preserve exact</NativeSelectOption>
                    <NativeSelectOption value="canonical">Fit canonical</NativeSelectOption>
                  </NativeSelect>
                </div>
                <div class="grid gap-2">
                  <Label for="anchor" class="text-xs">Anchor</Label>
                  <NativeSelect id="anchor" v-model="anchor" class="w-full" size="sm">
                    <NativeSelectOption value="auto">Auto</NativeSelectOption>
                    <NativeSelectOption v-for="shade in SHADE_NAMES" :key="shade" :value="shade">{{
                      shade
                    }}</NativeSelectOption>
                  </NativeSelect>
                </div>
                <div class="grid gap-2">
                  <Label for="hue-path" class="text-xs">Hue path</Label>
                  <NativeSelect id="hue-path" v-model="huePath" class="w-full" size="sm">
                    <NativeSelectOption
                      v-for="option in huePathOptions"
                      :key="option"
                      :value="option"
                      >{{ option }}</NativeSelectOption
                    >
                  </NativeSelect>
                </div>
                <div class="grid gap-2">
                  <Label for="gamut" class="text-xs">Gamut</Label>
                  <NativeSelect id="gamut" v-model="gamut" class="w-full" size="sm">
                    <NativeSelectOption value="srgb">sRGB</NativeSelectOption>
                    <NativeSelectOption value="display-p3">Display P3</NativeSelectOption>
                    <NativeSelectOption value="none">Unbounded</NativeSelectOption>
                  </NativeSelect>
                </div>
              </div>
              <Button class="generate h-9 w-full" @click="generate">
                <WandSparklesIcon data-icon="inline-start" />
                Generate
              </Button>

              <Alert v-if="generationError" variant="destructive" class="source-alert">
                <TriangleAlertIcon />
                <AlertTitle>Could not generate this palette</AlertTitle>
                <AlertDescription>{{ generationError }}</AlertDescription>
              </Alert>
              <Alert v-else-if="warnings.length" class="source-alert border-amber-500/30">
                <TriangleAlertIcon class="text-amber-600 dark:text-amber-300" />
                <AlertTitle>Palette warnings</AlertTitle>
                <AlertDescription>
                  <ul class="list-disc space-y-1 ps-4">
                    <li v-for="warning in warnings" :key="warning">{{ warning }}</li>
                  </ul>
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>

          <div class="workbench-canvas min-w-0">
            <div class="overflow-x-auto rounded-xl">
              <div class="min-w-[720px]">
                <section
                  class="flex flex-wrap items-center gap-2 rounded-t-xl border border-b-0 bg-card px-3 py-2"
                  aria-label="Editor view"
                >
                  <div class="mr-auto hidden min-w-0 sm:block">
                    <p class="text-sm font-medium">Palette curve</p>
                    <p class="truncate text-xs text-muted-foreground">
                      Adjust lightness, chroma, and hue across every shade
                    </p>
                  </div>
                  <ToggleGroup
                    type="single"
                    variant="outline"
                    size="sm"
                    :model-value="channelMode"
                    aria-label="Color model"
                    @update:model-value="selectChannelMode"
                  >
                    <ToggleGroupItem v-for="mode in MODES" :key="mode" :value="mode">
                      {{ mode.toUpperCase() }}
                    </ToggleGroupItem>
                  </ToggleGroup>

                  <div class="h-6 w-px bg-border" aria-hidden="true" />

                  <ToggleGroup
                    type="multiple"
                    variant="outline"
                    size="sm"
                    :model-value="visibleChannelKeys"
                    aria-label="Visible color channels"
                    @update:model-value="selectVisibleChannels"
                  >
                    <ToggleGroupItem
                      v-for="channel in CHANNEL_MODES[channelMode]"
                      :key="channel.key"
                      :value="channel.key"
                      :aria-label="`Toggle ${channel.label}`"
                    >
                      <span
                        class="size-2 rounded-full"
                        :class="{
                          'bg-pink-400': channel.key === 'h',
                          'bg-violet-400': channel.key === 'c' || channel.key === 's',
                          'bg-sky-300': channel.key === 'l' || channel.key === 'v',
                        }"
                      />
                      {{ channel.label }}
                    </ToggleGroupItem>
                  </ToggleGroup>

                  <label
                    class="flex cursor-pointer items-center gap-2 px-1 text-sm text-muted-foreground"
                  >
                    <Checkbox v-model="baselineVisible" />
                    Generated baseline
                  </label>
                </section>
                <PaletteEditor />
              </div>
            </div>
            <p class="mt-2 flex items-center gap-2 px-1 text-xs text-muted-foreground">
              <SlidersHorizontalIcon class="size-3.5" />
              Drag a point to edit one shade · Shift-drag scales its region · scroll changes the
              radius
            </p>
          </div>

          <PaletteInspector class="inspector-panel hidden sm:flex" />

          <MobileInspectorSheet class="mobile-inspector sm:hidden">
            <template #trigger>
              <Button variant="outline" class="w-full">
                <PanelRightIcon data-icon="inline-start" />
                Open palette inspector
              </Button>
            </template>
          </MobileInspectorSheet>
        </div>

        <div class="analysis-layout mt-4">
          <AnalysisWorkspace
            class="analysis-workspace-slot"
            :name="paletteName"
            :shades="displayShades"
            :app-theme="theme"
          />
        </div>
      </div>
    </main>
  </TooltipProvider>
</template>

<style scoped>
.app-shell {
  width: min(2880px, calc(100% - 32px));
  margin-inline: auto;
}
.app-toolbar {
  background: color-mix(in oklch, var(--background) 88%, transparent);
  backdrop-filter: blur(18px) saturate(140%);
}
.workstation {
  display: grid;
  grid-template-areas: 'source' 'canvas' 'mobile';
  gap: 16px;
  align-items: start;
}
.analysis-layout {
  display: grid;
  min-width: 0;
}
.analysis-workspace-slot {
  min-width: 0;
}
.source-panel {
  grid-area: source;
}
.workbench-canvas {
  grid-area: canvas;
}
.mobile-inspector {
  grid-area: mobile;
}
.source-fields,
.source-identity,
.source-options {
  display: grid;
  gap: 12px;
}
.source-options {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}
.source-alert {
  margin-top: 4px;
}

@media (max-width: 639px) {
  .inspector-panel {
    display: none !important;
  }
}
@media (min-width: 640px) {
  .app-shell {
    width: min(2880px, calc(100% - 48px));
  }
  .workstation {
    grid-template-areas: 'source' 'canvas' 'inspector';
  }
  .inspector-panel {
    grid-area: inspector;
  }
  .source-identity {
    grid-template-columns: 120px minmax(240px, 1fr);
  }
}
@media (min-width: 1280px) {
  .workstation {
    grid-template-columns: minmax(0, 1fr) 360px;
    grid-template-areas: 'source source' 'canvas inspector';
  }
  .source-fields {
    grid-template-columns: minmax(300px, 1fr) minmax(560px, 2fr) auto;
    align-items: end;
  }
  .source-options {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
  .source-alert {
    grid-column: 1 / -1;
  }
  .inspector-panel {
    position: sticky;
    top: 68px;
  }
  .analysis-layout {
    grid-template-columns: minmax(0, 1fr) 360px;
  }
  .analysis-workspace-slot {
    grid-column: 1;
  }
}
@media (min-width: 1792px) {
  .workstation {
    grid-template-columns: minmax(288px, 320px) minmax(900px, 1fr) minmax(360px, 420px);
    grid-template-areas: 'source canvas inspector';
    gap: 20px;
  }
  .source-panel {
    position: sticky;
    top: 68px;
  }
  .source-fields,
  .source-identity,
  .source-options {
    grid-template-columns: 1fr;
  }
  .source-panel :deep([data-slot='card-header']) {
    grid-template-columns: 1fr;
  }
  .source-panel :deep([data-slot='card-action']) {
    grid-column: 1;
    grid-row: auto;
    justify-self: start;
  }
  .analysis-layout {
    grid-template-columns: minmax(288px, 320px) minmax(900px, 1fr) minmax(360px, 420px);
    gap: 20px;
  }
  .analysis-workspace-slot {
    grid-column: 2;
  }
}
@media (min-width: 2560px) {
  .app-shell {
    width: min(2880px, calc(100% - 64px));
  }
}
@media (prefers-reduced-transparency: reduce) {
  .app-toolbar {
    background: var(--background);
    backdrop-filter: none;
  }
}
</style>
