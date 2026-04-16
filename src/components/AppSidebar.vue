<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- Copyright (C) Mag. Thomas Michael Weissel <valueerror@gmail.com> -->

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
      <RouterLink to="/groups" class="nav-link-custom">
        <i class="bi bi-collection"></i>
        <span>Gruppen</span>
        <span v-if="groupsStore.groups.length" class="ms-auto" style="font-size:0.7rem;background:rgba(88,166,255,0.15);color:#58a6ff;border-radius:10px;padding:0.1rem 0.4rem;">
          {{ groupsStore.groups.length }}
        </span>
      </RouterLink>
      <RouterLink to="/devices" class="nav-link-custom">
        <i class="bi bi-pc-display"></i>
        <span>Geräte</span>
        <span v-if="devicesStore.devices.length" class="ms-auto" style="font-size:0.7rem;background:rgba(88,166,255,0.15);color:#58a6ff;border-radius:10px;padding:0.1rem 0.4rem;">
          {{ devicesStore.devices.length }}
        </span>
      </RouterLink>

      <div class="sidebar-section-label mt-2">Aktionen</div>
      <RouterLink to="/create" class="nav-link-custom">
        <i class="bi bi-person-plus"></i>
        <span>Erstellen / Import</span>
      </RouterLink>
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
            <p class="mt-1 mb-1 text-secondary small">2026</p>
            <p class="mb-0 mt-2 fw-semibold" style="color:var(--text-primary);font-size:1.05rem;">{{ appDisplayName }}</p>
            <p class="mb-0 mt-1 fw-normal" style="color:var(--text-secondary);font-size:0.82rem;">{{ appVersionFull }}</p>
            <p class="mb-0 mt-4 fw-normal" style="color:var(--text-primary);font-size:1.08rem;">Thomas Michael Weissel</p>
            <p class="mb-0 mt-3">
              <button type="button" class="about-vendor-link" @click="openXapientSite">https://xapient.solutions/</button>
            </p>
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
import { useDevicesStore } from '../stores/devicesStore'
import pkg from '../../package.json'

const appDisplayName = 'MS365 Manager'
const appVersion = pkg.version
const appVersionFull = `Version ${pkg.version}`
const xapientUrl = 'https://xapient.solutions/'
const aboutModalOpen = ref(false)

const authStore = useAuthStore()
const usersStore = useUsersStore()
const groupsStore = useGroupsStore()
const devicesStore = useDevicesStore()

function formatTime(date) {
  return date.toLocaleTimeString('de-AT', { hour: '2-digit', minute: '2-digit' })
}

async function openXapientSite() {
  try {
    const r = await window.ipcRenderer.invoke('open-external-url', xapientUrl)
    if (!r?.ok) authStore.showToast('Link konnte nicht geöffnet werden.', 'error')
  } catch {
    authStore.showToast('Link konnte nicht geöffnet werden.', 'error')
  }
}
</script>

<style scoped>
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

.about-vendor-link {
  color: #58a6ff;
  text-decoration: none;
  font-size: 0.9rem;
  word-break: break-all;
  background: none;
  border: 0;
  padding: 0;
  cursor: pointer;
  text-align: center;
}

.about-vendor-link:hover {
  color: #79b8ff;
  text-decoration: underline;
}
</style>
