<script setup lang="ts">
import { Icon } from '@iconify/vue'
import dayjs from 'dayjs'
import { computed, onMounted, ref, shallowRef, watch } from 'vue'
import VChart from 'vue-echarts'
import { Button } from '@/components/ui/button'
import { DataTooltip } from '@/components/ui/data-tooltip'
import { Empty } from '@/components/ui/empty'
import { Spinner } from '@/components/ui/spinner'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useBackgroundSurface } from '@/composables/useBackgroundSurface'
import { useAppStore } from '@/stores/app'
import { cutPeakValues, interpolateNullsLinear } from '@/utils/recordHelper'
import { getSharedRpc, RpcError } from '@/utils/rpc'
import '@/utils/echarts' // 共享 ECharts 配置

const props = defineProps<{
  uuid: string
}>()

const appStore = useAppStore()
const { pickSurfaceClass } = useBackgroundSurface()
const isDark = computed(() => appStore.isDark)
// 使用共享的 RPC 实例，避免重复创建连接
const rpc = getSharedRpc()

// 图表主题相关颜色
const chartThemeColors = computed(() => ({
  text: isDark.value ? 'rgba(255, 255, 255, 0.85)' : 'rgba(0, 0, 0, 0.85)',
  textSecondary: isDark.value ? 'rgba(255, 255, 255, 0.55)' : 'rgba(0, 0, 0, 0.55)',
  textTertiary: isDark.value ? 'rgba(255, 255, 255, 0.35)' : 'rgba(0, 0, 0, 0.35)',
  borderColor: isDark.value ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.06)',
  splitLineColor: isDark.value ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)',
  tooltipBg: isDark.value ? 'rgba(40, 40, 40, 0.95)' : 'rgba(255, 255, 255, 0.8)',
  tooltipShadow: isDark.value ? 'rgba(0, 0, 0, 0.4)' : 'rgba(0, 0, 0, 0.06)',
  crosshairColor: isDark.value ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.1)',
}))

// 优化后的图表配色方案（多任务时使用）
const chartColors = [
  '#FF6B6B', // 珊瑚红
  '#4ECDC4', // 青绿色
  '#A78BFA', // 紫罗兰
  '#60A5FA', // 天蓝色
  '#FFB347', // 琥珀黄
  '#F472B6', // 粉红色
  '#34D399', // 翠绿色
  '#FB923C', // 橙色
]

// 从 publicSettings 获取记录保留时间
const maxPingRecordPreserveTime = computed(() => appStore.publicSettings?.ping_record_preserve_time || 168)

// 视图选项（与 LoadChart 对齐，12 小时仅网络图有；60/90 天仅在实际保留时间足够时显示）
const presetViews = [
  { label: '1 小时', hours: 1 },
  { label: '6 小时', hours: 6 },
  { label: '12 小时', hours: 12 },
  { label: '1 天', hours: 24 },
  { label: '7 天', hours: 168 },
  { label: '30 天', hours: 720 },
  { label: '60 天', hours: 1440 },
  { label: '90 天', hours: 2160 },
]

// 可用视图列表
const availableViews = computed(() => {
  const views: { label: string, hours: number }[] = []
  const maxHours = maxPingRecordPreserveTime.value

  for (const v of presetViews) {
    if (maxHours >= v.hours) {
      views.push(v)
    }
  }

  const maxPreset = presetViews.at(-1)
  if (maxPreset && maxHours > maxPreset.hours) {
    const label = maxHours % 24 === 0
      ? `${Math.floor(maxHours / 24)} 天`
      : `${maxHours} 小时`
    views.push({ label, hours: maxHours })
  }
  else if (maxHours > 1 && !presetViews.some(v => v.hours === maxHours)) {
    const label = maxHours % 24 === 0
      ? `${Math.floor(maxHours / 24)} 天`
      : `${maxHours} 小时`
    views.push({ label, hours: maxHours })
  }

  return views
})

// 当前选中的视图
const selectedView = ref<string>('')
const selectedHours = computed(() => {
  const view = availableViews.value.find(v => v.label === selectedView.value)
  return view?.hours || 1
})

// 初始化默认视图
watch(availableViews, (views) => {
  const firstView = views[0]
  if (firstView && !selectedView.value) {
    selectedView.value = firstView.label
  }
}, { immediate: true })

// ==================== 类型定义 ====================

interface PingRecord {
  client: string
  task_id: number
  time: string
  value: number
}

interface TaskInfo {
  id: number
  name: string
  interval: number
  loss: number
  p99?: number
  p50?: number
  p99_p50_ratio?: number
  min?: number
  max?: number
  avg?: number
  latest?: number
  total?: number
  type?: string
}

interface MetricPoint {
  time: string
  value: number | null
  tags?: Record<string, string>
  tag?: Record<string, string>
}

interface MetricSeries {
  metric_key: 'ping.latency_ms' | 'ping.loss'
  tags?: Record<string, string>
  tag?: Record<string, string>
  points: MetricPoint[]
}

interface MetricQueryResponse {
  series: MetricSeries[]
}

interface PingMetricTaskStats {
  task_id: string
  name?: string
  type?: string
  interval?: number
  loss: number
  min?: number
  max?: number
  avg?: number
  latest?: number
  total: number
  p50?: number
  p99?: number
  p99_p50_ratio?: number
}

interface PingMetricStatsResponse {
  stats: PingMetricTaskStats[]
}

