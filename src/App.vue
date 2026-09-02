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
  XIcon,
} from '@lucide/vue'
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { CHANNEL_MODES, type ChannelMode } from '@/app/channels'
import {
  anchor,
  baselineVisible,
  canReset,
  canRedo,
  canUndo,
  channelMode,
  committedPaletteName,
  displayShades,
  gamut,
  generate,
  generationError,
  generationIssue,
  hiddenChannels,
  huePath,
  huePathOptions,
  lastResult,
  paletteName,
  redo,
  resetToGenerated,
  seedColor,
  seedMode,
  shareLoadError,
  dismissShareLoadError,
  toggleChannel,
  undo,
  warnings,
} from '@/app/palette-store'
import AnalysisWorkspace from '@/components/AnalysisWorkspace.vue'
import MobileInspectorSheet from '@/components/MobileInspectorSheet.vue'
import PaletteEditor from '@/components/PaletteEditor.vue'
import PaletteInspector from '@/components/PaletteInspector.vue'
import ProductGuide from '@/components/ProductGuide.vue'
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

function huePathLabel(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

async function generateFromForm(): Promise<void> {
  if (generate()) return
  await nextTick()
  const field = generationIssue.value?.field
  if (field === 'name') document.querySelector<HTMLInputElement>('#name')?.focus()
  if (field === 'color') document.querySelector<HTMLInputElement>('#seed')?.focus()
}

function moveToSection(id: 'main-content' | 'how-it-works'): void {
  const section = document.getElementById(id)
  if (!section) return
  const behavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
  section.scrollIntoView({ behavior, block: 'start' })
  if (id === 'main-content') section.focus({ preventScroll: true })
  else document.getElementById('guide-title')?.focus({ preventScroll: true })
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
  <a
    href="#main-content"
    class="coarse-target fixed start-4 top-3 z-50 -translate-y-16 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground shadow-md transition-transform focus-visible:translate-y-0 focus-visible:outline-2 focus-visible:outline-offset-2"
    @click.prevent="moveToSection('main-content')"
  >
    Skip to palette generator
  </a>
  <main
    id="main-content"
    tabindex="-1"
    class="min-h-screen overflow-x-clip bg-background text-foreground"
  >
    <header class="app-toolbar sticky top-0 z-30 border-b">
      <div class="app-shell flex h-[52px] items-center justify-between gap-3">
        <a
          href="#main-content"
          class="coarse-target flex min-w-0 items-center gap-2.5 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4"
          aria-label="Lupinum Colors, back to generator"
          @click.prevent="moveToSection('main-content')"
        >
          <PaletteIcon class="size-4 shrink-0 text-muted-foreground" />
          <span class="truncate text-[13px] font-semibold tracking-[-0.01em]">
            Lupinum Colors
          </span>
        </a>
        <div class="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            :aria-label="`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`"
            :title="`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`"
            @click="toggleTheme"
          >
            <span class="theme-icon relative size-4" aria-hidden="true">
              <SunIcon
                class="absolute inset-0 transition-[opacity,scale,filter] duration-150 motion-reduce:transition-[opacity]"
                :class="
                  theme === 'light'
                    ? 'scale-100 opacity-100 blur-0'
                    : 'scale-25 opacity-0 blur-[4px]'
                "
              />
              <MoonIcon
                class="absolute inset-0 transition-[opacity,scale,filter] duration-150 motion-reduce:transition-[opacity]"
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
          <Button
            variant="outline"
            size="sm"
            aria-label="Reset edits"
            title="Reset edits"
            :disabled="!canReset"
            @click="resetToGenerated"
          >
            <RotateCcwIcon data-icon="inline-start" />
            <span class="hidden sm:inline">Reset edits</span>
          </Button>
        </div>
      </div>
    </header>

    <div class="app-shell py-4 sm:py-5">
      <section class="tool-intro" aria-labelledby="tool-title">
        <div>
          <h1 id="tool-title" class="text-balance text-2xl font-semibold tracking-[-0.025em]">
            Tailwind shade generator
          </h1>
          <p class="mt-1 max-w-3xl text-pretty text-sm leading-5 text-muted-foreground">
            Generate, refine, test, and export a production-ready 50–950 color scale from any CSS
            color.
          </p>
        </div>
        <a
          href="#how-it-works"
          class="coarse-target text-sm font-medium underline decoration-border underline-offset-4 transition-colors hover:decoration-foreground focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4"
          @click.prevent="moveToSection('how-it-works')"
        >
          How it works
        </a>
      </section>

      <div class="workstation">
        <Card size="sm" class="source-panel">
          <CardHeader>
            <div>
              <CardTitle>Palette setup</CardTitle>
              <CardDescription class="text-pretty">
                Start with one color, then choose how it fits into the scale.
              </CardDescription>
            </div>
            <CardAction>
              <Badge v-if="lastResult" variant="outline" class="hidden font-mono sm:inline-flex">
                {{ lastResult.reference.kind }} · shade {{ lastResult.configuration.anchor }}
              </Badge>
            </CardAction>
          </CardHeader>
          <CardContent class="source-fields">
            <div class="source-identity">
              <div class="grid gap-2">
                <Label for="name">Palette name</Label>
                <Input
                  id="name"
                  v-model="paletteName"
                  name="palette-name"
                  autocomplete="off"
                  spellcheck="false"
                  :aria-invalid="generationIssue?.field === 'name'"
                  :aria-describedby="generationIssue?.field === 'name' ? 'name-error' : undefined"
                />
                <p v-if="generationIssue?.field === 'name'" id="name-error" class="field-error">
                  {{ generationIssue.message }}
                </p>
              </div>
              <div class="grid gap-2">
                <Label for="seed">Starting color</Label>
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
                    name="seed-color"
                    autocomplete="off"
                    spellcheck="false"
                    placeholder="#89E5D2 or oklch(86% 0.08 174)"
                    :aria-invalid="generationIssue?.field === 'color'"
                    :aria-describedby="
                      generationIssue?.field === 'color' ? 'seed-error' : undefined
                    "
                    @keydown.enter="generateFromForm"
                  />
                </div>
                <p v-if="generationIssue?.field === 'color'" id="seed-error" class="field-error">
                  {{ generationIssue.message }}
                </p>
              </div>
            </div>
            <div class="source-options">
              <div class="grid gap-2">
                <Label for="seed-mode">Color matching</Label>
                <NativeSelect
                  id="seed-mode"
                  v-model="seedMode"
                  name="seed-mode"
                  class="w-full"
                  size="sm"
                  aria-describedby="seed-mode-hint"
                >
                  <NativeSelectOption value="exact">Keep exact color</NativeSelectOption>
                  <NativeSelectOption value="canonical">Match Tailwind curve</NativeSelectOption>
                </NativeSelect>
                <p id="seed-mode-hint" class="field-hint">
                  Preserve the seed or fit it to the Tailwind reference curve.
                </p>
              </div>
              <div class="grid gap-2">
                <Label for="anchor">Anchor shade</Label>
                <NativeSelect
                  id="anchor"
                  v-model="anchor"
                  name="anchor"
                  class="w-full"
                  size="sm"
                  aria-describedby="anchor-hint"
                >
                  <NativeSelectOption value="auto">Auto</NativeSelectOption>
                  <NativeSelectOption v-for="shade in SHADE_NAMES" :key="shade" :value="shade">{{
                    shade
                  }}</NativeSelectOption>
                </NativeSelect>
                <p id="anchor-hint" class="field-hint">Place the seed within the 50–950 scale.</p>
              </div>
              <div class="grid gap-2">
                <Label for="hue-path">Hue direction</Label>
                <NativeSelect
                  id="hue-path"
                  v-model="huePath"
                  name="hue-path"
                  class="w-full"
                  size="sm"
                  aria-describedby="hue-path-hint"
                >
                  <NativeSelectOption
                    v-for="option in huePathOptions"
                    :key="option"
                    :value="option"
                    >{{ huePathLabel(option) }}</NativeSelectOption
                  >
                </NativeSelect>
                <p id="hue-path-hint" class="field-hint">
                  Choose the hue path between the scale ends.
                </p>
              </div>
              <div class="grid gap-2">
                <Label for="gamut">Display range</Label>
                <NativeSelect
                  id="gamut"
                  v-model="gamut"
                  name="gamut"
                  class="w-full"
                  size="sm"
                  aria-describedby="gamut-hint"
                >
                  <NativeSelectOption value="srgb">sRGB</NativeSelectOption>
                  <NativeSelectOption value="display-p3">Display P3</NativeSelectOption>
                  <NativeSelectOption value="none">No limit</NativeSelectOption>
                </NativeSelect>
                <p id="gamut-hint" class="field-hint">Constrain output to the target display.</p>
              </div>
            </div>
            <Button class="generate h-9 w-full" @click="generateFromForm">
              <WandSparklesIcon data-icon="inline-start" />
              Generate palette
            </Button>

            <Alert v-if="generationError" variant="destructive" class="source-alert">
              <TriangleAlertIcon />
              <AlertTitle>Palette could not be generated</AlertTitle>
              <AlertDescription>{{ generationError }}</AlertDescription>
            </Alert>
            <Alert v-else-if="shareLoadError" class="source-alert">
              <TriangleAlertIcon />
              <AlertTitle>Shared palette could not be loaded</AlertTitle>
              <AlertDescription>{{ shareLoadError }}</AlertDescription>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                class="absolute end-2 top-2"
                aria-label="Dismiss share-link message"
                @click="dismissShareLoadError"
              >
                <XIcon />
              </Button>
            </Alert>
            <Alert v-else-if="warnings.length" class="source-alert border-amber-500/30">
              <TriangleAlertIcon class="text-amber-600 dark:text-amber-300" />
              <AlertTitle>Review palette details</AlertTitle>
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
            <div
              class="min-w-[720px] overflow-hidden rounded-xl bg-card shadow-[var(--surface-shadow)]"
            >
              <section
                class="flex flex-wrap items-center gap-2 px-3 pb-2 pt-3"
                aria-label="Editor view"
              >
                <div class="mr-auto hidden min-w-0 sm:block">
                  <p class="cn-font-heading text-sm font-medium">Palette curve</p>
                  <p class="truncate text-sm text-muted-foreground">
                    Fine-tune lightness, color intensity, and hue for each shade.
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
                  Show generated curve
                </label>
              </section>
              <div class="px-3 pb-3">
                <PaletteEditor
                  class="rounded-lg! border! border-foreground/20! dark:border-foreground/30!"
                />
              </div>
            </div>
          </div>
          <p class="mt-2 flex items-center gap-2 px-1 text-xs text-muted-foreground">
            <SlidersHorizontalIcon class="size-3.5" />
            Drag a point to change a shade. Use the arrow keys for precise adjustments.
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
          :name="committedPaletteName"
          :shades="displayShades"
          :app-theme="theme"
        />
      </div>

      <ProductGuide :tailwind-version="lastResult?.reference.tailwindVersion" />
    </div>
  </main>
</template>

<style scoped>
.app-shell {
  width: min(2880px, calc(100% - 32px));
  margin-inline: auto;
}
.app-toolbar {
  background: color-mix(in oklch, var(--card) 92%, transparent);
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
.tool-intro {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 24px;
  padding: 2px 1px 20px;
}
.source-panel {
  grid-area: source;
  min-width: 0;
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
  grid-template-columns: minmax(0, 1fr);
}
.source-alert {
  margin-top: 4px;
}
.field-hint {
  max-width: 42ch;
  color: var(--muted-foreground);
  font-size: 12px;
  line-height: 1.4;
  text-wrap: pretty;
}
.field-error {
  color: var(--destructive);
  font-size: 12px;
  line-height: 1.4;
}

@media (max-width: 639px) {
  .tool-intro {
    align-items: start;
    flex-direction: column;
    gap: 12px;
  }
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
  .source-options {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (min-width: 1280px) {
  .workstation {
    grid-template-columns: minmax(0, 1fr) 360px;
    grid-template-areas: 'source source' 'canvas inspector';
  }
  .source-fields {
    grid-template-columns: minmax(300px, 1fr) minmax(560px, 2fr) auto;
    align-items: start;
  }
  .source-options {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
  .source-alert {
    grid-column: 1 / -1;
  }
  .generate {
    margin-top: 28px;
  }
  .inspector-panel {
    position: sticky;
    top: 68px;
  }
  .analysis-layout {
    grid-template-columns: minmax(0, 1fr) 360px;
    gap: 16px;
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
  .generate {
    margin-top: 0;
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
