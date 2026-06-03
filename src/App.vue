<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- Copyright (C) Mag. Thomas Michael Weissel <valueerror@gmail.com> -->

<template>
  <div class="app-layout">
    <AppSidebar />
    <div class="main-area">
      <main class="flex-grow-1 overflow-y-auto overflow-x-hidden p-4" style="flex: 1">
        <router-view />
      </main>
      <LogConsole />
    </div>
  </div>

  <!-- Toast Container -->
  <div class="toast-container-custom">
    <div
      v-for="toast in authStore.toasts"
      :key="toast.id"
      class="toast-item"
      :class="toast.type"
    >
      <i class="bi"
        :class="{
          'bi-check-circle-fill text-success': toast.type === 'success',
          'bi-exclamation-circle-fill text-danger': toast.type === 'error',
          'bi-info-circle-fill text-info': toast.type === 'info'
        }"></i>
      <span>{{ toast.message }}</span>
    </div>
  </div>
</template>

<script setup>
import { onMounted } from 'vue'
import AppSidebar from './components/AppSidebar.vue'
import LogConsole from './components/LogConsole.vue'
import { useAuthStore } from './stores/authStore'
import { useUsersStore } from './stores/usersStore'
import { useRolesStore } from './stores/rolesStore'

const authStore = useAuthStore()
const usersStore = useUsersStore()
const rolesStore = useRolesStore()

onMounted(() => {
  window.ipcRenderer.on('ps-operation-log', (_e, log) => {
    authStore.addLog(log)
  })
  window.ipcRenderer.on('ps-operation-complete', (_e, data) => {
    authStore.addLog({
      type: data.status === 'ok' ? 'success' : 'error',
      message: `Operation abgeschlossen (${data.status})`
    })
  })
  window.ipcRenderer.on('pwsh-log', (_e, log) => {
    authStore.addLog(log)
    usersStore.bulkLogs.push(log)
  })
  window.ipcRenderer.on('scheduled-directory-roles-changed', (_e, data) => {
    rolesStore.$patch({ scheduledExpirations: data?.entries || [] })
    for (const role of rolesStore.roles) {
      rolesStore.syncScheduledExpirationsToMembers(role.templateId)
    }
  })
  window.ipcRenderer.on('directory-role-auto-removed', (_e, payload) => {
    const tid = payload?.roleTemplateId
    const uid = payload?.userId
    if (!tid || !uid) return
    const normTid = String(tid || '').trim().toLowerCase()
    const normUid = String(uid || '').trim().toLowerCase()
    const role = rolesStore.roles.find((r) => String(r.templateId || '').trim().toLowerCase() === normTid)
    if (role) {
      role.members = (role.members || []).filter(
        (m) => String(m.id || '').trim().toLowerCase() !== normUid
      )
      role.memberCount = role.members.length
    }
    rolesStore.$patch({
      scheduledExpirations: rolesStore.scheduledExpirations.filter(
        (e) =>
          !(
            String(e.roleTemplateId || '').trim().toLowerCase() === normTid &&
            String(e.userId || '').trim().toLowerCase() === normUid
          )
      )
    })
    authStore.addLog({
      type: 'info',
      message: `Temporäre Rolle abgelaufen und entfernt (${payload.roleLabel || tid})`
    })
  })
  window.ipcRenderer.on('pwsh-complete', (_e, data) => {
    const ok = data.status === 'success'
    authStore.addLog({
      type: ok ? 'success' : 'error',
      message: ok
        ? `Massenoperation abgeschlossen`
        : `Fehler: ${data.message || 'PowerShell-Fehler'} (Exit: ${data.exitCode ?? '?'})`
    })
    if (data.failedUsers?.length) {
      authStore.addLog({ type: 'warning', message: `Fehlgeschlagen: ${data.failedUsers.join(', ')}` })
    }
  })
})
</script>