interface PingRecordsResponse {
  records: PingRecord[]
  tasks?: TaskInfo[]
}

interface LossRecord {
  task_id: number
  time: string
  loss: number
}

interface LossMarkerPoint {
  index: number
  loss: number
}

interface PingChartData {
  records: PingRecord[]
  tasks: TaskInfo[]
  lossRecords?: LossRecord[]
}

// 数据状态
const remoteData = shallowRef<PingRecord[]>([])
const lossRecordsData = shallowRef<LossRecord[]>([])
const tasks = shallowRef<TaskInfo[]>([])
const loading = ref(false)
const error = ref<string | null>(null)
let fetchRequestId = 0
let metricRpcSupported: boolean | null = null

// 任务选择
const selectedTaskIds = ref<number[]>([])
const cutPeak = ref(false)
const showDelay = ref(true)
const showLoss = ref(true)

const mergeToleranceMs = computed(() => {
  const taskIntervals = tasks.value
    .map(t => t.interval)
    .filter((v): v is number => typeof v === 'number' && v > 0)

  const fallbackIntervalSec = taskIntervals.length ? Math.min(...taskIntervals) : 60
  return Math.min(
    6000,
    Math.max(800, Math.floor(fallbackIntervalSec * 1000 * 0.25)),
  )
})

// ==================== 数据获取 ====================

function isMethodNotFoundError(err: unknown): boolean {
  return err instanceof RpcError && err.code === -32601
}

function getMetricTaskId(series: MetricSeries, point: MetricPoint): number | null {
  const taskId = Number(
    point.tags?.task_id
    ?? series.tags?.task_id
    ?? point.tag?.task_id
    ?? series.tag?.task_id,
  )

  return Number.isInteger(taskId) ? taskId : null
}

// 与官方 komari-web HISTORY_MAX_POINTS 对齐；过小会导致长范围间隔过大、曲线断点过多
const HISTORY_MAX_POINTS = 700

/**
 * 将 metrics 延迟点转为图表记录。
 * 官方在 fill_empty=true 时会把丢包采样（latency=-1）转成 null；
 * 这里统一用 value=-1 表示断点/丢包，供合并与丢包标记复用。
 * 不要把 ping.loss 的聚合平均值（0~1）当成整点丢包写入延迟序列，
 * 否则 7 天等长范围会出现大量伪断点，曲线断断续续。
 */
function pushLatencyMetricPoint(
  records: PingRecord[],
  uuid: string,
  taskId: number,
  point: MetricPoint,
) {
  if (point.value === null || point.value < 0) {
    records.push({
      client: uuid,
      task_id: taskId,
      time: point.time,
      value: -1,
    })
    return
  }

  records.push({
    client: uuid,
    task_id: taskId,
    time: point.time,
    value: point.value,
  })
}

async function fetchMetricRecords(uuid: string, hours: number): Promise<PingChartData> {
  const [metricResult, statsResult, lossResult] = await Promise.all([
    rpc.getClient().call<MetricQueryResponse>('public:queryMetrics', {
      // 与官方主题一致：延迟曲线只吃 ping.latency_ms；丢包率走 getPingMetricStats
      metric_keys: ['ping.latency_ms'],
      entity_id: uuid,
      hours,
      max_points: HISTORY_MAX_POINTS,
      aggregation: 'avg',
      // 官方默认开启：空桶补 null，并把 latency=-1 规范为 null
      fill_empty: true,
    }),
    rpc.getClient().call<PingMetricStatsResponse>('public:getPingMetricStats', {
      entity_id: uuid,
      uuid,
      hours,
      max_points: HISTORY_MAX_POINTS,
    }),
    // 独立拉取 ping.loss 时序数据，仅供丢包标记与比例绘制使用，不污染延迟曲线
    rpc.getClient().call<MetricQueryResponse>('public:queryMetrics', {
      metric_keys: ['ping.loss'],
      entity_id: uuid,
      hours,
      max_points: HISTORY_MAX_POINTS,
      aggregation: 'avg',
      fill_empty: true,
    }).catch(() => null),
  ])

  const records: PingRecord[] = []
  for (const series of metricResult?.series ?? []) {
    if (series.metric_key !== 'ping.latency_ms')
      continue

    for (const point of series.points ?? []) {
      const taskId = getMetricTaskId(series, point)
      if (taskId === null)
        continue

      pushLatencyMetricPoint(records, uuid, taskId, point)
    }
  }

  const lossRecords: LossRecord[] = []
  for (const series of lossResult?.series ?? []) {
    if (series.metric_key !== 'ping.loss')
      continue

    for (const point of series.points ?? []) {
      const taskId = getMetricTaskId(series, point)
      if (taskId === null || point.value === null || point.value <= 0)
        continue

      const rawVal = point.value
      // 兼容 0~1 小数或 0~100 百分比
      const loss = rawVal > 1 ? Math.min(1, rawVal / 100) : Math.min(1, Math.max(0, rawVal))
      if (loss > 0) {
        lossRecords.push({
          task_id: taskId,
          time: point.time,
          loss,
        })
      }
    }
  }

  const metricTasks = (statsResult?.stats ?? []).map(task => ({
    id: Number(task.task_id),
    name: task.name || `Ping ${task.task_id}`,
    interval: task.interval ?? 60,
    loss: task.loss,
    p99: task.p99,
    p50: task.p50,
    p99_p50_ratio: task.p99_p50_ratio,
    min: task.min,
    max: task.max,
    avg: task.avg,
    latest: task.latest,
    total: task.total,
    type: task.type,
  })).filter(task => Number.isInteger(task.id))

  return { records, tasks: metricTasks, lossRecords }
}

