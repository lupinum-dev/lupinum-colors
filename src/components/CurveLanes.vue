<script setup lang="ts">
import { computed, nextTick, onMounted, onBeforeUnmount, ref, shallowRef } from 'vue'
import { OKLCH_CHANNELS, type Channel } from '@/app/channels'
import { anchorShade, changedShades, commit, committedPaletteName, displayShades, endsState, generatedShades, referenceFamily, referenceName, referenceRanks, selectedShade, selectShade, setShadeColor, shades } from '@/app/palette-store'
import { rankReferences } from '@/app/palette-tools'
import { endTail, isAdjusted } from '@/app/scale-ends'
import { SHADE_NAMES as SH } from '@/types'
import { normalizeHue } from '@/color'
defineProps<{ hoverCol: number }>()
const hover = ref(-1)
const plot = ref<HTMLElement | null>(null)
const plotW = ref(700)
const laneH = ref(112)
const colW = computed(() => plotW.value / 11)
const selIndex = computed(() => SH.indexOf(selectedShade.value))
const refOptions = computed(() => referenceFamily.value && shades.value && !referenceRanks.value.some((r) => r.family.name === referenceName.value) ? [...referenceRanks.value, ...rankReferences(shades.value,[referenceFamily.value])] : referenceRanks.value)
const bands = computed(() => (['dark','light'] as const).filter((side) => isAdjusted(endsState.value[side])).map((side) => { const tail = endTail(side,anchorShade.value!); return {side,from:SH.indexOf(tail[0]!),to:SH.indexOf(tail.at(-1)!)} }).filter((b) => b.from >= 0))
const PAD=14
interface Point { x:number; y:number }
interface View { min:number; max:number; center:number|null }
interface Lane { key:string; ch:Channel; values:number[]; view:View; points:(Point & {shade:typeof SH[number]})[]; path:string; refPath:string|null; genPath:string|null; ticks:{label:string;y:number}[] }
const frozen=shallowRef<Record<string,View>|null>(null)
const drag=ref<{key:string;i:number;y0:number;live:boolean}|null>(null)
const signed=(d:number)=> ((((d+180)%360)+360)%360)-180
function curvePath(pts:Point[]):string {
  if (!pts.length) return ''
  const n=pts.length, slopes:number[]=[]
  for(let i=0;i<n-1;i++) slopes.push((pts[i+1]!.y-pts[i]!.y)/(pts[i+1]!.x-pts[i]!.x))
  const t=pts.map((_,i)=>{ if(i===0)return slopes[0]!;if(i===n-1)return slopes[n-2]!;const a=slopes[i-1]!,b=slopes[i]!;return a===0||b===0||Math.sign(a)!==Math.sign(b)?0:2*a*b/(a+b) })
  const f=(v:number)=>v.toFixed(2)
  let d=`M${f(pts[0]!.x)} ${f(pts[0]!.y)}`
  for(let i=0;i<n-1;i++){const p=pts[i]!,q=pts[i+1]!,dx=(q.x-p.x)/3;d+=` C${f(p.x+dx)} ${f(p.y+t[i]!*dx)},${f(q.x-dx)} ${f(q.y-t[i+1]!*dx)},${f(q.x)} ${f(q.y)}`}
  return d
}
function circularMean(values:number[],weights:number[]):number { let x=0,y=0;values.forEach((v,i)=>{x+=Math.cos(v*Math.PI/180)*weights[i]!;y+=Math.sin(v*Math.PI/180)*weights[i]!});return normalizeHue(Math.atan2(y,x)*180/Math.PI) }
const lanes=computed<Lane[]>(()=>{
  const current=shades.value
  if(!current)return []
  return OKLCH_CHANNELS.map((ch)=>{
    const values=SH.map(s=>ch.get(current[s]))
    const rv=referenceFamily.value ? SH.map(s=>ch.get(referenceFamily.value!.colors[s])) : null
    const gv=changedShades.value.length && generatedShades.value ? SH.map(s=>ch.get(generatedShades.value![s])):null
    let view=frozen.value?.[ch.key]
    if(!view){
      const center=ch.key==='h'?circularMean(values,SH.map(s=>Math.min(1,current[s].c/0.02)+0.001)):0
      const all=[...values,...(rv??[]),...(gv??[])].map(v=>ch.key==='h'?center+signed(v-center):v)
      let min=0,max=1
      if(ch.key==='c')max=Math.min(0.4,Math.max(0.04,Math.ceil(Math.max(...all)*1.2/0.02)*0.02))
      if(ch.key==='h'){const lo=Math.min(...all),hi=Math.max(...all),span=Math.max(30,Math.ceil(((hi-lo)*1.4+6)/10)*10); if(span>=300){max=360}else{const mid=Math.round((lo+hi)/2);min=mid-span/2;max=mid+span/2}}
      view={min,max,center:ch.key==='h'&&max-min<360?center:null}
    }
    const v=view
    const yAt=(value:number)=>{const u=ch.key==='h'&&v.center!==null?v.center+signed(value-v.center):value;return PAD+(1-Math.min(1,Math.max(0,(u-v.min)/(v.max-v.min))))*(laneH.value-2*PAD)}
    const point=(value:number,i:number)=>({shade:SH[i]!,x:(i+0.5)*colW.value,y:yAt(value)})
    const line=(vs:number[])=>curvePath(vs.map(point))
    const ticks=[v.max,(v.min+v.max)/2,v.min].map(value=>({label:ch.key==='h'?`${Math.round(normalizeHue(value))}°`:ch.key==='c'?value.toFixed(2):`${Math.round(value*100)}%`,y:yAt(value)}))
    return {key:ch.key,ch,values,view:v,points:values.map(point),path:line(values),refPath:rv&&line(rv),genPath:gv&&line(gv),ticks}
  })
})
function setChannel(lane:Lane,i:number,value:number):void { const shade=SH[i]!;if(shades.value)setShadeColor(shade,lane.ch.set(shades.value[shade],value)) }
function down(event:PointerEvent,lane:Lane,i:number):void {
  event.preventDefault();selectShade(SH[i]!);frozen.value=Object.fromEntries(lanes.value.map(l=>[l.key,l.view]));drag.value={key:lane.key,i,y0:event.clientY,live:false}
  const target=event.currentTarget as SVGCircleElement;target.setPointerCapture(event.pointerId);target.focus({preventScroll:true})
}
function move(event:PointerEvent,lane:Lane):void {
  const d=drag.value;if(!d||d.key!==lane.key)return
  if(!d.live&&Math.abs(event.clientY-d.y0)<3)return
  d.live=true
  const y=event.clientY-(event.currentTarget as SVGSVGElement).getBoundingClientRect().top
  const {min,max}=lane.view;let value=Math.min(max,Math.max(min,min+(1-(y-PAD)/(laneH.value-2*PAD))*(max-min)))
  value=lane.key==='h'?normalizeHue(value):Math.min(lane.ch.max,Math.max(lane.ch.min,value))
  setChannel(lane,d.i,value)
}
function up():void { if(!drag.value)return;drag.value=null;frozen.value=null;commit() }
async function key(event:KeyboardEvent,lane:Lane,i:number):Promise<void> {
  const k=event.key
  if(['ArrowLeft','ArrowRight','Home','End'].includes(k)) { event.preventDefault();const j=k==='Home'?0:k==='End'?10:Math.max(0,Math.min(10,i+(k==='ArrowRight'?1:-1)));selectShade(SH[j]!);await nextTick();document.getElementById(`h-${lane.key}-${SH[j]}`)?.focus();return }
  const dir=['ArrowUp','PageUp'].includes(k)?1:['ArrowDown','PageDown'].includes(k)?-1:0
  if(!dir)return;event.preventDefault();let v=lane.values[i]!+lane.ch.step*(event.shiftKey||k.startsWith('Page')?10:1)*dir
  v=lane.key==='h'?normalizeHue(v):Math.min(lane.ch.max,Math.max(lane.ch.min,v));setChannel(lane,i,v);commit()
}
let observer:ResizeObserver|undefined
let media:MediaQueryList|undefined
function size():void {laneH.value=media?.matches?96:112}
onMounted(()=>{media=window.matchMedia('(max-width:640px)');size();media.addEventListener('change',size);observer=new ResizeObserver(entries=>{plotW.value=entries[0]!.contentRect.width});if(plot.value)observer.observe(plot.value)})
onBeforeUnmount(()=>{observer?.disconnect();media?.removeEventListener('change',size)})
</script>

