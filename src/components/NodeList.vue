<script setup lang="ts">
import type { NodeData } from '@/stores/nodes'
import { Icon } from '@iconify/vue'
import { computed, ref } from 'vue'
import PingChart from '@/components/PingChart.vue'
import TrafficProgress from '@/components/TrafficProgress.vue'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { ProgressThin } from '@/components/ui/progress-thin'
import { Tag } from '@/components/ui/tag'
import { TooltipProvider } from '@/components/ui/tooltip'
import { TooltipX } from '@/components/ui/tooltip-x'
import { useThemeVars } from '@/composables/useThemeVars'
import { useAppStore } from '@/stores/app'
import { formatBytesPerSecondWithConfig, formatBytesWithConfig, formatDateTime, formatUptimeWithFormat, getStatus } from '@/utils/helper'
import { getOSImage, getOSName } from '@/utils/osImageHelper'
import { getRegionCode, getRegionDisplayName } from '@/utils/regionHelper'
import { formatPriceWithCycle, getDaysUntilExpired, getExpireStatus, parseTags } from '@/utils/tagHelper'

const props = defineProps<{ nodes: NodeData[] }>()

const emit = defineEmits<{ click: [node: NodeData] }>()

const isTouchDevice = computed(() => {
  if (typeof window === 'undefined')
    return false
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0
})

const appStore = useAppStore()
const themeVars = useThemeVars()

const showPingChart = ref(false)
const selectedNode = ref<NodeData | null>(null)

const sortKey = ref<string>('')
const sortDir = ref<1 | -1>(1)

function handleSort(col: string) {
  if (sortKey.value === col) {
    sortDir.value = sortDir.value === 1 ? -1 : 1
  }
  else {
    sortKey.value = col
    sortDir.value = 1
  }
}

const sortedNodes = computed(() => {
  const nodes = [...props.nodes]
  const key = sortKey.value
  const dir = sortDir.value
  if (!key)
    return nodes
  return nodes.sort((a, b) => {
    switch (key) {
      case 'status': return dir * ((a.online ? 1 : 0) - (b.online ? 1 : 0))
      case 'region': {
        const va = (a.region || '').toLowerCase()
        const vb = (b.region || '').toLowerCase()
        return dir * (va < vb ? -1 : va > vb ? 1 : 0)
      }
      case 'name': {
        const va = (a.name || '').toLowerCase()
        const vb = (b.name || '').toLowerCase()
        return dir * (va < vb ? -1 : va > vb ? 1 : 0)
      }
      case 'uptime': return dir * ((a.uptime ?? 0) - (b.uptime ?? 0))
      case 'os': {
        const va = (a.os || '').toLowerCase()
        const vb = (b.os || '').toLowerCase()
        return dir * (va < vb ? -1 : va > vb ? 1 : 0)
      }
      case 'cpu': return dir * ((a.cpu ?? 0) - (b.cpu ?? 0))
      case 'mem': return dir * ((a.ram ?? 0) / (a.mem_total || 1) - (b.ram ?? 0) / (b.mem_total || 1))
      case 'disk': return dir * ((a.disk ?? 0) / (a.disk_total || 1) - (b.disk ?? 0) / (b.disk_total || 1))
      case 'traffic':
      case 'rate':
        return dir * (((a.net_out ?? 0) + (a.net_in ?? 0)) - ((b.net_out ?? 0) + (b.net_in ?? 0)))
      default: return 0
    }
  })
})

const columns = computed(() => appStore.listViewColumns)

const formatBytes = (bytes: number) => formatBytesWithConfig(bytes, appStore.byteDecimals)
const formatBytesPerSecond = (bytes: number) => formatBytesPerSecondWithConfig(bytes, appStore.byteDecimals)
const formatUptime = (seconds: number) => formatUptimeWithFormat(seconds, appStore.uptimeFormat)

const gridStyle = computed(() => {
  const visibleColumns = columns.value
  const columnWidths = appStore.listColumnWidths
  const columnGap = appStore.listColumnGap
  const templateColumns = visibleColumns.map(col => columnWidths[col] || 'auto')
  return { gridTemplateColumns: templateColumns.join(' '), gap: columnGap }
})

const offlineOverlayContentStyle = computed(() => {
  const statusIndex = columns.value.indexOf('status')
  const regionIndex = columns.value.indexOf('region')
  const nameIndex = columns.value.indexOf('name')
  const startColumn = nameIndex !== -1
    ? nameIndex + 1
    : regionIndex !== -1
      ? regionIndex + 2
      : statusIndex === -1 ? 1 : statusIndex + 2
  return { gridColumn: `${startColumn} / -1` }
})

