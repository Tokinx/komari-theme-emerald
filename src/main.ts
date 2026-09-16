import { createPinia } from 'pinia'
import { createApp } from 'vue'
import { setupIconify } from '@/utils/iconify'
import { message } from '@/utils/message'
import { ensureServiceWorkerDoesNotHijack } from '@/utils/serviceWorkerGuard'
import App from './App.vue'
import router from './router'

import './styles/main.css'

window.$message = message

async function bootstrap() {
  await ensureServiceWorkerDoesNotHijack()

  setupIconify().catch((err) => {
    console.warn('[main] iconify init failed', err)
  })

  const pinia = createPinia()
  const app = createApp(App)

  app.use(pinia)
  app.use(router)

  app.mount('#app')
}

bootstrap().catch((err) => {
  console.error('[main] bootstrap failed', err)
})
