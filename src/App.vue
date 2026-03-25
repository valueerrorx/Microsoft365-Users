<template>
  <div class="app-layout">
    <AppSidebar />
    <div class="main-area">
      <main class="flex-grow-1 overflow-auto p-4" style="flex: 1">
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

const authStore = useAuthStore()
const usersStore = useUsersStore()

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
