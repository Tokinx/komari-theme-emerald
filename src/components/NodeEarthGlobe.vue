<script setup lang="ts">
import type { COBEOptions, Globe, Marker } from 'cobe'
import type { ComponentPublicInstance } from 'vue'
import type { NodeData } from '@/stores/nodes'
import {
  useDocumentVisibility,
  useElementSize,
  useElementVisibility,
  useRafFn,
} from '@vueuse/core'
import createGlobe from 'cobe'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useAppStore } from '@/stores/app'
import { useNodesStore } from '@/stores/nodes'
import { getCoordByCode, getCountryCodeFromRegion } from '@/utils/geoHelper'

const props = defineProps<{
  nodes?: NodeData[]
}>()

const appStore = useAppStore()
const nodesStore = useNodesStore()

const displayNodes = computed(() => props.nodes ?? nodesStore.earthNodes)

const containerRef = ref<HTMLDivElement>()
const canvasRef = ref<HTMLCanvasElement>()
const { width: containerWidth, height: containerHeight } = useElementSize(containerRef)

const documentVisibility = useDocumentVisibility()
const elementVisible = useElementVisibility(containerRef)
const shouldRender = computed(() => documentVisibility.value === 'visible' && elementVisible.value)
const shouldAutoRotate = computed(() => appStore.earthViewMode !== 'earth-stop')

let globe: Globe | null = null
const INITIAL_THETA = 0.22
const MIN_THETA = -0.65
const MAX_THETA = 0.65
const CHINA_COORD = getCoordByCode('CN') ?? [35.8617, 104.1954]
const DEFAULT_PHI = normalizePhi(-Math.PI / 2 - CHINA_COORD[1] * Math.PI / 180)
const GLOBE_RADIUS = 0.8
const GLOBE_SCALE = 1
const MARKER_ELEVATION = 0
let phi = DEFAULT_PHI
let targetPhi = phi
let theta = INITIAL_THETA
let targetTheta = INITIAL_THETA
let isPointerDown = false
let lastPointerX = 0
let lastPointerY = 0
let staticRedrawUntil = 0

function normalizePhi(value: number): number {
  const circle = Math.PI * 2
  let next = value % circle
  if (next <= -Math.PI)
    next += circle
  if (next > Math.PI)
    next -= circle
  return next
}

function clampTheta(value: number): number {
  return Math.min(Math.max(value, MIN_THETA), MAX_THETA)
}

function resetStoppedView() {
  phi = DEFAULT_PHI
  targetPhi = DEFAULT_PHI
  theta = INITIAL_THETA
  targetTheta = INITIAL_THETA
}

function triggerStaticRedrawWindow(duration = 1500) {
  if (typeof performance === 'undefined') {
    staticRedrawUntil = Date.now() + duration
    return
  }
  staticRedrawUntil = performance.now() + duration
}

function shouldKeepStaticRedraw(): boolean {
  const now = typeof performance === 'undefined' ? Date.now() : performance.now()
  return now < staticRedrawUntil
}

// 减少高采样导致的性能问题
function getCappedDpr(): number {
  if (typeof window === 'undefined')
    return 1
  return Math.min(window.devicePixelRatio || 1, 2)
}

interface RegionCluster {
  code: string
  coord: [number, number]
  servers: number
  onlineServers: number
}

function clusterKey(c: RegionCluster) {
  return `${c.code}:${c.servers}:${c.onlineServers}`
}

// 节点按地区聚合
const regionClusters = computed<RegionCluster[]>(() => {
  const map = new Map<string, RegionCluster>()
  for (const node of displayNodes.value) {
    const code = getCountryCodeFromRegion(node.region)
    if (!code)
      continue
    const coord = getCoordByCode(code)
    if (!coord)
      continue

    let entry = map.get(code)
    if (!entry) {
      entry = { code, coord, servers: 0, onlineServers: 0 }
      map.set(code, entry)
    }
    entry.servers += 1
    if (node.online)
      entry.onlineServers += 1
  }
  return Array.from(map.values()).sort((a, b) => b.servers - a.servers)
})

const clusterOverlayEls = new Map<string, HTMLDivElement>()
const clusterOverlayRefBinders = new Map<string, (el: Element | ComponentPublicInstance | null) => void>()

