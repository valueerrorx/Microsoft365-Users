<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- Copyright (C) Mag. Thomas Michael Weissel <valueerror@gmail.com> -->

<template>
  <div>
    <div class="page-header d-flex align-items-center justify-content-between flex-wrap gap-2">
      <div>
        <h1 class="page-title">Geräte</h1>
        <p class="page-subtitle">{{ devicesStore.totalDevices }} Geräte im Tenant</p>
      </div>
      <div class="d-flex gap-2">
        <button class="btn btn-outline-secondary btn-sm" @click="devicesStore.fetchDevices()" :disabled="devicesStore.loading">
          <i class="bi bi-arrow-clockwise me-1" :class="{ spin: devicesStore.loading }"></i>
          Aktualisieren
        </button>
      </div>
    </div>

    <div class="content-card mb-3">
      <div class="content-card-body py-2">
        <div class="row g-2 align-items-center">
          <div class="col-12 col-md-4 col-lg-4">
            <div class="input-group input-group-sm">
              <span class="input-group-text"><i class="bi bi-search"></i></span>
              <input v-model="searchQuery" type="text" class="form-control" placeholder="Name, Besitzer, OS suchen…" />
              <button v-if="searchQuery" class="btn btn-outline-secondary" type="button" @click="searchQuery = ''">
                <i class="bi bi-x"></i>
              </button>
            </div>
          </div>
          <div class="col-6 col-md-2 col-lg-2">
            <select v-model="filterTrust" class="form-select form-select-sm" aria-label="Verknüpfungstyp filtern">
              <option value="all">Alle Verknüpfungen</option>
              <option value="AzureAd">Entra gejoint</option>
              <option value="Workplace">Entra registriert</option>
              <option value="ServerAd">Hybrid</option>
              <option value="other">Sonstige / leer</option>
            </select>
          </div>
          <div class="col-6 col-md-2 col-lg-2">
            <select v-model="filterEnabled" class="form-select form-select-sm" aria-label="Aktiviert filtern">
              <option value="all">Aktiviert: alle</option>
              <option value="yes">Aktiviert: Ja</option>
              <option value="no">Aktiviert: Nein</option>
            </select>
          </div>
          <div class="col-6 col-md-2 col-lg-2">
            <select v-model="filterCompliant" class="form-select form-select-sm" aria-label="Konformität filtern">
              <option value="all">Konform: alle</option>
              <option value="yes">Konform: Ja</option>
              <option value="no">Konform: Nein</option>
              <option value="unknown">Konform: unbekannt</option>
            </select>
          </div>
          <div class="col-auto ms-md-auto">
            <span style="font-size:0.8rem;color:#8b949e;">{{ filteredDevices.length }} Treffer</span>
          </div>
        </div>
      </div>
    </div>

    <div
      v-if="!devicesStore.loading && devicesStore.devices.length && selectedDeviceIds.length >= 2"
      class="content-card mb-2"
    >
      <div class="content-card-body py-2 px-3 d-flex flex-wrap align-items-center gap-2">
        <span style="font-size:0.875rem;color:#e6edf3;">
          <strong>{{ selectedDeviceIds.length }}</strong> ausgewählt
        </span>
        <button type="button" class="btn btn-outline-primary btn-sm" @click="openBulkRetireModal">
          <i class="bi bi-link-45deg me-1"></i>Abkoppeln (Retire)
        </button>
        <button type="button" class="btn btn-link btn-sm text-secondary ms-auto p-0" @click="clearDeviceSelection">
          Auswahl aufheben
        </button>
      </div>
    </div>

    <div v-if="devicesStore.loading" class="text-center py-5">
      <div class="spinner-border" style="color:#58a6ff;" role="status"></div>
      <div style="color:#8b949e;margin-top:1rem;font-size:0.875rem;">Geräte werden geladen…</div>
    </div>

    <div v-else-if="!devicesStore.devices.length" class="text-center py-5">
      <i class="bi bi-pc-display" style="font-size:3rem;color:#30363d;"></i>
      <div style="color:#8b949e;margin-top:1rem;">Noch keine Geräte geladen</div>
      <button class="btn btn-primary btn-sm mt-3" @click="devicesStore.fetchDevices()">
        <i class="bi bi-plug me-1"></i> Geräte laden
      </button>
    </div>

    <div v-else class="content-card" style="position:relative;">
      <div style="overflow-x:auto;">
        <table class="table table-ms365">
          <thead>
            <tr>
              <th class="text-center" style="width:36px;">
                <input
                  type="checkbox"
                  class="form-check-input"
                  :checked="allPageDevicesSelected"
                  :indeterminate.prop="pageDevicesSelectionIndeterminate"
                  title="Alle auf dieser Seite"
                  @change="toggleSelectDevicesPage"
                />
              </th>
              <th @click="setSort('displayName')" style="cursor:pointer;user-select:none;min-width:9rem;">
                Gerätename <i class="bi" :class="sortIcon('displayName')"></i>
              </th>
              <th @click="setSort('accountEnabled')" style="cursor:pointer;user-select:none;white-space:nowrap;">
                Aktiviert <i class="bi" :class="sortIcon('accountEnabled')"></i>
              </th>
              <th @click="setSort('operatingSystem')" style="cursor:pointer;user-select:none;">
                OS <i class="bi" :class="sortIcon('operatingSystem')"></i>
              </th>
              <th @click="setSort('operatingSystemVersion')" style="cursor:pointer;user-select:none;white-space:nowrap;">
                Version <i class="bi" :class="sortIcon('operatingSystemVersion')"></i>
              </th>
              <th @click="setSort('trustTypeLabel')" style="cursor:pointer;user-select:none;min-width:10rem;">
                Verknüpfung <i class="bi" :class="sortIcon('trustTypeLabel')"></i>
              </th>
              <th @click="setSort('ownerDisplayName')" style="cursor:pointer;user-select:none;min-width:9rem;">
                Besitzer <i class="bi" :class="sortIcon('ownerDisplayName')"></i>
              </th>
              <th @click="setSort('managementLabel')" style="cursor:pointer;user-select:none;">
                MDM <i class="bi" :class="sortIcon('managementLabel')"></i>
              </th>
              <th @click="setSort('securityManagementLabel')" style="cursor:pointer;user-select:none;min-width:8rem;">
                Sicherheit <i class="bi" :class="sortIcon('securityManagementLabel')"></i>
              </th>
              <th @click="setSort('isCompliant')" style="cursor:pointer;user-select:none;white-space:nowrap;">
                Konform <i class="bi" :class="sortIcon('isCompliant')"></i>
              </th>
              <th @click="setSort('createdDateTime')" style="cursor:pointer;user-select:none;white-space:nowrap;">
                Registriert <i class="bi" :class="sortIcon('createdDateTime')"></i>
              </th>
              <th @click="setSort('approximateLastSignInDateTime')" style="cursor:pointer;user-select:none;white-space:nowrap;">
                Aktivität <i class="bi" :class="sortIcon('approximateLastSignInDateTime')"></i>
              </th>
              <th style="width:140px;">Aktionen</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="d in paginatedDevices" :key="d.id">
              <td class="text-center align-middle">
                <input
                  type="checkbox"
                  class="form-check-input"
                  :checked="isDeviceRowSelected(d.id)"
                  @change="toggleDeviceRowSelected(d.id)"
                />
              </td>
              <td>
                <div style="font-weight:500;">{{ d.displayName || '—' }}</div>
              </td>
              <td>
                <span v-if="d.accountEnabled" class="badge-active">Ja</span>
                <span v-else class="badge-inactive">Nein</span>
              </td>
              <td style="font-size:0.82rem;">{{ d.operatingSystem || '—' }}</td>
              <td style="font-size:0.82rem;font-family:monospace;color:#8b949e;">{{ d.operatingSystemVersion || '—' }}</td>
              <td>
                <span v-if="d.trustType === 'AzureAd'" class="badge-license">{{ d.trustTypeLabel || d.trustType }}</span>
                <span v-else style="font-size:0.82rem;">{{ d.trustTypeLabel || d.trustType || '—' }}</span>
              </td>
              <td>
                <div style="font-size:0.82rem;">{{ d.ownerDisplayName || '—' }}</div>
                <div v-if="d.ownerUserPrincipalName" style="font-size:0.72rem;color:#8b949e;font-family:monospace;">{{ d.ownerUserPrincipalName }}</div>
              </td>
              <td>
                <span v-if="d.managementLabel" class="badge-mdm">{{ d.managementLabel }}</span>
                <span v-else style="font-size:0.8rem;color:#484f58;">—</span>
              </td>
              <td style="font-size:0.8rem;">{{ d.securityManagementLabel || '—' }}</td>
              <td>
                <span v-if="d.isCompliant === true" class="badge-active">Ja</span>
                <span v-else-if="d.isCompliant === false" class="badge-inactive">Nein</span>
                <span v-else style="color:#484f58;font-size:0.78rem;">—</span>
              </td>
              <td style="font-size:0.82rem;color:#8b949e;white-space:nowrap;" :title="d.createdDateTime || ''">{{ formatDeviceDateTime(d.createdDateTime) }}</td>
              <td style="font-size:0.82rem;color:#8b949e;white-space:nowrap;" :title="d.approximateLastSignInDateTime || ''">{{ formatDeviceDateTime(d.approximateLastSignInDateTime) }}</td>
              <td>
                <div class="d-flex gap-1 flex-wrap">
                  <button type="button" class="btn-action" title="Abkoppeln (Intune Retire)" @click="openRetireModal(d)">
                    <i class="bi bi-link-45deg"></i>
                  </button>
                  <button type="button" class="btn-action danger" title="Werkseinstellungen (Remote Wipe)" @click="openWipeModal(d)">
                    <i class="bi bi-arrow-counterclockwise"></i>
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div
        v-if="filteredDevices.length"
        class="d-flex align-items-center justify-content-between flex-wrap gap-2 p-3"
        style="border-top:1px solid var(--sidebar-border);"
      >
        <span style="font-size:0.8rem;color:#8b949e;">Seite {{ currentPage }} von {{ totalPages }}</span>
        <div class="d-flex align-items-center gap-2 flex-wrap">
          <div class="d-flex align-items-center gap-1">
            <span style="font-size:0.8rem;color:#8b949e;">Pro Seite</span>
            <select v-model.number="pageSize" class="form-select form-select-sm" style="width:auto;min-width:4.25rem;">
              <option v-for="n in pageSizeOptions" :key="n" :value="n">{{ n }}</option>
            </select>
          </div>
          <div v-if="totalPages > 1" class="d-flex gap-2">
            <button type="button" class="btn btn-outline-secondary btn-sm" :disabled="currentPage <= 1" @click="currentPage--">
              <i class="bi bi-chevron-left"></i>
            </button>
            <button type="button" class="btn btn-outline-secondary btn-sm" :disabled="currentPage >= totalPages" @click="currentPage++">
              <i class="bi bi-chevron-right"></i>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Batch Retire -->
    <div v-if="bulkRetireModal.show" class="modal d-block" tabindex="-1" style="background:rgba(0,0,0,0.6);">
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">
              <i class="bi bi-link-45deg me-2" style="color:#58a6ff;"></i>{{ bulkRetireModal.count }} Geräte abkoppeln (Retire)
            </h5>
            <button type="button" class="btn-close" :disabled="bulkRetireModal.running" @click="bulkRetireModal.show = false"></button>
          </div>
          <div class="modal-body">
            <p class="small mb-2">
              Intune entfernt die Verwaltung von allen ausgewählten Geräten nacheinander. Nicht in Intune eingeschriebene Geräte schlagen pro Zeile fehl (siehe Log).
            </p>
            <p class="small mb-3" style="color:#f85149;">
              <strong>Wirklich ausführen?</strong> Nur bei bewusster Offboarding-Entscheidung.
            </p>
            <div class="form-check">
              <input id="bulkRetireDisableUser" v-model="bulkRetireModal.disableUserAccount" class="form-check-input" type="checkbox" :disabled="bulkRetireModal.running" />
              <label class="form-check-label small" for="bulkRetireDisableUser">
                Schulbenutzerkonten in Microsoft Entra <strong>deaktivieren</strong> (je Gerät, wenn UPN ermittelbar)
              </label>
            </div>
            <p v-if="bulkRetireModal.disableUserAccount" class="small mt-2 mb-0" style="color:#8b949e;">
              Betroffene Benutzer können sich danach <strong>nicht mehr</strong> mit diesem Konto anmelden (pro Gerät separat).
            </p>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary btn-sm" :disabled="bulkRetireModal.running" @click="bulkRetireModal.show = false">Abbrechen</button>
            <button type="button" class="btn btn-primary btn-sm" :disabled="bulkRetireModal.running" @click="runBulkRetire">
              {{ bulkRetireModal.running ? 'Wird ausgeführt…' : 'Alle abkoppeln' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Retire (Intune abkoppeln) -->
    <div v-if="retireModal.show" class="modal d-block" tabindex="-1" style="background:rgba(0,0,0,0.6);">
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title"><i class="bi bi-link-45deg me-2" style="color:#58a6ff;"></i>Gerät abkoppeln (Retire)</h5>
            <button type="button" class="btn-close" :disabled="retireModal.running" @click="retireModal.show = false"></button>
          </div>
          <div class="modal-body">
            <p class="small mb-2">
              Intune entfernt die Verwaltung von diesem Gerät (Schulprofile/Apps je nach Plattform). Das Gerät selbst wird dabei nicht automatisch auf Werkseinstellungen zurückgesetzt.
            </p>
            <p class="small mb-3" style="color:#f85149;">
              <strong>Wirklich ausführen?</strong> Nur bei bewusster Offboarding-Entscheidung.
            </p>
            <div class="form-check">
              <input id="retireDisableUser" v-model="retireModal.disableUserAccount" class="form-check-input" type="checkbox" :disabled="retireModal.running" />
              <label class="form-check-label small" for="retireDisableUser">
                Schulbenutzerkonto in Microsoft Entra <strong>deaktivieren</strong>
              </label>
            </div>
            <p v-if="retireModal.disableUserAccount" class="small mt-2 mb-0" style="color:#8b949e;">
              Der Benutzer kann sich danach <strong>nicht mehr</strong> mit diesem Konto am Gerät und bei Microsoft-365-Diensten anmelden (sofern kein anderes Konto genutzt wird).
            </p>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary btn-sm" :disabled="retireModal.running" @click="retireModal.show = false">Abbrechen</button>
            <button type="button" class="btn btn-primary btn-sm" :disabled="retireModal.running" @click="runRetire">
              {{ retireModal.running ? 'Wird ausgeführt…' : 'Abkoppeln' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Factory reset (Remote Wipe) -->
    <div v-if="wipeModal.show" class="modal d-block" tabindex="-1" style="background:rgba(0,0,0,0.6);">
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title text-danger"><i class="bi bi-arrow-counterclockwise me-2"></i>Werkseinstellungen (Remote Wipe)</h5>
            <button type="button" class="btn-close" :disabled="wipeModal.running" @click="wipeModal.show = false"></button>
          </div>
          <div class="modal-body">
            <p class="small">
              Es wird ein <strong>Remote-Wipe</strong> ausgelöst: Das Gerät setzt Daten je nach Plattform und Richtlinie zurück, sobald es online ist (effektiv Factory-Reset / Datenlöschung).
            </p>
            <p class="small text-danger mb-2"><strong>Nur bei Schulgeräten oder klarer Freigabe verwenden.</strong></p>
            <label class="form-label small">{{ wipeConfirmLabel }}</label>
            <input v-model="wipeModal.confirmName" type="text" class="form-control" :disabled="wipeModal.running" autocomplete="off" />
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary btn-sm" :disabled="wipeModal.running" @click="wipeModal.show = false">Abbrechen</button>
            <button
              type="button"
              class="btn btn-danger btn-sm"
              :disabled="wipeModal.running || wipeModal.confirmName !== wipeConfirmExpected"
              @click="runWipe"
            >
              {{ wipeModal.running ? 'Wipe wird ausgelöst…' : 'Wipe auslösen' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, reactive, watch, onMounted } from 'vue'
import { useDevicesStore } from '../stores/devicesStore'

const devicesStore = useDevicesStore()

const retireModal = reactive({ show: false, device: null, disableUserAccount: false, running: false })
const bulkRetireModal = reactive({ show: false, disableUserAccount: false, running: false, count: 0 })
const wipeModal = reactive({ show: false, device: null, confirmName: '', running: false })

const selectedDeviceIds = ref([])

const searchQuery = ref('')
const filterTrust = ref('all')
const filterEnabled = ref('all')
const filterCompliant = ref('all')
const sortKey = ref('displayName')
const sortDir = ref(1)
const currentPage = ref(1)
const pageSizeOptions = [50, 100, 200]
const pageSize = ref(50)

const filteredDevices = computed(() => {
  let list = devicesStore.devices
  const q = searchQuery.value.trim().toLowerCase()
  if (q) {
    list = list.filter(
      (d) =>
        (d.displayName || '').toLowerCase().includes(q) ||
        (d.ownerDisplayName || '').toLowerCase().includes(q) ||
        (d.ownerUserPrincipalName || '').toLowerCase().includes(q) ||
        (d.operatingSystem || '').toLowerCase().includes(q) ||
        (d.operatingSystemVersion || '').toLowerCase().includes(q) ||
        (d.trustTypeLabel || '').toLowerCase().includes(q) ||
        (d.managementLabel || '').toLowerCase().includes(q)
    )
  }
  const ft = filterTrust.value
  if (ft !== 'all') {
    list = list.filter((d) => {
      const t = d.trustType || ''
      if (ft === 'other') return !t || !['AzureAd', 'Workplace', 'ServerAd'].includes(t)
      return t === ft
    })
  }
  const fe = filterEnabled.value
  if (fe === 'yes') list = list.filter((d) => d.accountEnabled === true)
  if (fe === 'no') list = list.filter((d) => d.accountEnabled === false)
  const fc = filterCompliant.value
  if (fc === 'yes') list = list.filter((d) => d.isCompliant === true)
  if (fc === 'no') list = list.filter((d) => d.isCompliant === false)
  if (fc === 'unknown') list = list.filter((d) => d.isCompliant !== true && d.isCompliant !== false)

  return [...list].sort((a, b) => {
    const key = sortKey.value
    if (key === 'accountEnabled' || key === 'isCompliant') {
      const av = boolSortKey(a[key])
      const bv = boolSortKey(b[key])
      return av < bv ? -sortDir.value : av > bv ? sortDir.value : 0
    }
    if (key === 'createdDateTime' || key === 'approximateLastSignInDateTime') {
      const av = dateSortKey(a[key])
      const bv = dateSortKey(b[key])
      return av < bv ? -sortDir.value : av > bv ? sortDir.value : 0
    }
    const av = (a[key] || '').toLowerCase()
    const bv = (b[key] || '').toLowerCase()
    return av < bv ? -sortDir.value : av > bv ? sortDir.value : 0
  })
})

const totalPages = computed(() => {
  const len = filteredDevices.value.length
  if (!len) return 1
  return Math.ceil(len / pageSize.value)
})

const paginatedDevices = computed(() => {
  const ps = pageSize.value
  const start = (currentPage.value - 1) * ps
  return filteredDevices.value.slice(start, start + ps)
})

const pageDeviceIds = computed(() => paginatedDevices.value.map((d) => d.id).filter(Boolean))

const allPageDevicesSelected = computed(
  () => pageDeviceIds.value.length > 0 && pageDeviceIds.value.every((id) => selectedDeviceIds.value.includes(id))
)

const pageDevicesSelectionIndeterminate = computed(() => {
  const n = pageDeviceIds.value.filter((id) => selectedDeviceIds.value.includes(id)).length
  return n > 0 && n < pageDeviceIds.value.length
})

function isDeviceRowSelected(id) {
  return selectedDeviceIds.value.includes(id)
}

function toggleDeviceRowSelected(id) {
  if (selectedDeviceIds.value.includes(id)) {
    selectedDeviceIds.value = selectedDeviceIds.value.filter((x) => x !== id)
  } else {
    selectedDeviceIds.value = [...selectedDeviceIds.value, id]
  }
}

function toggleSelectDevicesPage(e) {
  const checked = e.target.checked
  const ids = pageDeviceIds.value
  if (checked) {
    selectedDeviceIds.value = [...new Set([...selectedDeviceIds.value, ...ids])]
  } else {
    selectedDeviceIds.value = selectedDeviceIds.value.filter((id) => !ids.includes(id))
  }
}

function clearDeviceSelection() {
  selectedDeviceIds.value = []
}

function openBulkRetireModal() {
  bulkRetireModal.count = selectedDeviceIds.value.length
  bulkRetireModal.disableUserAccount = false
  bulkRetireModal.show = true
}

async function runBulkRetire() {
  const ids = [...selectedDeviceIds.value]
  const rows = ids.map((id) => devicesStore.devices.find((d) => d.id === id)).filter(Boolean)
  if (!rows.length) {
    bulkRetireModal.show = false
    return
  }
  bulkRetireModal.running = true
  await devicesStore.retireIntuneDevicesBatch(rows, bulkRetireModal.disableUserAccount)
  bulkRetireModal.running = false
  bulkRetireModal.show = false
  clearDeviceSelection()
}

watch([() => filteredDevices.value.length, pageSize], () => {
  const len = filteredDevices.value.length
  if (!len) return
  const tp = Math.ceil(len / pageSize.value)
  if (currentPage.value > tp) currentPage.value = tp
})

watch(pageSize, () => {
  currentPage.value = 1
})

watch(searchQuery, () => {
  currentPage.value = 1
})

watch([filterTrust, filterEnabled, filterCompliant], () => {
  currentPage.value = 1
})

function setSort(key) {
  if (sortKey.value === key) sortDir.value *= -1
  else {
    sortKey.value = key
    sortDir.value = 1
  }
  currentPage.value = 1
}

function sortIcon(key) {
  if (sortKey.value !== key) return 'bi-chevron-expand text-secondary'
  return sortDir.value === 1 ? 'bi-chevron-up' : 'bi-chevron-down'
}

function dateSortKey(iso) {
  if (!iso) return 0
  const t = new Date(iso).getTime()
  return Number.isNaN(t) ? 0 : t
}

function boolSortKey(v) {
  if (v === true) return 2
  if (v === false) return 1
  return 0
}

function formatDeviceDateTime(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })
}

function wipeConfirmTarget(d) {
  const n = (d?.displayName || '').trim()
  return n || (d?.id || '').trim()
}

const wipeConfirmExpected = computed(() => wipeConfirmTarget(wipeModal.device))

const wipeConfirmLabel = computed(() => {
  const d = wipeModal.device
  if (!d) return 'Bestätigung'
  return (d.displayName || '').trim() ? 'Gerätename zur Bestätigung eintippen' : 'Geräte-ID zur Bestätigung eintippen'
})

function openRetireModal(d) {
  retireModal.device = d
  retireModal.disableUserAccount = false
  retireModal.show = true
}

async function runRetire() {
  const d = retireModal.device
  if (!d?.id) return
  retireModal.running = true
  const ok = await devicesStore.retireIntuneDevice({
    azureAdDeviceId: d.id,
    disableUserAccount: retireModal.disableUserAccount,
    userUpn: d.ownerUserPrincipalName || ''
  })
  retireModal.running = false
  if (ok) retireModal.show = false
}

function openWipeModal(d) {
  wipeModal.device = d
  wipeModal.confirmName = ''
  wipeModal.show = true
}

async function runWipe() {
  const d = wipeModal.device
  if (!d?.id || wipeModal.confirmName !== wipeConfirmExpected.value) return
  wipeModal.running = true
  const ok = await devicesStore.wipeIntuneDevice({ azureAdDeviceId: d.id })
  wipeModal.running = false
  if (ok) wipeModal.show = false
}

onMounted(() => {
  if (!devicesStore.devices.length && !devicesStore.loading) devicesStore.fetchDevices()
})
</script>

<style scoped>
.spin {
  animation: spin 1s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
