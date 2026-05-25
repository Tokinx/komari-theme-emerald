<script setup lang="ts">
import { useDark, usePreferredDark } from '@vueuse/core'
import { computed, provide, ref, watch } from 'vue'
import { BackTop } from '@/components/ui/back-top'
import { useAppStore } from '@/stores/app'

const appStore = useAppStore()

const isScrolled = ref(false)
provide('isScrolled', isScrolled)

const isDark = computed(() => appStore.isDark)

const preferredDark = usePreferredDark()
useDark({
  storageKey: 'vueuse-color-scheme',
  selector: 'html',
  attribute: 'class',
  valueDark: 'dark',
  valueLight: '',
  initialValue: () => (appStore.themeMode === 'auto' ? (preferredDark.value ? 'dark' : 'light') : appStore.themeMode),
})

const themeSettings = computed(() => appStore.publicSettings?.theme_settings as Record<string, unknown> | undefined)

const primaryColor = computed(() => isDark.value
  ? (themeSettings.value?.darkPrimaryColor as string) || '#63e2b6'
  : (themeSettings.value?.lightPrimaryColor as string) || '#18a058',
)
const primaryColorHover = computed(() => isDark.value
  ? (themeSettings.value?.darkPrimaryColorHover as string) || '#7fe7c4'
  : (themeSettings.value?.lightPrimaryColorHover as string) || '#36ad6a',
)
const primaryColorPressed = computed(() => isDark.value
  ? (themeSettings.value?.darkPrimaryColorPressed as string) || '#5acea7'
  : (themeSettings.value?.lightPrimaryColorPressed as string) || '#0c7a43',
)
const borderRadius = computed(() => (themeSettings.value?.borderRadius as string) || '3px')
const fontFamily = computed(() => (themeSettings.value?.fontFamily as string) || '"MiSans VF", system-ui, sans-serif')
const numberFontFamily = computed(() => (themeSettings.value?.numberFontFamily as string) || '"TCloud Number VF", "MiSans VF", system-ui, sans-serif')

watch(
  [primaryColor, primaryColorHover, primaryColorPressed, borderRadius, fontFamily, numberFontFamily],
  ([primary, hover, pressed, radius, font, numFont]) => {
    const root = document.documentElement
    root.style.setProperty('--primary', primary)
    root.style.setProperty('--primary-hover', hover)
    root.style.setProperty('--primary-active', pressed)
    root.style.setProperty('--primary-color', primary)
    root.style.setProperty('--primary-color-hover', hover)
    root.style.setProperty('--primary-color-pressed', pressed)
    root.style.setProperty('--radius', radius)
    root.style.setProperty('--font-sans', font)
    root.style.setProperty('--font-number', numFont)
  },
  { immediate: true },
)

watch(
  isDark,
  (dark) => {
    const root = document.documentElement
    if (dark)
      root.classList.add('dark')
    else root.classList.remove('dark')
  },
  { immediate: true },
)

watch(
  [() => appStore.backgroundEnabled, isDark],
  ([enabled, dark]) => {
    const body = document.body
    if (enabled) {
      body.style.setProperty('background-color', 'transparent', 'important')
    }
    else {
      body.style.removeProperty('background-color')
      body.style.backgroundColor = dark ? 'rgb(16, 16, 20)' : '#fff'
    }
  },
  { immediate: true },
)
</script>

<template>
  <slot />
  <BackTop :visibility-height="1" @scrolled="isScrolled = $event" />
</template>
