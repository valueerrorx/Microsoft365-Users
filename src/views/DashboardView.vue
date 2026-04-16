<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- Copyright (C) Mag. Thomas Michael Weissel <valueerror@gmail.com> -->

<template>
  <div>
    <!-- Header -->
    <div class="page-header">
      <h1 class="page-title">Dashboard</h1>
      <p class="page-subtitle">Übersicht über Microsoft 365 Benutzer, Gruppen, Geräte und Lizenzen</p>
    </div>

    <!-- PowerShell Core missing (Linux/macOS) -->
    <div v-if="pwshWarning" class="p-3 rounded mb-4 d-flex align-items-start gap-3" style="background:rgba(210,153,34,0.12);border:1px solid rgba(210,153,34,0.35);color:#e6edf3;" role="alert">
      <i class="bi bi-exclamation-triangle-fill fs-5 mt-1" style="flex-shrink:0;color:#d29922;"></i>
      <div>
        <strong style="color:#d29922;">PowerShell Core (<code class="text-light">pwsh</code>) nicht gefunden</strong>
        <p class="mb-0 mt-1" style="font-size:0.85rem;color:#8b949e;">
          Auf Linux und macOS muss PowerShell installiert und im <code class="text-secondary">PATH</code> sein (z.&nbsp;B. Paketmanager oder
          <a href="https://learn.microsoft.com/powershell/scripting/install/installing-powershell" target="_blank" rel="noopener noreferrer" class="link-light">Microsoft-Dokumentation</a>).
          Ohne <code class="text-secondary">pwsh</code> funktionieren MS365-Aktionen nicht.
        </p>
      </div>
    </div>

    <!-- Connection Alert -->
    <div v-if="!authStore.connected && !dashboardRefreshing && !usersStore.users.length" class="alert-dark-info p-3 rounded mb-4 d-flex align-items-start gap-3">
      <i class="bi bi-info-circle-fill fs-5 mt-1" style="flex-shrink:0"></i>
      <div>
        <strong>Nicht verbunden</strong>
        <p class="mb-2 mt-1" style="font-size:0.85rem;color:#8b949e;">
          Klicke auf <strong>Verbinden &amp; Laden</strong> oder unten bei Schnellzugriff auf <strong>Daten aktualisieren</strong>.
          Beim ersten Start öffnet sich ein Browser-Fenster zur Authentifizierung.
        </p>
        <button class="btn btn-primary btn-sm" @click="refreshDashboardData" :disabled="dashboardRefreshing">
          <i class="bi bi-plug me-1"></i> Verbinden &amp; Laden
        </button>
      </div>
    </div>

    <!-- Error Alert -->
    <div v-if="usersStore.error" class="alert" style="background:rgba(248,81,73,0.1);border:1px solid rgba(248,81,73,0.25);color:#f85149;border-radius:6px;" role="alert">
      <i class="bi bi-exclamation-triangle-fill me-2"></i>
      {{ usersStore.error }}
    </div>

    <!-- Stats Cards -->
    <div class="row row-cols-1 row-cols-md-2 row-cols-xl-4 g-3 mb-4 dashboard-stat-row">
      <div class="col">
        <div class="stat-card stat-card-rich flex-fill w-100">
          <div class="d-flex align-items-start gap-3">
            <div class="stat-icon" style="background:rgba(88,166,255,0.12);color:#58a6ff;">
              <i class="bi bi-people-fill"></i>
            </div>
            <div class="min-w-0 flex-grow-1">
              <div class="stat-card-kicker">Benutzer</div>
              <div class="stat-value stat-value-lg">{{ usersStore.loading ? '—' : usersStore.totalUsers }}</div>
              <div class="stat-label" style="margin-top:0.15rem;">Gesamt im Mandanten</div>
              <div class="stat-card-metrics stat-card-metrics--stack">
                <div class="stat-metric stat-metric--row">
                  <span class="stat-metric-label">Aktiv</span>
                  <span class="stat-metric-value">{{ usersStore.loading ? '—' : usersStore.activeUsers }}</span>
                </div>
                <div class="stat-metric stat-metric--row">
                  <span class="stat-metric-label">Deaktiviert</span>
                  <span class="stat-metric-value">{{ usersStore.loading ? '—' : usersStore.inactiveUsers }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="col">
        <div class="stat-card stat-card-rich flex-fill w-100">
          <div class="d-flex align-items-start gap-3">
            <div class="stat-icon" style="background:rgba(210,153,34,0.12);color:#d29922;">
              <i class="bi bi-award-fill"></i>
            </div>
            <div class="min-w-0 flex-grow-1">
              <div class="stat-card-kicker">Lizenzen</div>
              <div class="stat-value stat-value-lg">{{ usersStore.loading ? '—' : usersStore.licensedUsers }}</div>
              <div class="stat-label" style="margin-top:0.15rem;">Lizenzierte Benutzer</div>
              <div class="stat-card-metrics stat-card-metrics--stack">
                <div class="stat-metric stat-metric--row">
                  <span class="stat-metric-label">A3 Schüler</span>
                  <span class="stat-metric-value">{{ usersStore.loading ? '—' : usersStore.a3StudentLicenseConsumed }}</span>
                </div>
                <div class="stat-metric stat-metric--row">
                  <span class="stat-metric-label">A3 Lehrer</span>
                  <span class="stat-metric-value">{{ usersStore.loading ? '—' : usersStore.a3FacultyLicenseConsumed }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="col">
        <div class="stat-card stat-card-rich flex-fill w-100">
          <div class="d-flex align-items-start gap-3">
            <div class="stat-icon" style="background:rgba(163,113,247,0.12);color:#a371f7;">
              <i class="bi bi-collection-fill"></i>
            </div>
            <div class="min-w-0 flex-grow-1">
              <div class="stat-card-kicker">Gruppen</div>
              <div class="stat-value stat-value-lg">{{ groupsStore.loading ? '—' : groupsStore.totalGroups }}</div>
              <div class="stat-label" style="margin-top:0.15rem;">Microsoft365 / Entra</div>
              <div class="stat-card-metrics stat-card-metrics--stack">
                <div class="stat-metric stat-metric--row">
                  <span class="stat-metric-label">Mit Teams verbunden</span>
                  <span class="stat-metric-value">{{ groupsStore.loading ? '—' : groupsStore.teamsGroupsCount }}</span>
                </div>
                <div class="stat-metric stat-metric--row">
                  <span class="stat-metric-label">Ablaufrichtlinie</span>
                  <span class="stat-metric-value">{{ dashboardGroupsLifecycleDisplay }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="col">
        <div class="stat-card stat-card-rich flex-fill w-100">
          <div class="d-flex align-items-start gap-3">
            <div class="stat-icon" style="background:rgba(86,212,221,0.12);color:#56d4dd;">
              <i class="bi bi-pc-display"></i>
            </div>
            <div class="min-w-0 flex-grow-1">
              <div class="stat-card-kicker">Geräte</div>
              <div class="stat-value stat-value-lg">{{ devicesStore.loading ? '—' : devicesStore.totalDevices }}</div>
              <div class="stat-label" style="margin-top:0.15rem;">Im Verzeichnis</div>
              <div class="stat-card-metrics stat-card-metrics--stack">
                <div class="stat-metric stat-metric--row">
                  <span class="stat-metric-label">MDM / Intune verwaltet</span>
                  <span class="stat-metric-value">{{ devicesStore.loading ? '—' : devicesStore.managedDevicesCount }}</span>
                </div>
                <div class="stat-metric stat-metric--row">
                  <span class="stat-metric-label">Konform</span>
                  <span class="stat-metric-value">{{ devicesStore.loading ? '—' : devicesStore.compliantDevicesCount }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Quick Actions + License Overview -->
    <div class="row g-3">
      <!-- Quick Actions -->
      <div class="col-lg-5">
        <div class="content-card h-100">
          <div class="content-card-header">
            <span style="font-weight:600;font-size:0.9rem;">Schnellzugriff</span>
          </div>
          <div class="content-card-body d-flex flex-column gap-2">
            <div
              class="d-flex align-items-center gap-3 p-3 rounded"
              style="background:rgba(210,153,34,0.06);border:1px solid rgba(210,153,34,0.15);"
              :style="{ cursor: dashboardRefreshing ? 'wait' : 'pointer', opacity: dashboardRefreshing ? 0.85 : 1 }"
              @click="refreshDashboardData"
            >
              <div style="width:36px;height:36px;background:rgba(210,153,34,0.12);border-radius:8px;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                <i class="bi bi-arrow-repeat" style="color:#d29922;font-size:1.1rem;" :class="{ spin: dashboardRefreshing }"></i>
              </div>
              <div>
                <div style="font-size:0.875rem;font-weight:600;color:#e6edf3;">Daten aktualisieren</div>
                <div style="font-size:0.775rem;color:#8b949e;">Benutzer, Gruppen und Geräte neu von MS365 laden</div>
              </div>
            </div>

            <button
              v-for="p in msAdminPortals"
              :key="p.url"
              type="button"
              class="btn-quick-portal d-flex align-items-center gap-3 p-3 rounded text-start w-100 border-0"
              :style="portalRowStyle(p)"
              @click="openMsPortal(p.url)"
            >
              <div class="portal-icon-wrap d-flex align-items-center justify-content-center flex-shrink-0" :style="portalIconWrapStyle(p)">
                <i class="bi" :class="p.icon" :style="{ color: p.accent, fontSize: '1.1rem' }"></i>
              </div>
              <div class="min-w-0 flex-grow-1">
                <div style="font-size:0.875rem;font-weight:600;color:#e6edf3;">{{ p.title }}</div>
                <div style="font-size:0.775rem;color:#8b949e;">{{ p.subtitle }}</div>
              </div>
              <i class="bi bi-box-arrow-up-right ms-auto flex-shrink-0" :style="{ color: p.accent, fontSize: '0.95rem' }"></i>
            </button>
          </div>
        </div>
      </div>

      <!-- Licenses -->
      <div class="col-lg-7">
        <div class="content-card h-100">
          <div class="content-card-header">
            <span style="font-weight:600;font-size:0.9rem;">Verfügbare Lizenzen</span>
            <span style="font-size:0.78rem;color:#8b949e;">{{ usersStore.licenses.length }} SKUs</span>
          </div>
          <div class="content-card-body">
            <div v-if="!usersStore.licenses.length" style="color:#8b949e;font-size:0.85rem;text-align:center;padding:1.5rem 0;">
              <i class="bi bi-award fs-3 d-block mb-2"></i>
              Noch keine Lizenzdaten geladen
            </div>
            <div v-else class="d-flex flex-column gap-2">
              <div v-for="sku in displayedLicenses" :key="sku.skuId"
                class="d-flex align-items-center justify-content-between p-2 rounded"
                style="background:rgba(88,166,255,0.04);border:1px solid rgba(88,166,255,0.1);">
                <div>
                  <div style="font-size:0.82rem;font-weight:500;color:#e6edf3;">{{ humanLicenseLabel(sku.skuPartNumber) }}</div>
                  <div style="font-size:0.72rem;color:#8b949e;font-family:monospace;">{{ sku.skuPartNumber }}</div>
                  <div style="font-size:0.72rem;color:#8b949e;">{{ sku.consumedUnits }} / {{ sku.prepaidUnits?.enabled || '?' }} genutzt</div>
                </div>
                <div class="text-end">
                  <div style="font-size:0.75rem;color:#58a6ff;">
                    {{ sku.prepaidUnits?.enabled ? (sku.prepaidUnits.enabled - sku.consumedUnits) : '?' }} frei
                  </div>
                  <div style="width:80px;height:4px;background:#21262d;border-radius:2px;margin-top:4px;">
                    <div style="height:100%;border-radius:2px;"
                      :style="{
                        width: sku.prepaidUnits?.enabled ? Math.round(sku.consumedUnits / sku.prepaidUnits.enabled * 100) + '%' : '0%',
                        background: licenseBarColor(sku)
                      }"></div>
                  </div>
                </div>
              </div>
              <div v-if="usersStore.licenses.length > defaultLicenseCount" class="d-flex justify-content-center">
                <button
                  type="button"
                  class="btn btn-sm"
                  style="background:transparent;border:1px solid rgba(88,166,255,0.2);color:#58a6ff;"
                  @click="showAllLicenses = !showAllLicenses"
                >
                  {{ showAllLicenses ? 'Weniger anzeigen' : `Alle anzeigen (${usersStore.licenses.length - defaultLicenseCount} weitere)` }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useAuthStore } from '../stores/authStore'
import { useUsersStore } from '../stores/usersStore'
import { useGroupsStore } from '../stores/groupsStore'
import { useDevicesStore } from '../stores/devicesStore'
import { humanLicenseLabel } from '../utils/licenseLabel.js'

const authStore = useAuthStore()
const usersStore = useUsersStore()
const groupsStore = useGroupsStore()
const devicesStore = useDevicesStore()

const msAdminPortals = [
  { url: 'https://intune.microsoft.com/', title: 'Intune admin center', subtitle: 'Endpoint Management & Geräte', icon: 'bi-tablet-landscape', accent: '#a371f7' },
  { url: 'https://admin.microsoft.com/', title: 'Microsoft 365 Admin', subtitle: 'Benutzer, Lizenzen, Organisation', icon: 'bi-building', accent: '#3fb950' },
  { url: 'https://entra.microsoft.com/', title: 'Entra admin center', subtitle: 'Identität, Zugriff, Gruppen', icon: 'bi-person-badge', accent: '#58a6ff' },
  { url: 'https://security.microsoft.com/', title: 'Microsoft 365 Defender', subtitle: 'Security & Bedrohungsschutz', icon: 'bi-shield-check', accent: '#f778ba' }
]

const defaultLicenseCount = 6
const showAllLicenses = ref(false)
const pwshWarning = ref(false)

onMounted(async () => {
  try {
    const r = await window.ipcRenderer.invoke('check-pwsh')
    pwshWarning.value = Boolean(r?.shouldWarn)
  } catch {
    pwshWarning.value = false
  }
})

const displayedLicenses = computed(() => {
  const list = usersStore.licenses || []
  return showAllLicenses.value ? list : list.slice(0, defaultLicenseCount)
})

const dashboardRefreshing = computed(
  () => usersStore.loading || groupsStore.loading || groupsStore.lifecycleLoading || devicesStore.loading
)

const dashboardGroupsLifecycleDisplay = computed(() => {
  if (groupsStore.loading || groupsStore.lifecycleLoading) return '—'
  if (!groupsStore.lifecyclePolicy) return '—'
  const n = groupsStore.lifecyclePolicyGroupCount
  return Number.isFinite(n) ? n : '—'
})

async function refreshDashboardData() {
  if (dashboardRefreshing.value) return
  await usersStore.fetchUsers()
  await groupsStore.fetchGroupsDetail()
  await groupsStore.fetchLifecyclePolicies()
  groupsStore.refreshLifecyclePolicyGroupCount()
  await devicesStore.fetchDevices()
}

function portalRowStyle(p) {
  const a = p.accent
  return {
    background: `${a}0f`,
    border: `1px solid ${a}26`,
    cursor: 'pointer',
    transition: 'all 0.15s'
  }
}

function portalIconWrapStyle(p) {
  const a = p.accent
  return {
    width: '36px',
    height: '36px',
    borderRadius: '8px',
    background: `${a}1f`
  }
}

async function openMsPortal(url) {
  try {
    const r = await window.ipcRenderer.invoke('open-external-url', url)
    if (!r?.ok) authStore.showToast('Link konnte nicht geöffnet werden.', 'error')
  } catch {
    authStore.showToast('Link konnte nicht geöffnet werden.', 'error')
  }
}

function licenseBarColor(sku) {
  if (!sku.prepaidUnits?.enabled) return '#58a6ff'
  const pct = sku.consumedUnits / sku.prepaidUnits.enabled
  if (pct >= 0.9) return '#f85149'
  if (pct >= 0.7) return '#d29922'
  return '#3fb950'
}
</script>

<style scoped>
.spin { animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

.btn-quick-portal:hover {
  filter: brightness(1.06);
}
</style>
