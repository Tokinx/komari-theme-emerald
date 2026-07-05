<script setup lang="ts">
import { computed } from 'vue'
import { useAppStore } from '@/stores/app'

const appStore = useAppStore()
const isDark = computed(() => appStore.isDark)
</script>

<template>
  <div
    class="loading-cover fixed inset-0 z-20 flex items-center justify-center"
    :class="[isDark ? 'bg-black/50' : 'bg-white/80']"
  >
    <div class="flex flex-col items-center gap-3 text-foreground">
      <span
        class="inline-block size-7 animate-spin rounded-full border-2"
        style="border-color: color-mix(in srgb, currentColor 18%, transparent); border-top-color: currentColor;"
      />
      <span class="text-sm text-muted-foreground">Loading...</span>
    </div>
  </div>
</template>
