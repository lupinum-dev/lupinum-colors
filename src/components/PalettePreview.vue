<script setup lang="ts">
import {
  ArrowUpRightIcon,
  CheckCircle2Icon,
  CreditCardIcon,
  MoreHorizontalIcon,
  TrendingUpIcon,
  UsersIcon,
} from '@lucide/vue'
import { computed, ref, type CSSProperties } from 'vue'
import type { DisplayShade } from '@/app/palette-store'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Slider } from '@/components/ui/slider'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'

type PreviewScenario = 'workspace' | 'components'
type PreviewAppearance = 'auto' | 'light' | 'dark'

const props = defineProps<{
  name: string
  shades: DisplayShade[]
  appTheme: 'light' | 'dark'
}>()

const scenario = ref<PreviewScenario>('workspace')
const appearance = ref<PreviewAppearance>('auto')
const subscribed = ref(true)
const intensity = ref([64])
const role = ref('designer')
const workspaceSection = ref('Overview')
const projectCreated = ref(false)
const shadeMap = computed(() => new Map(props.shades.map((entry) => [entry.shade, entry])))
const previewIsDark = computed(() =>
  appearance.value === 'auto' ? props.appTheme === 'dark' : appearance.value === 'dark',
)
const workspaceTitle = computed(() =>
  workspaceSection.value === 'Overview' ? 'Project overview' : `${workspaceSection.value} overview`,
)
const previewStyle = computed<CSSProperties>(() => {
  const variables = Object.fromEntries(
    props.shades.map((entry) => [`--preview-${entry.shade}`, entry.css]),
  )
  return variables as CSSProperties
})
const primaryForeground = computed(() => {
  const primary = shadeMap.value.get(500)
  return primary && primary.contrastOnBlack >= primary.contrastOnWhite ? '#000' : '#fff'
})
const chartValues = [38, 54, 43, 70, 62, 88, 76]
const chartShades = [300, 400, 500, 600, 500, 700, 800] as const

function selectAppearance(value: unknown): void {
  if (value === 'auto' || value === 'light' || value === 'dark') appearance.value = value
}
</script>

