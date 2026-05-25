<script setup lang="ts">
import type { PrimitiveProps } from 'reka-ui'

import { Minus as PhMinus } from 'lucide-vue-next'
import { Primitive, useForwardProps } from 'reka-ui'

const props = defineProps<PrimitiveProps>()
const forwardedProps = useForwardProps(props)
</script>

<template>
  <Primitive
    data-slot="pin-input-separator"
    v-bind="forwardedProps"
  >
    <slot>
      <PhMinus />
    </slot>
  </Primitive>
</template>