async function fetchLegacyRecords(uuid: string, hours: number): Promise<PingChartData> {
  const result = await rpc.getClient().call<PingRecordsResponse>('common:getRecords', {
    type: 'ping',
    uuid,
    hours,
  })

  return {
    records: result?.records ?? [],
    tasks: result?.tasks ?? [],
  }
}

async function fetchRecords() {
  if (!props.uuid)
    return

  const requestId = ++fetchRequestId
  const uuid = props.uuid
  const hours = selectedHours.value

  loading.value = true
  error.value = null

  try {
    let result: PingChartData
    if (metricRpcSupported === false) {
      result = await fetchLegacyRecords(uuid, hours)
    }
    else {
      try {
        result = await fetchMetricRecords(uuid, hours)
        metricRpcSupported = true
      }
      catch (err) {
        if (!isMethodNotFoundError(err))
          throw err

        metricRpcSupported = false
        result = await fetchLegacyRecords(uuid, hours)
      }
    }

    if (requestId !== fetchRequestId)
      return

    const records = result.records
    records.sort((a, b) => dayjs(a.time).valueOf() - dayjs(b.time).valueOf())

    remoteData.value = records
    lossRecordsData.value = result.lossRecords ?? []
    tasks.value = result.tasks

    if (tasks.value.length > 0 && selectedTaskIds.value.length === 0) {
      selectedTaskIds.value = tasks.value.map(t => t.id)
    }
  }
  catch (err) {
    if (requestId !== fetchRequestId)
      return

    error.value = err instanceof Error ? err.message : '获取数据失败'
    remoteData.value = []
    lossRecordsData.value = []
    tasks.value = []
  }
  finally {
    if (requestId === fetchRequestId) {
      loading.value = false
    }
  }
}

// ==================== 数据处理 ====================

const mergedData = computed(() => {
  const data = remoteData.value
  if (!data.length)
    return []

  const toleranceMs = mergeToleranceMs.value

  const grouped: Map<number, Record<string, unknown>> = new Map()
  const anchors: number[] = []

  for (const rec of data) {
    const ts = dayjs(rec.time).valueOf()
    let anchor: number | null = null

    for (const a of anchors) {
      if (Math.abs(a - ts) <= toleranceMs) {
        anchor = a
        break
      }
    }

    const useTs = anchor ?? ts
    if (!grouped.has(useTs)) {
      grouped.set(useTs, { time: dayjs(useTs).toISOString() })
      if (anchor === null) {
        anchors.push(useTs)
      }
    }

    const group = grouped.get(useTs)!
    group[rec.task_id] = rec.value < 0 ? null : rec.value
  }

  const merged = Array.from(grouped.values()).sort(
    (a, b) => dayjs(a.time as string).valueOf() - dayjs(b.time as string).valueOf(),
  )

  const hours = selectedHours.value
  const lastItem = merged.at(-1)
  const lastTs = lastItem ? dayjs(lastItem.time as string).valueOf() : dayjs().valueOf()
  const fromTs = lastTs - hours * 3600_000

  let startIdx = 0
  for (let i = 0; i < merged.length; i++) {
    const item = merged[i]
    if (!item)
      continue
    const ts = dayjs(item.time as string).valueOf()
    if (ts >= fromTs) {
      startIdx = Math.max(0, i - 1)
      break
    }
  }

  return merged.slice(startIdx)
})

const chartData = computed(() => {
  let data = mergedData.value
  const selectedKeys = selectedTaskIds.value.map(String)

  if (selectedKeys.length === 0)
    return []

  if (cutPeak.value) {
    data = cutPeakValues(data, selectedKeys)
  }

  if (selectedKeys.length > 0 && data.length > 0) {
    // 长范围降采样后桶间隔会变大，按查询跨度放宽插值上限，避免 7 天+ 曲线被硬截断
    const bucketMs = Math.ceil((selectedHours.value * 3600_000) / HISTORY_MAX_POINTS)
    data = interpolateNullsLinear(data, selectedKeys, {
      maxGapMultiplier: 6,
      minCapMs: 2 * 60_000,
      maxCapMs: Math.max(30 * 60_000, bucketMs * 6),
    })
  }

  return data
})

// ==================== 工具函数 ====================

function formatTime(time: string, showDate: boolean): string {
  const date = dayjs(time)
  if (showDate) {
    return date.format('M/D HH:mm')
  }
  return date.format('HH:mm')
}

function formatTimeForTooltip(time: string, hours: number): string {
  const date = dayjs(time)
  if (hours < 24) {
    return date.format('HH:mm:ss')
  }
  return date.format('MM/DD HH:mm')
}

const showDateInAxis = computed(() => selectedHours.value >= 24)

// ==================== 任务选择 ====================

// 获取任务颜色（根据任务在完整列表中的索引）
function getTaskColor(taskId: number): string {
  const taskIndex = tasks.value.findIndex(t => t.id === taskId)
  const safeIndex = Math.max(0, taskIndex % chartColors.length)
  return chartColors[safeIndex]!
}

