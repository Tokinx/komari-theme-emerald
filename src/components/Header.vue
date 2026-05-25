<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { computed, h, inject, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useAppStore } from '@/stores/app'
import LoginDialog from './LoginDialog.vue'

const router = useRouter()
const appStore = useAppStore()

const isScrolled = inject<ReturnType<typeof ref<boolean>>>('isScrolled', ref(false))

const siteFavicon = ref('/favicon.ico')

const containerStyle = computed(() => {
  if (appStore.fullWidth)
    return {}
  return { maxWidth: appStore.maxPageWidth, marginInline: 'auto' }
})

const actionButtons = computed(() => {
  const buttons = [
    {
      title: appStore.themeMode === 'auto' ? '自动主题' : appStore.themeMode === 'light' ? '浅色主题' : '深色主题',
      icon: appStore.themeMode === 'auto' ? 'icon-park-outline:dark-mode' : appStore.themeMode === 'light' ? 'icon-park-outline:sun-one' : 'icon-park-outline:moon',
      action: 'toggleTheme',
    },
  ]

  if (appStore.isLoggedIn) {
    buttons.push({
      title: '后台管理',
      icon: 'icon-park-outline:setting',
      action: 'jumpToSetting',
    })
  }
  else if (appStore.showLoginButton) {
    buttons.push({
      title: '登录',
      icon: 'icon-park-outline:login',
      action: 'openLoginDialog',
    })
  }

  return buttons
})

function handleButtonClick(action: string) {
  switch (action) {
    case 'toggleTheme':
      appStore.updateThemeMode()
      break
    case 'jumpToSetting':
      location.href = '/admin'
      break
    case 'openLoginDialog':
      window.$modal.create({
        title: '登录',
        preset: 'dialog',
        showIcon: false,
        content: () => h(LoginDialog),
      })
      break
  }
}

const sitename = computed(() => appStore.publicSettings?.sitename || 'Komari Monitor')
</script>

<template>
  <div
    class="transition-all duration-200 top-0 sticky z-10"
    :class="isScrolled ? 'glass-card shadow-sm' : 'bg-transparent'"
  >
    <div class="px-4 flex-between h-16" :style="containerStyle">
      <div class="flex items-center gap-3 cursor-pointer" @click="router.push('/')">
        <Avatar class="size-8">
          <AvatarImage :src="siteFavicon" :alt="sitename" />
          <AvatarFallback>{{ sitename.slice(0, 1) }}</AvatarFallback>
        </Avatar>
        <h3 class="m-0 text-lg font-semibold">
          {{ sitename }}
        </h3>
      </div>
      <TooltipProvider :delay-duration="200">
        <div class="flex items-center gap-2">
          <Tooltip v-for="button in actionButtons" :key="button.action">
            <TooltipTrigger as-child>
              <Button
                variant="ghost"
                size="icon-sm"
                @click="handleButtonClick(button.action)"
              >
                <Icon :icon="button.icon" :width="18" :height="18" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{{ button.title }}</TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>
    </div>
  </div>
</template>
