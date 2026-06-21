<script setup lang="ts">
import type { NodeData } from '@/stores/nodes'
import { Icon } from '@iconify/vue'
import { computed } from 'vue'
import { Badge } from '@/components/ui/badge'
import { CardX } from '@/components/ui/card-x'
import { DataTooltip } from '@/components/ui/data-tooltip'
import { ProgressThin } from '@/components/ui/progress-thin'
import { useNodePingDisplay } from '@/composables/useNodePingDisplay'
import { useAppStore } from '@/stores/app'
import { formatBytesPerSecondWithConfig, formatBytesWithConfig, formatDateTime, formatUptimeWithFormat, getStatus } from '@/utils/helper'
import { getOSImage, getOSName } from '@/utils/osImageHelper'
import { getRegionCode, getRegionDisplayName } from '@/utils/regionHelper'
import { formatPriceWithCycle, getDaysUntilExpired, getExpireStatus, getExpireTextClass, parseTags } from '@/utils/tagHelper'

const props = defineProps<{ node: NodeData }>()

const emit = defineEmits<{
  click: []
  pingClick: [node: NodeData]
}>()

const appStore = useAppStore()

const formatBytes = (bytes: number) => formatBytesWithConfig(bytes, appStore.byteDecimals)
const formatBytesPerSecond = (bytes: number) => formatBytesPerSecondWithConfig(bytes, appStore.byteDecimals)
const formatUptime = (seconds: number) => formatUptimeWithFormat(seconds, 'hour')
const offlineTime = computed(() => formatDateTime(props.node.time))

const cpuStatus = computed(() => getStatus(props.node.cpu ?? 0))
const memPercentage = computed(() => (props.node.ram ?? 0) / (props.node.mem_total || 1) * 100)
const memStatus = computed(() => getStatus(memPercentage.value))
const diskPercentage = computed(() => (props.node.disk ?? 0) / (props.node.disk_total || 1) * 100)
const diskStatus = computed(() => getStatus(diskPercentage.value))

const {
  latencyRenderBars,
  lossRenderBars,
  latencyDisplay,
  lossDisplay,
  latencyPanelTooltip,
  lossPanelTooltip,
} = useNodePingDisplay(() => props.node.uuid)

function showTrafficProgress(node: NodeData): boolean {
  return node.traffic_limit > 0
}

const trafficUsedPercentage = computed(() => {
  if (props.node.traffic_limit <= 0)
    return 0
  const { net_total_up = 0, net_total_down = 0, traffic_limit_type } = props.node
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
  return Math.min((used / props.node.traffic_limit) * 100, 100)
})

const trafficUsed = computed(() => {
  const { net_total_up = 0, net_total_down = 0, traffic_limit_type } = props.node
  switch (traffic_limit_type) {
    case 'up': return net_total_up
    case 'down': return net_total_down
    case 'min': return Math.min(net_total_up, net_total_down)
    case 'max': return Math.max(net_total_up, net_total_down)
    case 'sum':
    default: return net_total_up + net_total_down
  }
})

interface PriceTagItem {
  text: string
  highlightValue?: string
  prefix?: string
  suffix?: string
}

const priceTags = computed<PriceTagItem[]>(() => {
  const tags: PriceTagItem[] = []
  const lang = appStore.lang
  const node = props.node
  if (node.price !== 0) {
    const days = getDaysUntilExpired(node.expired_at)
    const status = getExpireStatus(node.expired_at)
    const priceText = formatPriceWithCycle(node.price, node.billing_cycle, node.currency, lang)
    tags.push({ text: priceText })
    if (status === 'expired')
      tags.push({ text: lang === 'zh-CN' ? '已过期' : 'Expired' })
    else if (status === 'long_term')
      tags.push({ text: lang === 'zh-CN' ? '长期' : 'Long-term' })
    else if (lang === 'zh-CN')
      tags.push({ text: `剩余 ${days} 天`, prefix: '剩余 ', highlightValue: String(days), suffix: ' 天' })
    else
      tags.push({ text: `${days} days left`, highlightValue: String(days), suffix: ' days left' })
  }
  return tags
})

const remainingTimeTagClass = computed(() => {
  if (props.node.price === 0)
    return ''
  return getExpireTextClass(props.node.expired_at)
})

