<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { useDebounceFn } from '@vueuse/core'
import { computed, defineAsyncComponent, nextTick, onActivated, onDeactivated, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import MarkdownRenderer from '@/components/MarkdownRenderer.vue'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Empty } from '@/components/ui/empty'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { useAppStore } from '@/stores/app'
import { useNodesStore } from '@/stores/nodes'
import { isRegionMatch } from '@/utils/regionHelper'

defineOptions({ name: 'HomeView' })

const NodeCard = defineAsyncComponent(() => import('@/components/NodeCard.vue'))
const NodeGeneralCards = defineAsyncComponent(() => import('@/components/NodeGeneralCards.vue'))
const NodeList = defineAsyncComponent(() => import('@/components/NodeList.vue'))

const appStore = useAppStore()
const nodesStore = useNodesStore()
const router = useRouter()

onActivated(() => {
  if (appStore.homeScrollPosition > 0) {
    nextTick(() => {
      window.scrollTo({ top: appStore.homeScrollPosition, behavior: 'instant' })
    })
  }
})

onDeactivated(() => {
  appStore.homeScrollPosition = window.scrollY
})

const searchText = ref('')
const debouncedSearchText = ref('')

const updateDebouncedSearch = useDebounceFn((value: string) => {
  debouncedSearchText.value = value
}, 300)

watch(searchText, (value) => {
  updateDebouncedSearch(value)
})

const groups = computed(() => [
  { tab: '全部节点', name: 'all' },
  ...nodesStore.groups.map(g => ({ tab: g, name: g })),
])

const showGroupTabs = computed(() => {
  if (appStore.hideSingleGroupTab && nodesStore.groups.length <= 1)
    return false
  return true
})

watch(
  () => nodesStore.groups,
  (gs) => {
    const cur = appStore.nodeSelectedGroup
    if (cur !== 'all' && !gs.includes(cur)) {
      appStore.nodeSelectedGroup = 'all'
    }
  },
  { immediate: true },
)

function isNodeMatchSearch(node: typeof nodesStore.nodes[number], search: string): boolean {
  if (!search.trim())
    return true
  const lowerSearch = search.toLowerCase().trim()
  if (node.name.toLowerCase().includes(lowerSearch))
    return true
  if (node.region && isRegionMatch(node.region, search))
    return true
  if (node.os && node.os.toLowerCase().includes(lowerSearch))
    return true
  if (node.group && node.group.toLowerCase().includes(lowerSearch))
    return true
  if (node.tags && node.tags.toLowerCase().includes(lowerSearch))
    return true
  if (node.remark && node.remark.toLowerCase().includes(lowerSearch))
    return true
  return false
}

const nodeList = computed(() => {
  let filtered = appStore.nodeSelectedGroup === 'all'
    ? nodesStore.nodes
    : nodesStore.nodes.filter(n => n.group === appStore.nodeSelectedGroup)
  if (debouncedSearchText.value.trim()) {
    filtered = filtered.filter(n => isNodeMatchSearch(n, debouncedSearchText.value))
  }
  return filtered
})

function handleNodeClick(node: typeof nodesStore.nodes[number]) {
  router.push({ name: 'instance-detail', params: { id: node.uuid } })
}

const hasBackgroundBlur = computed(() => appStore.backgroundEnabled && appStore.cardBlurRadius > 0)

const alertVariantMap: Record<string, 'default' | 'destructive'> = {
  default: 'default',
  info: 'default',
  success: 'default',
  warning: 'default',
  error: 'destructive',
}

const alertVariant = computed(() => alertVariantMap[appStore.alertType] || 'default')
</script>

