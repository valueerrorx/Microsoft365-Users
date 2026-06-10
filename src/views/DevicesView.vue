<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- Copyright (C) Mag. Thomas Michael Weissel <valueerror@gmail.com> -->

<template>
  <div>
    <div class="page-header d-flex align-items-center justify-content-between flex-wrap gap-2">
      <div>
        <h1 class="page-title">Geräte</h1>
        <p class="page-subtitle">{{ devicesStore.totalDevices }} Geräte ({{ devicesStore.managedDevicesCount }} Intune)</p>
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
          <div class="col-6 col-md-3 col-lg-2">
            <select v-model="filterLicense" class="form-select form-select-sm" aria-label="Lizenz des Besitzers filtern">
              <option value="all">Lizenz Besitzer: alle</option>
              <option value="none">Ohne Lizenz / kein Besitzer</option>
              <option v-for="o in ownerLicenseOptions" :key="o.skuId" :value="o.skuId">{{ o.label }}</option>
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
        <button type="button" class="btn btn-outline-primary btn-sm" :disabled="!selectedIntuneDeviceRows.length" @click="openBulkRetireModal">
          <i class="bi bi-link-45deg me-1"></i>Abkoppeln (Retire)
        </button>
        <button type="button" class="btn btn-outline-primary btn-sm" @click="openAddToGroupModal">
          <i class="bi bi-people me-1"></i>Zu Gruppe hinzufügen
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
      <div class="table-ms365-hscroll">
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
              <th style="width:168px;">Aktionen</th>
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
                <span v-else-if="d.trustType === 'Workplace'" class="badge-entra-registered">{{ d.trustTypeLabel || d.trustType }}</span>
                <span v-else style="font-size:0.82rem;">{{ d.trustTypeLabel || d.trustType || '—' }}</span>
              </td>
              <td>
                <div style="font-size:0.82rem;">{{ ownerName(d) }}</div>
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
                  <button
                    type="button"
                    class="btn-action"
                    :title="d.isIntuneManaged ? 'Abkoppeln (Intune Retire)' : 'Nur für in Intune eingeschriebene Geräte'"
                    :disabled="!d.isIntuneManaged"
                    @click="openRetireModal(d)"
                  >
                    <i class="bi bi-link-45deg"></i>
                  </button>
                  <button
                    type="button"
                    class="btn-action danger"
                    :title="d.isIntuneManaged ? 'Werkseinstellungen (Remote Wipe)' : 'Nur für in Intune eingeschriebene Geräte'"
                    :disabled="!d.isIntuneManaged"
                    @click="openWipeModal(d)"
                  >
                    <i class="bi bi-arrow-counterclockwise"></i>
                  </button>
                  <button
                    v-if="!d.isIntuneManaged"
                    type="button"
                    class="btn-action danger"
                    title="Aus Entra entfernen (Verzeichnis-Eintrag löschen)"
                    @click="openDeleteEntraModal(d)"
                  >
                    <i class="bi bi-trash"></i>
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
              Intune entfernt die Verwaltung von allen ausgewählten Geräten nacheinander. Geräte ohne Intune-Einschreibung werden übersprungen.
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

    <!-- Delete Entra device (non-Intune) -->
    <div v-if="deleteEntraModal.show" class="modal d-block" tabindex="-1" style="background:rgba(0,0,0,0.6);">
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title text-danger"><i class="bi bi-trash me-2"></i>Aus Entra entfernen</h5>
            <button type="button" class="btn-close" :disabled="deleteEntraModal.running" @click="closeDeleteEntraModal"></button>
          </div>
          <div class="modal-body">
            <div class="alert" style="background:rgba(248,81,73,0.1);border:1px solid rgba(248,81,73,0.25);color:#f85149;border-radius:6px;">
              <i class="bi bi-exclamation-triangle-fill me-2"></i>
              <strong>Achtung:</strong> Der Entra-Verzeichnis-Eintrag wird endgültig gelöscht. Das physische Gerät wird dabei nicht zurückgesetzt.
            </div>
            <p class="small mb-2" style="color:#8b949e;">
              Gerät: <strong style="color:#e6edf3;">{{ deleteEntraModal.device?.displayName || deleteEntraModal.device?.id }}</strong>
            </p>
            <label class="form-label small">{{ deleteEntraConfirmLabel }}</label>
            <input v-model="deleteEntraModal.confirmName" type="text" class="form-control" :disabled="deleteEntraModal.running" autocomplete="off" />
            <div v-if="deleteEntraModal.error" class="mt-2" style="color:#f85149;font-size:0.83rem;">
              <i class="bi bi-exclamation-triangle me-1"></i>{{ deleteEntraModal.error }}
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary btn-sm" :disabled="deleteEntraModal.running" @click="closeDeleteEntraModal">Abbrechen</button>
            <button
              type="button"
              class="btn btn-danger btn-sm"
              :disabled="deleteEntraModal.running || deleteEntraModal.confirmName !== deleteEntraConfirmExpected"
              @click="runDeleteEntra"
            >
              {{ deleteEntraModal.running ? 'Löscht…' : 'Endgültig löschen' }}
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

    <!-- Zu Gruppe hinzufügen (Geräte) -->
    <div v-if="groupPickerModal.show" class="modal d-block" tabindex="-1" style="background:rgba(0,0,0,0.6);">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">
              <i class="bi bi-people me-2" style="color:#58a6ff;"></i>
              Geräte zur Gruppe hinzufügen
            </h5>
            <button type="button" class="btn-close" :disabled="groupPickerModal.running" @click="closeGroupPickerModal"></button>
          </div>
          <div class="modal-body">
            <p class="small mb-2" style="color:#8b949e;">
              <strong style="color:#e6edf3;">{{ groupPickerModal.deviceCount }}</strong> Geräte werden der gewählten Gruppe zugeordnet.
              Bereits vorhandene Mitglieder werden übersprungen. Dynamische Gruppen sind nicht wählbar.
            </p>
            <div class="input-group input-group-sm mb-2">
              <span class="input-group-text"><i class="bi bi-search"></i></span>
              <input
                v-model="groupSearchQuery"
                type="text"
                class="form-control"
                placeholder="Gruppe suchen (Name, E-Mail-Alias)..."
                :disabled="groupsStore.loading || groupPickerModal.running"
              />
            </div>
            <div v-if="groupsStore.loading" class="text-center py-4" style="color:#8b949e;">
              <div class="spinner-border spinner-border-sm me-2" style="color:#58a6ff;"></div>
              Gruppen werden geladen...
            </div>
            <div v-else-if="!filteredDirectoryGroups.length" class="py-3 text-center small" style="color:#8b949e;">
              Keine Gruppen passend zum Filter.
            </div>
            <div v-else class="group-picker-list">
              <label
                v-for="g in filteredDirectoryGroups"
                :key="g.id"
                class="d-flex align-items-start gap-2 py-2 px-2 group-picker-row"
                :class="{ 'group-picker-row-active': groupPickerModal.selectedGroupId === g.id }"
              >
                <input
                  v-model="groupPickerModal.selectedGroupId"
                  type="radio"
                  class="form-check-input mt-1"
                  :value="g.id"
                  :disabled="groupPickerModal.running"
                />
                <span class="flex-grow-1" style="min-width:0;">
                  <span class="d-block fw-medium" style="color:#e6edf3;">{{ g.displayName || g.id }}</span>
                  <span v-if="g.mailNickname" class="d-block font-monospace small" style="color:#8b949e;">{{ g.mailNickname }}</span>
                  <span class="badge rounded-pill me-1 mt-1" style="font-size:0.65rem;background:#30363d;color:#8b949e;">{{ groupKindLabel(g) }}</span>
                </span>
              </label>
            </div>
          </div>
          <div class="modal-footer flex-wrap gap-2">
            <span v-if="groupPickerModal.selectedGroupId" class="me-auto small" style="color:#8b949e;">
              Gewählt: <strong style="color:#e6edf3;">{{ selectedGroupDisplayName }}</strong>
            </span>
            <button type="button" class="btn btn-secondary btn-sm" :disabled="groupPickerModal.running" @click="closeGroupPickerModal">Abbrechen</button>
            <button
              type="button"
              class="btn btn-primary btn-sm"
              :disabled="groupPickerModal.running || !groupPickerModal.selectedGroupId || groupsStore.loading"
              @click="runAddDevicesToGroup"
            >
              {{ groupPickerModal.running ? 'Wird ausgeführt...' : 'Hinzufügen' }}
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
import { useUsersStore } from '../stores/usersStore'
import { useGroupsStore } from '../stores/groupsStore'
import { humanLicenseLabel } from '../utils/licenseLabel.js'

