<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { computed, ref } from 'vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PinInput, PinInputGroup, PinInputSlot } from '@/components/ui/pin-input'
import { Separator } from '@/components/ui/separator'
import { useAppStore } from '@/stores/app'
import { ApiError, getSharedApi } from '@/utils/api'
import { reconnectAfterLogin } from '@/utils/init'

const props = defineProps<{
  forceLogin?: boolean
}>()

const emit = defineEmits<{
  loginSuccess: []
}>()

const appStore = useAppStore()
const api = getSharedApi()

const form = ref({
  username: '',
  password: '',
})

const loading = ref(false)
const showOtpDialog = ref(false)
const otpCode = ref<(string | number)[]>([])
const otpLoading = ref(false)

const usernameError = ref('')
const passwordError = ref('')

function validate(): boolean {
  usernameError.value = form.value.username.trim() ? '' : '请输入用户名'
  passwordError.value = form.value.password ? '' : '请输入密码'
  return !usernameError.value && !passwordError.value
}

async function handleLogin() {
  if (!validate())
    return
  loading.value = true
  try {
    await api.login(form.value.username, form.value.password)
    window.$message?.success('登录成功')
    if (props.forceLogin) {
      emit('loginSuccess')
    }
    else {
      await reconnectAfterLogin()
      window.$modal?.destroyAll()
    }
  }
  catch (error) {
    if (error instanceof ApiError) {
      const msg = error.message.toLowerCase()
      if (msg.includes('2fa') || msg.includes('2fa code') || msg.includes('two factor')) {
        showOtpDialog.value = true
        return
      }
    }
    console.error('[LoginDialog] Login error:', error)
    window.$message?.error('登录失败，请检查用户名和密码')
  }
  finally {
    loading.value = false
  }
}

async function handleOtpSubmit() {
  const code = otpCode.value.join('')
  if (code.length < 6) {
    window.$message?.warning('请输入 6 位验证码')
    return
  }
  otpLoading.value = true
  try {
    await api.login(form.value.username, form.value.password, code)
    window.$message?.success('登录成功')
    if (props.forceLogin) {
      emit('loginSuccess')
    }
    else {
      await reconnectAfterLogin()
      window.$modal?.destroyAll()
    }
  }
  catch (error) {
    console.error('[LoginDialog] OTP error:', error)
    window.$message?.error('验证码错误，请重试')
    otpCode.value = []
  }
  finally {
    otpLoading.value = false
  }
}

function handleOAuth2Login() {
  location.href = '/api/oauth'
}

const oauthEnabled = computed(() => Boolean((appStore.publicSettings as Record<string, unknown> | undefined)?.oauth_enable))
</script>

<template>
  <div class="w-full">
    <div v-if="!showOtpDialog" class="flex flex-col gap-4">
      <form class="flex flex-col gap-3" @submit.prevent="handleLogin">
        <div class="flex flex-col gap-1.5">
          <Label for="username">用户名</Label>
          <Input
            id="username"
            v-model="form.username"
            placeholder="请输入用户名"
            :disabled="loading"
            autocomplete="username"
          />
          <span v-if="usernameError" class="text-xs text-destructive">{{ usernameError }}</span>
        </div>
        <div class="flex flex-col gap-1.5">
          <Label for="password">密码</Label>
          <Input
            id="password"
            v-model="form.password"
            type="password"
            placeholder="请输入密码"
            :disabled="loading"
            autocomplete="current-password"
            @keydown.enter="handleLogin"
          />
          <span v-if="passwordError" class="text-xs text-destructive">{{ passwordError }}</span>
        </div>
        <Button type="submit" :disabled="loading" class="w-full">
          <Icon icon="icon-park-outline:login" :width="16" :height="16" />
          {{ loading ? '登录中...' : '登录' }}
        </Button>
      </form>

      <template v-if="oauthEnabled">
        <Separator />
        <Button variant="outline" class="w-full" @click="handleOAuth2Login">
          <Icon icon="icon-park-outline:outbound" :width="16" :height="16" />
          使用 OAuth2 登录
        </Button>
      </template>
    </div>

    <div v-else class="flex flex-col gap-4 w-full items-center">
      <div class="text-center">
        <div class="text-lg font-medium mb-2">
          两步验证
        </div>
        <div class="text-sm text-muted-foreground">
          请输入验证器中的 6 位数字验证码
        </div>
      </div>
      <PinInput
        v-model="(otpCode as any)"
        :disabled="otpLoading"
        type="number"
        :length="6"
        @complete="handleOtpSubmit"
      >
        <PinInputGroup>
          <PinInputSlot v-for="(_, i) in 6" :key="i" :index="i" />
        </PinInputGroup>
      </PinInput>
      <div class="flex gap-2 w-full">
        <Button variant="ghost" :disabled="otpLoading" @click="showOtpDialog = false">
          返回
        </Button>
        <Button class="flex-1" :disabled="otpLoading" @click="handleOtpSubmit">
          {{ otpLoading ? '验证中...' : '验证' }}
        </Button>
      </div>
    </div>
  </div>
</template>
