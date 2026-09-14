import { createPinia } from 'pinia'
import { createApp } from 'vue'

import App from './App.vue'
import { i18n, readStoredLocale } from './i18n'
import { router } from './router'
import { useUiStore } from './stores/ui.store'

import './assets/main.css'

const app = createApp(App)

app.use(createPinia())
app.use(i18n)
app.use(router)

// Direction and theme are settled before the first paint, so the layout never flashes in the wrong
// direction or the wrong theme on load.
useUiStore().initialize(readStoredLocale())

app.mount('#app')