const devicesStore = useDevicesStore()
const usersStore = useUsersStore()
const groupsStore = useGroupsStore()

// Statische (nicht-dynamische) Gruppen aus dem geteilten groupsStore — dynamische erlauben kein manuelles Hinzufügen
const assignableGroups = computed(() => groupsStore.groups.filter((g) => !g.isDynamic))

const retireModal = reactive({ show: false, device: null, disableUserAccount: false, running: false })
const bulkRetireModal = reactive({ show: false, disableUserAccount: false, running: false, count: 0 })
const wipeModal = reactive({ show: false, device: null, confirmName: '', running: false })
const deleteEntraModal = reactive({ show: false, device: null, confirmName: '', running: false, error: '' })

const selectedDeviceIds = ref([])

const selectedIntuneDeviceRows = computed(() =>
  selectedDeviceIds.value
    .map((id) => devicesStore.devices.find((d) => d.id === id))
    .filter((d) => d?.isIntuneManaged)
)

const searchQuery = ref('')
const filterTrust = ref('all')
const filterEnabled = ref('all')
const filterCompliant = ref('all')
const filterLicense = ref('all') // skuId des Gerätebesitzers, 'all', 'none' (kein/unlizenzierter Besitzer)

// UPN (lowercase) -> User-Objekt (für Besitzer-Lizenz und -Name)
const userByUpn = computed(() => {
  const map = {}
  for (const u of usersStore.users) {
    const upn = String(u.userPrincipalName || '').toLowerCase()
    if (upn) map[upn] = u
  }
  return map
})

