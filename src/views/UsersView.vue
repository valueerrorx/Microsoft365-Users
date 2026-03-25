<template>
  <div>
    <!-- Header -->
    <div class="page-header d-flex align-items-center justify-content-between flex-wrap gap-2">
      <div>
        <h1 class="page-title">Benutzerverwaltung</h1>
        <p class="page-subtitle">{{ usersStore.totalUsers }} Benutzer im Tenant</p>
      </div>
      <div class="d-flex gap-2">
        <button class="btn btn-outline-secondary btn-sm" @click="usersStore.fetchUsers()" :disabled="usersStore.loading">
          <i class="bi bi-arrow-clockwise me-1" :class="{ spin: usersStore.loading }"></i>
          Aktualisieren
        </button>
      </div>
    </div>

    <!-- Filters -->
    <div class="content-card mb-3">
      <div class="content-card-body py-2">
        <div class="row g-2 align-items-center">
          <div class="col-md-5">
            <div class="input-group input-group-sm">
              <span class="input-group-text"><i class="bi bi-search"></i></span>
              <input
                v-model="searchQuery"
                type="text"
                class="form-control"
                placeholder="Name, UPN, Abteilung suchen..."
              />
              <button v-if="searchQuery" class="btn btn-outline-secondary" @click="searchQuery = ''">
                <i class="bi bi-x"></i>
              </button>
            </div>
          </div>
          <div class="col-auto">
            <select v-model="filterStatus" class="form-select form-select-sm" style="min-width:130px;">
              <option value="all">Alle Status</option>
              <option value="active">Aktiv</option>
              <option value="inactive">Deaktiviert</option>
            </select>
          </div>
          <div class="col-auto">
            <select v-model="filterDept" class="form-select form-select-sm" style="min-width:130px;">
              <option value="">Alle Abteilungen</option>
              <option v-for="dept in departments" :key="dept" :value="dept">{{ dept }}</option>
            </select>
          </div>
          <div class="col-auto ms-auto">
            <span style="font-size:0.8rem;color:#8b949e;">{{ filteredUsers.length }} Treffer</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="usersStore.loading" class="text-center py-5">
      <div class="spinner-border" style="color:#58a6ff;" role="status"></div>
      <div style="color:#8b949e;margin-top:1rem;font-size:0.875rem;">
        Benutzerliste wird geladen...<br>
        <small>Beim ersten Start öffnet sich eine Authentifizierungsseite im Browser</small>
      </div>
    </div>

    <!-- Empty State -->
    <div v-else-if="!usersStore.users.length" class="text-center py-5">
      <i class="bi bi-people" style="font-size:3rem;color:#30363d;"></i>
      <div style="color:#8b949e;margin-top:1rem;">Noch keine Benutzer geladen</div>
      <button class="btn btn-primary btn-sm mt-3" @click="usersStore.fetchUsers()">
        <i class="bi bi-plug me-1"></i> Verbinden &amp; Laden
      </button>
    </div>

    <!-- User Table -->
    <div v-else class="content-card" style="position:relative;">
      <div style="overflow-x:auto;">
        <table class="table table-ms365">
          <thead>
            <tr>
              <th style="width:32px;"></th>
              <th @click="setSort('displayName')" style="cursor:pointer;user-select:none;">
                Name <i class="bi" :class="sortIcon('displayName')"></i>
              </th>
              <th @click="setSort('userPrincipalName')" style="cursor:pointer;user-select:none;">
                UPN <i class="bi" :class="sortIcon('userPrincipalName')"></i>
              </th>
              <th @click="setSort('department')" style="cursor:pointer;user-select:none;">
                Abteilung <i class="bi" :class="sortIcon('department')"></i>
              </th>
              <th>Status</th>
              <th>Lizenzen</th>
              <th style="width:160px;">Aktionen</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="user in paginatedUsers" :key="user.id || user.userPrincipalName">
              <td>
                <div class="user-avatar">{{ initials(user.displayName) }}</div>
              </td>
              <td>
                <div style="font-weight:500;">{{ user.displayName }}</div>
                <div v-if="user.jobTitle" style="font-size:0.73rem;color:#8b949e;">{{ user.jobTitle }}</div>
              </td>
              <td>
                <div style="font-family:monospace;font-size:0.8rem;color:#8b949e;">{{ user.userPrincipalName }}</div>
              </td>
              <td>
                <span v-if="user.department" style="font-size:0.82rem;">{{ user.department }}</span>
                <span v-else style="color:#484f58;font-size:0.82rem;">—</span>
              </td>
              <td>
                <span class="badge-active" v-if="user.accountEnabled">Aktiv</span>
                <span class="badge-inactive" v-else>Deaktiviert</span>
              </td>
              <td>
                <div v-if="user.assignedLicenses?.length">
                  <span v-for="lic in user.assignedLicenses.slice(0, 2)" :key="lic.skuId" class="badge-license">
                    {{ licenseLabel(lic.skuId) }}
                  </span>
                  <span v-if="user.assignedLicenses.length > 2" class="badge-license">+{{ user.assignedLicenses.length - 2 }}</span>
                </div>
                <span v-else style="color:#484f58;font-size:0.78rem;">Keine</span>
              </td>
              <td>
                <div class="d-flex gap-1">
                  <button class="btn-action" @click="openEdit(user)" title="Bearbeiten">
                    <i class="bi bi-pencil"></i>
                  </button>
                  <button class="btn-action" @click="openPasswordReset(user)" title="Passwort zurücksetzen">
                    <i class="bi bi-key"></i>
                  </button>
                  <button class="btn-action warning" @click="openMfaReset(user)" title="MFA zurücksetzen">
                    <i class="bi bi-shield-x"></i>
                  </button>
                  <button
                    class="btn-action"
                    :class="user.accountEnabled ? 'danger' : ''"
                    @click="toggleUser(user)"
                    :title="user.accountEnabled ? 'Deaktivieren' : 'Aktivieren'"
                  >
                    <i class="bi" :class="user.accountEnabled ? 'bi-person-slash' : 'bi-person-check'"></i>
                  </button>
                  <button class="btn-action danger" @click="openDelete(user)" title="Löschen">
                    <i class="bi bi-trash"></i>
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Pagination -->
      <div v-if="totalPages > 1" class="d-flex align-items-center justify-content-between p-3" style="border-top:1px solid var(--sidebar-border);">
        <span style="font-size:0.8rem;color:#8b949e;">Seite {{ currentPage }} von {{ totalPages }}</span>
        <div class="d-flex gap-2">
          <button class="btn btn-outline-secondary btn-sm" :disabled="currentPage <= 1" @click="currentPage--">
            <i class="bi bi-chevron-left"></i>
          </button>
          <button class="btn btn-outline-secondary btn-sm" :disabled="currentPage >= totalPages" @click="currentPage++">
            <i class="bi bi-chevron-right"></i>
          </button>
        </div>
      </div>
    </div>

    <!-- Edit User Modal -->
    <div v-if="editModal.show" class="modal d-block" tabindex="-1" style="background:rgba(0,0,0,0.6);">
      <div class="modal-dialog modal-lg">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">
              <i class="bi bi-person-gear me-2" style="color:#58a6ff;"></i>
              Benutzer bearbeiten
            </h5>
            <button type="button" class="btn-close" @click="editModal.show = false"></button>
          </div>
          <div class="modal-body">
            <div class="row g-3">
              <div class="col-6">
                <label class="form-label">Vorname</label>
                <input v-model="editForm.givenName" type="text" class="form-control" />
              </div>
              <div class="col-6">
                <label class="form-label">Nachname</label>
                <input v-model="editForm.surname" type="text" class="form-control" />
              </div>
              <div class="col-12">
                <label class="form-label">Anzeigename</label>
                <input v-model="editForm.displayName" type="text" class="form-control" />
              </div>
              <div class="col-6">
                <label class="form-label">Abteilung</label>
                <input v-model="editForm.department" type="text" class="form-control" />
              </div>
              <div class="col-6">
                <label class="form-label">Jobtitel</label>
                <input v-model="editForm.jobTitle" type="text" class="form-control" />
              </div>
              <div class="col-6">
                <label class="form-label">Nutzungsstandort</label>
                <select v-model="editForm.usageLocation" class="form-select">
                  <option value="">— Nicht gesetzt —</option>
                  <option value="AT">AT — Österreich</option>
                  <option value="DE">DE — Deutschland</option>
                  <option value="CH">CH — Schweiz</option>
                  <option value="US">US — USA</option>
                  <option value="GB">GB — Großbritannien</option>
                </select>
              </div>
              <div class="col-6 d-flex align-items-end">
                <div class="form-check">
                  <input class="form-check-input" type="checkbox" v-model="editForm.accountEnabled" id="editEnabled" />
                  <label class="form-check-label" for="editEnabled">Konto aktiv</label>
                </div>
              </div>
              <div v-if="usersStore.licenses.length" class="col-12">
                <label class="form-label">Lizenzen (Tenant-SKUs)</label>
                <div class="license-edit-list">
                  <div v-for="sku in usersStore.licenses" :key="sku.skuId" class="form-check mb-1">
                    <input
                      class="form-check-input"
                      type="checkbox"
                      :id="'lic-edit-' + sku.skuId"
                      :checked="isLicenseSelected(sku.skuId)"
                      @change="toggleEditLicense(sku.skuId)"
                    />
                    <label class="form-check-label" :for="'lic-edit-' + sku.skuId" style="font-size:0.85rem;">
                      {{ licenseLabel(sku.skuId) }} — <span style="font-family:monospace;color:#8b949e;">{{ sku.skuPartNumber }}</span>
                      <span v-if="sku.prepaidUnits?.enabled != null" style="color:#484f58;font-size:0.72rem;margin-left:0.35rem;">
                        ({{ licenseFreeTenant(sku) }} frei im Tenant)
                      </span>
                    </label>
                  </div>
                </div>
                <div style="font-size:0.72rem;color:#8b949e;margin-top:0.35rem;">
                  Zum Zuweisen neuer Lizenzen ist ein Nutzungsstandort erforderlich.
                </div>
              </div>
              <div class="col-12">
                <label class="form-label">UPN (nicht änderbar)</label>
                <input :value="editModal.user?.userPrincipalName" type="text" class="form-control" disabled />
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary btn-sm" @click="editModal.show = false">Abbrechen</button>
            <button type="button" class="btn btn-primary btn-sm" @click="saveUser" :disabled="editModal.saving">
              <i class="bi bi-check2 me-1"></i>
              {{ editModal.saving ? 'Speichert...' : 'Speichern' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Password Reset Modal -->
    <div v-if="pwModal.show" class="modal d-block" tabindex="-1" style="background:rgba(0,0,0,0.6);">
      <div class="modal-dialog modal-lg pw-modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">
              <i class="bi bi-key me-2" style="color:#d29922;"></i>
              Passwort zurücksetzen
            </h5>
            <button type="button" class="btn-close" @click="pwModal.show = false"></button>
          </div>
          <div class="modal-body pw-modal-body">
            <div class="pw-modal-user-line">
              <span style="color:#8b949e;font-size:0.85rem;">Benutzer</span>
              <span class="pw-modal-upn">{{ pwModal.user?.userPrincipalName }}</span>
            </div>
            <div class="mb-3">
              <label class="form-label">Neues Passwort</label>
              <PasswordInput v-model="pwForm.newPassword" />
            </div>
            <div class="form-check">
              <input class="form-check-input" type="checkbox" v-model="pwForm.forceChange" id="pwForce" />
              <label class="form-check-label" for="pwForce">Bei nächster Anmeldung Passwort ändern</label>
            </div>
            <div v-if="pwModal.error" class="mt-3" style="color:#f85149;font-size:0.83rem;">
              <i class="bi bi-exclamation-triangle me-1"></i>{{ pwModal.error }}
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary btn-sm" @click="pwModal.show = false">Abbrechen</button>
            <button type="button" class="btn btn-warning btn-sm" @click="doPasswordReset" :disabled="pwModal.saving || !validatePassword(pwForm.newPassword).valid">
              <i class="bi bi-key me-1"></i>
              {{ pwModal.saving ? 'Setzt zurück...' : 'Passwort zurücksetzen' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- MFA Reset Modal -->
    <div v-if="mfaModal.show" class="modal d-block" tabindex="-1" style="background:rgba(0,0,0,0.6);">
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">
              <i class="bi bi-shield-exclamation me-2" style="color:#f85149;"></i>
              MFA / 2FA zurücksetzen
            </h5>
            <button type="button" class="btn-close" @click="mfaModal.show = false"></button>
          </div>
          <div class="modal-body">
            <div class="alert" style="background:rgba(248,81,73,0.1);border:1px solid rgba(248,81,73,0.25);color:#f85149;border-radius:6px;font-size:0.85rem;">
              <i class="bi bi-exclamation-triangle-fill me-2"></i>
              <strong>Achtung:</strong> Alle MFA-Authentifizierungsmethoden (Authenticator App, TOTP, etc.) werden entfernt.
              Der Benutzer muss MFA beim nächsten Login neu einrichten.
            </div>
            <p style="font-size:0.875rem;color:#8b949e;">
              Benutzer: <strong style="color:#e6edf3;">{{ mfaModal.user?.displayName }}</strong><br>
              UPN: <span style="font-family:monospace;font-size:0.82rem;">{{ mfaModal.user?.userPrincipalName }}</span>
            </p>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary btn-sm" @click="mfaModal.show = false">Abbrechen</button>
            <button type="button" class="btn btn-danger btn-sm" @click="doMfaReset" :disabled="mfaModal.saving">
              <i class="bi bi-shield-x me-1"></i>
              {{ mfaModal.saving ? 'Wird zurückgesetzt...' : 'MFA zurücksetzen' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Confirm Toggle Modal -->
    <div v-if="toggleModal.show" class="modal d-block" tabindex="-1" style="background:rgba(0,0,0,0.6);">
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">
              <i class="bi me-2" :class="toggleModal.user?.accountEnabled ? 'bi-person-slash text-danger' : 'bi-person-check text-success'"></i>
              Konto {{ toggleModal.user?.accountEnabled ? 'deaktivieren' : 'aktivieren' }}
            </h5>
            <button type="button" class="btn-close" @click="toggleModal.show = false"></button>
          </div>
          <div class="modal-body" style="font-size:0.875rem;">
            Konto von <strong>{{ toggleModal.user?.displayName }}</strong> wirklich
            {{ toggleModal.user?.accountEnabled ? 'deaktivieren' : 'aktivieren' }}?
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary btn-sm" @click="toggleModal.show = false">Abbrechen</button>
            <button type="button"
              class="btn btn-sm"
              :class="toggleModal.user?.accountEnabled ? 'btn-danger' : 'btn-success'"
              @click="doToggleUser"
              :disabled="toggleModal.saving"
            >
              {{ toggleModal.saving ? 'Wird gespeichert...' : (toggleModal.user?.accountEnabled ? 'Deaktivieren' : 'Aktivieren') }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Delete User Modal -->
    <div v-if="deleteModal.show" class="modal d-block" tabindex="-1" style="background:rgba(0,0,0,0.6);">
      <div class="modal-dialog modal-lg delete-modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">
              <i class="bi bi-trash me-2" style="color:#f85149;"></i>
              Benutzer löschen
            </h5>
            <button type="button" class="btn-close" @click="closeDelete"></button>
          </div>
          <div class="modal-body delete-modal-body" style="font-size:0.9rem;">
            <div class="alert" style="background:rgba(248,81,73,0.1);border:1px solid rgba(248,81,73,0.25);color:#f85149;border-radius:6px;">
              <i class="bi bi-exclamation-triangle-fill me-2"></i>
              <strong>Achtung:</strong> Dieser Benutzer wird endgültig gelöscht.
            </div>
            <div class="delete-modal-user-info">
              Benutzer: <strong class="delete-modal-display-name">{{ deleteModal.user?.displayName }}</strong>
              <div class="delete-modal-upn-row">
                <span class="delete-modal-label">UPN:</span>
                <span class="delete-modal-upn">{{ deleteModal.user?.userPrincipalName }}</span>
              </div>
            </div>
            <label class="form-label">UPN zur Bestätigung eintippen</label>
            <input v-model="deleteModal.confirmUpn" type="text" class="form-control" style="font-family:monospace;" />
            <div v-if="deleteModal.error" class="mt-2" style="color:#f85149;font-size:0.83rem;">
              <i class="bi bi-exclamation-triangle me-1"></i>{{ deleteModal.error }}
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary btn-sm" @click="closeDelete" :disabled="deleteModal.saving">Abbrechen</button>
            <button
              type="button"
              class="btn btn-danger btn-sm"
              @click="doDeleteUser"
              :disabled="deleteModal.saving || deleteModal.confirmUpn !== deleteModal.user?.userPrincipalName"
            >
              <i class="bi bi-trash me-1"></i>
              {{ deleteModal.saving ? 'Löscht...' : 'Endgültig löschen' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, reactive } from 'vue'
import { useUsersStore } from '../stores/usersStore'
import { useAuthStore } from '../stores/authStore'
import PasswordInput from '../components/PasswordInput.vue'
import { validatePassword } from '../utils/passwordValidator.js'
import { humanLicenseLabel } from '../utils/licenseLabel.js'

const usersStore = useUsersStore()
const authStore = useAuthStore()

// ---- Filters & Sorting ----
const searchQuery = ref('')
const filterStatus = ref('all')
const filterDept = ref('')
const sortKey = ref('displayName')
const sortDir = ref(1) // 1 = asc, -1 = desc
const currentPage = ref(1)
const PAGE_SIZE = 50

const departments = computed(() => {
  const depts = new Set(usersStore.users.map(u => u.department).filter(Boolean))
  return [...depts].sort()
})

const filteredUsers = computed(() => {
  let list = usersStore.users
  const q = searchQuery.value.toLowerCase()
  if (q) {
    list = list.filter(u =>
      u.displayName?.toLowerCase().includes(q) ||
      u.userPrincipalName?.toLowerCase().includes(q) ||
      u.department?.toLowerCase().includes(q) ||
      u.jobTitle?.toLowerCase().includes(q)
    )
  }
  if (filterStatus.value === 'active') list = list.filter(u => u.accountEnabled)
  if (filterStatus.value === 'inactive') list = list.filter(u => !u.accountEnabled)
  if (filterDept.value) list = list.filter(u => u.department === filterDept.value)

  return [...list].sort((a, b) => {
    const av = (a[sortKey.value] || '').toLowerCase()
    const bv = (b[sortKey.value] || '').toLowerCase()
    return av < bv ? -sortDir.value : av > bv ? sortDir.value : 0
  })
})

const totalPages = computed(() => Math.ceil(filteredUsers.value.length / PAGE_SIZE))
const paginatedUsers = computed(() => {
  const start = (currentPage.value - 1) * PAGE_SIZE
  return filteredUsers.value.slice(start, start + PAGE_SIZE)
})

function setSort(key) {
  if (sortKey.value === key) sortDir.value *= -1
  else { sortKey.value = key; sortDir.value = 1 }
  currentPage.value = 1
}

function sortIcon(key) {
  if (sortKey.value !== key) return 'bi-chevron-expand text-secondary'
  return sortDir.value === 1 ? 'bi-chevron-up' : 'bi-chevron-down'
}

function initials(name) {
  if (!name) return '?'
  return name.split(/\s+/).map(p => p[0]).join('').slice(0, 2).toUpperCase()
}

function licenseLabel(skuId) {
  const sku = usersStore.licenseMap[skuId]
  if (!sku) return skuId?.slice(0, 8) || '?'
  return humanLicenseLabel(sku.skuPartNumber)
}

function licenseFreeTenant(sku) {
  const cap = sku?.prepaidUnits?.enabled
  if (cap == null) return '—'
  const free = Math.max(0, cap - (sku.consumedUnits || 0))
  return String(free)
}

// ---- Edit Modal ----
const editModal = reactive({ show: false, user: null, saving: false })
const editForm = reactive({ givenName: '', surname: '', displayName: '', department: '', jobTitle: '', accountEnabled: true, usageLocation: '' })
const editInitialLicenseIds = ref([])
const editSelectedLicenseIds = ref([])

function isLicenseSelected(skuId) {
  const id = String(skuId || '')
  return editSelectedLicenseIds.value.some((x) => String(x) === id)
}

function toggleEditLicense(skuId) {
  const id = String(skuId || '')
  const arr = editSelectedLicenseIds.value
  const i = arr.findIndex((x) => String(x) === id)
  if (i >= 0) arr.splice(i, 1)
  else arr.push(id)
}

function openEdit(user) {
  editModal.user = user
  editForm.givenName = user.givenName || ''
  editForm.surname = user.surname || ''
  editForm.displayName = user.displayName || ''
  editForm.department = user.department || ''
  editForm.jobTitle = user.jobTitle || ''
  editForm.accountEnabled = user.accountEnabled !== false
  editForm.usageLocation = user.usageLocation || ''
  editInitialLicenseIds.value = (user.assignedLicenses || []).map((l) => String(l.skuId)).filter(Boolean)
  editSelectedLicenseIds.value = [...editInitialLicenseIds.value]
  editModal.show = true
}

async function saveUser() {
  const upn = editModal.user.userPrincipalName
  editModal.saving = true
  const ok = await usersStore.updateUser({
    upn,
    ...editForm
  })
  if (!ok) {
    editModal.saving = false
    return
  }
  const idx = usersStore.users.findIndex((u) => u.userPrincipalName === upn)
  if (idx !== -1) Object.assign(usersStore.users[idx], editForm)

  const initial = editInitialLicenseIds.value
  const selected = [...editSelectedLicenseIds.value]
  const add = selected.filter((id) => !initial.some((x) => String(x) === String(id)))
  const remove = initial.filter((id) => !selected.some((x) => String(x) === String(id)))

  if (add.length > 0 || remove.length > 0) {
    const usage = String(usersStore.users[idx]?.usageLocation || editForm.usageLocation || '').trim()
    if (add.length > 0 && !usage) {
      authStore.showToast('Bitte Nutzungsstandort setzen, bevor Lizenzen zugewiesen werden.', 'error')
      editModal.saving = false
      return
    }
    const licOk = await usersStore.updateUserLicenses({ upn, addSkuIds: add, removeSkuIds: remove })
    if (!licOk) {
      editModal.saving = false
      return
    }
  }

  editModal.saving = false
  editModal.show = false
}

// ---- Password Modal ----
const pwModal = reactive({ show: false, user: null, saving: false, error: '' })
const pwForm = reactive({ newPassword: '', forceChange: true })

function openPasswordReset(user) {
  pwModal.user = user
  pwModal.error = ''
  pwModal.saving = false
  pwForm.newPassword = ''
  pwForm.forceChange = true
  pwForm.show = false
  pwModal.show = true
}

async function doPasswordReset() {
  if (!pwForm.newPassword) return
  pwModal.saving = true
  pwModal.error = ''
  const ok = await usersStore.resetPassword(pwModal.user.userPrincipalName, pwForm.newPassword, pwForm.forceChange)
  pwModal.saving = false
  if (ok) pwModal.show = false
  else pwModal.error = 'Passwort konnte nicht zurückgesetzt werden. Prüfe das Ausgabefenster.'
}

// ---- MFA Modal ----
const mfaModal = reactive({ show: false, user: null, saving: false })

function openMfaReset(user) {
  mfaModal.user = user
  mfaModal.saving = false
  mfaModal.show = true
}

async function doMfaReset() {
  mfaModal.saving = true
  const ok = await usersStore.resetMfa(mfaModal.user.userPrincipalName)
  mfaModal.saving = false
  if (ok) mfaModal.show = false
}

// ---- Toggle Enable/Disable ----
const toggleModal = reactive({ show: false, user: null, saving: false })

function toggleUser(user) {
  toggleModal.user = user
  toggleModal.saving = false
  toggleModal.show = true
}

async function doToggleUser() {
  toggleModal.saving = true
  const ok = await usersStore.updateUser({
    upn: toggleModal.user.userPrincipalName,
    accountEnabled: !toggleModal.user.accountEnabled
  })
  if (ok) {
    const idx = usersStore.users.findIndex(u => u.userPrincipalName === toggleModal.user.userPrincipalName)
    if (idx !== -1) usersStore.users[idx].accountEnabled = !toggleModal.user.accountEnabled
    toggleModal.show = false
  }
  toggleModal.saving = false
}

// ---- Delete Modal ----
const deleteModal = reactive({ show: false, user: null, saving: false, confirmUpn: '', error: '' })

function openDelete(user) {
  deleteModal.user = user
  deleteModal.confirmUpn = ''
  deleteModal.error = ''
  deleteModal.saving = false
  deleteModal.show = true
}

function closeDelete() {
  if (deleteModal.saving) return
  deleteModal.show = false
}

async function doDeleteUser() {
  const upn = deleteModal.user?.userPrincipalName
  if (!upn) return
  if (deleteModal.confirmUpn !== upn) {
    deleteModal.error = 'UPN stimmt nicht überein.'
    return
  }
  deleteModal.saving = true
  deleteModal.error = ''
  const ok = await usersStore.deleteUser(upn)
  deleteModal.saving = false
  if (ok) deleteModal.show = false
  else deleteModal.error = 'Benutzer konnte nicht gelöscht werden. Prüfe das Ausgabefenster.'
}
</script>

<style scoped>
.spin { animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

.delete-modal-dialog { max-width: min(640px, calc(100vw - 2rem)); }
.delete-modal-body { min-width: 0; overflow-wrap: anywhere; }
.delete-modal-user-info { color: #8b949e; margin-bottom: 0.75rem; min-width: 0; }
.delete-modal-display-name { color: #e6edf3; word-break: break-word; overflow-wrap: anywhere; }
.delete-modal-upn-row { margin-top: 0.35rem; min-width: 0; }
.delete-modal-label { color: #8b949e; font-size: 0.85rem; }
.delete-modal-upn {
  display: block;
  margin-top: 0.2rem;
  font-family: monospace;
  font-size: 0.82rem;
  color: #e6edf3;
  word-break: break-all;
  overflow-wrap: anywhere;
  max-width: 100%;
}

.license-edit-list {
  max-height: 220px;
  overflow: auto;
  padding: 0.5rem 0.75rem;
  border: 1px solid #30363d;
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.15);
}

.pw-modal-dialog { max-width: min(640px, calc(100vw - 2rem)); }
.pw-modal-body { min-width: 0; overflow-wrap: anywhere; }
.pw-modal-user-line { margin-bottom: 1rem; min-width: 0; }
.pw-modal-upn {
  display: block;
  margin-top: 0.25rem;
  font-family: monospace;
  font-size: 0.82rem;
  color: #e6edf3;
  word-break: break-all;
  overflow-wrap: anywhere;
  max-width: 100%;
}
</style>
