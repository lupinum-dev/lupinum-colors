<script setup lang="ts">
import {
  CheckIcon,
  ClipboardIcon,
  Redo2Icon,
  RotateCcwIcon,
  SlidersHorizontalIcon,
  TriangleAlertIcon,
  Undo2Icon,
  WandSparklesIcon,
} from '@lucide/vue'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { CHANNEL_MODES, type ChannelMode } from '@/app/channels'
import { formatExport, type ExportFormat } from '@/app/format'
import {
  anchor,
  baselineVisible,
  beginContinuousEdit,
  canRedo,
  canUndo,
  channelMode,
  displayShades,
  effectiveShades,
  endContinuousEdit,
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
  selectedShade,
  setShadeColor,
  toggleChannel,
  undo,
  warnings,
} from '@/app/palette-store'
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
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { TooltipProvider } from '@/components/ui/tooltip'
import { SHADE_NAMES, formatOklch } from '@/index'

const MODES: ChannelMode[] = ['oklch', 'hsv', 'hsl']

if (!lastResult.value) generate()

const selectedEntry = computed(() =>
  displayShades.value.find((entry) => entry.shade === selectedShade.value),
)
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

function selectExportFormat(value: unknown): void {
  if (value === 'tailwind' || value === 'css' || value === 'json') exportFormat.value = value
}

function channelInput(event: Event, channelLabel: string, set: (value: number) => void): void {
  const value = Number((event.target as HTMLInputElement).value)
  if (!Number.isFinite(value)) return
  beginContinuousEdit()
  set(value)
  endContinuousEdit(`Set ${channelLabel} at ${selectedShade.value}`)
}

const exportFormat = ref<ExportFormat>('tailwind')
const exportText = computed(() =>
  formatExport(exportFormat.value, paletteName.value, displayShades.value),
)
const copied = ref(false)

async function copyExport(): Promise<void> {
  await navigator.clipboard.writeText(exportText.value)
  copied.value = true
  setTimeout(() => (copied.value = false), 1200)
}