const offlineOverlayMaskStyle = computed(() => {
  const statusIndex = columns.value.indexOf('status')
  return { gridColumn: statusIndex === -1 ? '1 / -1' : `${statusIndex + 2} / -1` }
})

const offlineOverlayRegionStyle = computed(() => {
  const regionIndex = columns.value.indexOf('region')
  if (regionIndex === -1)
    return null
  return { gridColumn: `${regionIndex + 1} / span 1` }
})

function getColumnPadding(col: string): Record<string, string> {
  const padding = appStore.listColumnPadding[col]
  return padding ? { padding } : {}
}

function getColumnMargin(col: string): Record<string, string> {
  const margin = appStore.listColumnMargin[col]
  return margin ? { margin } : {}
}

function getColumnStyle(col: string): Record<string, string> {
  return { ...getColumnPadding(col), ...getColumnMargin(col) }
}

const rowHeightStyle = computed(() => {
  const height = appStore.listRowHeight
  return height ? { height, minHeight: height } : {}
})

const hasBackgroundBlur = computed(() => appStore.backgroundEnabled && appStore.cardBlurRadius > 0)

function getFlagSrc(region: string): string {
  return `/images/flags/${getRegionCode(region)}.svg`
}

function handleClick(node: NodeData) {
  emit('click', node)
}

function openPingChart(node: NodeData) {
  selectedNode.value = node
  showPingChart.value = true
}

function showTrafficProgress(node: NodeData): boolean {
  return node.traffic_limit > 0
}

function getTrafficUsedPercentage(node: NodeData): number {
  if (node.traffic_limit <= 0)
    return 0
  const { net_total_up = 0, net_total_down = 0, traffic_limit_type } = node
  let used = 0
  switch (traffic_limit_type) {
    case 'up': used = net_total_up
      break
    case 'down': used = net_total_down
      break
    case 'min': used = Math.min(net_total_up, net_total_down)
      break
    case 'max': used = Math.max(net_total_up, net_total_down)
      break
    case 'sum':
    default:
      used = net_total_up + net_total_down
      break
  }
  return Math.min((used / node.traffic_limit) * 100, 100)
}

function getTrafficUsed(node: NodeData): number {
  const { net_total_up = 0, net_total_down = 0, traffic_limit_type } = node
  switch (traffic_limit_type) {
    case 'up': return net_total_up
    case 'down': return net_total_down
    case 'min': return Math.min(net_total_up, net_total_down)
    case 'max': return Math.max(net_total_up, net_total_down)
    case 'sum':
    default: return net_total_up + net_total_down
  }
}

function formatOfflineTime(node: NodeData): string {
  return formatDateTime(node.time)
}

function getExpireBadgeColor(status: string): string {
  switch (status) {
    case 'expired':
    case 'critical': return '#E54D2E'
    case 'warning': return '#F97316'
    case 'long_term': return '#8D8D8D'
    case 'normal':
    default: return '#30A46C'
  }
}

function getNodeTags(node: NodeData): Array<{ text: string, color: string }> {
  const tags: Array<{ text: string, color: string }> = []
  const lang = appStore.lang
  if (node.price !== 0) {
    const days = getDaysUntilExpired(node.expired_at)
    const status = getExpireStatus(node.expired_at)
    const color = getExpireBadgeColor(status)
    if (status === 'expired')
      tags.push({ text: lang === 'zh-CN' ? '已过期' : 'Expired', color })
    else if (status === 'long_term')
      tags.push({ text: lang === 'zh-CN' ? '长期' : 'Long-term', color })
    else tags.push({ text: lang === 'zh-CN' ? `剩余 ${days} 天` : `${days} days left`, color })
    const priceText = formatPriceWithCycle(node.price, node.billing_cycle, node.currency, lang)
    tags.push({ text: priceText, color: '#0090FF' })
  }
  const customTags = parseTags(node.tags)
  for (const tag of customTags) tags.push({ text: tag.text, color: tag.hex })
  return tags
}

const columnTitles: Record<string, string> = {
  status: '状态',
  region: '地区',
  name: '节点',
  tags: '标签',
  uptime: '运行时间',
  os: '系统',
  cpu: 'CPU',
  mem: '内存',
  disk: '硬盘',
  traffic: '流量',
  rate: '速率',
}

function makeTagColor(hex: string) {
  return { color: `${hex}20`, textColor: hex, borderColor: `${hex}40` }
}
</script>

