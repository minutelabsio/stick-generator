import '@fontsource-variable/atkinson-hyperlegible-mono'
import '@fontsource-variable/atkinson-hyperlegible-next'
import { createPinia } from 'pinia'
import PrimeVue from 'primevue/config'
import ToastService from 'primevue/toastservice'
import { createApp } from 'vue'
import 'primeicons/primeicons.css'
import './styles.css'
import App from './app.vue'
import { router } from './router'
import { WORKSPACE_PRESET } from './theme'

createApp(App)
  .use(createPinia())
  .use(router)
  .use(PrimeVue, { theme: { preset: WORKSPACE_PRESET } })
  .use(ToastService)
  .mount('#app')