// 最新值统计（从服务端 tasks 获取，保持颜色顺序）
const latestValues = computed(() => {
  if (!tasks.value.length)
    return []

  const latestMap = new Map<number, number | null>()
  for (const task of tasks.value) {
    for (let i = remoteData.value.length - 1; i >= 0; i--) {
      const rec = remoteData.value[i]
      if (rec && rec.task_id === task.id && rec.value >= 0) {
        latestMap.set(task.id, rec.value)
        break
      }
    }
  }

  return tasks.value.map((task, idx) => {
    const safeIdx = Math.max(0, idx % chartColors.length)
    return {
      ...task,
      latestValue: latestMap.get(task.id) ?? null,
      color: chartColors[safeIdx]!,
    }
  })
})

const selectedTasks = computed(() => {
  return tasks.value.filter(t => selectedTaskIds.value.includes(t.id))
})

const packetLossMarkers = computed(() => {
  const data = mergedData.value
  const markers = new Map<number, LossMarkerPoint[]>()

  if (!data.length || !selectedTasks.value.length)
    return markers

  // 长范围 fill_empty 可能产生大量空桶，限制标记数量避免 markLine 过密拖垮渲染
  const MAX_LOSS_MARKERS_PER_TASK = 200
  const chartTimes = data.map(item => dayjs(item.time as string).valueOf())
  const toleranceMs = mergeToleranceMs.value

  for (const task of selectedTasks.value) {
    const indexLossMap = new Map<number, number>()

    // 来源 1：短周期原始探测点中延迟为 null / < 0（单次探测丢包，视为 100% 丢包）
    const taskLatencyLossRecords = remoteData.value.filter(rec => rec.task_id === task.id && rec.value < 0)
    for (const record of taskLatencyLossRecords) {
      const lossTs = dayjs(record.time).valueOf()
      let matchedIndex = -1

      for (let i = 0; i < chartTimes.length; i++) {
        const chartTs = chartTimes[i]
        if (chartTs === undefined)
          continue

        if (Math.abs(chartTs - lossTs) <= toleranceMs) {
          matchedIndex = i
          break
        }
      }

      if (matchedIndex >= 0) {
        indexLossMap.set(matchedIndex, Math.max(indexLossMap.get(matchedIndex) ?? 0, 1))
      }
    }

    // 来源 2：长周期聚合分桶的 ping.loss 时序数据（真实分桶丢包率 0~1）
    const taskLossRecords = lossRecordsData.value.filter(rec => rec.task_id === task.id && rec.loss > 0)
    for (const record of taskLossRecords) {
      const lossTs = dayjs(record.time).valueOf()
      let matchedIndex = -1

      for (let i = 0; i < chartTimes.length; i++) {
        const chartTs = chartTimes[i]
        if (chartTs === undefined)
          continue

        if (Math.abs(chartTs - lossTs) <= toleranceMs) {
          matchedIndex = i
          break
        }
      }

      if (matchedIndex >= 0) {
        indexLossMap.set(matchedIndex, Math.max(indexLossMap.get(matchedIndex) ?? 0, record.loss))
      }
    }

    let points: LossMarkerPoint[] = Array.from(indexLossMap.entries()).map(([index, loss]) => ({
      index,
      loss,
    }))

    if (points.length > MAX_LOSS_MARKERS_PER_TASK) {
      // 超限时优先保留丢包率最高的严重事件
      points.sort((a, b) => b.loss - a.loss)
      points = points.slice(0, MAX_LOSS_MARKERS_PER_TASK)
    }

    points.sort((a, b) => a.index - b.index)
    markers.set(task.id, points)
  }

  return markers
})

const totalLossMarkersCount = computed(() => {
  let count = 0
  for (const task of selectedTasks.value) {
    count += (packetLossMarkers.value.get(task.id) || []).length
  }
  return count
})

// 切换任务选中状态
function toggleTask(taskId: number) {
  if (selectedTaskIds.value.includes(taskId)) {
    selectedTaskIds.value = selectedTaskIds.value.filter(id => id !== taskId)
  }
  else {
    selectedTaskIds.value = [...selectedTaskIds.value, taskId]
  }
}

function showAllTasks() {
  selectedTaskIds.value = tasks.value.map(t => t.id)
}

function hideAllTasks() {
  selectedTaskIds.value = []
}

// ==================== 图表配置 ====================

// 通用 Tooltip 配置
const baseTooltipConfig = computed(() => ({
  trigger: 'axis' as const,
  confine: false,
  backgroundColor: chartThemeColors.value.tooltipBg,
  borderColor: 'transparent',
  borderWidth: 0,
  borderRadius: 6,
  textStyle: {
    color: chartThemeColors.value.text,
    fontSize: 12,
    lineHeight: 20,
  },
  extraCssText: `backdrop-filter: blur(5px);z-index:9;box-shadow:0 0 0 1px ${chartThemeColors.value.tooltipShadow}, 0 0 16px ${chartThemeColors.value.tooltipShadow}`,
  axisPointer: {
    type: 'cross' as const,
    crossStyle: {
      color: chartThemeColors.value.textTertiary,
    },
    lineStyle: {
      color: chartThemeColors.value.crosshairColor,
      width: 1,
      type: 'dashed' as const,
    },
    shadowStyle: {
      color: chartThemeColors.value.crosshairColor,
    },
  },
}))