<template>
  <div class="home-view">
    <div v-if="appStore.connectionError" class="alert px-4 pb-2">
      <Alert variant="destructive">
        <AlertTitle>RPC 服务错误</AlertTitle>
        <AlertDescription>连接服务器失败，请检查网络设置或刷新页面后再试。</AlertDescription>
      </Alert>
    </div>

    <div v-if="appStore.alertEnabled && appStore.alertContent" class="alert px-4 pb-2">
      <Alert :variant="alertVariant">
        <AlertTitle v-if="appStore.alertTitle">
          {{ appStore.alertTitle }}
        </AlertTitle>
        <AlertDescription>
          <MarkdownRenderer :content="appStore.alertContent" />
        </AlertDescription>
      </Alert>
    </div>

    <NodeGeneralCards />
    <Separator class="my-0" />

    <div class="node-info p-4 flex flex-col gap-4">
      <div class="nodes">
        <Tabs v-if="showGroupTabs" v-model="appStore.nodeSelectedGroup" class="w-full flex-col">
          <div class="flex items-center justify-between gap-2 mb-4 flex-wrap">
            <TabsList>
              <TabsTrigger v-for="g in groups" :key="g.name" :value="g.name">
                {{ g.tab }}
              </TabsTrigger>
            </TabsList>
            <div class="search flex gap-2 items-center">
              <div class="relative">
                <Input
                  v-model="searchText"
                  placeholder="搜索节点名称、地区、系统"
                  class="w-40 md:w-60 pl-8" :class="[hasBackgroundBlur && 'glass-input-enabled glass-card']"
                />
                <Icon
                  icon="icon-park-outline:search"
                  :width="14"
                  :height="14"
                  class="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
                />
              </div>
              <ToggleGroup v-model="appStore.nodeViewMode" type="single" variant="outline" size="sm">
                <ToggleGroupItem value="card" aria-label="卡片视图" class="size-8 p-0">
                  <Icon icon="icon-park-outline:view-grid-card" :width="14" :height="14" />
                </ToggleGroupItem>
                <ToggleGroupItem value="list" aria-label="列表视图" class="size-8 p-0">
                  <Icon icon="icon-park-outline:view-list" :width="14" :height="14" />
                </ToggleGroupItem>
              </ToggleGroup>
            </div>
          </div>
          <TabsContent v-for="g in groups" :key="g.name" :value="g.name">
            <div v-if="nodeList.length !== 0 && appStore.nodeViewMode === 'card'" class="gap-4 grid grid-cols-1 sm:grid-cols-[repeat(auto-fill,minmax(340px,1fr))]">
              <NodeCard v-for="node in nodeList" :key="node.uuid" :node="node" @click="handleNodeClick(node)" />
            </div>
            <NodeList v-else-if="nodeList.length !== 0 && appStore.nodeViewMode === 'list'" :nodes="nodeList" @click="handleNodeClick" />
            <div v-else class="text-muted-foreground text-center py-8">
              <Empty description="暂无节点" />
            </div>
          </TabsContent>
        </Tabs>

        <template v-else>
          <div class="flex justify-end gap-2 mb-4">
            <div class="relative">
              <Input
                v-model="searchText"
                placeholder="搜索节点名称、地区、系统"
                class="w-40 md:w-60 pl-8" :class="[hasBackgroundBlur && 'glass-input-enabled glass-card']"
              />
              <Icon
                icon="icon-park-outline:search"
                :width="14"
                :height="14"
                class="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
            </div>
            <ToggleGroup v-model="appStore.nodeViewMode" type="single" variant="outline" size="sm">
              <ToggleGroupItem value="card" aria-label="卡片视图" class="size-8 p-0">
                <Icon icon="icon-park-outline:view-grid-card" :width="14" :height="14" />
              </ToggleGroupItem>
              <ToggleGroupItem value="list" aria-label="列表视图" class="size-8 p-0">
                <Icon icon="icon-park-outline:view-list" :width="14" :height="14" />
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
          <div v-if="nodeList.length !== 0 && appStore.nodeViewMode === 'card'" class="gap-4 grid grid-cols-1 sm:grid-cols-[repeat(auto-fill,minmax(340px,1fr))]">
            <NodeCard v-for="node in nodeList" :key="node.uuid" :node="node" @click="handleNodeClick(node)" />
          </div>
          <NodeList v-else-if="nodeList.length !== 0 && appStore.nodeViewMode === 'list'" :nodes="nodeList" @click="handleNodeClick" />
          <div v-else class="text-muted-foreground text-center py-8">
            <Empty description="暂无节点" />
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.glass-input-enabled {
  background-color: rgba(255, 255, 255, 0.7) !important;
}

html.dark .glass-input-enabled {
  background-color: rgba(24, 24, 28, 0.85) !important;
}
</style>
