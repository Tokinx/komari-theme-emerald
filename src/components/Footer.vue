<script setup lang="ts">
import type { VersionInfo } from '@/utils/api'
import { computed, onMounted, ref } from 'vue'
import { useAppStore } from '@/stores/app'
import { getSharedApi } from '@/utils/api'

const appStore = useAppStore()
const api = getSharedApi()

const buildVersion = __BUILD_VERSION__
const buildGitHash = __BUILD_GIT_HASH__

const serverVersion = ref<VersionInfo | null>(null)

onMounted(async () => {
  try {
    serverVersion.value = await api.getVersion()
  }
  catch {
    // 静默失败
  }
})

const formattedServerVersion = computed(() => serverVersion.value?.version ?? null)

const containerStyle = computed(() =>
  appStore.fullWidth ? {} : { maxWidth: appStore.maxPageWidth, marginInline: 'auto' },
)

const showIcp = computed(() => appStore.icpEnabled && appStore.icpNumber)
const showPolice = computed(() => appStore.policeEnabled && appStore.policeNumber)
const showFiling = computed(() => showIcp.value || showPolice.value)

const hasBackgroundBlur = computed(() => appStore.backgroundEnabled && appStore.backgroundBlur > 0)
</script>

<template>
  <footer
    class="px-4 py-4 w-full"
    :class="[hasBackgroundBlur && 'glass-footer-enabled glass-card']"
  >
    <div
      class="flex flex-col gap-3 w-full sm:flex-row sm:gap-4 sm:items-center sm:justify-between"
      :style="containerStyle"
    >
      <div class="flex flex-col gap-2 sm:flex-row sm:gap-6">
        <div class="flex flex-wrap gap-1 items-center">
          <span class="text-sm text-muted-foreground">Powered by</span>
          <a
            href="https://github.com/komari-monitor/komari"
            target="_blank"
            rel="noopener noreferrer"
            class="transition-opacity hover:opacity-80"
          >
            <span class="text-sm font-medium text-primary">Komari Monitor</span>
          </a>
          <span v-if="formattedServerVersion" class="text-xs font-mono ml-1 text-muted-foreground">
            v{{ formattedServerVersion }}
          </span>
        </div>
        <div class="flex flex-wrap gap-1 items-center">
          <span class="text-sm text-muted-foreground">Theme by</span>
          <a
            href="https://github.com/lyimoexiao/komari-theme-naive"
            target="_blank"
            rel="noopener noreferrer"
            class="transition-opacity hover:opacity-80"
          >
            <span class="text-sm font-medium text-primary">Komari Naive</span>
          </a>
          <span class="text-xs font-mono ml-1 text-muted-foreground">
            v{{ buildVersion }} ({{ buildGitHash }})
          </span>
        </div>
      </div>

      <div v-if="showFiling" class="flex flex-wrap gap-2 items-center sm:flex-shrink-0">
        <a
          v-if="showIcp"
          :href="appStore.icpUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="transition-opacity hover:opacity-70"
        >
          <span class="text-xs text-muted-foreground">{{ appStore.icpNumber }}</span>
        </a>
        <span v-if="showIcp && showPolice" class="opacity-50 text-xs text-muted-foreground">|</span>
        <template v-if="showPolice">
          <a
            v-if="appStore.policeUrl"
            :href="appStore.policeUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="transition-opacity hover:opacity-70"
          >
            <span class="text-xs text-muted-foreground">{{ appStore.policeNumber }}</span>
          </a>
          <span v-else class="text-xs text-muted-foreground">{{ appStore.policeNumber }}</span>
        </template>
      </div>
    </div>
  </footer>
</template>

<style scoped>
.glass-footer-enabled {
  background-color: rgba(255, 255, 255, 0.7) !important;
}

html.dark .glass-footer-enabled {
  background-color: rgba(24, 24, 28, 0.85) !important;
}
</style>