<template>

        <section aria-labelledby="curves-h">
          <div class="wb-head" style="margin-bottom:10px">
            <h2 id="curves-h" class="wb-h">Curves</h2>
            <div class="legend" aria-hidden="true">
              <span><svg><line x1="0" y1="4" x2="22" y2="4" stroke="currentColor" style="color:var(--wb-fg)"/></svg>{{ committedPaletteName }}</span>
              <span v-if="referenceFamily"><svg><line x1="0" y1="4" x2="22" y2="4" class="p-ref"/></svg>Tailwind {{ referenceFamily.name }}</span>
              <span v-if="changedShades.length"><svg><line x1="1" y1="4" x2="22" y2="4" class="p-gen"/></svg>Generated</span>
            </div>
            <span class="wb-grow"></span>
            <label for="cmp" class="wb-sub">Compare with</label>
            <select id="cmp" class="sel" v-model="referenceName">
              <option v-for="r in refOptions" :key="r.family.name" :value="r.family.name">Tailwind {{ r.family.name }}, {{ r.score.toFixed(0) }}% match</option>
              <option value="none">Nothing</option>
            </select>
          </div>
          <div v-for="(lane,laneIndex) in lanes" :key="lane.key" class="lane wb-row">
            <div class="wb-gutter" :style="{ '--lh': laneH + 'px' }">
              <span class="wb-lbl">{{ lane.ch.name }}</span>
              <span class="val wb-mono">{{ lane.ch.format(lane.values[selIndex]) }}</span>
              <span v-for="t in lane.ticks" :key="t.label" class="tick" :style="{ top: t.y + 'px' }">{{ t.label }}</span>
            </div>
            <div :ref="laneIndex === 0 ? (element) => { plot = element as HTMLElement } : undefined" class="plot">
              <svg :width="plotW" :height="laneH" role="group" :aria-label="lane.ch.name + ' by shade'" @pointermove="move($event, lane)" @pointerup="up" @pointercancel="up">
                <rect v-for="(s, i) in SH" :key="'c' + s" class="col-r" :class="{ sel: i === selIndex, hov: i === (hover >= 0 ? hover : hoverCol) }" :x="i * colW" y="0" :width="colW" :height="laneH" @pointerenter="hover = i" @pointerleave="hover = -1"/>
                <template v-if="lane.key === 'c'">
                  <template v-for="b in bands" :key="'b' + b.side">
                    <rect class="band" :x="b.from * colW" y="0" :width="(b.to - b.from + 1) * colW" :height="laneH"/>
                    <text class="band-l" :x="b.side === 'dark' ? (b.to + 1) * colW - 6 : b.from * colW + 6" y="11" :text-anchor="b.side === 'dark' ? 'end' : 'start'">Adjusted</text>
                  </template>
                </template>
                <line v-for="t in lane.ticks" :key="'g' + t.label" class="grid-l" x1="0" :x2="plotW" :y1="t.y" :y2="t.y"/>
                <path v-if="lane.refPath" class="p-ref" :d="lane.refPath"/>
                <path v-if="lane.genPath" class="p-gen" :d="lane.genPath"/>
                <path class="p-cur" :d="lane.path"/>
                <g v-for="(pt, i) in lane.points" :key="pt.shade" class="wb-h" :class="{ sel: i === selIndex }">
                  <circle class="h-ring" :cx="pt.x" :cy="pt.y" r="11"/>
                  <circle class="h-dot" :cx="pt.x" :cy="pt.y" :r="i === selIndex ? 7.5 : 6" :fill="displayShades[i]!.css"/>
                  <circle class="h-hit" :id="'h-' + lane.key + '-' + pt.shade" :cx="pt.x" :cy="pt.y" r="15"
                    role="slider" :tabindex="i === selIndex ? 0 : -1"
                    :aria-label="lane.ch.name + ', shade ' + pt.shade" :aria-valuemin="lane.ch.min" :aria-valuemax="lane.ch.max"
                    :aria-valuenow="Number(lane.values[i].toFixed(4))" :aria-valuetext="lane.ch.format(lane.values[i])"
                    @pointerdown="down($event, lane, i)" @keydown="key($event, lane, i)" @focus="selectShade(pt.shade)"/>
                </g>
                <text v-if="drag && drag.key === lane.key" class="tip" :x="lane.points[drag.i].x" :y="lane.points[drag.i].y - 14" :text-anchor="drag.i > 8 ? 'end' : drag.i < 2 ? 'start' : 'middle'">{{ lane.ch.format(lane.values[drag.i]) }}</text>
              </svg>
            </div>
          </div>
          <p class="hint">Drag a point. Or focus it: <kbd class="wb-kbd">↑</kbd><kbd class="wb-kbd">↓</kbd> change the value, <kbd class="wb-kbd">Shift</kbd> for bigger steps, <kbd class="wb-kbd">←</kbd><kbd class="wb-kbd">→</kbd> move between shades.</p>
        </section>