const pingChartOption = computed(() => {
  const taskList = selectedTasks.value
  const data = chartData.value
  const hours = selectedHours.value

  // 1. 上通道：延迟折线 series（绑定 gridIndex: 0, yAxisIndex: 0）
  const lineSeries = taskList.map((task) => {
    const color = getTaskColor(task.id)
    return {
      name: task.name,
      type: 'line' as const,
      xAxisIndex: 0,
      yAxisIndex: 0,
      data: data.map(d => (showDelay.value ? (d[task.id] as number | null ?? null) : null)),
      smooth: showDelay.value ? (cutPeak.value ? 0.6 : 0.1) : 0,
      showSymbol: false,
      connectNulls: false,
      lineStyle: { width: showDelay.value ? 1.5 : 0, color, cap: 'round' as const },
      itemStyle: { color, opacity: showDelay.value ? 1 : 0 },
    }
  })

  // 预先统计各时间点存在丢包的任务，用于多任务同时丢包时的精准对称并排
  const lossTasksByTime = new Map<number, number[]>()
  if (showLoss.value) {
    for (const task of taskList) {
      const lossMarkers = packetLossMarkers.value.get(task.id) || []
      for (const m of lossMarkers) {
        if (m.loss > 0) {
          const list = lossTasksByTime.get(m.index) || []
          list.push(task.id)
          lossTasksByTime.set(m.index, list)
        }
      }
    }
  }

  // 2. 下通道：丢包 series（采用 custom series 严格对齐 category tick，保持 boundaryGap: false 与上通道等宽）
  const lossSeries = showLoss.value
    ? taskList.map((task) => {
        const color = getTaskColor(task.id)
        const lossMarkers = packetLossMarkers.value.get(task.id) || []

        const lossMap = new Map<number, number>()
        for (const m of lossMarkers) {
          if (m.loss > 0) {
            lossMap.set(m.index, Number((m.loss * 100).toFixed(1)))
          }
        }
        const customLossData: [number, number][] = data.map((_, idx) => [
          idx,
          lossMap.get(idx) ?? 0,
        ])

        return {
          name: `${task.name} 丢包`,
          type: 'custom' as const,
          xAxisIndex: 1,
          yAxisIndex: 1,
          clip: true,
          renderItem: (_params: unknown, api: {
            value: (dim: number) => number
            coord: (pt: [number, number]) => [number, number]
          }) => {
            const xIndex = api.value(0)
            const lossVal = api.value(1)
            if (lossVal === null || lossVal === undefined || lossVal <= 0)
              return

            const coordTop = api.coord([xIndex, lossVal])
            const coordBottom = api.coord([xIndex, 0])

            const activeTaskIds = lossTasksByTime.get(xIndex) || []
            const count = activeTaskIds.length
            const subIndex = activeTaskIds.indexOf(task.id)
            const barWidth = 2
            // 单任务丢包时严格居中在 tick 轴线上（offsetX = 0，与上方折线点 100% 垂直对齐）；多任务时对称并排
            const offsetX = count > 1 ? (subIndex - (count - 1) / 2) * (barWidth + 1) : 0

            const barHeight = Math.max(3, coordBottom[1] - coordTop[1])

            return {
              type: 'rect' as const,
              shape: {
                x: coordBottom[0] + offsetX - barWidth / 2,
                y: coordBottom[1] - barHeight,
                width: barWidth,
                height: barHeight,
                r: [1, 1, 0, 0],
              },
              style: {
                fill: color,
                opacity: 0.85,
              },
            }
          },
          data: customLossData,
        }
      })
    : []

  const series = [...lineSeries, ...lossSeries]

  // 颜色映射表（用于 Tooltip）
  const colorMap = new Map<number, string>()
  tasks.value.forEach((task, idx) => {
    const safeIdx = Math.max(0, idx % chartColors.length)
    colorMap.set(task.id, chartColors[safeIdx]!)
  })

  // Grid 布局：双通道 vs 单通道
  const gridConfig = showLoss.value
    ? [
        // 上通道：延迟折线（黄金分割 56% 高度，极致清爽舒展）
        {
          left: 56,
          right: 60,
          top: 24,
          height: '56%',
        },
        // 下通道：专属丢包泳道（19% 高度，独立微弱背景与细边框）
        {
          left: 56,
          right: 60,
          top: '68%',
          height: '19%',
          show: true,
          backgroundColor: isDark.value ? 'rgba(255, 255, 255, 0.015)' : 'rgba(0, 0, 0, 0.012)',
          borderColor: chartThemeColors.value.borderColor,
          borderWidth: 1,
        },
      ]
    : [
        {
          left: 56,
          right: 24,
          top: 24,
          bottom: 48,
        },
      ]

  // X 轴配置（联动对齐）
  const xAxisConfig = showLoss.value
    ? [
        // 上通道 X 轴（隐藏刻度文字与多余浮动时间气泡）
        {
          type: 'category' as const,
          gridIndex: 0,
          data: data.map(d => formatTime(d.time as string, showDateInAxis.value)),
          axisLabel: { show: false },
          axisLine: {
            show: true,
            lineStyle: { color: chartThemeColors.value.borderColor, width: 1 },
          },
          axisTick: { show: false },
          boundaryGap: false,
          axisPointer: {
            label: { show: false },
          },
        },
        // 下通道 X 轴（显示时间刻度）
        {
          type: 'category' as const,
          gridIndex: 1,
          data: data.map(d => formatTime(d.time as string, showDateInAxis.value)),
          axisLabel: {
            fontSize: 11,
            color: chartThemeColors.value.textSecondary,
            margin: 6,
          },
          axisLine: {
            show: true,
            lineStyle: { color: chartThemeColors.value.borderColor, width: 1 },
          },
          axisTick: { show: false },
          boundaryGap: false,
        },
      ]
    : [
        {
          type: 'category' as const,
          gridIndex: 0,
          data: data.map(d => formatTime(d.time as string, showDateInAxis.value)),
          axisLabel: {
            fontSize: 11,
            color: chartThemeColors.value.textSecondary,
            margin: 12,
          },
          axisLine: {
            show: true,
            lineStyle: { color: chartThemeColors.value.borderColor, width: 1 },
          },
          axisTick: { show: false },
          boundaryGap: false,
        },
      ]

  // Y 轴配置
  const yAxisConfig = showLoss.value
    ? [
        // 上通道 Y 轴：延迟 (ms)
        {
          type: 'value' as const,
          gridIndex: 0,
          name: '延迟 (ms)',
          min: 0,
          nameTextStyle: { color: chartThemeColors.value.textSecondary },
          axisLabel: { fontSize: 11, color: chartThemeColors.value.textSecondary, formatter: '{value}' },
          axisLine: { show: false },
          axisTick: { show: false },
          axisPointer: {
            lineStyle: { opacity: 0 },
            crossStyle: { opacity: 0 },
            label: { show: false },
          },
          splitLine: {
            lineStyle: {
              color: chartThemeColors.value.splitLineColor,
              type: 'dashed' as const,
            },
          },
        },
        // 下通道 Y 轴：丢包率 (%) 刻度，标在右侧轴线外（方案二：100% 丢包自解释）
        {
          type: 'value' as const,
          gridIndex: 1,
          min: 0,
          max: 100,
          interval: 50,
          position: 'right' as const,
          axisLabel: {
            fontSize: 10,
            margin: 4,
            color: chartThemeColors.value.textSecondary,
            formatter: (val: number) => (val === 100 ? '100% 丢包' : `${val}%`),
          },
          axisLine: { show: false },
          axisTick: { show: false },
          axisPointer: {
            lineStyle: { opacity: 0 },
            crossStyle: { opacity: 0 },
            label: { show: false },
          },
          splitLine: {
            lineStyle: {
              color: chartThemeColors.value.splitLineColor,
              type: 'dashed' as const,
            },
          },
        },
      ]
    : [
        {
          type: 'value' as const,
          gridIndex: 0,
          name: '延迟 (ms)',
          min: 0,
          nameTextStyle: { color: chartThemeColors.value.textSecondary },
          axisLabel: { fontSize: 11, color: chartThemeColors.value.textSecondary, formatter: '{value}' },
          axisLine: { show: false },
          axisTick: { show: false },
          axisPointer: {
            lineStyle: { opacity: 0 },
            crossStyle: { opacity: 0 },
            label: { show: false },
          },
          splitLine: {
            lineStyle: {
              color: chartThemeColors.value.splitLineColor,
              type: 'dashed' as const,
            },
          },
        },
      ]

  return {
    animation: false,
    color: tasks.value.map((_, idx) => {
      const safeIdx = Math.max(0, idx % chartColors.length)
      return chartColors[safeIdx]!
    }),
    axisPointer: {
      link: [
        {
          xAxisIndex: 'all',
        },
      ],
    },
    graphic: [
      // 无丢包时的状态反馈提示
      ...(showLoss.value && totalLossMarkersCount.value === 0 && data.length > 0
        ? [
            {
              type: 'text' as const,
              left: 'center',
              top: '76%',
              style: {
                text: '✓ 当前时段无丢包 · 网络质量优异',
                fill: isDark.value ? 'rgba(52, 211, 153, 0.65)' : 'rgba(16, 185, 129, 0.75)',
                fontSize: 11,
                fontWeight: 500,
              },
            },
          ]
        : []),
    ],
    tooltip: {
      ...baseTooltipConfig.value,
      formatter: (params: unknown) => {
        const p = params as Array<{
          seriesName: string
          seriesType?: string
          value: unknown
          dataIndex: number
        }>
        if (!p.length)
          return ''

        // 优先从 line 系列获取当前指针对应的时间点数据索引；若指针在下通道 custom 系列上，从 value[0] 或 dataIndex 获取
        const lineParam = p.find(item => item.seriesType === 'line')
        let dataIndex = lineParam ? lineParam.dataIndex : -1
        if (dataIndex < 0) {
          const firstParam = p[0]
          if (firstParam) {
            const val = firstParam.value
            if (Array.isArray(val) && typeof val[0] === 'number') {
              dataIndex = val[0]
            }
            else if (typeof firstParam.dataIndex === 'number') {
              dataIndex = firstParam.dataIndex
            }
          }
        }
        if (dataIndex < 0)
          return ''

        const rowData = data[dataIndex]
        if (!rowData)
          return ''

        const time = rowData.time as string
        const timeStr = formatTimeForTooltip(time, hours)
        let html = `<div style="font-weight:600;margin-bottom:6px;color:${chartThemeColors.value.textSecondary}">${timeStr}</div>`
        html += '<div style="display:flex;flex-direction:column;gap:4px">'

        // 整理每个选中的任务在该时间点的延迟与丢包率
        const taskRows = taskList.map((task) => {
          const delayVal = (showDelay.value && typeof rowData[task.id] === 'number')
            ? rowData[task.id] as number
            : null
          const taskLossMarkers = packetLossMarkers.value.get(task.id)
          const marker = taskLossMarkers?.find(m => m.index === dataIndex)
          return {
            task,
            delayVal,
            loss: marker?.loss,
          }
        }).sort((a, b) => {
          if (a.delayVal === null && b.delayVal === null)
            return 0
          if (a.delayVal === null)
            return 1
          if (b.delayVal === null)
            return -1
          return (a.delayVal ?? 0) - (b.delayVal ?? 0)
        })

        for (const { task, delayVal, loss } of taskRows) {
          const color = colorMap.get(task.id) || chartColors[0]!
          const colorDot = `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${color};margin-right:8px;flex-shrink:0"></span>`

          if (delayVal !== null) {
            const lossText = (loss !== undefined && loss > 0)
              ? `<span style="margin-left:6px;color:${color};font-size:11px;font-weight:600">(${(loss * 100).toFixed(loss < 0.01 ? 1 : 0)}% 丢包)</span>`
              : ''
            html += `<div style="display:flex;align-items:center">${colorDot}<span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${task.name}</span>${lossText}<span style="margin-left:auto;font-weight:600;margin-left:16px;font-variant-numeric:tabular-nums">${Math.round(delayVal)} ms</span></div>`
          }
          else if (loss !== undefined && loss > 0) {
            html += `<div style="display:flex;align-items:center">${colorDot}<span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${task.name}</span><span style="margin-left:auto;font-weight:600;margin-left:16px;color:${color};font-variant-numeric:tabular-nums">${(loss * 100).toFixed(loss < 0.01 ? 1 : 0)}% 丢包</span></div>`
          }
        }
        html += '</div>'
        return html
      },
    },
    legend: {
      type: 'scroll',
      bottom: 0,
      itemWidth: 12,
      itemHeight: 12,
      itemGap: 16,
      icon: 'roundRect',
      textStyle: { fontSize: 11, color: chartThemeColors.value.textSecondary },
      data: taskList.map(t => t.name),
    },
    grid: gridConfig,
    xAxis: xAxisConfig,
    yAxis: yAxisConfig,
    series,
  }
})

