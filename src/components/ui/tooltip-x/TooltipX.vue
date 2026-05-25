<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { computed } from 'vue'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

interface Props {
  trigger?: 'hover' | 'click'
  placement?: 'top' | 'bottom' | 'left' | 'right'
  disabled?: boolean
  contentClass?: HTMLAttributes['class']
}

const props = withDefaults(defineProps<Props>(), {
  trigger: 'hover',
  placement: 'top',
  disabled: false,
})

const useClick = computed(() => props.trigger === 'click')
</script>

<template>
  <template v-if="disabled">
    <slot name="trigger" />
  </template>
  <Popover v-else-if="useClick">
    <PopoverTrigger as-child>
      <slot name="trigger" />
    </PopoverTrigger>
    <PopoverContent :side="placement" :class="contentClass">
      <slot />
    </PopoverContent>
  </Popover>
  <Tooltip v-else>
    <TooltipTrigger as-child>
      <slot name="trigger" />
    </TooltipTrigger>
    <TooltipContent :side="placement" :class="contentClass">
      <slot />
    </TooltipContent>
  </Tooltip>
</template>