// UPN (lowercase) -> Set der zugewiesenen skuIds des Besitzers
const ownerSkuMap = computed(() => {
  const map = {}
  for (const [upn, u] of Object.entries(userByUpn.value)) {
    map[upn] = new Set((u.assignedLicenses || []).map((l) => l.skuId))
  }
  return map
})

// Besitzername = "Nachname Vorname" aus dem User-Objekt; Fallback auf den Geräte-Besitzer-Anzeigenamen
function ownerName(d) {
  const upn = String(d.ownerUserPrincipalName || '').toLowerCase()
  const u = upn ? userByUpn.value[upn] : null
  const parts = [u?.surname, u?.givenName].filter(Boolean)
  return parts.length ? parts.join(' ') : (d.ownerDisplayName || '—')
}

// Lizenz-Filteroptionen: nur SKUs die bei mind. einem Gerätebesitzer vorkommen
const ownerLicenseOptions = computed(() => {
  const seen = new Set()
  for (const skus of Object.values(ownerSkuMap.value)) {
    for (const id of skus) seen.add(id)
  }
  return [...seen]
    .map((id) => ({ skuId: id, label: humanLicenseLabel(usersStore.licenseMap[id]?.skuPartNumber) || id }))
    .sort((a, b) => a.label.localeCompare(b.label))
})
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
        ownerName(d).toLowerCase().includes(q) ||
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
  const fl = filterLicense.value
  if (fl !== 'all') {
    list = list.filter((d) => {
      const upn = String(d.ownerUserPrincipalName || '').toLowerCase()
      const skus = upn ? ownerSkuMap.value[upn] : null
      if (fl === 'none') return !skus || skus.size === 0
      return !!skus && skus.has(fl)
    })
  }

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
    const av = (key === 'ownerDisplayName' ? ownerName(a) : (a[key] || '')).toLowerCase()
    const bv = (key === 'ownerDisplayName' ? ownerName(b) : (b[key] || '')).toLowerCase()
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
  bulkRetireModal.count = selectedIntuneDeviceRows.value.length
  bulkRetireModal.disableUserAccount = false
  bulkRetireModal.show = true
}

