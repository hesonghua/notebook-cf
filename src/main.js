import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { useConfigStore } from './stores/configStore'

import App from './App.vue'
import router from './router'
import './style.css'
import mitt from 'mitt';

const app = createApp(App)
const emitter = mitt();

app.provide('emitter', emitter);
app.directive('focus', {
  mounted(el) {
    el.focus()
  }
})

app.use(createPinia())
app.use(router)

const configStore = useConfigStore()
configStore.fetchConfig().then(() => {
  app.mount('body')
})
