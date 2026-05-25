<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { computed, defineAsyncComponent, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CardX } from '@/components/ui/card-x'
import { Empty } from '@/components/ui/empty'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAppStore } from '@/stores/app'
import { useNodesStore } from '@/stores/nodes'
import { formatBytesPerSecondWithConfig, formatBytesWithConfig, formatDateTime, formatUptimeWithFormat } from '@/utils/helper'
import { getOSImage, getOSName } from '@/utils/osImageHelper'
import { getRegionCode, getRegionDisplayName } from '@/utils/regionHelper'

const LoadChart = defineAsyncComponent(() => import('@/components/LoadChart.vue'))
const PingChart = defineAsyncComponent(() => import('@/components/PingChart.vue'))

const route = useRoute()
const router = useRouter()

const appStore = useAppStore()
const nodesStore = useNodesStore()

onMounted(() => {
  window.scrollTo({ top: 0, behavior: 'instant' })
})

const formatBytes = (bytes: number) => formatBytesWithConfig(bytes, appStore.byteDecimals)
const formatBytesPerSecond = (bytes: number) => formatBytesPerSecondWithConfig(bytes, appStore.byteDecimals)
const formatUptime = (seconds: number) => formatUptimeWithFormat(seconds, appStore.uptimeFormat)

const chartView = ref<'load' | 'ping'>('load')

const data = computed(() => nodesStore.nodes.find(node => node.uuid === route.params.id))

const hasBackgroundBlur = computed(() => appStore.backgroundEnabled && appStore.backgroundBlur > 0)

interface InfoItem {
  label: string
  value: string | undefined
  icon?: string
}

const hardwareInfo = computed<InfoItem[]>(() => [
  { label: 'CPU', value: data.value ? `${data.value.cpu_name} (x${data.value.cpu_cores})` : '-', icon: 'icon-park-outline:cpu' },
  { label: '架构', value: data.value?.arch ?? '-', icon: 'icon-park-outline:application-two' },
  { label: '虚拟化', value: data.value?.virtualization ?? '-', icon: 'icon-park-outline:server' },
  { label: 'GPU', value: data.value?.gpu_name || '-', icon: 'icon-park-outline:video-one' },
])

const systemInfo = computed<InfoItem[]>(() => [
  { label: '操作系统', value: data.value?.os ?? '-', icon: 'icon-park-outline:computer' },
  { label: '内核版本', value: data.value?.kernel_version ?? '-', icon: 'icon-park-outline:code' },
  { label: '运行时间', value: formatUptime(data.value?.uptime ?? 0), icon: 'icon-park-outline:timer' },
  { label: '最后上报', value: formatDateTime(data.value?.time), icon: 'icon-park-outline:time' },
])

const storageInfo = computed<InfoItem[]>(() => [
  { label: '内存', value: formatBytes(data.value?.mem_total ?? 0), icon: 'icon-park-outline:memory' },
  { label: '内存交换', value: formatBytes(data.value?.swap_total ?? 0), icon: 'icon-park-outline:switch' },
  { label: '硬盘', value: formatBytes(data.value?.disk_total ?? 0), icon: 'icon-park-outline:hard-disk' },
])

const lightCardContrastEnabled = computed(() => appStore.lightCardContrast && !appStore.isDark)

const cardClassExtras = computed(() => [
  lightCardContrastEnabled.value && 'light-card-contrast',
  hasBackgroundBlur.value && 'glass-card-enabled glass-card',
])
</script>