<template>
  <Tabs v-model="scenario" class="preview-lab gap-0" :style="previewStyle">
    <div class="flex flex-wrap items-center justify-between gap-3 pb-3">
      <div>
        <h3 class="text-[13px] font-semibold">Palette preview</h3>
        <p class="text-[13px] text-muted-foreground">
          Neutral product chrome with deliberate {{ name }} roles.
        </p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <TabsList aria-label="Preview scenario">
          <TabsTrigger value="workspace">Workspace</TabsTrigger>
          <TabsTrigger value="components">Components</TabsTrigger>
        </TabsList>
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          :model-value="appearance"
          aria-label="Preview appearance"
          @update:model-value="selectAppearance"
        >
          <ToggleGroupItem value="auto">Auto</ToggleGroupItem>
          <ToggleGroupItem value="light">Light</ToggleGroupItem>
          <ToggleGroupItem value="dark">Dark</ToggleGroupItem>
        </ToggleGroup>
      </div>
    </div>

    <div
      class="preview-stage overflow-hidden rounded-[10px]"
      :class="{ 'preview-dark': previewIsDark }"
    >
      <TabsContent value="workspace" class="m-0">
        <div class="workspace-scene">
          <aside class="workspace-sidebar">
            <div class="flex items-center gap-2 px-3 py-3">
              <span class="size-6 rounded-md preview-primary" />
              <span class="text-sm font-semibold">Northstar</span>
            </div>
            <nav aria-label="Preview navigation" class="space-y-1 px-2">
              <button
                v-for="item in ['Overview', 'Projects', 'Reports', 'Settings']"
                :key="item"
                :class="{ 'preview-nav-active': workspaceSection === item }"
                :aria-current="workspaceSection === item ? 'page' : undefined"
                @click="workspaceSection = item"
              >
                {{ item }}
              </button>
            </nav>
            <div class="mt-auto border-t preview-border p-3">
              <p class="text-xs preview-muted">Palette in use</p>
              <p class="mt-1 font-mono text-[11px]">{{ name }}-500</p>
            </div>
          </aside>

          <div class="min-w-0">
            <header
              class="flex flex-wrap items-center justify-between gap-3 border-b preview-border px-4 py-3"
            >
              <div>
                <p class="text-sm font-semibold">{{ workspaceTitle }}</p>
                <p class="text-xs preview-muted">Thursday, 13 August</p>
              </div>
              <Button
                class="preview-primary border-0"
                size="sm"
                :style="{ color: primaryForeground }"
                :disabled="projectCreated"
                @click="projectCreated = true"
              >
                {{ projectCreated ? 'Project created' : 'Create project' }}
              </Button>
            </header>

            <div class="p-3 sm:p-4">
              <div class="metric-grid">
                <article
                  v-for="metric in [
                    { label: 'Revenue', value: '€48.2k', change: '+12.4%', icon: CreditCardIcon },
                    { label: 'Customers', value: '1,429', change: '+8.1%', icon: UsersIcon },
                    { label: 'Conversion', value: '4.8%', change: '+0.6%', icon: TrendingUpIcon },
                  ]"
                  :key="metric.label"
                  class="metric-item"
                >
                  <component :is="metric.icon" class="size-4 preview-muted" />
                  <p class="mt-4 text-xs preview-muted">{{ metric.label }}</p>
                  <div class="mt-1 flex items-end justify-between gap-3">
                    <p class="text-xl font-semibold tracking-tight tabular-nums">
                      {{ metric.value }}
                    </p>
                    <Badge class="preview-soft border-0 tabular-nums">{{ metric.change }}</Badge>
                  </div>
                </article>
              </div>

              <div class="content-grid mt-3">
                <article class="content-panel">
                  <div class="flex items-start justify-between gap-3">
                    <div>
                      <p class="text-sm font-semibold">Performance</p>
                      <p class="text-xs preview-muted">Last seven months</p>
                    </div>
                    <Badge variant="outline">All channels</Badge>
                  </div>
                  <div class="mt-5 flex h-48 items-end gap-2">
                    <div
                      v-for="(value, index) in chartValues"
                      :key="index"
                      class="preview-track flex h-full min-w-0 flex-1 items-end rounded-md"
                    >
                      <span
                        class="w-full rounded-md"
                        :style="{
                          height: `${value}%`,
                          background: `var(--preview-${chartShades[index]})`,
                        }"
                      />
                    </div>
                  </div>
                </article>

                <article class="content-panel">
                  <div class="flex items-center justify-between">
                    <div>
                      <p class="text-sm font-semibold">Active projects</p>
                      <p class="text-xs preview-muted">Updated just now</p>
                    </div>
                    <span class="preview-muted" aria-hidden="true"
                      ><MoreHorizontalIcon class="size-4"
                    /></span>
                  </div>
                  <div class="mt-3 divide-y preview-divide">
                    <div
                      v-for="(project, index) in ['Canopy', 'Riverbank', 'Common Ground']"
                      :key="project"
                      class="flex items-center gap-3 py-3"
                    >
                      <span
                        class="size-2.5 rounded-full"
                        :style="{ background: `var(--preview-${[400, 600, 800][index]})` }"
                      />
                      <div class="min-w-0 flex-1">
                        <p class="text-sm font-medium">{{ project }}</p>
                        <p class="text-xs preview-muted">{{ 8 + index * 3 }} open tasks</p>
                      </div>
                      <ArrowUpRightIcon class="size-4 preview-muted" />
                    </div>
                  </div>
                </article>
              </div>
            </div>
          </div>
        </div>
      </TabsContent>

      <TabsContent value="components" class="m-0">
        <div class="specimen-grid">
          <section class="specimen-group">
            <div>
              <h4>Actions</h4>
              <p>Hierarchy and interaction states.</p>
            </div>
            <div class="mt-5 flex flex-wrap gap-2">
              <Button class="preview-primary border-0" :style="{ color: primaryForeground }"
                >Create project</Button
              >
              <Button class="preview-secondary border-0">Save draft</Button>
              <Button variant="outline">Outline</Button>
              <Button variant="ghost">Cancel</Button>
              <Button disabled class="preview-disabled">Unavailable</Button>
              <Button variant="outline" size="icon" aria-label="Open more actions"
                ><MoreHorizontalIcon
              /></Button>
            </div>
            <div class="mt-5 flex flex-wrap gap-2">
              <Badge
                v-for="shade in [200, 400, 600, 800]"
                :key="shade"
                class="border-0"
                :style="{
                  background: `var(--preview-${shade})`,
                  color: shade < 500 ? 'var(--preview-950)' : 'var(--preview-50)',
                }"
              >
                {{ name }}-{{ shade }}
              </Badge>
            </div>
          </section>

          <section class="specimen-group">
            <div>
              <h4>Fields</h4>
              <p>Input, selection, and focus roles.</p>
            </div>
            <div class="mt-5 grid gap-4">
              <div class="grid gap-2">
                <Label for="preview-email">Work email</Label>
                <Input
                  id="preview-email"
                  value="studio@example.com"
                  class="preview-input"
                  readonly
                />
              </div>
              <div class="grid gap-2">
                <Label for="preview-role">Role</Label>
                <NativeSelect id="preview-role" v-model="role" class="preview-input w-full">
                  <NativeSelectOption value="designer">Designer</NativeSelectOption>
                  <NativeSelectOption value="developer">Developer</NativeSelectOption>
                </NativeSelect>
              </div>
              <label class="flex items-center gap-3 text-sm">
                <Checkbox v-model="subscribed" class="preview-checkbox" />
                Send weekly palette reports
              </label>
              <div class="grid gap-2">
                <div class="flex items-center justify-between text-sm">
                  <Label>Accent intensity</Label
                  ><output class="font-mono text-xs tabular-nums">{{ intensity[0] }}%</output>
                </div>
                <Slider v-model="intensity" :max="100" class="preview-slider" />
              </div>
            </div>
          </section>

          <section class="specimen-group">
            <div>
              <h4>Feedback</h4>
              <p>Status that remains legible without hue.</p>
            </div>
            <Alert class="mt-5 preview-soft-border">
              <CheckCircle2Icon />
              <AlertTitle>Contrast review passed</AlertTitle>
              <AlertDescription>Primary actions meet the selected AA requirement.</AlertDescription>
            </Alert>
            <div class="mt-5 grid gap-3">
              <div
                v-for="(label, index) in [
                  'Tokens synchronized',
                  'Palette published',
                  'Review requested',
                ]"
                :key="label"
                class="flex items-center gap-3 border-b preview-border pb-3 last:border-0 last:pb-0"
              >
                <span class="flex size-7 items-center justify-center rounded-md preview-soft"
                  ><CheckCircle2Icon class="size-4"
                /></span>
                <span class="text-sm">{{ label }}</span>
                <Badge variant="outline" class="ms-auto">{{
                  index === 0 ? 'Done' : index === 1 ? 'Live' : 'Open'
                }}</Badge>
              </div>
            </div>
          </section>
        </div>
      </TabsContent>
    </div>
  </Tabs>
