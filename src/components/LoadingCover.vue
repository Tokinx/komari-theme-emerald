<script setup lang="ts">
import { usePreferredDark } from '@vueuse/core'
import { computed } from 'vue'
import { useAppStore } from '@/stores/app'

const appStore = useAppStore()
const preferredDark = usePreferredDark()

const isDark = computed(() => {
  if (appStore.themeMode === 'auto')
    return preferredDark.value
  return appStore.themeMode === 'dark'
})
</script>

<template>
  <div
    class="loading-cover flex h-screen w-screen items-center left-0 top-0 justify-center absolute z-20 backdrop-blur-sm"
    :class="isDark ? 'bg-black/50' : 'bg-white/80'"
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
