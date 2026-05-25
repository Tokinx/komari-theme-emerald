<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import { ModalHost } from '@/components/ui/modal-x'
import { Toaster } from '@/components/ui/sonner'
import { useAppStore } from '@/stores/app'
import { destroyInitManager, initApp } from '@/utils/init'
import { registerModalHost } from '@/utils/modal'
import Background from './components/Background.vue'
import Footer from './components/Footer.vue'
import Header from './components/Header.vue'
import LoadingCover from './components/LoadingCover.vue'
import Provider from './components/Provider.vue'

const appStore = useAppStore()

const isReady = ref(false)

const pageContainerStyle = computed(() => {
  if (appStore.fullWidth) {
    return {}
  }
  return {
    maxWidth: appStore.maxPageWidth,
    marginInline: 'auto',
  }
})

const modalHostRef = ref<InstanceType<typeof ModalHost> | null>(null)

onMounted(async () => {
  if (modalHostRef.value) {
    registerModalHost(modalHostRef.value)
  }
  try {
    await initApp()
    await nextTick()
    isReady.value = true
  }
  catch (error) {
    console.error('[App] Initialization failed:', error)
    isReady.value = true
  }
})

onUnmounted(() => {
  destroyInitManager()
})
</script>

<template>
  <Provider>
    <Background />
    <Transition
      enter-active-class="transition-all duration-100 ease-out"
      enter-from-class="opacity-0 backdrop-blur-0"
      enter-to-class="opacity-100 backdrop-blur-sm"
      leave-active-class="transition-all duration-100 ease-in"
      leave-from-class="opacity-100 backdrop-blur-sm"
      leave-to-class="opacity-0 backdrop-blur-0"
    >
      <LoadingCover v-if="appStore.loading" />
    </Transition>

    <Header />
    <main v-if="!appStore.loading" class="min-h-screen overflow-hidden">
      <div :style="pageContainerStyle">
        <RouterView v-slot="{ Component }">
          <Transition
            enter-active-class="transition-all duration-200 ease-out"
            enter-from-class="opacity-0 translate-x-4 blur-sm"
            enter-to-class="opacity-100 translate-x-0 blur-0"
            leave-active-class="transition-all duration-200 ease-in"
            leave-from-class="opacity-100 translate-x-0 blur-0"
            leave-to-class="opacity-0 -translate-x-4 blur-sm"
            mode="out-in"
          >
            <KeepAlive :include="['HomeView']">
              <component :is="Component" />
            </KeepAlive>
          </Transition>
        </RouterView>
      </div>
    </main>
    <Footer v-if="!appStore.loading" />
    <Toaster rich-colors close-button position="top-center" />
    <ModalHost ref="modalHostRef" />
  </Provider>
</template>
