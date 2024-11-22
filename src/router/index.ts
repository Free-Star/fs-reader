import { createRouter, createWebHistory } from 'vue-router'
import Home from '../views/Home.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'Home',
      component: Home
    },
    {
      path: '/reader/:bookId',
      name: 'Reader',
      component: () => import('../views/Reader.vue')
    }
  ]
})

export default router 