<template>
  <div class="instance-detail">
    <div v-if="!data" class="p-4">
      <CardX>
        <Empty description="节点不存在或已被删除">
          <template #extra>
            <Button @click="router.push('/')">
              返回首页
            </Button>
          </template>
        </Empty>
      </CardX>
    </div>

    <template v-else>
      <div class="px-4 py-2 flex gap-4 items-center">
        <Button variant="ghost" size="icon-sm" @click="router.push('/')">
          <Icon icon="icon-park-outline:arrow-left" :width="16" :height="16" />
        </Button>
        <div class="text-lg font-bold flex gap-2 items-center">
          <img
            :src="`/images/flags/${getRegionCode(data.region)}.svg`"
            :alt="getRegionDisplayName(data.region)"
            class="size-6"
          >
          <span>{{ data.name }}</span>
        </div>
        <Badge :variant="data.online ? 'default' : 'destructive'" class="text-xs">
          {{ data.online ? '在线' : '离线' }}
        </Badge>
      </div>

      <div class="p-4 gap-4 grid grid-cols-1 lg:grid-cols-2">
        <CardX title="硬件信息" size="small" :class="cardClassExtras">
          <div class="gap-4 grid grid-cols-1 sm:grid-cols-2">
            <div v-for="item in hardwareInfo" :key="item.label" class="flex flex-col gap-1">
              <div class="flex gap-1 items-center text-muted-foreground">
                <Icon v-if="item.icon" :icon="item.icon" :width="14" :height="14" />
                <span class="text-sm">{{ item.label }}</span>
              </div>
              <span class="text-sm break-all">{{ item.value }}</span>
            </div>
          </div>
        </CardX>

        <CardX title="系统信息" size="small" :class="cardClassExtras">
          <div class="gap-4 grid grid-cols-1 sm:grid-cols-2">
            <div v-for="item in systemInfo" :key="item.label" class="flex flex-col gap-1">
              <div class="flex gap-1 items-center text-muted-foreground">
                <Icon v-if="item.icon" :icon="item.icon" :width="14" :height="14" />
                <span class="text-sm">{{ item.label }}</span>
              </div>
              <div class="flex gap-2 items-center">
                <img
                  v-if="item.label === '操作系统'"
                  :src="getOSImage(data.os)"
                  :alt="getOSName(data.os)"
                  class="size-5"
                >
                <span
                  class="text-sm break-all"
                  :style="(item.label === '运行时间' || item.label === '最后上报') ? { fontFamily: appStore.numberFontFamily } : {}"
                >
                  {{ item.value }}
                </span>
              </div>
            </div>
          </div>
        </CardX>

        <CardX title="存储信息" size="small" :class="cardClassExtras">
          <div class="gap-4 grid grid-cols-1 sm:grid-cols-3">
            <div v-for="item in storageInfo" :key="item.label" class="flex flex-col gap-1">
              <div class="flex gap-1 items-center text-muted-foreground">
                <Icon v-if="item.icon" :icon="item.icon" :width="14" :height="14" />
                <span class="text-sm">{{ item.label }}</span>
              </div>
              <span class="text-sm" :style="{ fontFamily: appStore.numberFontFamily }">{{ item.value }}</span>
            </div>
          </div>
        </CardX>

        <CardX title="网络信息" size="small" :class="cardClassExtras">
          <div class="gap-4 grid grid-cols-1 sm:grid-cols-2">
            <div class="flex flex-col gap-1">
              <div class="flex gap-1 items-center text-muted-foreground">
                <Icon icon="icon-park-outline:transfer-data" :width="14" :height="14" />
                <span class="text-sm">总流量</span>
              </div>
              <span class="text-sm break-all" :style="{ fontFamily: appStore.numberFontFamily }">
                ↑ {{ formatBytes(data?.net_total_up ?? 0) }}
                <span class="p-1" />
                ↓ {{ formatBytes(data?.net_total_down ?? 0) }}
              </span>
            </div>
            <div class="flex flex-col gap-1">
              <div class="flex gap-1 items-center text-muted-foreground">
                <Icon icon="icon-park-outline:dashboard-one" :width="14" :height="14" />
                <span class="text-sm">网络速率</span>
              </div>
              <span class="text-sm break-all" :style="{ fontFamily: appStore.numberFontFamily }">
                ↑ {{ formatBytesPerSecond(data?.net_out ?? 0) }}
                <span class="p-1" />
                ↓ {{ formatBytesPerSecond(data?.net_in ?? 0) }}
              </span>
            </div>
          </div>
        </CardX>
      </div>

      <Separator class="my-0 mx-4" />

      <div class="p-4">
        <Tabs v-model="chartView" class="w-full">
          <TabsList>
            <TabsTrigger value="load">
              负载
            </TabsTrigger>
            <TabsTrigger value="ping">
              延迟
            </TabsTrigger>
          </TabsList>
          <TabsContent value="load">
            <LoadChart :uuid="data.uuid" />
          </TabsContent>
          <TabsContent value="ping">
            <PingChart :uuid="data.uuid" />
          </TabsContent>
        </Tabs>
      </div>
    </template>
  </div>
</template>

<style scoped>
.light-card-contrast {
  background-color: rgba(250, 250, 252, 1) !important;
  box-shadow: 0 2px 8px 0 rgba(0, 0, 0, 0.08);
  border-color: rgba(0, 0, 0, 0.12) !important;
}

.light-card-contrast:hover {
  box-shadow: 0 4px 12px 0 rgba(0, 0, 0, 0.12);
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
