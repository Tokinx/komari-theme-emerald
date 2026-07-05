import { computed } from 'vue'
import { useAppStore } from '@/stores/app'

export function useBackgroundSurface() {
  const appStore = useAppStore()
  const hasCustomBackground = computed(() => appStore.backgroundEnabled)

  function pickSurfaceClass(defaultClass: string, customBackgroundClass: string): string {
    return hasCustomBackground.value ? customBackgroundClass : defaultClass
  }

  return {
    hasCustomBackground,
    pickSurfaceClass,
  }
}