function coordToGlobePoint([lat, lon]: [number, number]): [number, number, number] {
  const latRad = lat * Math.PI / 180
  const lonRad = lon * Math.PI / 180 - Math.PI
  const cosLat = Math.cos(latRad)
  return [
    -cosLat * Math.cos(lonRad),
    Math.sin(latRad),
    cosLat * Math.sin(lonRad),
  ]
}

function getRenderSize() {
  const width = containerWidth.value || canvasRef.value?.clientWidth || 320
  const height = containerHeight.value || canvasRef.value?.clientHeight || width
  return { width, height }
}

// iOS Safari 对 cobe 内部 marker anchor 的 DOM/style 行为不稳定，
// overlay 改为组件内自行投影定位，避免回落到容器左上角。
function syncClusterOverlayPosition(cluster: RegionCluster, el: HTMLDivElement) {
  const { width, height } = getRenderSize()
  if (width <= 0 || height <= 0) {
    el.style.opacity = '0'
    el.style.filter = 'blur(20px)'
    return
  }

  const aspect = width / height
  const cosTheta = Math.cos(theta)
  const sinTheta = Math.sin(theta)
  const cosPhi = Math.cos(phi)
  const sinPhi = Math.sin(phi)
  const markerRadius = GLOBE_RADIUS + MARKER_ELEVATION
  const visibleThreshold = GLOBE_RADIUS * GLOBE_RADIUS
  const [baseX, baseY, baseZ] = coordToGlobePoint(cluster.coord)
  const x = baseX * markerRadius
  const y = baseY * markerRadius
  const z = baseZ * markerRadius
  const screenX = cosPhi * x + sinPhi * z
  const screenY = sinPhi * sinTheta * x + cosTheta * y - cosPhi * sinTheta * z
  const visible = (
    -sinPhi * cosTheta * x + sinTheta * y + cosPhi * cosTheta * z >= 0
    || screenX * screenX + screenY * screenY >= visibleThreshold
  )
  const xPx = ((screenX / aspect) * GLOBE_SCALE + 1) * width / 2
  const yPx = ((-screenY) * GLOBE_SCALE + 1) * height / 2

  el.style.transform = `translate3d(${xPx}px, ${yPx}px, 0)`
  el.style.opacity = visible ? '1' : '0'
  el.style.filter = visible ? 'blur(0px)' : 'blur(20px)'
}

function syncClusterOverlayPositions() {
  for (const cluster of regionClusters.value) {
    const el = clusterOverlayEls.get(cluster.code)
    if (!el)
      continue
    syncClusterOverlayPosition(cluster, el)
  }
}

function setClusterOverlayEl(code: string, el: Element | ComponentPublicInstance | null) {
  if (el instanceof HTMLDivElement) {
    el.style.willChange = 'transform, opacity, filter'
    clusterOverlayEls.set(code, el)

    const cluster = regionClusters.value.find(item => item.code === code)
    if (cluster) {
      syncClusterOverlayPosition(cluster, el)
    }
    else {
      el.style.opacity = '0'
      el.style.filter = 'blur(20px)'
    }
    return
  }

  clusterOverlayEls.delete(code)
}

function bindClusterOverlayRef(code: string): (el: Element | ComponentPublicInstance | null) => void {
  const existingBinder = clusterOverlayRefBinders.get(code)
  if (existingBinder)
    return existingBinder

  const binder = (el: Element | ComponentPublicInstance | null) => setClusterOverlayEl(code, el)
  clusterOverlayRefBinders.set(code, binder)
  return binder
}

const markers = computed<Marker[]>(() => {
  return regionClusters.value.map(cluster => ({
    location: cluster.coord,
    size: 0, // 不渲染圆点
  }))
})

const themeColors = computed(() => {
  if (appStore.isDark) {
    return {
      dark: 1,
      mapBrightness: 4,
      baseColor: [0.32, 0.33, 0.4] as [number, number, number],
      markerColor: [0.4, 0.7, 1.0] as [number, number, number],
      glowColor: [0.2, 0.25, 0.45] as [number, number, number],
    }
  }
  return {
    dark: 0,
    mapBrightness: 6,
    baseColor: [1, 1, 1] as [number, number, number],
    markerColor: [0.21, 0.51, 0.93] as [number, number, number],
    glowColor: [1, 1, 1] as [number, number, number],
  }
})

