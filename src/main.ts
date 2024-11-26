import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import { useBookStore } from './stores/bookStore'

const app = createApp(App)
const pinia = createPinia()
app.use(pinia)
app.use(router)

// 初始化书籍数据
const bookStore = useBookStore()
await bookStore.loadBooks()

app.mount('#app')
