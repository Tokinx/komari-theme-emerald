<script setup lang="ts">
import type { NodeData } from '@/stores/nodes'
import { Icon } from '@iconify/vue'
import { computed, ref } from 'vue'
import PingChart from '@/components/PingChart.vue'
import TrafficProgress from '@/components/TrafficProgress.vue'
import { Button } from '@/components/ui/button'
import { CardX } from '@/components/ui/card-x'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { ProgressThin } from '@/components/ui/progress-thin'
import { Tag } from '@/components/ui/tag'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useThemeVars } from '@/composables/useThemeVars'
import { useAppStore } from '@/stores/app'
import { formatBytesPerSecondWithConfig, formatBytesWithConfig, formatDateTime, formatUptimeWithFormat, getStatus } from '@/utils/helper'
import { getOSImage, getOSName } from '@/utils/osImageHelper'
import { getRegionCode, getRegionDisplayName } from '@/utils/regionHelper'
import { formatPriceWithCycle, getDaysUntilExpired, getExpireStatus, getExpireStatusHexColor, parseTags } from '@/utils/tagHelper'

const props = defineProps<{ node: NodeData }>()

const emit = defineEmits<{ click: [] }>()

const appStore = useAppStore()
const themeVars = useThemeVars()

const showPingChart = ref(false)

const formatBytes = (bytes: number) => formatBytesWithConfig(bytes, appStore.byteDecimals)
const formatBytesPerSecond = (bytes: number) => formatBytesPerSecondWithConfig(bytes, appStore.byteDecimals)
const formatUptime = (seconds: number) => formatUptimeWithFormat(seconds, appStore.uptimeFormat)
const offlineTime = computed(() => formatDateTime(props.node.time))

const cpuStatus = computed(() => getStatus(props.node.cpu ?? 0))
const memPercentage = computed(() => (props.node.ram ?? 0) / (props.node.mem_total || 1) * 100)
const memStatus = computed(() => getStatus(memPercentage.value))
const diskPercentage = computed(() => (props.node.disk ?? 0) / (props.node.disk_total || 1) * 100)
const diskStatus = computed(() => getStatus(diskPercentage.value))

const showTrafficProgress = computed(() => props.node.traffic_limit > 0)

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

const priceTags = computed(() => {
  const tags: Array<{ text: string, color: string }> = []
  const lang = appStore.lang
  const node = props.node
  if (node.price !== 0) {
    const days = getDaysUntilExpired(node.expired_at)
    const status = getExpireStatus(node.expired_at)
    const color = getExpireStatusHexColor(status)
    if (status === 'expired')
      tags.push({ text: lang === 'zh-CN' ? '已过期' : 'Expired', color })
    else if (status === 'long_term')
      tags.push({ text: lang === 'zh-CN' ? '长期' : 'Long-term', color })
    else tags.push({ text: lang === 'zh-CN' ? `剩余 ${days} 天` : `${days} days left`, color })
    const priceText = formatPriceWithCycle(node.price, node.billing_cycle, node.currency, lang)
    tags.push({ text: priceText, color: themeVars.value.infoColor })
  }
  return tags
})

const customTags = computed(() => parseTags(props.node.tags).map(t => ({ text: t.text, color: t.hex })))
const mergedTags = computed(() => [...customTags.value, ...priceTags.value])
const shouldShowTagsInSeparateRow = computed(() => appStore.tagsInSeparateRow && mergedTags.value.length > 0)

const hasBackgroundBlur = computed(() => appStore.backgroundEnabled && appStore.cardBlurRadius > 0)

const cardClassExtras = computed(() => [
  props.node.online ? 'hover:border-primary' : 'node-card--offline',
  appStore.lightCardContrast && !appStore.isDark && 'light-card-contrast',
  hasBackgroundBlur.value && 'glass-card-enabled glass-card',
])

function makeTagColor(hex: string) {
  return { color: `${hex}20`, textColor: hex, borderColor: `${hex}40` }
}
</script>