function buildInitialOptions(): COBEOptions {
  const colors = themeColors.value
  const { width, height } = getRenderSize()
  return {
    devicePixelRatio: getCappedDpr(),
    width,
    height,
    phi,
    theta,
    dark: colors.dark,
    diffuse: 1.2,
    mapSamples: 10000, // 地图采样点数，默认 16000
    mapBrightness: colors.mapBrightness,
    baseColor: colors.baseColor,
    markerColor: colors.markerColor,
    glowColor: colors.glowColor,
    markers: markers.value,
    markerElevation: MARKER_ELEVATION,
  }
}

function updateGlobeFrame() {
  if (!globe)
    return
  const { width, height } = getRenderSize()
  globe.update({ phi, theta, width, height })
  syncClusterOverlayPositions()
}

// phi 收敛/静止时整帧跳过 globe.update，WebGL + overlay 位置更新双双归零
const ORIENTATION_IDLE_EPSILON = 1e-5
const { pause: pauseRaf, resume: resumeRaf } = useRafFn(
  () => {
    if (!globe)
      return
    const prevPhi = phi
    const prevTheta = theta
    if (!isPointerDown && shouldAutoRotate.value)
      targetPhi += 0.0025
    phi += (targetPhi - phi) * 1
    theta += (targetTheta - theta) * 1
    if (
      Math.abs(phi - prevPhi) < ORIENTATION_IDLE_EPSILON
      && Math.abs(theta - prevTheta) < ORIENTATION_IDLE_EPSILON
    ) {
      if (!shouldAutoRotate.value && shouldKeepStaticRedraw())
        updateGlobeFrame()
      return
    }
    updateGlobeFrame()
  },
  { immediate: false }, // , fpsLimit: 30
)

function syncRafState() {
  if (!globe)
    return

  if (shouldRender.value && (shouldAutoRotate.value || isPointerDown)) {
    resumeRaf()
    return
  }

  pauseRaf()
  if (shouldRender.value)
    updateGlobeFrame()
}

function startGlobe() {
  if (!canvasRef.value)
    return
  if (appStore.earthViewMode === 'earth-stop') {
    resetStoppedView()
    triggerStaticRedrawWindow()
  }
  globe = createGlobe(canvasRef.value, buildInitialOptions())
  syncClusterOverlayPositions()
  // 静止地球没有自转帧，首帧需要在实际尺寸稳定后主动重绘一次。
  requestAnimationFrame(() => {
    updateGlobeFrame()
  })
  // documentVisibility 同步可读；useElementVisibility 需等 IntersectionObserver 首回调
  // 先按"前台"启动，若实际不可见，shouldRender 的 watch 会在下一帧 pause
  syncRafState()
}

// cobe 不会清理自己创建的 wrapper，这里手动收尾。
function stopGlobe() {
  pauseRaf()
  globe?.destroy()
  globe = null
  if (canvasRef.value && containerRef.value) {
    const cobeWrapper = canvasRef.value.parentElement
    if (cobeWrapper && cobeWrapper !== containerRef.value) {
      containerRef.value.appendChild(canvasRef.value)
      cobeWrapper.remove()
    }
  }
}

function rebuildGlobe() {
  stopGlobe()
  startGlobe()
}

onMounted(() => {
  startGlobe()
})

onBeforeUnmount(() => {
  stopGlobe()
})

// 切换主题时重建 globe
watch(() => appStore.isDark, () => {
  rebuildGlobe()
})

watch(
  [containerWidth, containerHeight],
  ([width, height]) => {
    if (!globe || width <= 0 || height <= 0)
      return
    updateGlobeFrame()
  },
)

watch(
  () => appStore.earthViewMode,
  (mode) => {
    if (mode === 'earth-stop')
      resetStoppedView()
    triggerStaticRedrawWindow()
    syncRafState()
  },
)

