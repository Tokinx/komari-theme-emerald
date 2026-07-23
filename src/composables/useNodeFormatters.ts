import type { UptimeFormat } from '@/utils/helper'
import { useAppStore } from '@/stores/app'
import { formatBytesPerSecondWithConfig, formatBytesWithConfig, formatUptimeWithFormat } from '@/utils/helper'

export function useNodeFormatters() {
  const appStore = useAppStore()

  const formatBytes = (bytes: number) => formatBytesWithConfig(bytes, appStore.byteDecimals)
  const formatBytesPerSecond = (bytes: number) => formatBytesPerSecondWithConfig(bytes, appStore.byteDecimals)
  const formatUptime = (seconds: number, precision: UptimeFormat = 'hour') =>
    formatUptimeWithFormat(seconds, precision)

  return { formatBytes, formatBytesPerSecond, formatUptime }
}
