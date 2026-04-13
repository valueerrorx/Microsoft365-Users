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
      <RouterLink to="/groups" class="nav-link-custom">
        <i class="bi bi-collection"></i>
        <span>Gruppen</span>
        <span v-if="groupsStore.groups.length" class="ms-auto" style="font-size:0.7rem;background:rgba(88,166,255,0.15);color:#58a6ff;border-radius:10px;padding:0.1rem 0.4rem;">
          {{ groupsStore.groups.length }}
        </span>
      </RouterLink>

      <div class="sidebar-section-label mt-2">Aktionen</div>
      <div class="nav-link-custom" @click="refreshUsers" :class="{ 'opacity-50': usersStore.loading }">
        <i class="bi" :class="usersStore.loading ? 'bi-arrow-repeat spin' : 'bi-arrow-clockwise'"></i>
        <span>{{ usersStore.loading ? 'Lädt...' : 'Benutzer laden' }}</span>
      </div>
    </div>

    <!-- Connection + version (pinned bottom) -->
    <div class="sidebar-footer mt-auto">
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
      <button
        type="button"
        class="sidebar-version-btn"
        :title="'Version ' + appVersion"
        @click="aboutModalOpen = true"
      >
        v{{ appVersion }}
      </button>
    </div>

    <div
      v-if="aboutModalOpen"
      class="modal d-block about-modal-backdrop"
      tabindex="-1"
      @click.self="aboutModalOpen = false"
    >
      <div class="modal-dialog modal-dialog-centered modal-sm">
        <div class="modal-content about-modal-content">
          <div class="modal-body text-center py-4 px-3">
            <div class="copyleft-glyph" aria-hidden="true">©</div>
            <p class="mt-3 mb-0 text-secondary small">2026</p>
            <p class="mb-0 mt-2" style="color:var(--text-primary);font-size:0.95rem;">Mag. Thomas Michael Weissel</p>
          </div>
          <div class="modal-footer border-0 pt-0 justify-content-center">
            <button type="button" class="btn btn-sm btn-secondary" @click="aboutModalOpen = false">Schließen</button>
          </div>
        </div>
      </div>
    </div>
  </nav>
</template>

<script setup>
import { ref } from 'vue'
import { useAuthStore } from '../stores/authStore'
import { useUsersStore } from '../stores/usersStore'
import { useGroupsStore } from '../stores/groupsStore'
import pkg from '../../package.json'

const appVersion = pkg.version
const aboutModalOpen = ref(false)

const authStore = useAuthStore()
const usersStore = useUsersStore()
const groupsStore = useGroupsStore()

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

.sidebar-footer {
  flex-shrink: 0;
}

.sidebar-version-btn {
  display: block;
  width: 100%;
  padding: 0.35rem 1rem 0.65rem;
  border: 0;
  background: transparent;
  text-align: left;
  font-size: 0.68rem;
  color: #6e7681;
  cursor: pointer;
  transition: color 0.15s, background 0.15s;
}

.sidebar-version-btn:hover {
  color: #8b949e;
  background: rgba(255, 255, 255, 0.04);
}

.about-modal-backdrop {
  background: rgba(0, 0, 0, 0.6);
}

.about-modal-content {
  background: #21262d;
  border: 1px solid var(--sidebar-border);
  color: var(--text-primary);
}

.copyleft-glyph {
  font-size: 3.25rem;
  line-height: 1;
  display: inline-block;
  transform: scaleX(-1);
  color: #e6edf3;
  font-weight: 400;
  user-select: none;
}
</style>
