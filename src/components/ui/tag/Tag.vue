<script setup lang="ts">
import type { CSSProperties, HTMLAttributes } from 'vue'
import { computed } from 'vue'
import { cn } from '@/lib/utils'

export type TagColor
  = | string
    | { color?: string, textColor?: string, borderColor?: string }

interface Props {
  type?: 'default' | 'primary' | 'success' | 'info' | 'warning' | 'error'
  size?: 'tiny' | 'small' | 'medium' | 'large'
  color?: TagColor
  bordered?: boolean
  round?: boolean
  class?: HTMLAttributes['class']
}

const props = withDefaults(defineProps<Props>(), {
  type: 'default',
  size: 'medium',
  bordered: true,
})

const typeClass = computed(() => {
  switch (props.type) {
    case 'primary': return 'bg-primary/10 text-primary border-primary/30'
    case 'success': return 'bg-success/10 text-success border-success/30'
    case 'info': return 'bg-info/10 text-info border-info/30'
    case 'warning': return 'bg-warning/10 text-warning border-warning/30'
    case 'error': return 'bg-destructive/10 text-destructive border-destructive/30'
    default: return 'bg-muted text-muted-foreground border-border'
  }
})

const sizeClass = computed(() => {
  switch (props.size) {
    case 'tiny': return 'h-4 px-1.5 text-[10px]'
    case 'small': return 'h-5 px-1.5 text-xs'
    case 'large': return 'h-7 px-3 text-sm'
    default: return 'h-6 px-2 text-xs'
  }
})

const customStyle = computed<CSSProperties>(() => {
  const c = props.color
  if (!c)
    return {}
  if (typeof c === 'string') {
    return { backgroundColor: c }
  }
  const style: CSSProperties = {}
  if (c.color)
    style.backgroundColor = c.color
  if (c.textColor)
    style.color = c.textColor
  if (c.borderColor)
    style.borderColor = c.borderColor
  return style
})

const hasCustomColor = computed(() => !!props.color)
</script>

<template>
  <span
    :class="cn(
      'inline-flex items-center gap-1 whitespace-nowrap font-medium leading-none',
      bordered ? 'border' : 'border border-transparent',
      round ? 'rounded-full' : 'rounded',
      sizeClass,
      !hasCustomColor && typeClass,
      props.class,
    )"
    :style="customStyle"
  >
    <slot name="icon" />
    <slot />
  </span>
</template>
