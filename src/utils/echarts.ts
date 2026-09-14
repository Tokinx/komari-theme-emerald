/**
 * ECharts 共享配置
 *
 * 统一注册所有图表组件，避免在各个组件中重复注册
 */
import { BarChart, CustomChart, LineChart, MapChart, ScatterChart } from 'echarts/charts'
import {
  DataZoomComponent,
  GeoComponent,
  GraphicComponent,
  GridComponent,
  LegendComponent,
  MarkLineComponent,
  TitleComponent,
  TooltipComponent,
} from 'echarts/components'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'

// 一次性注册所有需要的 ECharts 组件
use([
  BarChart,
  CustomChart,
  LineChart,
  MapChart,
  ScatterChart,
  GridComponent,
  GeoComponent,
  GraphicComponent,
  TooltipComponent,
  LegendComponent,
  MarkLineComponent,
  TitleComponent,
  DataZoomComponent,
  CanvasRenderer,
])