</template>
<style scoped>

.legend { display: flex; align-items: center; gap: 14px; color: var(--wb-fg-2); font-size: 12px; flex-wrap: wrap; }
.legend span { display: inline-flex; align-items: center; gap: 6px; }
.legend svg { width: 22px; height: 8px; overflow: visible; }
.legend line { stroke-width: 1.75; }
select.sel { height: 28px; padding: 0 26px 0 8px; border: 1px solid var(--wb-line); border-radius: 7px; background: var(--wb-panel); font-size: 12px; appearance: none; background-image: linear-gradient(45deg, transparent 50%, var(--wb-fg-3) 50%), linear-gradient(135deg, var(--wb-fg-3) 50%, transparent 50%); background-position: calc(100% - 14px) 12px, calc(100% - 9px) 12px; background-size: 5px 5px; background-repeat: no-repeat; }
select.sel:hover { border-color: var(--wb-line-strong); }
.lane { position: relative; }
.lane + .lane { border-top: 1px dashed var(--wb-line); }
.lane .wb-gutter { position: relative; padding-top: 10px; min-height: var(--wb-lh); }
.lane .val { font-size: 12px; color: var(--wb-fg-2); }
.tick { position: absolute; right: 12px; transform: translateY(-50%); font: 10.5px var(--wb-mono); color: var(--wb-fg-3); }
.plot { position: relative; min-width: 0; touch-action: none; }
.plot svg { display: block; overflow: visible; }
.grid-l { stroke: var(--wb-line); stroke-width: 1; }
.col-r { fill: transparent; }
.col-r.hov { fill: var(--wb-col-hover); }
.col-r.sel { fill: var(--wb-col-sel); }
.band { fill: var(--wb-col-hover); }
.band-l { font: 500 10.5px var(--wb-font); fill: var(--wb-fg-3); }
.p-ref { fill: none; stroke: var(--wb-fg-3); stroke-width: 1.5; stroke-dasharray: 6 5; opacity: .9; }
.p-gen { fill: none; stroke: var(--wb-fg-3); stroke-width: 1.5; stroke-dasharray: 1.5 4; stroke-linecap: round; }
.p-cur { fill: none; stroke: var(--wb-fg); stroke-width: 2; }
.h-dot { stroke: var(--wb-fg); stroke-width: 1.5; }
.wb-h.sel .h-dot { stroke-width: 2.5; }
.h-ring { fill: none; stroke: var(--wb-focus); stroke-width: 2; opacity: 0; }
.wb-h:has(.h-hit:focus-visible) .h-ring { opacity: 1; }
.h-hit { fill: transparent; cursor: grab; outline: none; }
.dragging .h-hit { cursor: grabbing; }
.tip { font: 600 11px var(--wb-mono); fill: var(--wb-fg); paint-order: stroke; stroke: var(--wb-panel); stroke-width: 4px; stroke-linejoin: round; }
.hint { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; margin: 10px 0 0 112px; color: var(--wb-fg-3); font-size: 12px; }


@media(max-width:640px) { .lane .wb-gutter {flex-direction:row;gap:8px;align-items:baseline;padding:10px 0 4px;min-height:0;} .tick {display:none;} .hint {margin-left:0;} }
</style>
