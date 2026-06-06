<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- Copyright (C) Mag. Thomas Michael Weissel <valueerror@gmail.com> -->

<template>
  <div class="app-layout">
    <AppSidebar />
    <div class="main-area">
      <main class="flex-grow-1 overflow-y-auto overflow-x-hidden p-4" style="flex: 1">
        <div v-if="!sessionChecked" class="text-center py-5" style="color:#8b949e;">
          <i class="bi bi-hourglass-split me-2"></i>Session wird geprüft…
        </div>
        <router-view v-else />
      </main>
      <LogConsole />
    </div>
  </div>

  <div v-if="authStore.deviceLoginCode" class="device-login-overlay">
    <div class="device-login-card">
      <h2 class="device-login-title">Microsoft-Anmeldung</h2>
      <p class="device-login-hint">
        Nachdem sich der Browser geöffnet hat, gib diesen Code auf
        <strong>microsoft.com/devicelogin</strong> ein:
      </p>
      <div class="device-login-code">{{ authStore.deviceLoginCode }}</div>
      <div class="device-login-actions">
        <button type="button" class="btn btn-primary" @click="copyDeviceCode">
          <i class="bi bi-clipboard me-1"></i>Code kopieren
        </button>
        <button type="button" class="btn btn-outline-secondary" @click="authStore.setDeviceLoginCode(null)">
          Ausblenden
        </button>
      </div>
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
import { onMounted, ref } from 'vue'
import AppSidebar from './components/AppSidebar.vue'
import LogConsole from './components/LogConsole.vue'
import { useAuthStore } from './stores/authStore'
import { useUsersStore } from './stores/usersStore'
import { useRolesStore } from './stores/rolesStore'

const authStore = useAuthStore()
const usersStore = useUsersStore()
const rolesStore = useRolesStore()
const sessionChecked = ref(false)

// Register before child views mount — RolesView can trigger auth during its onMounted.
window.ipcRenderer.on('device-login-code', (_e, data) => {
  authStore.setDeviceLoginCode(data?.code ?? null)
})
window.ipcRenderer.on('ps-operation-log', (_e, log) => {
  authStore.addLog(log)
})
window.ipcRenderer.on('ps-operation-complete', (_e, data) => {
  if (data.status === 'ok') authStore.setDeviceLoginCode(null)
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
void window.ipcRenderer.invoke('get-device-login-code').then((data) => {
  if (data?.code) authStore.setDeviceLoginCode(data.code)
})

async function copyDeviceCode() {
  const code = authStore.deviceLoginCode
  if (!code) return
  try {
    await navigator.clipboard.writeText(code)
    authStore.showToast('Anmeldecode kopiert', 'success')
  } catch {
    authStore.showToast('Kopieren fehlgeschlagen', 'error')
  }
}

onMounted(async () => {
  try {
    const status = await window.ipcRenderer.invoke('graph-connection-status')
    if (status?.status === 'ok') authStore.setConnected(status.tenantDomain || 'Microsoft 365')
  } catch { /* ignorieren: dann normaler Login-Flow */ }
  finally {
    sessionChecked.value = true
  }
})
</script>

<style scoped>
.device-login-overlay {
  position: fixed;
  inset: 0;
  z-index: 2000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(1, 4, 9, 0.82);
  padding: 1.5rem;
}

.device-login-card {
  width: min(480px, 100%);
  padding: 1.75rem 1.5rem;
  border-radius: 12px;
  border: 1px solid #30363d;
  background: #161b22;
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.45);
  text-align: center;
}

.device-login-title {
  margin: 0 0 0.75rem;
  font-size: 1.25rem;
  color: #e6edf3;
}

.device-login-hint {
  margin: 0 0 1.25rem;
  font-size: 0.9rem;
  color: #8b949e;
  line-height: 1.45;
}

.device-login-code {
  font-family: ui-monospace, 'Cascadia Code', 'Consolas', monospace;
  font-size: clamp(2rem, 8vw, 2.75rem);
  font-weight: 700;
  letter-spacing: 0.22em;
  color: #58a6ff;
  margin-bottom: 1.25rem;
  user-select: all;
}

.device-login-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  justify-content: center;
}
</style>
