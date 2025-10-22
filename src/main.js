import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { useConfigStore } from './stores/configStore'
import { marked } from 'marked'

import App from './App.vue'
import router from './router'
import './assets/main.css'
import mitt from 'mitt';

// 在应用启动时，全局配置 marked
marked.setOptions({
  sanitize: false,
});

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