<template>
  <div class="node-list-wrapper">
    <TooltipProvider :delay-duration="200">
      <div
        class="min-w-fit w-full rounded-md border bg-card"
        :class="[
          appStore.lightCardContrast && !appStore.isDark && 'light-list-contrast',
          hasBackgroundBlur && 'glass-list-enabled glass-card',
        ]"
      >
        <!-- 表头 -->
        <div class="node-list-header" :style="gridStyle">
          <template v-for="col in columns" :key="col">
            <div
              :class="`node-list-header__${col}`"
              :style="getColumnStyle(col)"
              class="sortable-header"
              @click="handleSort(col)"
            >
              <span class="text-xs text-muted-foreground">
                {{ columnTitles[col] }}{{ sortKey === col ? (sortDir === 1 ? ' ↑' : ' ↓') : '' }}
              </span>
            </div>
          </template>
        </div>

        <!-- 行 -->
        <div
          v-for="node in sortedNodes"
          :key="node.uuid"
          class="node-list-row cursor-pointer hover:bg-accent/40 transition-colors"
          :class="{ 'node-list-row--offline': !node.online }"
          :style="rowHeightStyle"
          @click="handleClick(node)"
        >
          <div class="node-list-item" :style="gridStyle">
            <template v-for="col in columns" :key="col">
              <!-- 在线状态指示器 -->
              <div v-if="col === 'status'" class="node-list-item__status" :style="getColumnStyle('status')">
                <div class="flex gap-1 items-center">
                  <TooltipX v-if="appStore.showPingChartButton">
                    <template #trigger>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        class="p-1"
                        @click.stop="openPingChart(node)"
                      >
                        <Icon icon="icon-park-outline:area-map" :width="14" :height="14" />
                      </Button>
                    </template>
                    查看延迟图表
                  </TooltipX>
                  <Tag v-if="appStore.listStatusStyle === 'tag'" :type="node.online ? 'success' : 'error'" size="small">
                    {{ node.online ? '在线' : '离线' }}
                  </Tag>
                  <Badge v-else :variant="node.online ? 'default' : 'destructive'">
                    {{ node.online ? '在线' : '离线' }}
                  </Badge>
                </div>
              </div>

              <!-- 国旗 -->
              <div v-else-if="col === 'region'" class="node-list-item__region" :style="getColumnStyle('region')">
                <img
                  :src="getFlagSrc(node.region)"
                  :alt="getRegionDisplayName(node.region)"
                  class="size-5 rounded-sm"
                >
              </div>

              <!-- 节点名称 -->
              <div v-else-if="col === 'name'" class="node-list-item__name" :style="getColumnStyle('name')">
                <span class="text-sm font-semibold">{{ node.name }}</span>
              </div>

              <!-- 标签 -->
              <div v-else-if="col === 'tags'" class="node-list-item__tags" :style="getColumnStyle('tags')">
                <div class="flex flex-wrap gap-1 items-center">
                  <template v-if="appStore.listTagsStyle === 'tag'">
                    <Tag
                      v-for="(tag, index) in getNodeTags(node)"
                      :key="index"
                      :color="makeTagColor(tag.color)"
                      size="small"
                    >
                      {{ tag.text }}
                    </Tag>
                  </template>
                  <template v-else>
                    <Badge
                      v-for="(tag, index) in getNodeTags(node)"
                      :key="index"
                      :style="{ backgroundColor: tag.color, color: '#fff' }"
                    >
                      {{ tag.text }}
                    </Badge>
                  </template>
                </div>
              </div>

              <!-- 运行时间 -->
              <div v-else-if="col === 'uptime'" class="node-list-item__uptime" :style="getColumnStyle('uptime')">
                <span class="text-xs text-muted-foreground" :style="{ fontFamily: appStore.numberFontFamily }">
                  {{ formatUptime(node.uptime ?? 0) }}
                </span>
              </div>

              <!-- 操作系统 -->
              <div v-else-if="col === 'os'" class="node-list-item__os" :style="getColumnStyle('os')">
                <div class="flex gap-1 items-center">
                  <img :src="getOSImage(node.os)" :alt="getOSName(node.os)" class="size-4">
                  <span class="text-xs text-muted-foreground">{{ getOSName(node.os) }}</span>
                </div>
              </div>

              <!-- CPU -->
              <div v-else-if="col === 'cpu'" class="node-list-item__cpu" :style="getColumnStyle('cpu')">
                <div class="flex flex-col gap-0.5">
                  <div class="text-[11px] flex gap-1 items-center" :style="{ fontFamily: appStore.numberFontFamily }">
                    <span>{{ (node.cpu ?? 0).toFixed(1) }}%</span>
                    <div class="flex-1" />
                    <span class="text-muted-foreground">{{ node.load.toFixed(2) ?? 0 }}, {{ node.load5.toFixed(2) ?? 0 }}, {{ node.load15.toFixed(2) ?? 0 }}</span>
                  </div>
                  <ProgressThin :percentage="node.cpu ?? 0" :status="getStatus(node.cpu ?? 0)" :height="4" />
                </div>
              </div>

              <!-- 内存 -->
              <div v-else-if="col === 'mem'" class="node-list-item__mem" :style="getColumnStyle('mem')">
                <div class="flex flex-col gap-0.5">
                  <div class="text-[11px] flex gap-1 items-center" :style="{ fontFamily: appStore.numberFontFamily }">
                    <span>{{ ((node.ram ?? 0) / (node.mem_total || 1) * 100).toFixed(1) }}%</span>
                    <div class="flex-1" />
                    <span class="text-muted-foreground">{{ formatBytes(node.ram ?? 0) }} / {{ formatBytes(node.mem_total ?? 0) }}</span>
                  </div>
                  <ProgressThin :percentage="(node.ram ?? 0) / (node.mem_total || 1) * 100" :status="getStatus((node.ram ?? 0) / (node.mem_total || 1) * 100)" :height="4" />
                </div>
              </div>

              <!-- 硬盘 -->
              <div v-else-if="col === 'disk'" class="node-list-item__disk" :style="getColumnStyle('disk')">
                <div class="flex flex-col gap-0.5">
                  <div class="text-[11px] flex gap-1 items-center" :style="{ fontFamily: appStore.numberFontFamily }">
                    <span>{{ ((node.disk ?? 0) / (node.disk_total || 1) * 100).toFixed(1) }}%</span>
                    <div class="flex-1" />
                    <span class="text-muted-foreground">{{ formatBytes(node.disk ?? 0) }} / {{ formatBytes(node.disk_total ?? 0) }}</span>
                  </div>
                  <ProgressThin :percentage="(node.disk ?? 0) / (node.disk_total || 1) * 100" :status="getStatus((node.disk ?? 0) / (node.disk_total || 1) * 100)" :height="4" />
                </div>
              </div>

              <!-- 速率 -->
              <div v-else-if="col === 'rate'" class="node-list-item__rate" :style="getColumnStyle('rate')">
                <div class="text-[11px] flex flex-col gap-1" :style="{ fontFamily: appStore.numberFontFamily }">
                  <span :style="{ color: themeVars.successColor }">↑{{ formatBytesPerSecond(node.net_out ?? 0) }}</span>
                  <span :style="{ color: themeVars.infoColor }">↓{{ formatBytesPerSecond(node.net_in ?? 0) }}</span>
                </div>
              </div>

              <!-- 流量 -->
              <div v-else-if="col === 'traffic'" class="node-list-item__traffic" :style="getColumnStyle('traffic')">
                <div class="traffic-cell">
                  <TooltipX :trigger="isTouchDevice ? 'click' : 'hover'">
                    <template #trigger>
                      <div
                        class="flex flex-col gap-0.5 w-full"
                        :class="{ 'cursor-help': !isTouchDevice }"
                        @click.stop
                      >
                        <div class="text-[11px] flex gap-1 items-center" :style="{ fontFamily: appStore.numberFontFamily }">
                          <span v-if="showTrafficProgress(node)">{{ getTrafficUsedPercentage(node).toFixed(1) }}%</span>
                          <div class="flex-1" />
                          <span class="text-muted-foreground">
                            {{ formatBytes(getTrafficUsed(node)) }} /
                            <template v-if="showTrafficProgress(node)">{{ formatBytes(node.traffic_limit) }}</template>
                            <template v-else>∞</template>
                          </span>
                        </div>
                        <TrafficProgress
                          :upload="node.net_total_up ?? 0"
                          :download="node.net_total_down ?? 0"
                          :traffic-limit="node.traffic_limit"
                          :traffic-limit-type="(node.traffic_limit_type || 'sum')"
                          height="4px"
                        />
                      </div>
                    </template>
                    <div class="text-[11px] flex flex-col gap-1" :style="{ fontFamily: appStore.numberFontFamily }">
                      <span><span :style="{ color: themeVars.successColor }">↑</span> {{ formatBytes(node.net_total_up ?? 0) }}</span>
                      <span><span :style="{ color: themeVars.infoColor }">↓</span> {{ formatBytes(node.net_total_down ?? 0) }}</span>
                    </div>
                  </TooltipX>
                </div>
              </div>
            </template>
          </div>

          <div v-if="!node.online" class="node-offline-overlay" aria-hidden="true">
            <div class="node-offline-overlay__grid" :style="gridStyle">
              <div class="node-offline-overlay__mask" :style="offlineOverlayMaskStyle" />
              <div v-if="offlineOverlayRegionStyle" class="node-offline-overlay__region" :style="offlineOverlayRegionStyle">
                <img
                  :src="getFlagSrc(node.region)"
                  :alt="getRegionDisplayName(node.region)"
                  class="size-4 rounded-sm shrink-0"
                >
              </div>
              <div class="node-offline-overlay__content" :style="offlineOverlayContentStyle">
                <span class="node-offline-overlay__name text-sm font-semibold truncate">{{ node.name }}</span>
                <span class="node-offline-overlay__time text-xs text-muted-foreground" :style="{ fontFamily: appStore.numberFontFamily }">
                  最后在线 {{ formatOfflineTime(node) }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>

    <Dialog v-model:open="showPingChart">
      <DialogContent class="max-w-[min(92vw,960px)]">
        <DialogTitle class="text-base font-medium">
          {{ selectedNode ? `${selectedNode.name} - 延迟监控` : '延迟监控' }}
        </DialogTitle>
        <PingChart v-if="selectedNode" :uuid="selectedNode.uuid" />
      </DialogContent>
    </Dialog>
  </div>
</template>

<style scoped>
.node-list-wrapper {
  overflow-x: auto;
  min-width: 0;
}

.node-list-header,
.node-list-item {
  display: grid;
  align-items: center;
}

.node-list-header {
  padding: 8px 16px;
  background-color: hsl(var(--muted) / 0.4);
  border-radius: var(--radius);
  border-bottom: 1px solid var(--border);
}

.node-list-row {
  position: relative;
  overflow: hidden;
  padding: 8px 16px;
  border-bottom: 1px solid var(--border);
}

.node-list-row:last-child {
  border-bottom: 0;
}

.node-offline-overlay {
  position: absolute;
  inset: 0;
  z-index: 2;
  padding: 8px 16px;
  pointer-events: none;
  transition: opacity 200ms ease;
}

.node-list-row:hover .node-offline-overlay {
  opacity: 0;
}

.node-offline-overlay__grid {
  display: grid;
  height: 100%;
  align-items: stretch;
}

.node-offline-overlay__mask,
.node-offline-overlay__region,
.node-offline-overlay__content {
  grid-row: 1;
}

.node-offline-overlay__mask {
  align-self: stretch;
  height: 100%;
  background-color: color-mix(in srgb, var(--card) 76%, transparent);
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
}

.node-offline-overlay__region,
.node-offline-overlay__content {
  position: relative;
  z-index: 1;
}

.node-offline-overlay__region {
  display: flex;
  align-self: center;
  align-items: center;
  justify-content: center;
}

.node-offline-overlay__content {
  display: flex;
  align-self: center;
  min-width: 0;
  max-width: 100%;
  flex-direction: row;
  gap: 8px;
  align-items: center;
  justify-content: flex-start;
}

.node-offline-overlay__name {
  min-width: 0;
  max-width: min(40%, 280px);
}

.node-list-header__status,
.node-list-item__status,
.node-list-header__region,
.node-list-item__region {
  display: flex;
  justify-content: center;
  align-items: center;
}

.node-list-header__name,
.node-list-item__name,
.node-list-header__uptime,
.node-list-item__uptime,
.node-list-header__os,
.node-list-item__os {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.node-list-header__cpu,
.node-list-item__cpu,
.node-list-header__mem,
.node-list-item__mem,
.node-list-header__disk,
.node-list-item__disk,
.node-list-header__traffic,
.node-list-item__traffic,
.node-list-header__rate,
.node-list-item__rate,
.node-list-header__tags,
.node-list-item__tags {
  min-width: 0;
}

.sortable-header {
  cursor: pointer;
  user-select: none;
}

.sortable-header:hover {
  opacity: 0.75;
}

.traffic-cell {
  min-height: 38px;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.light-list-contrast {
  box-shadow: 0 2px 8px 0 rgba(0, 0, 0, 0.08);
  border-color: rgba(0, 0, 0, 0.12);
}

.glass-list-enabled {
  background-color: rgba(255, 255, 255, 0.7) !important;
}

html.dark .glass-list-enabled {
  background-color: rgba(24, 24, 28, 0.85) !important;
}
</style>
