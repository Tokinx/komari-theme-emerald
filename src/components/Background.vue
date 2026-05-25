<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import { useAppStore } from '@/stores/app'

const appStore = useAppStore()

const isLoaded = ref(false)
const hasError = ref(false)

const backgroundStyle = computed(() => {
  const blur = appStore.backgroundBlur
  return { filter: blur > 0 ? `blur(${blur}px)` : 'none' }
})

const overlayStyle = computed(() => {
  if (appStore.backgroundOverlay <= 0)
    return {}
  return { backgroundColor: `rgba(0, 0, 0, ${appStore.backgroundOverlay / 100})` }
})

const showBackground = computed(() => appStore.backgroundEnabled)
const currentUrl = computed(() => appStore.currentBackgroundUrl)
const backgroundType = computed(() => appStore.backgroundType)

const showLoadedBackground = computed(() =>
  showBackground.value && currentUrl.value && isLoaded.value && !hasError.value,
)

const showDefaultBackground = computed(() => {
  if (!showBackground.value)
    return false
  if (!currentUrl.value)
    return true
  if (hasError.value)
    return true
  return false
})

const showLoadingBackground = computed(() =>
  showBackground.value && currentUrl.value && !isLoaded.value && !hasError.value,
)

let imageLoader: HTMLImageElement | null = null

function loadImage(url: string) {
  isLoaded.value = false
  hasError.value = false

  if (imageLoader) {
    imageLoader.onload = null
    imageLoader.onerror = null
    imageLoader = null
  }

  imageLoader = new Image()
  imageLoader.onload = () => {
    isLoaded.value = true
    hasError.value = false
  }
  imageLoader.onerror = () => {
    isLoaded.value = false
    hasError.value = true
  }
  imageLoader.src = url
}

const videoRef = ref<HTMLVideoElement | null>(null)

function handleVideoLoaded() {
  isLoaded.value = true
  hasError.value = false
}
function handleVideoError() {
  isLoaded.value = false
  hasError.value = true
}

watch(currentUrl, (url) => {
  if (url && backgroundType.value === 'image') {
    loadImage(url)
  }
  else if (url && backgroundType.value === 'video') {
    isLoaded.value = false
    hasError.value = false
  }
  else {
    isLoaded.value = false
    hasError.value = false
  }
}, { immediate: true })

watch(backgroundType, (type) => {
  if (type === 'image' && currentUrl.value)
    loadImage(currentUrl.value)
})

onUnmounted(() => {
  if (imageLoader) {
    imageLoader.onload = null
    imageLoader.onerror = null
    imageLoader = null
  }
})
</script>

<template>
  <div v-if="showBackground" class="background-container">
    <Transition name="fade">
      <div v-if="showDefaultBackground" class="background-default" />
    </Transition>
    <Transition name="fade">
      <div v-if="showLoadingBackground" class="background-loading" />
    </Transition>
    <Transition name="fade">
      <div v-if="showLoadedBackground" class="background-media" :style="backgroundStyle">
        <div
          v-if="backgroundType === 'image'"
          class="background-image"
          :style="{ backgroundImage: `url(${currentUrl})` }"
        />
        <video
          v-else-if="backgroundType === 'video'"
          ref="videoRef"
          class="background-video"
          :src="currentUrl ?? undefined"
          autoplay
          loop
          muted
          playsinline
          @loadeddata="handleVideoLoaded"
          @error="handleVideoError"
        />
      </div>
    </Transition>
    <div class="background-overlay" :style="overlayStyle" />
  </div>
</template>

<style scoped>
.background-container {
  position: fixed;
  inset: 0;
  z-index: -1;
  overflow: hidden;
}

.background-default,
.background-loading {
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, #f5f7fa 0%, #e4e8f0 25%, #d4e5f7 50%, #e8e0f0 75%, #f5f0e8 100%);
  background-size: 400% 400%;
  animation: gradientShift 15s ease infinite;
}

html.dark .background-default,
html.dark .background-loading {
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 25%, #1f3a5f 50%, #2d2d44 75%, #1a1a2e 100%);
  background-size: 400% 400%;
  animation: gradientShift 20s ease infinite;
}

@keyframes gradientShift {
  0% {
    background-position: 0% 50%;
  }
  50% {
    background-position: 100% 50%;
  }
  100% {
    background-position: 0% 50%;
  }
}

.background-media {
  position: absolute;
  inset: 0;
  transform: scale(1.1);
}

.background-image {
  width: 100%;
  height: 100%;
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
}

.background-video {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.background-overlay {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.8s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