async function runBulkRetire() {
  const rows = selectedIntuneDeviceRows.value
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

watch([filterTrust, filterEnabled, filterCompliant, filterLicense], () => {
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

function deviceConfirmTarget(d) {
  const n = (d?.displayName || '').trim()
  return n || (d?.id || '').trim()
}

function wipeConfirmTarget(d) {
  return deviceConfirmTarget(d)
}

const wipeConfirmExpected = computed(() => wipeConfirmTarget(wipeModal.device))

const wipeConfirmLabel = computed(() => {
  const d = wipeModal.device
  if (!d) return 'Bestätigung'
  return (d.displayName || '').trim() ? 'Gerätename zur Bestätigung eintippen' : 'Geräte-ID zur Bestätigung eintippen'
})

const deleteEntraConfirmExpected = computed(() => deviceConfirmTarget(deleteEntraModal.device))

const deleteEntraConfirmLabel = computed(() => {
  const d = deleteEntraModal.device
  if (!d) return 'Bestätigung'
  return (d.displayName || '').trim() ? 'Gerätename zur Bestätigung eintippen' : 'Geräte-ID zur Bestätigung eintippen'
})

function openDeleteEntraModal(d) {
  if (d?.isIntuneManaged) return
  deleteEntraModal.device = d
  deleteEntraModal.confirmName = ''
  deleteEntraModal.error = ''
  deleteEntraModal.running = false
  deleteEntraModal.show = true
}

function closeDeleteEntraModal() {
  if (deleteEntraModal.running) return
  deleteEntraModal.show = false
}

async function runDeleteEntra() {
  const d = deleteEntraModal.device
  if (!d?.id || deleteEntraModal.confirmName !== deleteEntraConfirmExpected.value) {
    deleteEntraModal.error = 'Bestätigung stimmt nicht überein.'
    return
  }
  deleteEntraModal.running = true
  deleteEntraModal.error = ''
  const ok = await devicesStore.deleteEntraDevice(d.id)
  deleteEntraModal.running = false
  if (ok) deleteEntraModal.show = false
  else deleteEntraModal.error = 'Gerät konnte nicht gelöscht werden. Prüfe das Ausgabefenster.'
}

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
    azureAdDeviceId: d.deviceId || d.id,
    intuneManagedDeviceId: d.intuneManagedDeviceId,
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
  const ok = await devicesStore.wipeIntuneDevice({
    azureAdDeviceId: d.deviceId || d.id,
    intuneManagedDeviceId: d.intuneManagedDeviceId
  })
  wipeModal.running = false
  if (ok) wipeModal.show = false
}

// --- Zu Gruppe hinzufügen (Geräte) ---
const groupPickerModal = reactive({ show: false, running: false, selectedGroupId: '', deviceCount: 0 })
const groupSearchQuery = ref('')

const filteredDirectoryGroups = computed(() => {
  const q = groupSearchQuery.value.trim().toLowerCase()
  const list = assignableGroups.value
  if (!q) return list
  return list.filter(
    (g) =>
      (g.displayName || '').toLowerCase().includes(q) ||
      (g.mailNickname || '').toLowerCase().includes(q)
  )
})

const selectedGroupDisplayName = computed(() => {
  const id = groupPickerModal.selectedGroupId
  if (!id) return ''
  const g = assignableGroups.value.find((x) => x.id === id)
  return g?.displayName || id
})

function groupKindLabel(g) {
  const types = g.groupTypes || []
  if (types.includes('Unified')) return 'Microsoft 365'
  if (g.securityEnabled === true) return 'Security'
  return 'Gruppe'
}

async function openAddToGroupModal() {
  if (selectedDeviceIds.value.length < 2) return
  groupPickerModal.deviceCount = selectedDeviceIds.value.length
  groupPickerModal.selectedGroupId = ''
  groupSearchQuery.value = ''
  groupPickerModal.running = false
  groupPickerModal.show = true
  if (!groupsStore.groups.length && !groupsStore.loading) await groupsStore.fetchGroupsDetail()
}

function closeGroupPickerModal() {
  if (groupPickerModal.running) return
  groupPickerModal.show = false
}

async function runAddDevicesToGroup() {
  if (!groupPickerModal.selectedGroupId) return
  // selectedDeviceIds enthält bereits die Entra-Geräte-Objekt-IDs (d.id)
  const ids = selectedDeviceIds.value.filter(Boolean)
  if (!ids.length) return
  groupPickerModal.running = true
  const { ok } = await devicesStore.addDevicesToGroup({
    groupId: groupPickerModal.selectedGroupId,
    deviceIds: ids
  })
  groupPickerModal.running = false
  if (ok) {
    groupPickerModal.show = false
    clearDeviceSelection()
  }
}

onMounted(() => {
  if (!devicesStore.devices.length && !devicesStore.loading) devicesStore.fetchDevices()
  if (!usersStore.users.length && !usersStore.loading) usersStore.fetchUsers()
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
.group-picker-list {
  max-height: 280px;
  overflow: auto;
  border: 1px solid #30363d;
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.12);
}
.group-picker-row {
  cursor: pointer;
  border-bottom: 1px solid rgba(48, 54, 61, 0.55);
  margin: 0;
}
.group-picker-row:hover {
  background: rgba(88, 166, 255, 0.06);
}
.group-picker-row-active {
  background: rgba(88, 166, 255, 0.12);
}
</style>
