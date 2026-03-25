<template>
  <div>
    <!-- Header -->
    <div class="page-header">
      <h1 class="page-title">Benutzer erstellen / importieren</h1>
      <p class="page-subtitle">Einzelnen Benutzer anlegen oder per CSV-Datei massenimportieren</p>
    </div>

    <!-- Tabs -->
    <ul class="nav nav-tabs mb-0">
      <li class="nav-item">
        <button class="nav-link" :class="{ active: tab === 'single' }" @click="tab = 'single'">
          <i class="bi bi-person-plus me-1"></i> Einzelner Benutzer
        </button>
      </li>
      <li class="nav-item">
        <button class="nav-link" :class="{ active: tab === 'csv' }" @click="tab = 'csv'">
          <i class="bi bi-file-earmark-spreadsheet me-1"></i> CSV Import
          <span v-if="usersStore.csvEntries.length" class="ms-1" style="font-size:0.7rem;background:rgba(88,166,255,0.15);color:#58a6ff;border-radius:10px;padding:0.1rem 0.4rem;">
            {{ usersStore.csvEntries.length }}
          </span>
        </button>
      </li>
    </ul>

    <!-- Single User Tab -->
    <div v-if="tab === 'single'" class="content-card" style="border-top-left-radius:0;">
      <div class="content-card-body">
        <div class="row g-3" style="max-width:700px;">
          <div class="col-6">
            <label class="form-label">Vorname <span style="color:#f85149;">*</span></label>
            <input v-model="singleForm.vorname" type="text" class="form-control" placeholder="Max" />
          </div>
          <div class="col-6">
            <label class="form-label">Nachname <span style="color:#f85149;">*</span></label>
            <input v-model="singleForm.nachname" type="text" class="form-control" placeholder="Mustermann" />
          </div>
          <div class="col-6">
            <label class="form-label">Abteilung</label>
            <input v-model="singleForm.abteilung" type="text" class="form-control" placeholder="z.B. 3AHIT" />
          </div>
          <div class="col-6">
            <label class="form-label">Benutzertyp</label>
            <select v-model="singleForm.userType" class="form-select">
              <option>Schüler</option>
              <option>Lehrer</option>
            </select>
          </div>
          <div class="col-12">
            <label class="form-label">Passwort <span style="color:#f85149;">*</span></label>
            <PasswordInput v-model="singleForm.newPassword" hints-position="side">
              <template #below>
                <div class="form-check">
                  <input class="form-check-input" type="checkbox" v-model="singleForm.forceChange" id="singleForce" />
                  <label class="form-check-label" for="singleForce">PW bei nächster Anmeldung ändern</label>
                </div>
              </template>
            </PasswordInput>
          </div>
          <div class="col-12">
            <button
              class="btn btn-success"
              @click="createSingleUser"
              :disabled="usersStore.bulkRunning || !singleForm.vorname || !singleForm.nachname || !pwValid"
              :title="!pwValid && singleForm.newPassword ? 'Passwort erfüllt nicht die Komplexitätsanforderungen' : ''"
            >
              <i class="bi" :class="usersStore.bulkRunning ? 'bi-arrow-repeat spin' : 'bi-person-plus'"></i>
              {{ usersStore.bulkRunning ? 'Erstellt...' : 'Benutzer erstellen' }}
            </button>
          </div>
        </div>

        <div v-if="singlePreview.upn" style="max-width:700px;margin-top:1rem;">
          <div style="background:rgba(88,166,255,0.08);border:1px solid rgba(88,166,255,0.2);border-radius:6px;padding:0.6rem 0.875rem;font-size:0.82rem;">
            <span style="color:#8b949e;">UPN Vorschau: </span>
            <span style="font-family:monospace;color:#58a6ff;">{{ singlePreview.upn }}</span>
            <span style="color:#8b949e;margin-left:0.75rem;">Anzeigename: </span>
            <span style="color:#e6edf3;">{{ singlePreview.displayName }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- CSV Import Tab -->
    <div v-if="tab === 'csv'" class="content-card" style="border-top-left-radius:0;border-top-right-radius:0;">
      <div class="content-card-body">
        <!-- Import Area -->
        <div class="d-flex gap-2 mb-4">
          <button class="btn btn-primary" @click="importCsv">
            <i class="bi bi-upload me-1"></i> CSV-Datei importieren
          </button>
          <button v-if="usersStore.csvEntries.length" class="btn btn-outline-secondary" @click="usersStore.csvEntries = []">
            <i class="bi bi-x-circle me-1"></i> Liste leeren
          </button>
        </div>

        <!-- CSV Format Info -->
        <div v-if="!usersStore.csvEntries.length" class="mb-4">
          <div style="background:rgba(88,166,255,0.06);border:1px solid rgba(88,166,255,0.15);border-radius:6px;padding:1rem;">
            <div style="font-size:0.85rem;font-weight:600;margin-bottom:0.5rem;">
              <i class="bi bi-info-circle me-1" style="color:#58a6ff;"></i> Erwartetes CSV-Format
            </div>
            <pre style="font-family:monospace;font-size:0.78rem;color:#8b949e;margin:0;white-space:pre-wrap;">Vorname;Nachname;Abteilung;UserType;NewPassword;ForceChange
Max;Mustermann;3AHIT;Schüler;Passwort123!;1
Anna;Schmidt;LehrerInnenzimmer;Lehrer;Passwort456!;0</pre>
            <div style="font-size:0.78rem;color:#8b949e;margin-top:0.5rem;">
              Trennzeichen: Semikolon oder Komma. Encoding: UTF-8 oder Windows-1252 (Excel).
            </div>
          </div>
        </div>

        <!-- CSV Preview Table -->
        <div v-if="usersStore.csvEntries.length">
          <div class="d-flex align-items-center justify-content-between mb-2">
            <span style="font-size:0.875rem;font-weight:600;">{{ usersStore.csvEntries.length }} Einträge bereit</span>
            <button class="btn btn-success" @click="runBulk" :disabled="usersStore.bulkRunning">
              <i class="bi" :class="usersStore.bulkRunning ? 'bi-arrow-repeat spin' : 'bi-play-fill'"></i>
              {{ usersStore.bulkRunning ? 'Läuft...' : 'Benutzer erstellen / aktualisieren' }}
            </button>
          </div>

          <div style="overflow-x:auto;max-height:400px;">
            <table class="table table-ms365 csv-preview-table">
              <thead>
                <tr>
                  <th style="width:28px;"></th>
                  <th>#</th>
                  <th>Vorname</th>
                  <th>Nachname</th>
                  <th>UPN Vorschau</th>
                  <th>Abteilung</th>
                  <th>Typ</th>
                  <th>Passwort</th>
                  <th>PW ändern</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(entry, i) in usersStore.csvEntries" :key="i" :class="{ 'row-has-error': entryError(entry) }">
                  <td class="text-center">
                    <i
                      v-if="entryError(entry)"
                      class="bi bi-exclamation-triangle-fill"
                      style="color:#f85149;"
                      :title="entryError(entry)"
                    ></i>
                  </td>
                  <td style="color:#8b949e;">{{ i + 1 }}</td>
                  <td><input v-model="entry.vorname" type="text" class="form-control form-control-sm" /></td>
                  <td><input v-model="entry.nachname" type="text" class="form-control form-control-sm" /></td>
                  <td style="font-family:monospace;font-size:0.72rem;color:#8b949e;">{{ entry.nachnameNormalized }}.{{ entry.vornameNormalized }}</td>
                  <td><input v-model="entry.abteilung" type="text" class="form-control form-control-sm" /></td>
                  <td>
                    <select v-model="entry.userType" class="form-select form-select-sm">
                      <option>Schüler</option>
                      <option>Lehrer</option>
                    </select>
                  </td>
                  <td><input v-model="entry.newPassword" type="text" class="form-control form-control-sm" /></td>
                  <td class="text-center">
                    <input type="checkbox" class="form-check-input" v-model="entry.forceChange" />
                  </td>
                  <td>
                    <button class="btn-action danger" @click="usersStore.csvEntries.splice(i, 1)">
                      <i class="bi bi-trash"></i>
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Add Row -->
          <button class="btn btn-outline-secondary btn-sm mt-2" @click="addEmptyRow">
            <i class="bi bi-plus me-1"></i> Zeile hinzufügen
          </button>
        </div>

        <!-- Failed Users -->
        <div v-if="usersStore.failedUsers.length" class="mt-3">
          <div style="background:rgba(248,81,73,0.1);border:1px solid rgba(248,81,73,0.25);border-radius:6px;padding:0.75rem;">
            <div style="font-size:0.875rem;font-weight:600;color:#f85149;margin-bottom:0.5rem;">
              <i class="bi bi-exclamation-triangle me-1"></i> Fehlgeschlagene Benutzer ({{ usersStore.failedUsers.length }})
            </div>
            <div v-for="u in usersStore.failedUsers" :key="u" style="font-family:monospace;font-size:0.8rem;color:#f85149;">{{ u }}</div>
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

const usersStore = useUsersStore()
const authStore = useAuthStore()

const tab = ref('single')
const pwValid = computed(() => validatePassword(singleForm.newPassword).valid)

const singleForm = reactive({
  vorname: '',
  nachname: '',
  abteilung: '',
  userType: 'Schüler',
  newPassword: '',
  forceChange: true
})

const singlePreview = computed(() => {
  if (!singleForm.vorname || !singleForm.nachname) return { upn: '', displayName: '' }
  const vn = normalizeForUPN(singleForm.vorname)
  const nn = normalizeForUPN(singleForm.nachname)
  const domain = authStore.tenantDomain || '?domain'
  return {
    upn: `${nn}.${vn}@${domain}`,
    displayName: `${singleForm.nachname} ${singleForm.vorname}`
  }
})

function normalizeForUPN(text) {
  if (!text) return ''
  let s = String(text)
  s = s.replace(/[äÄ]/g, 'ae').replace(/[öÖ]/g, 'oe').replace(/[üÜ]/g, 'ue').replace(/[ß]/g, 'ss')
  s = s.replace(/[àáâãÀÁÂÃ]/g, 'a').replace(/[èéêëÈÉÊË]/g, 'e').replace(/[ìíîïÌÍÎÏ]/g, 'i')
  s = s.replace(/[òóôõÒÓÔÕ]/g, 'o').replace(/[ùúûÙÚÛ]/g, 'u').replace(/[ýÿÝŸ]/g, 'y')
  s = s.replace(/[çÇ]/g, 'c').replace(/[ñÑ]/g, 'n')
  return s.toLowerCase().replace(/[^a-z0-9.]/g, '')
}

function entryUpn(entry) {
  const domain = authStore.tenantDomain || ''
  if (!entry?.vornameNormalized || !entry?.nachnameNormalized || !domain) return ''
  return `${entry.nachnameNormalized}.${entry.vornameNormalized}@${domain}`
}

function entryError(entry) {
  const upn = entryUpn(entry)
  return upn ? (usersStore.failedUserDetails?.[upn] || '') : ''
}

async function createSingleUser() {
  usersStore.bulkLogs = []
  usersStore.failedUsers = []
  usersStore.failedUserDetails = {}
  const vn = normalizeForUPN(singleForm.vorname)
  const nn = normalizeForUPN(singleForm.nachname)
  usersStore.csvEntries = [{
    vorname: singleForm.vorname,
    nachname: singleForm.nachname,
    vornameNormalized: vn,
    nachnameNormalized: nn,
    abteilung: singleForm.abteilung,
    userType: singleForm.userType,
    newPassword: singleForm.newPassword,
    forceChange: singleForm.forceChange
  }]
  await usersStore.runBulkCreate()
  const upn = `${nn}.${vn}@${authStore.tenantDomain || ''}`
  const err = usersStore.failedUserDetails?.[upn]
  if (err) authStore.showToast(err, 'error')
  else {
    authStore.showToast('Benutzer erstellt', 'success')
    singleForm.vorname = ''
    singleForm.nachname = ''
    singleForm.newPassword = ''
    singleForm.abteilung = ''
  }
  usersStore.csvEntries = []
}

async function importCsv() {
  await usersStore.importCsv()
  if (usersStore.csvEntries.length) tab.value = 'csv'
}

function addEmptyRow() {
  usersStore.csvEntries.push({
    vorname: '',
    nachname: '',
    vornameNormalized: '',
    nachnameNormalized: '',
    abteilung: '',
    userType: 'Schüler',
    newPassword: '',
    forceChange: true
  })
}

async function runBulk() {
  if (!usersStore.csvEntries.length) return
  usersStore.bulkLogs = []
  usersStore.failedUsers = []
  usersStore.failedUserDetails = {}
  await usersStore.runBulkCreate()
}
</script>

<style scoped>
.spin { animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
.row-has-error { background: rgba(248,81,73,0.06); }
</style>