function contrastBadge(ratio: number): string {
  if (ratio >= 7) return 'AAA'
  if (ratio >= 4.5) return 'AA'
  if (ratio >= 3) return 'AA-lg'
  return '—'
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

onMounted(() => window.addEventListener('keydown', onHistoryShortcut))
onBeforeUnmount(() => window.removeEventListener('keydown', onHistoryShortcut))
</script>

<template>
  <TooltipProvider>
    <main class="min-h-screen bg-background text-foreground">
      <header
        class="sticky top-0 z-20 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80"
      >
        <div
          class="mx-auto flex max-w-[1600px] items-center justify-between gap-4 px-4 py-3 sm:px-6"
        >
          <div class="min-w-0">
            <p
              class="font-mono text-[10px] font-medium tracking-[0.16em] text-muted-foreground uppercase"
            >
              OKLCH · Palette lab
            </p>
            <h1 class="truncate text-lg font-semibold tracking-tight">Tailwind shade generator</h1>
          </div>
          <div class="flex items-center gap-1.5">
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
              Reset
            </Button>
          </div>
        </div>
      </header>

      <div class="mx-auto flex max-w-[1600px] flex-col gap-4 px-4 py-4 sm:px-6 sm:py-6">
        <Card size="sm">
          <CardHeader class="border-b">
            <div>
              <CardTitle>Generate palette</CardTitle>
              <CardDescription
                >Start from any CSS color, then refine the generated curve.</CardDescription
              >
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
          <CardContent
            class="grid gap-4 pt-4 md:grid-cols-2 xl:grid-cols-[0.75fr_2fr_repeat(4,1fr)_auto] xl:items-end"
          >
            <div class="grid gap-2">
              <Label for="name">Token name</Label>
              <Input id="name" v-model="paletteName" spellcheck="false" />
            </div>
            <div class="grid gap-2">
              <Label for="seed">Seed color</Label>
              <div class="flex items-center gap-2">
                <span
                  class="size-9 shrink-0 rounded-md border shadow-xs"
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
            <div class="grid gap-2">
              <Label for="seed-mode">Seed behavior</Label>
              <NativeSelect id="seed-mode" v-model="seedMode" class="w-full">
                <NativeSelectOption value="exact">Preserve exact</NativeSelectOption>
                <NativeSelectOption value="canonical">Fit canonical</NativeSelectOption>
              </NativeSelect>
            </div>
            <div class="grid gap-2">
              <Label for="anchor">Anchor shade</Label>
              <NativeSelect id="anchor" v-model="anchor" class="w-full">
                <NativeSelectOption value="auto">Auto</NativeSelectOption>
                <NativeSelectOption v-for="shade in SHADE_NAMES" :key="shade" :value="shade">
                  {{ shade }}
                </NativeSelectOption>
              </NativeSelect>
            </div>
            <div class="grid gap-2">
              <Label for="hue-path">Hue path</Label>
              <NativeSelect id="hue-path" v-model="huePath" class="w-full">
                <NativeSelectOption v-for="option in huePathOptions" :key="option" :value="option">
                  {{ option }}
                </NativeSelectOption>
              </NativeSelect>
            </div>
            <div class="grid gap-2">
              <Label for="gamut">Output gamut</Label>
              <NativeSelect id="gamut" v-model="gamut" class="w-full">
                <NativeSelectOption value="srgb">sRGB</NativeSelectOption>
                <NativeSelectOption value="display-p3">Display P3</NativeSelectOption>
                <NativeSelectOption value="none">Unbounded</NativeSelectOption>
              </NativeSelect>
            </div>
            <Button class="generate w-full xl:w-auto" @click="generate">
              <WandSparklesIcon data-icon="inline-start" />
              Generate
            </Button>
          </CardContent>
        </Card>

        <Alert v-if="generationError" variant="destructive">
          <TriangleAlertIcon />
          <AlertTitle>Could not generate this palette</AlertTitle>
          <AlertDescription>{{ generationError }}</AlertDescription>
        </Alert>

        <section
          class="flex flex-wrap items-center gap-3 rounded-lg border bg-card p-2 shadow-xs"
          aria-label="Editor view"
        >
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            :model-value="channelMode"
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
                  'bg-amber-300': channel.key === 'c' || channel.key === 's',
                  'bg-sky-300': channel.key === 'l' || channel.key === 'v',
                }"
              />
              {{ channel.label }}
            </ToggleGroupItem>
          </ToggleGroup>

          <label class="flex cursor-pointer items-center gap-2 px-1 text-sm text-muted-foreground">
            <Checkbox v-model="baselineVisible" />
            Generated baseline
          </label>

          <p
            v-if="lastResult"
            class="ml-auto hidden font-mono text-[10px] text-muted-foreground 2xl:block"
          >
            {{ lastResult.reference.neighbors.join(' ↔ ') }}
          </p>
        </section>

        <div class="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div class="flex min-w-0 flex-col gap-4">
            <PaletteEditor />
            <p class="flex items-center gap-2 px-1 text-xs text-muted-foreground">
              <SlidersHorizontalIcon class="size-3.5" />
              Drag a point to edit one shade · Shift-drag scales its region · scroll changes the
              radius
            </p>

            <Alert
              v-if="warnings.length"
              class="border-amber-500/30 text-amber-200 [&>svg]:text-amber-300"
            >
              <TriangleAlertIcon />
              <AlertTitle>Palette warnings</AlertTitle>
              <AlertDescription>
                <ul class="list-disc space-y-1 pl-4">
                  <li v-for="warning in warnings" :key="warning">{{ warning }}</li>
                </ul>
              </AlertDescription>
            </Alert>

            <Card v-if="selectedEntry && effectiveShades" size="sm">
              <CardHeader>
                <div>
                  <CardDescription class="font-mono text-[10px] tracking-wider uppercase"
                    >Selected shade</CardDescription
                  >
                  <CardTitle>{{ paletteName }}-{{ selectedEntry.shade }}</CardTitle>
                </div>
                <CardAction class="flex flex-wrap justify-end gap-2">
                  <Badge variant="outline" class="font-mono">{{ selectedEntry.hex }}</Badge>
                  <Badge variant="outline" class="font-mono">{{
                    formatOklch(selectedEntry.raw)
                  }}</Badge>
                </CardAction>
              </CardHeader>
              <CardContent class="flex flex-wrap items-end gap-3">
                <div
                  v-for="channel in CHANNEL_MODES[channelMode]"
                  :key="channel.key"
                  class="grid gap-2"
                >
                  <Label :for="`channel-${channel.key}`">{{ channel.label }}</Label>
                  <Input
                    :id="`channel-${channel.key}`"
                    class="w-28 font-mono"
                    type="number"
                    :min="channel.min"
                    :max="channel.max"
                    :step="channel.step"
                    :model-value="Number(channel.get(selectedEntry.raw).toFixed(4))"
                    @change="
                      channelInput($event, channel.label, (value) =>
                        setShadeColor(
                          selectedEntry!.shade,
                          channel.set(effectiveShades![selectedEntry!.shade], value),
                        ),
                      )
                    "
                  />
                </div>
                <div class="ml-auto flex flex-wrap gap-2">
                  <Badge variant="secondary" class="font-mono">
                    White {{ selectedEntry.contrastOnWhite.toFixed(2) }} ·
                    {{ contrastBadge(selectedEntry.contrastOnWhite) }}
                  </Badge>
                  <Badge variant="secondary" class="font-mono">
                    Black {{ selectedEntry.contrastOnBlack.toFixed(2) }} ·
                    {{ contrastBadge(selectedEntry.contrastOnBlack) }}
                  </Badge>
                  <Badge
                    v-if="!selectedEntry.inGamut"
                    variant="outline"
                    class="border-amber-500/40 text-amber-300"
                  >
                    Gamut mapped
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>

          <PaletteInspector />
        </div>

        <Card size="sm">
          <CardHeader class="border-b">
            <div>
              <CardDescription class="font-mono text-[10px] tracking-wider uppercase"
                >Output</CardDescription
              >
              <CardTitle>Production tokens</CardTitle>
            </div>
            <CardAction class="flex items-center gap-2">
              <ToggleGroup
                type="single"
                variant="outline"
                size="sm"
                :model-value="exportFormat"
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
                {{ copied ? 'Copied' : 'Copy' }}
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent class="p-0">
            <ScrollArea class="h-[360px] w-full">
              <pre class="min-w-max p-4 font-mono text-xs leading-relaxed text-foreground">{{
                exportText
              }}</pre>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </main>
  </TooltipProvider>
</template>
