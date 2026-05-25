<script setup lang="ts">
import type { SwitchRootEmits, SwitchRootProps } from 'reka-ui'
import type { HTMLAttributes } from 'vue'
import { reactiveOmit } from '@vueuse/core'
import {
  SwitchRoot,
  SwitchThumb,
  useForwardPropsEmits,
} from 'reka-ui'
import { cn } from '@/lib/utils'

type SwitchSize = 'sm' | 'default'

const props = withDefaults(defineProps<SwitchRootProps & {
  class?: HTMLAttributes['class']
  size?: SwitchSize
}>(), {
  size: 'default',
})

const emits = defineEmits<SwitchRootEmits>()

const TRACK_SIZE_CLASSES: Record<SwitchSize, string> = {
  sm: 'h-[16px] w-[26px] [--switch-thumb-size:12px] [--switch-thumb-translate:10px]',
  default: 'h-[20px] w-[34px] [--switch-thumb-size:16px] [--switch-thumb-translate:14px]',
}

const delegatedProps = reactiveOmit(props, 'class', 'size')

const forwarded = useForwardPropsEmits(delegatedProps, emits)
</script>

<template>
  <SwitchRoot
    v-slot="slotProps"
    data-slot="switch"
    :data-size="size"
    v-bind="forwarded"
    :class="cn(
      'data-checked:bg-primary data-unchecked:bg-input focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 dark:data-unchecked:bg-input/80 shrink-0 rounded-xl border border-transparent focus-visible:ring-[3px] aria-invalid:ring-[3px] peer group/switch relative inline-flex transition-all outline-none after:absolute after:-inset-x-3 after:-inset-y-2 data-disabled:cursor-not-allowed data-disabled:opacity-50',
      TRACK_SIZE_CLASSES[size],
      props.class,
    )"
  >
    <SwitchThumb
      data-slot="switch-thumb"
      class="bg-background dark:data-unchecked:bg-foreground dark:data-checked:bg-primary-foreground absolute left-px top-px block size-[var(--switch-thumb-size)] rounded-lg ring-0 pointer-events-none transition-transform data-checked:translate-x-[var(--switch-thumb-translate)] data-unchecked:translate-x-0"
    >
      <slot name="thumb" v-bind="slotProps" />
    </SwitchThumb>
  </SwitchRoot>
</template>
