<script setup lang="ts">
import type { Component, VNode } from 'vue'
import { reactive } from 'vue'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'

interface ModalInstance {
  id: string
  title?: string
  preset?: 'card' | 'dialog'
  showIcon?: boolean
  content: Component | VNode | (() => VNode)
  open: boolean
}

const instances = reactive<ModalInstance[]>([])

function pushInstance(instance: ModalInstance) {
  instances.push(instance)
}

function destroyInstance(id: string) {
  const idx = instances.findIndex(i => i.id === id)
  if (idx >= 0) {
    const inst = instances[idx]
    if (inst)
      inst.open = false
    setTimeout(() => {
      const i = instances.findIndex(x => x.id === id)
      if (i >= 0)
        instances.splice(i, 1)
    }, 200)
  }
}

function destroyAll() {
  instances.forEach((i) => {
    i.open = false
  })
  setTimeout(() => instances.splice(0, instances.length), 200)
}

defineExpose({ pushInstance, destroyInstance, destroyAll })

function resolveContent(content: ModalInstance['content']): Component | VNode {
  if (typeof content === 'function') {
    return (content as () => VNode)()
  }
  return content
}

function handleUpdate(instance: ModalInstance, value: boolean) {
  if (!value) {
    destroyInstance(instance.id)
  }
}
</script>

<template>
  <Dialog
    v-for="instance in instances"
    :key="instance.id"
    :open="instance.open"
    @update:open="(v: boolean) => handleUpdate(instance, v)"
  >
    <DialogContent class="max-w-[min(92vw,640px)]">
      <DialogTitle v-if="instance.title" class="text-base font-medium">
        {{ instance.title }}
      </DialogTitle>
      <DialogDescription v-else class="sr-only">
        Modal
      </DialogDescription>
      <component :is="resolveContent(instance.content)" />
    </DialogContent>
  </Dialog>
</template>
