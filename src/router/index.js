import { createRouter, createWebHashHistory } from 'vue-router'
import DashboardView from '../views/DashboardView.vue'
import UsersView from '../views/UsersView.vue'
import CreateUsersView from '../views/CreateUsersView.vue'

const routes = [
  { path: '/', component: DashboardView, name: 'dashboard' },
  { path: '/users', component: UsersView, name: 'users' },
  { path: '/create', component: CreateUsersView, name: 'create' }
]

export default createRouter({
  history: createWebHashHistory(),
  routes
})
