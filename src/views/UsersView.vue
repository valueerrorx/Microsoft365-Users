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
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">
              <i class="bi bi-key me-2" style="color:#d29922;"></i>
              Passwort zurücksetzen
            </h5>
            <button type="button" class="btn-close" @click="pwModal.show = false"></button>
          </div>
          <div class="modal-body">
            <div style="font-size:0.85rem;color:#8b949e;margin-bottom:1rem;">
              Benutzer: <strong style="color:#e6edf3;">{{ pwModal.user?.userPrincipalName }}</strong>
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
  </div>
</template>

<script setup>
import { ref, computed, reactive } from 'vue'
import { useUsersStore } from '../stores/usersStore'
import PasswordInput from '../components/PasswordInput.vue'
import { validatePassword } from '../utils/passwordValidator.js'

const usersStore = useUsersStore()

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
  const name = sku.skuPartNumber || ''
  if (name.includes('A3') && name.includes('STUDENT')) return 'A3 Schüler'
  if (name.includes('A3') && name.includes('FACULTY')) return 'A3 Lehrer'
  if (name.includes('A1')) return 'A1'
  if (name.includes('A3')) return 'A3'
  if (name.includes('A5')) return 'A5'
  return name.slice(0, 12)
}

// ---- Edit Modal ----
const editModal = reactive({ show: false, user: null, saving: false })
const editForm = reactive({ givenName: '', surname: '', displayName: '', department: '', jobTitle: '', accountEnabled: true, usageLocation: '' })

function openEdit(user) {
  editModal.user = user
  editForm.givenName = user.givenName || ''
  editForm.surname = user.surname || ''
  editForm.displayName = user.displayName || ''
  editForm.department = user.department || ''
  editForm.jobTitle = user.jobTitle || ''
  editForm.accountEnabled = user.accountEnabled !== false
  editForm.usageLocation = user.usageLocation || ''
  editModal.show = true
}

async function saveUser() {
  editModal.saving = true
  const ok = await usersStore.updateUser({
    upn: editModal.user.userPrincipalName,
    ...editForm
  })
  editModal.saving = false
  if (ok) {
    // Update local user data
    const idx = usersStore.users.findIndex(u => u.userPrincipalName === editModal.user.userPrincipalName)
    if (idx !== -1) Object.assign(usersStore.users[idx], editForm)
    editModal.show = false
  }
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
</script>

<style scoped>
.spin { animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
</style>