</template>

<style scoped>
.preview-stage {
  --scene-bg: oklch(0.975 0 0);
  --scene-panel: oklch(1 0 0);
  --scene-muted: oklch(0.955 0 0);
  --scene-fg: oklch(0.16 0 0);
  --scene-muted-fg: oklch(0.46 0 0);
  --scene-border: oklch(0 0 0 / 8%);
  background: var(--scene-bg);
  color: var(--scene-fg);
  color-scheme: light;
  box-shadow: 0 0 0 1px var(--scene-border);
}
.preview-stage.preview-dark {
  --scene-bg: oklch(0.12 0 0);
  --scene-panel: oklch(0.155 0 0);
  --scene-muted: oklch(0.195 0 0);
  --scene-fg: oklch(0.98 0 0);
  --scene-muted-fg: oklch(0.72 0 0);
  --scene-border: oklch(1 0 0 / 10%);
  color-scheme: dark;
}
.workspace-scene {
  display: grid;
  min-height: 560px;
  grid-template-columns: 190px minmax(0, 1fr);
}
.workspace-sidebar {
  display: flex;
  flex-direction: column;
  border-inline-end: 1px solid var(--scene-border);
  background: var(--scene-panel);
}
.workspace-sidebar nav button {
  width: 100%;
  border: 0;
  border-radius: 8px;
  background: transparent;
  padding: 8px 10px;
  color: var(--scene-muted-fg);
  text-align: start;
  font-size: 13px;
}
.workspace-sidebar nav button:hover {
  background: var(--scene-muted);
  color: var(--scene-fg);
}
.workspace-sidebar nav .preview-nav-active {
  background: color-mix(in oklch, var(--preview-200) 42%, var(--scene-muted));
  color: var(--scene-fg);
  font-weight: 600;
}
.metric-grid {
  display: grid;
  gap: 1px;
  overflow: hidden;
  border-radius: 10px;
  background: var(--scene-border);
  grid-template-columns: repeat(3, minmax(0, 1fr));
}
.metric-item,
.content-panel {
  background: var(--scene-panel);
  padding: 16px;
}
.content-grid {
  display: grid;
  gap: 12px;
  grid-template-columns: minmax(0, 1.5fr) minmax(280px, 0.8fr);
}
.content-panel {
  border-radius: 10px;
  box-shadow: 0 0 0 1px var(--scene-border);
}
.specimen-grid {
  display: grid;
  background: var(--scene-panel);
}
.specimen-group {
  min-width: 0;
  padding: 20px;
  border-block-end: 1px solid var(--scene-border);
}
.specimen-group:last-child {
  border-block-end: 0;
}
.specimen-group h4 {
  font-size: 13px;
  font-weight: 600;
}
.specimen-group p {
  margin-top: 2px;
  color: var(--scene-muted-fg);
  font-size: 13px;
  line-height: 1.4;
}
.preview-primary,
.preview-checkbox {
  background: var(--preview-500) !important;
}
.preview-secondary,
.preview-soft {
  background: color-mix(in oklch, var(--preview-200) 68%, var(--scene-muted)) !important;
  color: var(--scene-fg) !important;
}
.preview-soft-border {
  border-color: var(--scene-border);
  background: color-mix(in oklch, var(--preview-100) 12%, var(--scene-panel));
  color: var(--scene-fg);
}
.preview-track {
  background: var(--scene-muted);
}
.preview-muted {
  color: var(--scene-muted-fg);
}
.preview-border {
  border-color: var(--scene-border);
}
.preview-divide > :not(:last-child) {
  border-color: var(--scene-border);
}
.preview-input {
  border-color: var(--scene-border);
  background: var(--scene-panel);
  color: var(--scene-fg);
}
.preview-input:focus-visible {
  border-color: var(--preview-500);
  box-shadow: 0 0 0 3px color-mix(in oklch, var(--preview-500) 25%, transparent);
}
.preview-slider {
  --primary: var(--preview-500);
}
.preview-disabled {
  background: var(--scene-muted) !important;
  color: var(--scene-muted-fg) !important;
}
.preview-stage :deep([data-slot='button'][data-variant='outline']) {
  border-color: var(--scene-border);
  background: var(--scene-panel);
  color: var(--scene-fg);
}
.preview-stage :deep([data-slot='button'][data-variant='ghost']) {
  color: var(--scene-fg);
}
.preview-stage :deep([data-slot='badge'][data-variant='outline']) {
  border-color: var(--scene-border);
  color: var(--scene-fg);
}
.preview-stage :deep([data-slot='alert-description']) {
  color: var(--scene-muted-fg);
}
.preview-stage :deep([data-slot='slider-track']) {
  background: var(--scene-muted);
}
@media (min-width: 1024px) {
  .specimen-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
  .specimen-group {
    border-block-end: 0;
    border-inline-end: 1px solid var(--scene-border);
  }
  .specimen-group:last-child {
    border-inline-end: 0;
  }
}
@media (max-width: 760px) {
  .workspace-scene {
    grid-template-columns: 1fr;
  }
  .workspace-sidebar {
    display: none;
  }
  .metric-grid,
  .content-grid {
    grid-template-columns: 1fr;
  }
}
</style>
