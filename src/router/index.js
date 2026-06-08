// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) Mag. Thomas Michael Weissel <valueerror@gmail.com>

import { createRouter, createWebHashHistory } from 'vue-router'
import DashboardView from '../views/DashboardView.vue'
import UsersView from '../views/UsersView.vue'
import CreateUsersView from '../views/CreateUsersView.vue'
import RemoveUsersView from '../views/RemoveUsersView.vue'
import CreateGroupView from '../views/CreateGroupView.vue'
import BackupView from '../views/BackupView.vue'
import GroupsView from '../views/GroupsView.vue'
import DevicesView from '../views/DevicesView.vue'
import RolesView from '../views/RolesView.vue'

const routes = [
  { path: '/', component: DashboardView, name: 'dashboard' },
  { path: '/users', component: UsersView, name: 'users' },
  { path: '/groups', component: GroupsView, name: 'groups' },
  { path: '/devices', component: DevicesView, name: 'devices' },
  { path: '/roles', component: RolesView, name: 'roles' },
  { path: '/create', component: CreateUsersView, name: 'create' },
  { path: '/remove', component: RemoveUsersView, name: 'remove' },
  { path: '/create-group', component: CreateGroupView, name: 'create-group' },
  { path: '/backup', component: BackupView, name: 'backup' }
]

export default createRouter({
  history: createWebHashHistory(),
  routes
})