<template>
  <div>
    <TooltipProvider :delay-duration="200">
      <CardX
        hoverable
        class="node-card w-full cursor-pointer transition-all duration-200"
        :class="cardClassExtras"
        @click="emit('click')"
      >
        <template #header>
          <div class="flex gap-2 min-w-0 items-center">
            <img
              :src="`/images/flags/${getRegionCode(props.node.region)}.svg`"
              :alt="getRegionDisplayName(props.node.region)"
              class="size-5 shrink-0"
            >
            <div v-if="customTags.length > 0 && !appStore.tagsInSeparateRow" class="has-tags flex shrink-0 flex-wrap gap-1 items-center">
              <Tag
                v-for="(tag, index) in customTags"
                :key="index"
                size="small"
                :color="makeTagColor(tag.color)"
              >
                {{ tag.text }}
              </Tag>
            </div>
            <span class="text-lg font-bold flex-1 min-w-0 truncate">{{ props.node.name }}</span>
          </div>
        </template>

        <template #header-extra>
          <div class="flex gap-2 items-center">
            <Tooltip v-if="appStore.showPingChartButton">
              <TooltipTrigger as-child>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  class="size-7 p-1.5"
                  @click.stop="showPingChart = true"
                >
                  <Icon icon="icon-park-outline:area-map" :width="16" :height="16" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>查看延迟图表</TooltipContent>
            </Tooltip>
            <div
              class="online-badge"
              :class="{ 'online-badge--online': props.node.online }"
              :style="{ backgroundColor: props.node.online ? themeVars.successColor : themeVars.errorColor }"
            >
              <div
                v-if="props.node.online"
                class="online-badge__wave"
                :style="{ backgroundColor: themeVars.successColor }"
              />
            </div>
          </div>
        </template>

        <template #default>
          <div v-if="!props.node.online" class="node-offline-overlay" aria-hidden="true">
            <div class="node-offline-overlay__content">
              <div class="node-offline-overlay__header flex gap-2 min-w-0 items-center justify-center">
                <img
                  :src="`/images/flags/${getRegionCode(props.node.region)}.svg`"
                  :alt="getRegionDisplayName(props.node.region)"
                  class="size-5 shrink-0"
                >
                <span class="text-base font-semibold text-center break-all">{{ props.node.name }}</span>
              </div>
              <span class="text-sm font-medium text-center" style="color: var(--destructive);">节点已离线</span>
              <span class="text-xs text-center text-muted-foreground" :style="{ fontFamily: appStore.numberFontFamily }">
                最后在线 {{ offlineTime }}
              </span>
              <div v-if="!appStore.tagsInSeparateRow && priceTags.length > 0" class="node-offline-overlay__tags flex flex-wrap gap-1 items-center justify-center">
                <Tag
                  v-for="(tag, index) in priceTags"
                  :key="index"
                  size="small"
                  :color="makeTagColor(tag.color)"
                >
                  {{ tag.text }}
                </Tag>
              </div>
            </div>
          </div>

          <div class="flex flex-col gap-4">
            <div class="flex-between">
              <span class="text-[13px] text-muted-foreground">操作系统</span>
              <div class="flex gap-2 items-center">
                <img :src="getOSImage(props.node.os)" :alt="getOSName(props.node.os)" class="size-4">
                <span class="text-[13px]">{{ getOSName(props.node.os) }} / {{ props.node.arch }}</span>
              </div>
            </div>

            <div class="gap-x-6 gap-y-4 grid" :class="appStore.cardProgressLayout === '1col' ? 'grid-cols-1' : 'grid-cols-2'">
              <!-- CPU -->
              <div class="flex flex-col gap-1.5">
                <div class="flex-between">
                  <span class="text-[13px] text-muted-foreground">CPU</span>
                  <span class="text-[13px]" :style="{ fontFamily: appStore.numberFontFamily }">{{ (props.node.cpu ?? 0).toFixed(1) }}%</span>
                </div>
                <ProgressThin :percentage="props.node.cpu ?? 0" :status="cpuStatus" :height="4" />
                <span class="text-[10px] text-muted-foreground" :style="{ fontFamily: appStore.numberFontFamily }">
                  {{ node.load.toFixed(2) ?? 0 }}, {{ node.load5.toFixed(2) ?? 0 }}, {{ node.load15.toFixed(2) ?? 0 }}
                </span>
              </div>

              <!-- 内存 -->
              <div class="flex flex-col gap-1.5">
                <div class="flex-between">
                  <span class="text-[13px] text-muted-foreground">内存</span>
                  <span class="text-[13px]" :style="{ fontFamily: appStore.numberFontFamily }">{{ memPercentage.toFixed(1) }}%</span>
                </div>
                <ProgressThin :percentage="memPercentage" :status="memStatus" :height="4" />
                <span class="text-[10px] text-muted-foreground" :style="{ fontFamily: appStore.numberFontFamily }">
                  {{ formatBytes(props.node.ram ?? 0) }} / {{ formatBytes(props.node.mem_total ?? 0) }}
                </span>
              </div>

              <!-- 硬盘 -->
              <div class="flex flex-col gap-1.5">
                <div class="flex-between">
                  <span class="text-[13px] text-muted-foreground">硬盘</span>
                  <span class="text-[13px]" :style="{ fontFamily: appStore.numberFontFamily }">{{ diskPercentage.toFixed(1) }}%</span>
                </div>
                <ProgressThin :percentage="diskPercentage" :status="diskStatus" :height="4" />
                <span class="text-[10px] text-muted-foreground" :style="{ fontFamily: appStore.numberFontFamily }">
                  {{ formatBytes(props.node.disk ?? 0) }} / {{ formatBytes(props.node.disk_total ?? 0) }}
                </span>
              </div>

              <!-- 流量进度条 -->
              <div class="flex flex-col gap-1.5">
                <div class="flex-between">
                  <span class="text-[13px] text-muted-foreground">流量</span>
                  <span class="text-[13px]" :style="{ fontFamily: appStore.numberFontFamily }">
                    <template v-if="showTrafficProgress">{{ trafficUsedPercentage.toFixed(1) }}%</template>
                    <template v-else>∞</template>
                  </span>
                </div>
                <TrafficProgress
                  :height="4"
                  :upload="props.node.net_total_up ?? 0"
                  :download="props.node.net_total_down ?? 0"
                  :traffic-limit="props.node.traffic_limit"
                  :traffic-limit-type="(props.node.traffic_limit_type || 'sum')"
                />
                <Tooltip v-if="showTrafficProgress">
                  <TooltipTrigger as-child>
                    <span class="text-[10px] cursor-help text-muted-foreground" :style="{ fontFamily: appStore.numberFontFamily }">
                      {{ formatBytes(trafficUsed) }} / {{ formatBytes(props.node.traffic_limit) }}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    <span class="text-[10px]" :style="{ fontFamily: appStore.numberFontFamily }">
                      <span :style="{ color: appStore.trafficSplitColor ? themeVars.successColor : 'inherit' }">↑ {{ formatBytes(props.node.net_total_up ?? 0) }}</span>
                      <span class="px-1" />
                      <span :style="{ color: appStore.trafficSplitColor ? themeVars.infoColor : 'inherit' }">↓ {{ formatBytes(props.node.net_total_down ?? 0) }}</span>
                    </span>
                  </TooltipContent>
                </Tooltip>
                <span v-else class="text-[10px] text-muted-foreground" :style="{ fontFamily: appStore.numberFontFamily }">
                  <span :style="{ color: appStore.trafficSplitColor ? themeVars.successColor : 'inherit' }">↑ {{ formatBytes(props.node.net_total_up ?? 0) }}</span>
                  <span class="px-1" />
                  <span :style="{ color: appStore.trafficSplitColor ? themeVars.infoColor : 'inherit' }">↓ {{ formatBytes(props.node.net_total_down ?? 0) }}</span>
                </span>
              </div>
            </div>

            <!-- 网络速率 -->
            <div class="flex-between">
              <span class="text-[13px] text-muted-foreground">网络速率</span>
              <div class="text-[13px] flex gap-1" :style="{ fontFamily: appStore.numberFontFamily }">
                <span :style="{ color: themeVars.successColor }">↑ {{ formatBytesPerSecond(props.node.net_out ?? 0) }}</span>
                <span :style="{ color: themeVars.infoColor }">↓ {{ formatBytesPerSecond(props.node.net_in ?? 0) }}</span>
              </div>
            </div>

            <!-- 运行时间 -->
            <div class="uptime-row flex-between">
              <span class="text-[13px] text-muted-foreground">运行时间</span>
              <div class="flex gap-2 items-center">
                <template v-if="!shouldShowTagsInSeparateRow">
                  <Tag
                    v-for="(tag, index) in priceTags"
                    :key="index"
                    size="small"
                    :color="makeTagColor(tag.color)"
                  >
                    {{ tag.text }}
                  </Tag>
                </template>
                <Tag
                  v-if="appStore.uptimeTagWrap"
                  size="small"
                  :color="makeTagColor('#8b5cf6')"
                >
                  {{ formatUptime(props.node.uptime ?? 0) }}
                </Tag>
                <span v-else class="text-[13px]" :style="{ fontFamily: appStore.numberFontFamily }">
                  {{ formatUptime(props.node.uptime ?? 0) }}
                </span>
              </div>
            </div>

            <!-- 标签单独一行显示 -->
            <div v-if="shouldShowTagsInSeparateRow" class="tags-separate-row flex-between">
              <span class="text-[13px] text-muted-foreground">标签</span>
              <div class="flex flex-wrap gap-1 items-center justify-end">
                <Tag
                  v-for="(tag, index) in mergedTags"
                  :key="index"
                  size="small"
                  :color="makeTagColor(tag.color)"
                >
                  {{ tag.text }}
                </Tag>
              </div>
            </div>
          </div>
        </template>
      </CardX>
    </TooltipProvider>

    <!-- 延迟图表弹窗 -->
    <Dialog v-model:open="showPingChart">
      <DialogContent class="max-w-[min(92vw,960px)]">
        <DialogTitle class="text-base font-medium">
          {{ props.node.name }} - 延迟监控
        </DialogTitle>
        <PingChart :uuid="props.node.uuid" />
      </DialogContent>
    </Dialog>
  </div>
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
  border: 1px solid color-mix(in srgb, var(--border) 72%, transparent);
  background-color: color-mix(in srgb, var(--card) 76%, transparent);
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
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

