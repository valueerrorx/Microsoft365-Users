import { createRouter, createWebHashHistory } from 'vue-router'
import DashboardView from '../views/DashboardView.vue'
import UsersView from '../views/UsersView.vue'
import CreateUsersView from '../views/CreateUsersView.vue'
import GroupsView from '../views/GroupsView.vue'

const routes = [
  { path: '/', component: DashboardView, name: 'dashboard' },
  { path: '/users', component: UsersView, name: 'users' },
  { path: '/groups', component: GroupsView, name: 'groups' },
  { path: '/create', component: CreateUsersView, name: 'create' }
]

export default createRouter({
  history: createWebHashHistory(),
  routes
})
