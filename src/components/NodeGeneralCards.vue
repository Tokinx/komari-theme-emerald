<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { useNow } from '@vueuse/core'
import { computed } from 'vue'
import { CardX } from '@/components/ui/card-x'
import { useAppStore } from '@/stores/app'
import { useNodesStore } from '@/stores/nodes'
import { formatBytesPerSecondSplit, formatBytesSplit } from '@/utils/helper'

const appStore = useAppStore()
const nodesStore = useNodesStore()

const now = useNow({ interval: 1000 })
const currentTime = computed(() => now.value.toLocaleString())

const totalSpeed = computed(() => {
  const onlineNodes = nodesStore.nodes.filter(node => node.online)
  const up = onlineNodes.reduce((sum, node) => sum + (node.net_out || 0), 0)
  const down = onlineNodes.reduce((sum, node) => sum + (node.net_in || 0), 0)
  return { up, down }
})

const totalTraffic = computed(() => {
  const up = nodesStore.nodes.reduce((sum, node) => sum + (node.net_total_up || 0), 0)
  const down = nodesStore.nodes.reduce((sum, node) => sum + (node.net_total_down || 0), 0)
  return { up, down }
})

const onlineRegionCount = computed(() => new Set(
  nodesStore.nodes.filter(node => node.online && node.region !== '').map(node => node.region),
).size)

const onlineNodeCount = computed(() => nodesStore.nodes.filter(node => node.online).length)

const formattedTrafficUp = computed(() => formatBytesSplit(totalTraffic.value.up, appStore.byteDecimals))
const formattedTrafficDown = computed(() => formatBytesSplit(totalTraffic.value.down, appStore.byteDecimals))

const formattedSpeedUp = computed(() => formatBytesPerSecondSplit(totalSpeed.value.up, appStore.byteDecimals))
const formattedSpeedDown = computed(() => formatBytesPerSecondSplit(totalSpeed.value.down, appStore.byteDecimals))

const hasBackgroundBlur = computed(() => appStore.backgroundEnabled && appStore.cardBlurRadius > 0)

const numberFontStyle = computed(() => ({ fontFamily: appStore.numberFontFamily }))
</script>