// ==================== 生命周期 ====================

watch(selectedView, () => {
  selectedTaskIds.value = []
  fetchRecords()
})

watch(() => props.uuid, () => {
  remoteData.value = []
  lossRecordsData.value = []
  tasks.value = []
  selectedTaskIds.value = []
  fetchRecords()
})

onMounted(() => {
  const firstView = availableViews.value[0]
  if (firstView && !selectedView.value) {
    selectedView.value = firstView.label
  }
  fetchRecords()
})
</script>

<template>
  <div class="flex flex-col gap-4">
    <!-- 时间选择器 -->
    <Tabs v-model="selectedView" class="w-full items-center">
      <div class="min-w-0 flex-1 overflow-x-auto pointer-events-auto">
        <TabsList :class="pickSurfaceClass('w-max h-8 bg-background/60 rounded-md', 'w-max h-8 bg-background/50 backdrop-blur-xl rounded-md')">
          <TabsTrigger
            v-for="view in availableViews" :key="view.label" :value="view.label"
            class="h-6.5 flex-none shrink-0 text-xs border-none data-[state=active]:text-emerald-600 shadow-none rounded-sm"
          >
            {{ view.label }}
          </TabsTrigger>
        </TabsList>
      </div>
      <div class="md:flex-1" />
      <div class="flex gap-2 items-center">
        <Button
          variant="ghost" size="xs" class="h-7 rounded-sm border-none bg-background/60 hover:bg-background"
          :class="[selectedTaskIds.length === tasks.length && 'bg-background !text-emerald-600']"
          @click="showAllTasks"
        >
          全选
        </Button>
        <Button
          variant="ghost" size="xs" class="h-7 rounded-sm border-none bg-background/60 hover:bg-background"
          :class="[!selectedTaskIds.length && 'bg-background !text-emerald-600']"
          @click="hideAllTasks"
        >
          全不选
        </Button>
      </div>
    </Tabs>

    <!-- 内容区域 -->
    <Spinner :show="loading" content-class="flex flex-col gap-4">
      <div v-if="error" class="text-red-500 py-8 text-center">
        {{ error }}
      </div>
      <div v-else-if="tasks.length === 0 && !loading" class="py-8">
        <Empty description="暂无延迟数据" />
      </div>

      <template v-else>
        <!-- 最新值统计卡片（可点击切换选中状态） -->
        <div
          v-if="latestValues.length > 0" class="gap-3 grid"
          style="grid-template-columns: repeat(auto-fit, minmax(180px, 1fr))"
        >
          <div
            v-for="task in latestValues" :key="task.id"
            class="flex cursor-pointer select-none items-center gap-3 rounded-md p-2 transition-all bg-background/60 hover:bg-background hover:shadow-[0_0_0_1px] hover:shadow-emerald-600/10"
            :class="[
              !selectedTaskIds.includes(task.id) && 'opacity-30',
            ]"
            :onmouseover="(e: MouseEvent) => ((e.currentTarget as HTMLElement).style.borderColor = task.color)"
            :onmouseout="(e: MouseEvent) => ((e.currentTarget as HTMLElement).style.borderColor = '')"
            @click="toggleTask(task.id)"
          >
            <div class="flex-1 min-w-0">
              <div class="flex gap-2 items-center">
                <div class="rounded h-4 w-1" :style="{ backgroundColor: task.color }" />
                <span class="text-sm font-semibold truncate">{{ task.name }}</span>
                <div class="flex-1" />
                <DataTooltip placement="left" content-class="!rounded p-3 w-60 backdrop-blur">
                  <Button variant="ghost" size="icon-xs" class="text-slate-500" @click.stop>
                    <Icon icon="carbon:information" :width="14" :height="14" />
                  </Button>
                  <template #content>
                    <div class="text-xs gap-x-4 gap-y-1.5 grid grid-cols-4">
                      <template v-if="task.min !== undefined">
                        <span class="text-muted-foreground">最小</span>
                        <span class="font-medium">{{ Math.round(task.min) }} ms</span>
                      </template>
                      <template v-if="task.max !== undefined">
                        <span class="text-muted-foreground">最大</span>
                        <span class="font-medium">{{ Math.round(task.max) }} ms</span>
                      </template>
                      <template v-if="task.avg !== undefined">
                        <span class="text-muted-foreground">平均</span>
                        <span class="font-medium">{{ Math.round(task.avg) }} ms</span>
                      </template>
                      <template v-if="task.latest !== undefined">
                        <span class="text-muted-foreground">最新</span>
                        <span class="font-medium">{{ Math.round(task.latest) }} ms</span>
                      </template>
                      <template v-if="task.p50 !== undefined">
                        <span class="text-muted-foreground">P50</span>
                        <span class="font-medium">{{ Math.round(task.p50) }} ms</span>
                      </template>
                      <template v-if="task.p99 !== undefined">
                        <span class="text-muted-foreground">P99</span>
                        <span class="font-medium">{{ Math.round(task.p99) }} ms</span>
                      </template>
                      <template v-if="task.p99_p50_ratio !== undefined">
                        <span class="text-muted-foreground">波动率</span>
                        <span class="font-medium">{{ task.p99_p50_ratio.toFixed(2) }}</span>
                      </template>
                      <template v-if="task.interval !== undefined">
                        <span class="text-muted-foreground">间隔</span>
                        <span class="font-medium">{{ task.interval }}s</span>
                      </template>
                      <template v-if="task.type">
                        <span class="text-muted-foreground">类型</span>
                        <span class="font-medium">{{ task.type.toUpperCase() }}</span>
                      </template>
                      <template v-if="task.total !== undefined">
                        <span class="text-muted-foreground">总数</span>
                        <span class="font-medium">{{ task.total }}</span>
                      </template>
                    </div>
                  </template>
                </DataTooltip>
              </div>
              <div class="text-xs mt-1 flex gap-1.5 items-center text-muted-foreground">
                <span class="font-medium" title="平均延迟">
                  {{ task.avg !== undefined ? `${Math.round(task.avg)}ms` : '-' }}
                </span>
                <span class="opacity-60">·</span>
                <span title="丢包率">{{ task.loss.toFixed(2) }}%</span>
                <template v-if="task.p99_p50_ratio !== undefined">
                  <span class="opacity-60">·</span>
                  <span title="波动率">{{ task.p99_p50_ratio.toFixed(2) }}</span>
                </template>
              </div>
            </div>
          </div>
        </div>

        <div class="flex flex-wrap gap-2 items-center py-2">
          <!-- 延迟可视化开关 -->
          <Button
            variant="ghost" size="xs" class="h-7 rounded-sm border-none bg-background/60 hover:bg-background"
            :class="[showDelay && 'bg-background !text-emerald-600']" @click="showDelay = !showDelay"
          >
            延迟
          </Button>
          <!-- 丢包可视化开关 -->
          <Button
            variant="ghost" size="xs" class="h-7 rounded-sm border-none bg-background/60 hover:bg-background"
            :class="[showLoss && 'bg-background !text-emerald-600']" @click="showLoss = !showLoss"
          >
            丢包
          </Button>
          <!-- 平滑峰值开关 -->
          <div class="flex gap-2 items-center">
            <Button
              variant="ghost" size="xs" class="h-7 rounded-sm border-none bg-background/60 hover:bg-background"
              :class="[cutPeak && 'bg-background !text-emerald-600']" @click="cutPeak = !cutPeak"
            >
              平滑峰值
            </Button>
            <DataTooltip
              content="使用 EWMA 算法平滑数据并过滤突变值"
              placement="top"
              :content-class="pickSurfaceClass('whitespace-nowrap text-[11px]', 'whitespace-nowrap text-[11px] backdrop-blur-xl')"
            >
              <Button variant="ghost" size="icon-xs" class="text-slate-500">
                <Icon icon="carbon:information" :width="14" :height="14" />
              </Button>
            </DataTooltip>
          </div>
        </div>

        <!-- 图表 -->
        <div
          class="rounded-md p-4 transition-all"
          :class="[
            showLoss ? 'h-96' : 'h-80',
            pickSurfaceClass('bg-background/60 hover:bg-background', 'bg-background/50 hover:bg-background backdrop-blur-xl'),
          ]"
        >
          <VChart :option="pingChartOption" autoresize />
        </div>
      </template>
    </Spinner>
  </div>
</template>
