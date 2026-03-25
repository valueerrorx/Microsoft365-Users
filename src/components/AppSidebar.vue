<template>
  <nav class="app-sidebar">
    <!-- Brand -->
    <div class="sidebar-brand d-flex align-items-center gap-2">
      <div style="width:28px;height:28px;background:linear-gradient(135deg,#58a6ff,#1f6feb);border-radius:6px;display:flex;align-items:center;justify-content:center;">
        <i class="bi bi-microsoft" style="color:white;font-size:0.85rem;"></i>
      </div>
      <div>
        <div style="font-size:0.875rem;line-height:1.2">MS365 Manager</div>
        <div style="font-size:0.68rem;color:#8b949e;font-weight:400">User Dashboard</div>
      </div>
    </div>

    <!-- Navigation -->
    <div class="flex-grow-1 pt-2">
      <div class="sidebar-section-label">Navigation</div>
      <RouterLink to="/" class="nav-link-custom">
        <i class="bi bi-speedometer2"></i>
        <span>Dashboard</span>
      </RouterLink>
      <RouterLink to="/users" class="nav-link-custom">
        <i class="bi bi-people"></i>
        <span>Benutzerliste</span>
        <span v-if="usersStore.users.length" class="ms-auto" style="font-size:0.7rem;background:rgba(88,166,255,0.15);color:#58a6ff;border-radius:10px;padding:0.1rem 0.4rem;">
          {{ usersStore.users.length }}
        </span>
      </RouterLink>
      <RouterLink to="/create" class="nav-link-custom">
        <i class="bi bi-person-plus"></i>
        <span>Erstellen / Import</span>
      </RouterLink>

      <div class="sidebar-section-label mt-2">Aktionen</div>
      <div class="nav-link-custom" @click="refreshUsers" :class="{ 'opacity-50': usersStore.loading }">
        <i class="bi" :class="usersStore.loading ? 'bi-arrow-repeat spin' : 'bi-arrow-clockwise'"></i>
        <span>{{ usersStore.loading ? 'Lädt...' : 'Benutzer laden' }}</span>
      </div>
    </div>

    <!-- Connection Status -->
    <div style="padding:0.75rem 1rem;border-top:1px solid var(--sidebar-border);">
      <div class="d-flex align-items-center gap-2 mb-2">
        <div class="conn-dot" :class="authStore.connected ? 'connected' : 'disconnected'"></div>
        <span style="font-size:0.78rem;color:var(--text-secondary);">
          {{ authStore.connected ? authStore.tenantDomain : 'Nicht verbunden' }}
        </span>
      </div>
      <div v-if="usersStore.lastFetched" style="font-size:0.7rem;color:var(--text-secondary);margin-bottom:0.4rem;">
        Zuletzt: {{ formatTime(usersStore.lastFetched) }}
      </div>
    </div>
  </nav>
</template>

<script setup>
import { useAuthStore } from '../stores/authStore'
import { useUsersStore } from '../stores/usersStore'

const authStore = useAuthStore()
const usersStore = useUsersStore()

function refreshUsers() {
  if (!usersStore.loading) usersStore.fetchUsers()
}

function formatTime(date) {
  return date.toLocaleTimeString('de-AT', { hour: '2-digit', minute: '2-digit' })
}
</script>

<style scoped>
.spin { animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
</style>