<template>
  <div
    class="general-info p-4 flex flex-col gap-2 sm:p-4 sm:gap-4 lg:grid lg:grid-cols-5"
    :class="{ 'light-general-contrast': appStore.lightCardContrast && !appStore.isDark }"
  >
    <!-- 当前时间 -->
    <CardX hoverable class="sm:min-h-32" :class="[hasBackgroundBlur && 'glass-card-enabled glass-card']" content-class="h-full">
      <div class="flex gap-2 items-center justify-between sm:hidden" :style="numberFontStyle">
        <span class="text-xs flex shrink-0 gap-1 items-center text-muted-foreground">
          <Icon icon="icon-park-outline:time" :width="14" :height="14" />
          当前时间
        </span>
        <span class="text-base font-bold">{{ currentTime }}</span>
      </div>
      <div class="flex-col h-full hidden justify-between sm:flex">
        <div :style="numberFontStyle">
          <span class="text-2xl font-bold">{{ currentTime }}</span>
        </div>
        <span class="text-xs flex gap-1 items-center text-muted-foreground">
          <Icon icon="icon-park-outline:time" :width="14" :height="14" />
          当前时间
        </span>
      </div>
    </CardX>

    <!-- 在线节点 -->
    <CardX hoverable class="sm:min-h-32" :class="[hasBackgroundBlur && 'glass-card-enabled glass-card']" content-class="h-full">
      <div class="flex gap-2 items-center justify-between sm:hidden" :style="numberFontStyle">
        <span class="text-xs flex shrink-0 gap-1 items-center text-muted-foreground">
          <Icon icon="icon-park-outline:heartbeat" :width="14" :height="14" />
          在线节点
        </span>
        <div class="flex items-baseline">
          <span class="text-base font-bold">{{ onlineNodeCount }}</span>
          <span class="text-xs px-1 text-muted-foreground">/</span>
          <span class="text-xs text-muted-foreground">{{ nodesStore.nodes.length }}</span>
        </div>
      </div>
      <div class="flex-col h-full hidden justify-between sm:flex">
        <div :style="numberFontStyle">
          <span class="text-2xl font-bold">{{ onlineNodeCount }}</span>
          <span class="text-xs px-1 text-muted-foreground">/</span>
          <span class="text-xs text-muted-foreground">{{ nodesStore.nodes.length }}</span>
        </div>
        <span class="text-xs flex gap-1 items-center text-muted-foreground">
          <Icon icon="icon-park-outline:heartbeat" :width="14" :height="14" />
          在线节点
        </span>
      </div>
    </CardX>

    <!-- 点亮区域 -->
    <CardX hoverable class="sm:min-h-32" :class="[hasBackgroundBlur && 'glass-card-enabled glass-card']" content-class="h-full">
      <div class="flex gap-2 items-center justify-between sm:hidden" :style="numberFontStyle">
        <span class="text-xs flex shrink-0 gap-1 items-center text-muted-foreground">
          <Icon icon="icon-park-outline:world" :width="14" :height="14" />
          点亮区域
        </span>
        <span class="text-base font-bold">{{ onlineRegionCount }}</span>
      </div>
      <div class="flex-col h-full hidden justify-between sm:flex">
        <div :style="numberFontStyle">
          <span class="text-2xl font-bold">{{ onlineRegionCount }}</span>
        </div>
        <span class="text-xs flex gap-1 items-center text-muted-foreground">
          <Icon icon="icon-park-outline:world" :width="14" :height="14" />
          点亮区域
        </span>
      </div>
    </CardX>

    <!-- 流量总览 -->
    <CardX hoverable class="sm:min-h-32" :class="[hasBackgroundBlur && 'glass-card-enabled glass-card']" content-class="h-full">
      <div class="flex gap-2 items-center justify-between sm:hidden" :style="numberFontStyle">
        <span class="text-xs flex shrink-0 gap-1 items-center text-muted-foreground">
          <Icon icon="icon-park-outline:transfer-data" :width="14" :height="14" />
          流量总览
        </span>
        <div class="flex gap-3">
          <div class="flex gap-0.5 items-baseline">
            <Icon icon="icon-park-outline:upload" :width="12" :height="12" class="self-center" />
            <span class="text-sm font-bold">{{ formattedTrafficUp.value }}</span>
            <span class="text-[10px] text-muted-foreground">{{ formattedTrafficUp.unit }}</span>
          </div>
          <div class="flex gap-0.5 items-baseline">
            <Icon icon="icon-park-outline:download" :width="12" :height="12" class="self-center" />
            <span class="text-sm font-bold">{{ formattedTrafficDown.value }}</span>
            <span class="text-[10px] text-muted-foreground">{{ formattedTrafficDown.unit }}</span>
          </div>
        </div>
      </div>
      <div class="flex-col h-full hidden justify-between sm:flex">
        <div class="flex flex-col gap-1" :style="numberFontStyle">
          <div class="flex gap-1 items-baseline">
            <Icon icon="icon-park-outline:upload" :width="16" :height="16" class="shrink-0 self-center" />
            <span class="text-xl font-bold">{{ formattedTrafficUp.value }}</span>
            <span class="text-xs text-muted-foreground">{{ formattedTrafficUp.unit }}</span>
          </div>
          <div class="flex gap-1 items-baseline">
            <Icon icon="icon-park-outline:download" :width="16" :height="16" class="shrink-0 self-center" />
            <span class="text-xl font-bold">{{ formattedTrafficDown.value }}</span>
            <span class="text-xs text-muted-foreground">{{ formattedTrafficDown.unit }}</span>
          </div>
        </div>
        <span class="text-xs flex gap-1 items-center text-muted-foreground">
          <Icon icon="icon-park-outline:transfer-data" :width="14" :height="14" />
          流量总览
        </span>
      </div>
    </CardX>

    <!-- 网络速率 -->
    <CardX hoverable class="sm:min-h-32" :class="[hasBackgroundBlur && 'glass-card-enabled glass-card']" content-class="h-full">
      <div class="flex gap-2 items-center justify-between sm:hidden" :style="numberFontStyle">
        <span class="text-xs flex shrink-0 gap-1 items-center text-muted-foreground">
          <Icon icon="icon-park-outline:lightning" :width="14" :height="14" />
          网络速率
        </span>
        <div class="flex gap-3">
          <div class="flex gap-0.5 items-baseline">
            <Icon icon="icon-park-outline:up" :width="12" :height="12" class="self-center" />
            <span class="text-sm font-bold">{{ formattedSpeedUp.value }}</span>
            <span class="text-[10px] text-muted-foreground">{{ formattedSpeedUp.unit }}</span>
          </div>
          <div class="flex gap-0.5 items-baseline">
            <Icon icon="icon-park-outline:down" :width="12" :height="12" class="self-center" />
            <span class="text-sm font-bold">{{ formattedSpeedDown.value }}</span>
            <span class="text-[10px] text-muted-foreground">{{ formattedSpeedDown.unit }}</span>
          </div>
        </div>
      </div>
      <div class="flex-col h-full hidden justify-between sm:flex">
        <div class="flex flex-col gap-1" :style="numberFontStyle">
          <div class="flex gap-1 items-baseline">
            <Icon icon="icon-park-outline:up" :width="16" :height="16" class="shrink-0 self-center" />
            <span class="text-xl font-bold">{{ formattedSpeedUp.value }}</span>
            <span class="text-xs text-muted-foreground">{{ formattedSpeedUp.unit }}</span>
          </div>
          <div class="flex gap-1 items-baseline">
            <Icon icon="icon-park-outline:down" :width="16" :height="16" class="shrink-0 self-center" />
            <span class="text-xl font-bold">{{ formattedSpeedDown.value }}</span>
            <span class="text-xs text-muted-foreground">{{ formattedSpeedDown.unit }}</span>
          </div>
        </div>
        <span class="text-xs flex gap-1 items-center text-muted-foreground">
          <Icon icon="icon-park-outline:lightning" :width="14" :height="14" />
          网络速率
        </span>
      </div>
    </CardX>
  </div>
</template>

<style scoped>
.light-general-contrast :deep(> div) {
  background-color: rgba(250, 250, 252, 1) !important;
  box-shadow: 0 2px 8px 0 rgba(0, 0, 0, 0.08);
  border-color: rgba(0, 0, 0, 0.12);
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
</style>