.has-tags {
  position: absolute;
  backdrop-filter: blur(8px);
  padding: 12px 22px 19px;
  border-radius: 10px;
  left: 1px;
  right: 1px;
  bottom: 1px;
  z-index: 9;
  transform: translateY(10%);
  opacity: 0;
  transition: 200ms;
}

.node-card:hover .has-tags {
  transform: translateY(0);
  opacity: 1;
}

.node-card:has(.has-tags):hover .flex-between:last-child {
  opacity: 0.3;
}

.light-card-contrast {
  background-color: rgba(250, 250, 252, 1) !important;
  box-shadow: 0 2px 8px 0 rgba(0, 0, 0, 0.08);
  border-color: rgba(0, 0, 0, 0.12) !important;
}

.light-card-contrast:hover {
  box-shadow: 0 4px 12px 0 rgba(0, 0, 0, 0.12);
  border-color: var(--primary) !important;
}

.glass-card-enabled {
  background-color: rgba(255, 255, 255, 0.7) !important;
}

.glass-card-enabled:hover {
  filter: brightness(0.95);
}

html.dark .glass-card-enabled {
  background-color: rgba(24, 24, 28, 0.85) !important;
}

html.dark .glass-card-enabled:hover {
  filter: brightness(1.1);
}

.online-badge {
  position: relative;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.online-badge__wave {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  opacity: 0.4;
  animation: online-badge-wave 1.5s infinite ease-out;
}

@keyframes online-badge-wave {
  0% {
    transform: scale(1);
    opacity: 0.4;
  }
  100% {
    transform: scale(2.5);
    opacity: 0;
  }
}
</style>