const customTags = computed(() => parseTags(props.node.tags).map(t => t.text))

function hasRegion(region: string | null | undefined): boolean {
  return Boolean(region?.trim())
}

function openPingDialog() {
  emit('pingClick', props.node)
}
</script>

<template>
  <CardX
    hoverable
    class="node-card w-full h-full cursor-pointer bg-background/50 border-none shadow-[0_0_0_3px] shadow-transparent hover:bg-background hover:shadow-slate-500/10 backdrop-blur-sm transition-all duration-200 rounded-md"
    :class="[!props.node.online && '!shadow-red-600/20']" @click="emit('click')"
  >
    <template #header>
      <div class="flex gap-2 min-w-0 items-center">
        <DataTooltip
          placement="right"
          :content="formatUptime(props.node.uptime ?? 0)"
          class="size-2 rounded-full" :class="[props.node.online ? 'bg-green-600' : 'bg-red-600']"
          content-class="whitespace-nowrap"
        >
          <div
            class="animate-ping absolute inset-0 rounded-full opacity-50"
            :class="[props.node.online ? 'bg-green-600' : 'bg-red-600']"
          />
        </DataTooltip>
        <span class="text-md font-bold flex-1 min-w-0 truncate">{{ props.node.name }}</span>
      </div>
    </template>

    <template #header-extra>
      <div class="flex gap-2 items-center">
        <img :src="getOSImage(props.node.os)" :alt="getOSName(props.node.os)" class="size-4">
        <img
          v-if="hasRegion(props.node.region)" :src="`/images/flags/${getRegionCode(props.node.region)}.svg`"
          :alt="getRegionDisplayName(props.node.region)" class="size-5 shrink-0"
        >
      </div>
    </template>

    <template #default>
      <div class="flex flex-col gap-3">
        <div class="gap-3 grid grid-cols-2">
          <!-- <div class="flex flex-col gap-1 col-span-2">
                <div class="flex gap-2 items-center">
                  <img :src="getOSImage(props.node.os)" :alt="getOSName(props.node.os)" class="size-4">
                  <span class="text-xs">{{ getOSName(props.node.os) }}</span>
                </div>
              </div> -->
          <!-- CPU -->
          <div class="flex flex-col gap-1">
            <div class="w-full text-xs flex flex-row justify-between">
              <span class="text-muted-foreground">
                CPU
              </span>
              <span>{{ (props.node.cpu ?? 0).toFixed(1) }}%</span>
            </div>
            <ProgressThin :percentage="props.node.cpu ?? 0" :status="cpuStatus" :height="4" />
            <div class="text-[11px] text-muted-foreground truncate">
              {{ props.node.load.toFixed(2) ?? 0 }}, {{ props.node.load5.toFixed(2) ?? 0 }}, {{
                props.node.load15.toFixed(2) ?? 0 }}
            </div>
          </div>

          <!-- 内存 -->
          <div class="flex flex-col gap-1">
            <div class="w-full text-xs flex flex-row justify-between">
              <span class="text-muted-foreground">
                内存
              </span>
              <span>{{ memPercentage.toFixed(1) }}%</span>
            </div>
            <ProgressThin :percentage="memPercentage" :status="memStatus" :height="4" />
            <DataTooltip
              placement="top" class="block"
              content-class="px-1.5 py-1 text-[10px]"
            >
              <div class="text-[11px] text-muted-foreground truncate">
                {{ formatBytes(props.node.ram ?? 0) }} / {{ formatBytes(props.node.mem_total ?? 0) }}
              </div>
              <template #content>
                <div class="flex items-center justify-between gap-3 whitespace-nowrap">
                  <span class="text-background/70">USED</span>
                  <span>{{ formatBytes(props.node.ram ?? 0) }}</span>
                </div>
                <div v-if="props.node.swap" class="flex items-center justify-between gap-3 whitespace-nowrap">
                  <span class="text-background/70">SWAP</span>
                  <span>{{ formatBytes(props.node.swap ?? 0) }}</span>
                </div>
              </template>
            </DataTooltip>
          </div>

          <!-- 硬盘 -->
          <div class="flex flex-col gap-1">
            <div class="w-full text-xs flex flex-row justify-between">
              <span class="text-muted-foreground">
                硬盘
              </span>
              <span>{{ diskPercentage.toFixed(1) }}%</span>
            </div>
            <ProgressThin :percentage="diskPercentage" :status="diskStatus" :height="4" />
            <div class="text-[11px] text-muted-foreground truncate">
              {{ formatBytes(props.node.disk ?? 0) }} / {{ formatBytes(props.node.disk_total ?? 0) }}
            </div>
          </div>

          <!-- 流量进度条 -->
          <div class="flex flex-col gap-1">
            <div class="w-full text-xs flex flex-row justify-between">
              <span class="text-muted-foreground">
                流量
              </span>
              <span>{{ trafficUsedPercentage.toFixed(1) }}%</span>
            </div>
            <ProgressThin :percentage="trafficUsedPercentage" status="success" :height="4" />
            <div class="text-[11px] text-muted-foreground truncate">
              {{ formatBytes(trafficUsed) }} /
              <template v-if="showTrafficProgress(node)">
                {{ formatBytes(props.node.traffic_limit) }}
              </template>
              <template v-else>
                ∞
              </template>
            </div>
          </div>
        </div>
        <div class="gap-1.5 grid grid-cols-6 relative">
          <div
            v-if="!props.node.online"
            class="absolute inset-0 flex flex-col gap-1 items-center justify-center z-1 text-center" aria-hidden="true"
          >
            <div class="text-sm font-medium text-destructive">
              离线
            </div>
            <div class="text-xs text-muted-foreground">
              {{ offlineTime }}
            </div>
          </div>
          <div
            class="flex flex-col gap-0.5 p-1 pl-2 rounded-sm bg-slate-500/5"
            :class="[priceTags.length ? 'col-span-2' : 'col-span-3', !props.node.online ? 'blur-xs opacity-60' : '']"
          >
            <div class="text-[11px] flex flex-col">
              <div class="text-green-600 flex flex-row items-center gap-1">
                <Icon icon="tabler:chevron-up" width="12" height="12" />
                {{ formatBytesPerSecond(props.node.net_out ?? 0) }}
              </div>
              <div class="text-blue-600 flex flex-row items-center gap-1">
                <Icon icon="tabler:chevron-down" width="12" height="12" />
                {{ formatBytesPerSecond(props.node.net_in ?? 0) }}
              </div>
            </div>
          </div>
          <div
            class="flex flex-col gap-0.5 p-1 pl-2 rounded-sm bg-slate-500/5"
            :class="[priceTags.length ? 'col-span-2' : 'col-span-3', !props.node.online ? 'blur-xs opacity-60' : '']"
          >
            <div class="text-[11px] text-muted-foreground flex flex-col">
              <div class="flex flex-row items-center gap-1">
                <Icon icon="tabler:upload" width="12" height="12" />
                {{ formatBytes(props.node.net_total_up ?? 0) }}
              </div>
              <div class="flex flex-row items-center gap-1">
                <Icon icon="tabler:download" width="12" height="12" />
                {{ formatBytes(props.node.net_total_down ?? 0) }}
              </div>
            </div>
          </div>
          <div
            v-if="priceTags.length" class="col-span-2 flex flex-col gap-0.5 p-1 pl-2 rounded-sm bg-slate-500/5"
            :class="[!props.node.online ? 'blur-xs opacity-60' : '']"
          >
            <div class="text-[11px] text-muted-foreground flex flex-col">
              <div v-for="(tag, index) in priceTags" :key="index" class="flex flex-row items-center gap-1">
                <template v-if="tag.highlightValue">
                  <span>{{ tag.prefix }}</span>
                  <span :class="remainingTimeTagClass">{{ tag.highlightValue }}</span>
                  <span>{{ tag.suffix }}</span>
                </template>
                <template v-else>
                  {{ tag.text }}
                </template>
              </div>
            </div>
          </div>
          <!-- 运行时长 -->
          <!-- <div
            class="col-span-6 flex flex-row gap-2 items-center p-1 rounded-sm bg-slate-500/5 justify-center text-[11px] text-muted-foreground"
            :class="[!props.node.online ? 'blur-xs opacity-60' : '']"
          >
            <span class="inline-flex flex-row gap-1 items-center">
              {{ formatUptime(props.node.uptime ?? 0) }}
            </span>
          </div> -->
          <!-- 延迟 -->
          <div
            role="button"
            tabindex="0"
            class="group/panel relative col-span-3 flex h-10 cursor-pointer flex-col gap-1.5 rounded-sm bg-slate-500/5 p-1.5 text-left transition-colors hover:bg-slate-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            :class="[!props.node.online ? 'blur-xs opacity-60' : '']" :title="latencyPanelTooltip"
            :aria-label="`${props.node.name} 延迟`"
            @click.stop="openPingDialog"
            @keydown.enter.stop.prevent="openPingDialog"
            @keydown.space.stop.prevent="openPingDialog"
          >
            <div class="flex items-center justify-between gap-2 text-[11px] leading-none relative">
              <span class="text-muted-foreground">延迟</span>
              <span class="font-medium text-foreground/85">{{ latencyDisplay }}</span>
            </div>
            <div
              class="grid h-full items-end gap-[1px] opacity-80 group-hover/panel:opacity-100"
              :style="{ gridTemplateColumns: `repeat(${latencyRenderBars.length}, minmax(0, 1fr))` }"
            >
              <DataTooltip v-for="bar in latencyRenderBars" :key="bar.key" placement="top" :content="bar.tooltip" class="h-full w-full">
                <span
                  class="block h-full w-full rounded-[1px] transition-transform duration-150 group-hover/data-tooltip:scale-y-160 group-hover/panel:opacity-60 group-hover/data-tooltip:!opacity-100"
                  :class="bar.className"
                />
              </DataTooltip>
            </div>
          </div>
          <!-- 丢包 -->
          <div
            role="button"
            tabindex="0"
            class="group/panel relative col-span-3 flex h-10 cursor-pointer flex-col gap-1.5 rounded-sm bg-slate-500/5 p-1.5 text-left transition-colors hover:bg-slate-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            :class="[!props.node.online ? 'blur-xs opacity-60' : '']" :title="lossPanelTooltip"
            :aria-label="`${props.node.name} 丢包`"
            @click.stop="openPingDialog"
            @keydown.enter.stop.prevent="openPingDialog"
            @keydown.space.stop.prevent="openPingDialog"
          >
            <div class="flex items-center justify-between gap-2 text-[11px] leading-none">
              <span class="text-muted-foreground">丢包</span>
              <span class="font-medium text-foreground/85">{{ lossDisplay }}</span>
            </div>
            <div
              class="grid h-full items-end gap-[1px] opacity-80 group-hover/panel:opacity-100"
              :style="{ gridTemplateColumns: `repeat(${lossRenderBars.length}, minmax(0, 1fr))` }"
            >
              <DataTooltip v-for="bar in lossRenderBars" :key="bar.key" placement="top" :content="bar.tooltip" class="h-full w-full">
                <span
                  class="block h-full w-full rounded-[1px] transition-transform duration-150 group-hover/data-tooltip:scale-y-160 group-hover/panel:opacity-60 group-hover/data-tooltip:!opacity-100"
                  :class="bar.className"
                />
              </DataTooltip>
            </div>
          </div>
        </div>
        <div v-if="customTags.length > 0" class="flex shrink-0 flex-wrap gap-1 items-center">
          <Badge
            v-for="(tag, index) in customTags" :key="index" variant="outline"
            class="!text-[11px] rounded text-muted-foreground border-muted-foreground/10 px-1.5"
          >
            {{ tag }}
          </Badge>
        </div>
      </div>
    </template>
  </CardX>
</template>

<style scoped>
.node-card {
  position: relative;
  overflow: hidden;
}

.node-offline-overlay {
  position: absolute;
  inset: 0;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  pointer-events: none;
  border-radius: inherit;
  background-color: var(--card);
  transition: opacity 200ms ease;
}

.node-card:hover .node-offline-overlay {
  opacity: 0;
}

.node-offline-overlay__content {
  display: flex;
  max-width: 100%;
  flex-direction: column;
  gap: 6px;
  align-items: center;
}

.node-offline-overlay__header,
.node-offline-overlay__tags {
  max-width: 100%;
}
</style>