// 仅地区集合或在线状态变化时才推送 markers；速率推送不触发
watch(
  () => regionClusters.value.map(clusterKey).join(','),
  async () => {
    if (!globe)
      return
    globe.update({ markers: markers.value })
    await nextTick()
    syncClusterOverlayPositions()
    if (!shouldAutoRotate.value)
      triggerStaticRedrawWindow(600)
  },
)

watch(shouldRender, () => {
  if (!globe)
    return
  syncRafState()
})

function onPointerDown(e: PointerEvent) {
  isPointerDown = true
  lastPointerX = e.clientX
  lastPointerY = e.clientY
  const target = e.currentTarget as HTMLElement
  target.setPointerCapture(e.pointerId)
  syncRafState()
}
function onPointerMove(e: PointerEvent) {
  if (!isPointerDown)
    return
  const deltaX = e.clientX - lastPointerX
  const deltaY = e.clientY - lastPointerY
  lastPointerX = e.clientX
  lastPointerY = e.clientY
  targetPhi += deltaX / 200
  targetTheta = clampTheta(targetTheta + deltaY / 300)
}
function onPointerUp(e: PointerEvent) {
  isPointerDown = false
  const target = e.currentTarget as HTMLElement
  if (target.hasPointerCapture(e.pointerId))
    target.releasePointerCapture(e.pointerId)
  syncRafState()
}

const totalServers = computed(() => displayNodes.value.length)
const onlineServers = computed(() => displayNodes.value.filter(node => node.online).length)
const offlineServers = computed(() => totalServers.value - onlineServers.value)
</script>

<template>
  <div ref="containerRef" class="relative aspect-square w-full max-w-md mx-auto -translate-y-6 md:-translate-y-12">
    <canvas
      ref="canvasRef"
      class="earth-globe-canvas absolute inset-0 w-full h-full select-none touch-none cursor-grab active:cursor-grabbing"
      @pointerdown="onPointerDown" @pointermove="onPointerMove" @pointerup="onPointerUp" @pointercancel="onPointerUp"
    />

    <template v-for="cluster in regionClusters" :key="cluster.code">
      <div
        :ref="bindClusterOverlayRef(cluster.code)"
        class="absolute -top-3.5 left-0 pointer-events-none rounded backdrop-blur-sm transition-[opacity,filter] duration-500"
      >
        <img
          :src="`/assets/flags/${cluster.code}.svg`" :alt="cluster.code"
          class="size-4 block absolute -bottom-2 -left-2 z-1"
        >
        <div class="relative z-2 bg-background/60 rounded py-0.5 px-2 text-xs zoom-80 items-start justify-center text-nowrap">
          <div v-if="cluster.onlineServers > 0" class="flex items-center gap-1">
            <span class="inline-block size-1.5 rounded-full bg-green-600" />
            <span class="text-green-600">{{ cluster.onlineServers }}</span>
          </div>
          <div v-if="(cluster.servers - cluster.onlineServers) > 0" class="flex items-center gap-1">
            <span class="inline-block size-1.5 rounded-full bg-yellow-600" />
            <span class="text-yellow-600">{{ cluster.servers - cluster.onlineServers }}</span>
          </div>
        </div>
      </div>
    </template>

    <div
      v-if="totalServers > 0"
      class="absolute top-6 md:top-12 left-0 text-[10px] text-muted-foreground pointer-events-none flex gap-2 items-center backdrop-blur-lg bg-background/60 rounded px-2 py-0.5"
    >
      <div v-if="onlineServers > 0" class="flex items-center gap-1">
        <span class="inline-block size-1.5 rounded-full bg-green-600 animate-pulse" />
        <span class="text-green-600">{{ onlineServers }}</span>
      </div>
      <div v-if="offlineServers > 0" class="flex items-center gap-1">
        <span class="inline-block size-1.5 rounded-full bg-yellow-600 animate-pulse" />
        <span class="text-yellow-600">{{ offlineServers }}</span>
      </div>
      <!-- <div v-if="totalServers > 0" class="flex items-center gap-1">
        <span class="inline-block size-1.5 rounded-full bg-blue-600 animate-pulse" />
        <span class="text-blue-600">{{ totalServers }}</span>
      </div> -->
    </div>
  </div>
</template>

<style scoped>
.earth-globe-canvas {
  contain: layout paint;
}
</style>
