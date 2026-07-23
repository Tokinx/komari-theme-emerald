import type { NodeData, TrafficLimitType } from '@/stores/nodes'
import { formatDateTime } from '@/utils/helper'
import { formatPriceWithCycle, getDaysUntilExpired, getExpireStatus, getExpireTextClass, parseTags } from '@/utils/tagHelper'

export interface PriceTagItem {
  text: string
  highlightValue?: string
  prefix?: string
  suffix?: string
}

export function hasRegion(region: string | null | undefined): boolean {
  return Boolean(region?.trim())
}

export function calculateTrafficUsed(upload: number, download: number, type: TrafficLimitType): number {
  switch (type) {
    case 'up': return upload
    case 'down': return download
    case 'min': return Math.min(upload, download)
    case 'max': return Math.max(upload, download)
    case 'sum':
    default: return upload + download
  }
}

export function showTrafficProgress(node: NodeData): boolean {
  return node.traffic_limit > 0
}

export function getTrafficUsed(node: NodeData): number {
  const { net_total_up = 0, net_total_down = 0, traffic_limit_type } = node
  return calculateTrafficUsed(net_total_up, net_total_down, traffic_limit_type)
}

export function getTrafficUsedPercentage(node: NodeData): number {
  if (node.traffic_limit <= 0)
    return 0
  const used = getTrafficUsed(node)
  return Math.min((used / node.traffic_limit) * 100, 100)
}

export function getPriceTags(node: NodeData, lang: 'zh-CN' | 'en-US'): PriceTagItem[] {
  const tags: PriceTagItem[] = []
  const days = getDaysUntilExpired(node.expired_at)
  const status = getExpireStatus(node.expired_at)
  const priceText = formatPriceWithCycle(node.price, node.billing_cycle, node.currency, lang)
  if (node.price !== 0)
    tags.push({ text: priceText })
  if (status === 'expired')
    tags.push({ text: lang === 'zh-CN' ? '已过期' : 'Expired' })
  else if (status === 'long_term')
    tags.push({ text: lang === 'zh-CN' ? '长期' : 'Long-term' })
  else if (lang === 'zh-CN')
    tags.push({ text: `余 ${days} 天`, prefix: '余 ', highlightValue: String(days), suffix: ' 天' })
  else
    tags.push({ text: `${days} days left`, highlightValue: String(days), suffix: ' days left' })
  return tags
}

export function getRemainingTimeTagClass(node: NodeData): string {
  if (node.price === 0)
    return ''
  return getExpireTextClass(node.expired_at)
}

export function getCustomTags(node: NodeData): string[] {
  return parseTags(node.tags).map(t => t.text)
}

export function formatOfflineTime(node: NodeData): string {
  return formatDateTime(node.time)
}

export function getMemPercentage(node: NodeData): number {
  return (node.ram ?? 0) / (node.mem_total || 1) * 100
}

export function getDiskPercentage(node: NodeData): number {
  return (node.disk ?? 0) / (node.disk_total || 1) * 100
}
