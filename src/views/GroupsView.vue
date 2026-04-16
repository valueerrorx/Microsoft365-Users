<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- Copyright (C) Mag. Thomas Michael Weissel <valueerror@gmail.com> -->

<template>
  <div>
    <div class="page-header d-flex align-items-center justify-content-between flex-wrap gap-2">
      <div>
        <h1 class="page-title">Gruppen</h1>
        <p class="page-subtitle">{{ groupsStore.totalGroups }} Gruppen im Tenant</p>
      </div>
      <div class="d-flex gap-2">
        <button
          type="button"
          class="btn btn-outline-primary btn-sm"
          :disabled="groupsStore.loading"
          @click="openLifecyclePolicyModal"
        >
          <i class="bi bi-hourglass-split me-1"></i>
          Ablaufrichtlinie
        </button>
        <button class="btn btn-outline-secondary btn-sm" @click="groupsStore.fetchGroupsDetail()" :disabled="groupsStore.loading">
          <i class="bi bi-arrow-clockwise me-1" :class="{ spin: groupsStore.loading }"></i>
          Aktualisieren
        </button>
      </div>
    </div>

    <div class="content-card mb-3">
      <div class="content-card-body py-2">
        <div class="row g-2 align-items-center">
          <div class="col-12 col-md-5">
            <div class="input-group input-group-sm">
              <span class="input-group-text"><i class="bi bi-search"></i></span>
              <input v-model="searchQuery" type="text" class="form-control" placeholder="Gruppenname oder Alias suchen..." />
              <button v-if="searchQuery" class="btn btn-outline-secondary" @click="searchQuery = ''">
                <i class="bi bi-x"></i>
              </button>
            </div>
          </div>
          <div class="col-12 col-md-4 col-lg-3">
            <select v-model="groupTypeFilter" class="form-select form-select-sm" aria-label="Gruppentyp filtern">
              <option value="all">Alle Gruppentypen</option>
              <option value="m365">Microsoft 365</option>
              <option value="m365dynamic">Microsoft 365 (dynamisch)</option>
              <option value="other">Sonstige (ohne M365)</option>
            </select>
          </div>
          <div class="col-auto ms-md-auto">
            <span style="font-size:0.8rem;color:#8b949e;">{{ filteredGroups.length }} Treffer</span>
          </div>
        </div>
      </div>
    </div>

    <div v-if="groupsStore.loading" class="text-center py-5">
      <div class="spinner-border" style="color:#58a6ff;" role="status"></div>
      <div style="color:#8b949e;margin-top:1rem;font-size:0.875rem;">Gruppen werden geladen…</div>
    </div>

    <div v-else-if="!groupsStore.groups.length" class="text-center py-5">
      <i class="bi bi-collection" style="font-size:3rem;color:#30363d;"></i>
      <div style="color:#8b949e;margin-top:1rem;">Noch keine Gruppen geladen</div>
      <button class="btn btn-primary btn-sm mt-3" @click="groupsStore.fetchGroupsDetail()">
        <i class="bi bi-plug me-1"></i> Gruppen laden
      </button>
    </div>

    <div v-else>
      <div
        v-if="selectedGroupIds.length >= 2"
        class="content-card mb-2"
      >
        <div class="content-card-body py-2 px-3 d-flex flex-wrap align-items-center gap-2">
          <span style="font-size:0.875rem;color:#e6edf3;">
            <strong>{{ selectedGroupIds.length }}</strong> ausgewählt
            <span v-if="selectedM365Count < selectedGroupIds.length" class="text-secondary small">
              ({{ selectedM365Count }} Microsoft 365)
            </span>
          </span>
          <button
            type="button"
            class="btn btn-outline-primary btn-sm"
            :disabled="!canBulkLifecycleAdd"
            @click="bulkLifecycleModal.show = true"
          >
            <i class="bi bi-hourglass-split me-1"></i>
            Zur Ablaufrichtlinie hinzufügen
          </button>
          <button type="button" class="btn btn-link btn-sm text-secondary ms-auto p-0" @click="clearGroupSelection">
            Auswahl aufheben
          </button>
        </div>
      </div>

      <div class="content-card" style="position:relative;">
      <div style="overflow-x:auto;">
        <table class="table table-ms365">
          <thead>
            <tr>
              <th class="text-center" style="width:36px;">
                <input
                  type="checkbox"
                  class="form-check-input"
                  :checked="allPageGroupsSelected"
                  :indeterminate.prop="pageGroupsSelectionIndeterminate"
                  title="Alle auf dieser Seite"
                  @change="toggleSelectGroupsPage"
                />
              </th>
              <th @click="setSort('displayName')" style="cursor:pointer;user-select:none;">
                Name <i class="bi" :class="sortIcon('displayName')"></i>
              </th>
              <th @click="setSort('visibility')" style="cursor:pointer;user-select:none;white-space:nowrap;">
                Sichtbarkeit <i class="bi" :class="sortIcon('visibility')"></i>
              </th>
              <th @click="setSort('createdDateTime')" style="cursor:pointer;user-select:none;white-space:nowrap;">
                Erstellt <i class="bi" :class="sortIcon('createdDateTime')"></i>
              </th>
              <th @click="setSort('expirationDateTime')" style="cursor:pointer;user-select:none;white-space:nowrap;">
                Ablauf <i class="bi" :class="sortIcon('expirationDateTime')"></i>
              </th>
              <th>Teams</th>
              <th style="width:140px;">Aktionen</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="g in paginatedGroups" :key="g.id">
              <td class="text-center align-middle">
                <input
                  type="checkbox"
                  class="form-check-input"
                  :checked="isGroupRowSelected(g.id)"
                  @change="toggleGroupRowSelected(g.id)"
                />
              </td>
              <td>
                <div style="font-weight:500;">{{ g.displayName || '—' }}</div>
                <div v-if="g.mailNickname" style="font-size:0.73rem;color:#8b949e;font-family:monospace;">{{ g.mailNickname }}</div>
                <span v-if="g.isDynamic" class="badge rounded-pill mt-1" style="font-size:0.65rem;background:#6e40c9;color:#fff;">Dynamisch</span>
              </td>
              <td style="font-size:0.82rem;">{{ g.visibility || '—' }}</td>
              <td style="font-size:0.82rem;color:#8b949e;white-space:nowrap;" :title="g.createdDateTime || ''">{{ formatGroupDateTime(g.createdDateTime) }}</td>
              <td style="font-size:0.82rem;color:#8b949e;white-space:nowrap;" :title="g.expirationDateTime || ''">{{ formatGroupDateTime(g.expirationDateTime) }}</td>
              <td>
                <span v-if="g.hasTeam" class="badge-active">Ja</span>
                <span v-else class="badge-inactive">Nein</span>
              </td>
              <td>
                <div class="d-flex gap-1 flex-wrap">
                  <button class="btn-action" title="Bearbeiten" @click="openEditGroup(g)">
                    <i class="bi bi-pencil"></i>
                  </button>
                  <button class="btn-action" title="Mitglieder" @click="openMembersModal(g)">
                    <i class="bi bi-people"></i>
                  </button>
                  <button class="btn-action danger" title="Gruppe löschen" @click="openDeleteGroup(g)">
                    <i class="bi bi-trash"></i>
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div
        v-if="filteredGroups.length"
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
            <button class="btn btn-outline-secondary btn-sm" :disabled="currentPage <= 1" @click="currentPage--">
              <i class="bi bi-chevron-left"></i>
            </button>
            <button class="btn btn-outline-secondary btn-sm" :disabled="currentPage >= totalPages" @click="currentPage++">
              <i class="bi bi-chevron-right"></i>
            </button>
          </div>
        </div>
      </div>
    </div>
    </div>

    <!-- Tenant lifecycle policy -->
    <div v-if="lifecyclePolicyModal.show" class="modal d-block" tabindex="-1" style="background:rgba(0,0,0,0.6);">
      <div class="modal-dialog modal-lg">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title"><i class="bi bi-hourglass-split me-2" style="color:#58a6ff;"></i>Ablaufrichtlinie (Tenant)</h5>
            <button type="button" class="btn-close" :disabled="lifecyclePolicyModal.saving" @click="lifecyclePolicyModal.show = false"></button>
          </div>
          <div class="modal-body">
            <p class="small text-secondary">
              Pro Mandant gibt es <strong>eine</strong> Richtlinie für Microsoft-365-Gruppen. Voraussetzung ist u. a. Microsoft Entra ID P1.
              Aktive Gruppen können von Microsoft automatisch verlängert werden (Aktivität in Teams, SharePoint, Outlook, …).
              Ohne Verlängerung: Ablauf, danach Soft-Delete (Wiederherstellung ca. 30 Tage).
            </p>
            <div v-if="groupsStore.lifecycleLoading" class="text-secondary small py-3">Lade Richtlinie…</div>
            <template v-else>
              <div v-if="groupsStore.lifecyclePolicy" class="alert alert-secondary small py-2 mb-3">
                Aktuell: <strong>{{ groupsStore.lifecyclePolicy.groupLifetimeInDays }}</strong> Tage,
                Geltung: <strong>{{ groupsStore.lifecyclePolicy.managedGroupTypes === 'All' ? 'Alle M365-Gruppen' : 'Ausgewählte Gruppen' }}</strong>
              </div>
              <div v-else class="alert alert-info small py-2 mb-3">Noch keine Ablaufrichtlinie im Tenant – unten anlegen.</div>
              <div class="mb-3">
                <label class="form-label">Ablauf nach (Tage)</label>
                <input v-model.number="lifecyclePolicyForm.groupLifetimeInDays" type="number" min="1" max="3650" class="form-control" />
              </div>
              <div class="mb-3">
                <label class="form-label d-block">Gilt für</label>
                <div class="form-check">
                  <input id="lcSel" v-model="lifecyclePolicyForm.managedGroupTypes" class="form-check-input" type="radio" value="Selected" />
                  <label class="form-check-label" for="lcSel">Ausgewählte Microsoft-365-Gruppen (per Liste zuordnen)</label>
                </div>
                <div class="form-check">
                  <input id="lcAll" v-model="lifecyclePolicyForm.managedGroupTypes" class="form-check-input" type="radio" value="All" />
                  <label class="form-check-label" for="lcAll">Alle Microsoft-365-Gruppen im Tenant</label>
                </div>
              </div>
              <div class="mb-3">
                <label class="form-label">Benachrichtigungs-E-Mails (optional, z. B. wenn Gruppe ohne Besitzer)</label>
                <input v-model="lifecyclePolicyForm.alternateNotificationEmails" type="text" class="form-control" placeholder="admin@domain.com; second@domain.com" />
              </div>
            </template>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary btn-sm" :disabled="lifecyclePolicyModal.saving" @click="lifecyclePolicyModal.show = false">Schließen</button>
            <button
              type="button"
              class="btn btn-primary btn-sm"
              :disabled="lifecyclePolicyModal.saving || groupsStore.lifecycleLoading || !lifecyclePolicyForm.groupLifetimeInDays"
              @click="saveLifecyclePolicyFromModal"
            >
              {{ lifecyclePolicyModal.saving ? 'Speichert…' : groupsStore.lifecyclePolicy ? 'Speichern' : 'Anlegen' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Bulk add to lifecycle policy -->
    <div v-if="bulkLifecycleModal.show" class="modal d-block" tabindex="-1" style="background:rgba(0,0,0,0.6);">
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">Ablaufrichtlinie zuordnen</h5>
            <button type="button" class="btn-close" :disabled="bulkLifecycleModal.running" @click="bulkLifecycleModal.show = false"></button>
          </div>
          <div class="modal-body">
            <p class="small">
              <strong>{{ bulkLifecycleM365Ids.length }}</strong> Microsoft-365-Gruppe(n) der Tenant-Richtlinie hinzufügen
              (max. 500 ausgewählte Gruppen laut Microsoft; Lebensdauer: {{ groupsStore.lifecyclePolicy?.groupLifetimeInDays }} Tage).
            </p>
            <p v-if="bulkLifecycleSkippedCount > 0" class="small text-warning">
              {{ bulkLifecycleSkippedCount }} nicht-M365-Gruppe(n) werden übersprungen.
            </p>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary btn-sm" :disabled="bulkLifecycleModal.running" @click="bulkLifecycleModal.show = false">Abbrechen</button>
            <button type="button" class="btn btn-primary btn-sm" :disabled="bulkLifecycleModal.running || !bulkLifecycleM365Ids.length" @click="runBulkLifecycleAdd">
              {{ bulkLifecycleModal.running ? 'Fügt hinzu…' : 'Hinzufügen' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Edit group -->
    <div v-if="editModal.show" class="modal d-block" tabindex="-1" style="background:rgba(0,0,0,0.6);">
      <div class="modal-dialog modal-lg">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title"><i class="bi bi-pencil me-2" style="color:#58a6ff;"></i>Gruppe bearbeiten</h5>
            <button type="button" class="btn-close" :disabled="editModal.saving" @click="editModal.show = false"></button>
          </div>
          <div class="modal-body">
            <div class="mb-3">
              <label class="form-label">Anzeigename</label>
              <input v-model="editForm.displayName" type="text" class="form-control" />
            </div>
            <div class="mb-3">
              <label class="form-label">Beschreibung</label>
              <textarea v-model="editForm.description" class="form-control" rows="3"></textarea>
            </div>
            <div v-if="editModal.group" class="small" style="color:#8b949e;">
              <div class="mb-1"><strong style="color:#e6edf3;">Besitzer:</strong></div>
              <div v-if="editModal.loadingOwners" class="text-secondary">Lade Besitzer...</div>
              <ul v-else class="mb-0 ps-3">
                <li v-for="(e, i) in (editModal.group.ownerEmails || [])" :key="i">{{ e }}</li>
                <li v-if="!(editModal.group.ownerEmails || []).length">—</li>
              </ul>
            </div>
            <div v-if="editModal.group" class="border-top pt-3 mt-3">
              <div class="fw-medium small mb-2" style="color:#e6edf3;">Ablaufrichtlinie</div>
              <p v-if="!isM365UnifiedGroup(editModal.group)" class="small text-secondary mb-0">Nur für Microsoft-365-Gruppen (Unified).</p>
              <p v-else-if="!groupsStore.lifecyclePolicy" class="small text-secondary mb-2">Zuerst eine Ablaufrichtlinie anlegen (Button „Ablaufrichtlinie“ oben).</p>
              <p v-else-if="groupsStore.lifecyclePolicy.managedGroupTypes === 'All'" class="small text-secondary mb-0">
                Richtlinie gilt für alle Microsoft-365-Gruppen; keine Einzelzuordnung nötig.
                <span v-if="editModal.group.expirationDateTime" class="d-block mt-1">Ablaufdatum (laut Gruppe): {{ formatGroupDateTime(editModal.group.expirationDateTime) }}</span>
              </p>
              <template v-else>
                <p v-if="editModal.lifecycleForGroupLoading" class="small text-secondary mb-2">Zuordnung wird geprüft…</p>
                <template v-else>
                  <p v-if="editModal.lifecycleForGroupError" class="small text-warning mb-2">{{ editModal.lifecycleForGroupError }}</p>
                  <template v-if="editGroupLinkedToTenantPolicy">
                    <p class="small mb-2" style="color:#3fb950;">
                      Diese Gruppe ist bereits der Ablaufrichtlinie des Mandanten zugeordnet.
                      <span v-if="editModal.group.expirationDateTime" class="d-block mt-1" style="color:#8b949e;">Ablaufdatum: {{ formatGroupDateTime(editModal.group.expirationDateTime) }}</span>
                    </p>
                    <button
                      type="button"
                      class="btn btn-outline-warning btn-sm"
                      :disabled="editModal.addLifecycleBusy || editModal.removeLifecycleBusy"
                      @click="removeEditGroupFromLifecycle"
                    >
                      {{ editModal.removeLifecycleBusy ? 'Entfernt…' : 'Aus Ablaufrichtlinie entfernen' }}
                    </button>
                  </template>
                  <button
                    v-else
                    type="button"
                    class="btn btn-outline-primary btn-sm"
                    :disabled="editModal.addLifecycleBusy || editModal.removeLifecycleBusy"
                    @click="addEditGroupToLifecycle"
                  >
                    {{ editModal.addLifecycleBusy ? 'Fügt hinzu…' : 'Zur Ablaufrichtlinie hinzufügen' }}
                  </button>
                </template>
              </template>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary btn-sm" :disabled="editModal.saving" @click="editModal.show = false">Abbrechen</button>
            <button type="button" class="btn btn-primary btn-sm" :disabled="editModal.saving || !editForm.displayName.trim()" @click="saveEditGroup">
              {{ editModal.saving ? 'Speichert...' : 'Speichern' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Delete group -->
    <div v-if="deleteModal.show" class="modal d-block" tabindex="-1" style="background:rgba(0,0,0,0.6);">
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title text-danger"><i class="bi bi-trash me-2"></i>Gruppe löschen</h5>
            <button type="button" class="btn-close" :disabled="deleteModal.saving" @click="deleteModal.show = false"></button>
          </div>
          <div class="modal-body">
            <p class="small">Gruppe <strong>{{ deleteModal.group?.displayName }}</strong> endgültig löschen?</p>
            <label class="form-label">Anzeigename zur Bestätigung eintippen</label>
            <input v-model="deleteModal.confirmName" type="text" class="form-control" :disabled="deleteModal.saving" />
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary btn-sm" :disabled="deleteModal.saving" @click="deleteModal.show = false">Abbrechen</button>
            <button
              type="button"
              class="btn btn-danger btn-sm"
              :disabled="deleteModal.saving || deleteModal.confirmName !== deleteModal.group?.displayName"
              @click="runDeleteGroup"
            >
              {{ deleteModal.saving ? 'Löscht...' : 'Löschen' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Members -->
    <div v-if="membersModal.show" class="modal d-block" tabindex="-1" style="background:rgba(0,0,0,0.6);">
      <div class="modal-dialog modal-xl members-modal-dialog">
        <div class="modal-content">
          <div class="modal-header flex-shrink-0">
            <h5 class="modal-title">
              <i class="bi bi-people me-2" style="color:#58a6ff;"></i>
              Mitglieder: {{ membersModal.group?.displayName }}
              <span
                v-if="!membersModal.loading && !membersModal.group?.isDynamic"
                class="ms-2 badge rounded-pill"
                style="font-size:0.7rem;background:#30363d;color:#8b949e;"
              >{{ membersModal.members.length }}</span>
            </h5>
            <button type="button" class="btn-close" :disabled="membersModal.busy" @click="closeMembersModal"></button>
          </div>
          <div class="modal-body members-modal-body">
            <div v-if="membersModal.group?.isDynamic" class="alert alert-info small">
              Dynamische Gruppe — Mitglieder werden per Regel verwaltet, keine manuelle Bearbeitung.
            </div>

            <template v-else>
              <div class="mb-3 p-2 rounded" style="background:rgba(0,0,0,0.2);border:1px solid #30363d;">
                <div class="fw-medium small mb-2" style="color:#e6edf3;">Mitglieder hinzufügen</div>
                <p v-if="!usersStore.users.length" class="small mb-2" style="color:#f85149;">
                  Keine Benutzerliste geladen — unter „Benutzerliste“ zuerst aktualisieren.
                </p>
                <template v-else>
                  <div class="input-group input-group-sm mb-2">
                    <span class="input-group-text"><i class="bi bi-search"></i></span>
                    <input v-model="addUserSearch" type="text" class="form-control" placeholder="Benutzer suchen..." />
                  </div>
                  <div class="add-user-pick-list mb-2">
                    <label
                      v-for="u in usersToShowForAdd"
                      :key="u.id"
                      class="d-flex align-items-center gap-2 py-1 px-2 small add-user-pick-row"
                      style="cursor:pointer;"
                    >
                      <input v-model="addUserIds" type="checkbox" class="form-check-input" :value="u.id" :disabled="membersModal.busy" />
                      <span style="min-width:0;">{{ u.displayName }} <span class="text-secondary font-monospace" style="font-size:0.75rem;">{{ u.userPrincipalName }}</span></span>
                    </label>
                    <div v-if="!usersToShowForAdd.length" class="small text-secondary p-2">Keine passenden Benutzer oder alle sind bereits Mitglieder.</div>
                  </div>
                  <button
                    type="button"
                    class="btn btn-primary btn-sm"
                    :disabled="membersModal.busy || !addUserIds.length"
                    @click="submitAddMembers"
                  >
                    Ausgewählte hinzufügen ({{ addUserIds.length }})
                  </button>
                </template>
              </div>

              <div class="input-group input-group-sm mb-2">
                <span class="input-group-text"><i class="bi bi-funnel"></i></span>
                <input v-model="memberListFilter" type="text" class="form-control" placeholder="Mitglieder filtern..." />
              </div>

              <div v-if="membersModal.loading" class="text-center py-4 text-secondary small">Lade Mitglieder...</div>
              <div v-else class="members-table-scroll">
                <table class="table table-sm table-ms365 mb-0">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>E-Mail / UPN</th>
                      <th>Typ</th>
                      <th style="width:48px;"></th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="m in filteredMembersList" :key="m.id">
                      <td>{{ m.displayName || '—' }}</td>
                      <td class="font-monospace small" style="color:#8b949e;">{{ m.mail || m.userPrincipalName || m.id?.slice(0,8) }}</td>
                      <td class="small">{{ memberTypeLabel(m) }}</td>
                      <td>
                        <button
                          v-if="canRemoveMember(m)"
                          class="btn btn-link btn-sm text-danger p-0"
                          title="Aus Gruppe entfernen"
                          :disabled="membersModal.busy"
                          @click="removeMember(m)"
                        >
                          <i class="bi bi-trash"></i>
                        </button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </template>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, reactive, watch, onMounted } from 'vue'
import { useGroupsStore } from '../stores/groupsStore'
import { useUsersStore } from '../stores/usersStore'

const groupsStore = useGroupsStore()
const usersStore = useUsersStore()

const searchQuery = ref('')
const groupTypeFilter = ref('all')
const sortKey = ref('displayName')
const sortDir = ref(1)
const currentPage = ref(1)
const pageSizeOptions = [50, 100, 200]
const pageSize = ref(50)

const filteredGroups = computed(() => {
  let list = groupsStore.groups
  const q = searchQuery.value.trim().toLowerCase()
  if (q) {
    list = list.filter(
      (g) =>
        (g.displayName || '').toLowerCase().includes(q) ||
        (g.mailNickname || '').toLowerCase().includes(q)
    )
  }
  const tf = groupTypeFilter.value
  if (tf !== 'all') {
    list = list.filter((g) => {
      const types = Array.isArray(g.groupTypes) ? g.groupTypes : []
      const unified = types.includes('Unified')
      const dynamic = types.includes('DynamicMembership')
      if (tf === 'm365') return unified
      if (tf === 'm365dynamic') return unified && dynamic
      if (tf === 'other') return !unified
      return true
    })
  }
  return [...list].sort((a, b) => {
    const key = sortKey.value
    if (key === 'createdDateTime' || key === 'expirationDateTime') {
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
  const len = filteredGroups.value.length
  if (!len) return 1
  return Math.ceil(len / pageSize.value)
})

const paginatedGroups = computed(() => {
  const ps = pageSize.value
  const start = (currentPage.value - 1) * ps
  return filteredGroups.value.slice(start, start + ps)
})

watch([() => filteredGroups.value.length, pageSize], () => {
  const len = filteredGroups.value.length
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

watch(groupTypeFilter, () => {
  currentPage.value = 1
})

const selectedGroupIds = ref([])

const pageGroupIds = computed(() => paginatedGroups.value.map((g) => g.id).filter(Boolean))

const allPageGroupsSelected = computed(
  () => pageGroupIds.value.length > 0 && pageGroupIds.value.every((id) => selectedGroupIds.value.includes(id))
)

const pageGroupsSelectionIndeterminate = computed(() => {
  const n = pageGroupIds.value.filter((id) => selectedGroupIds.value.includes(id)).length
  return n > 0 && n < pageGroupIds.value.length
})

function isGroupRowSelected(id) {
  return selectedGroupIds.value.includes(id)
}

function toggleGroupRowSelected(id) {
  if (selectedGroupIds.value.includes(id)) {
    selectedGroupIds.value = selectedGroupIds.value.filter((x) => x !== id)
  } else {
    selectedGroupIds.value = [...selectedGroupIds.value, id]
  }
}

function toggleSelectGroupsPage(e) {
  const checked = e.target.checked
  const ids = pageGroupIds.value
  if (checked) {
    selectedGroupIds.value = [...new Set([...selectedGroupIds.value, ...ids])]
  } else {
    selectedGroupIds.value = selectedGroupIds.value.filter((id) => !ids.includes(id))
  }
}

function clearGroupSelection() {
  selectedGroupIds.value = []
}

function isM365UnifiedGroup(g) {
  const types = Array.isArray(g?.groupTypes) ? g.groupTypes : []
  return types.includes('Unified')
}

const selectedM365Count = computed(() =>
  selectedGroupIds.value.filter((id) => {
    const g = groupsStore.groups.find((x) => x.id === id)
    return g && isM365UnifiedGroup(g)
  }).length
)

const canBulkLifecycleAdd = computed(() => {
  const p = groupsStore.lifecyclePolicy
  return !!(p && p.id && p.managedGroupTypes === 'Selected' && selectedM365Count.value >= 2)
})

const bulkLifecycleM365Ids = computed(() =>
  selectedGroupIds.value.filter((id) => {
    const g = groupsStore.groups.find((x) => x.id === id)
    return g && isM365UnifiedGroup(g)
  })
)

const bulkLifecycleSkippedCount = computed(() => selectedGroupIds.value.length - bulkLifecycleM365Ids.value.length)

const lifecyclePolicyModal = reactive({ show: false, saving: false })
const lifecyclePolicyForm = reactive({
  groupLifetimeInDays: 400,
  managedGroupTypes: 'Selected',
  alternateNotificationEmails: ''
})

const bulkLifecycleModal = reactive({ show: false, running: false })

const editModal = reactive({
  show: false,
  saving: false,
  loadingOwners: false,
  addLifecycleBusy: false,
  removeLifecycleBusy: false,
  group: null,
  lifecycleForGroupLoading: false,
  lifecycleForGroup: null,
  lifecycleForGroupError: null
})
const editForm = reactive({ displayName: '', description: '' })

const editGroupLinkedToTenantPolicy = computed(() => {
  const tenantPid = groupsStore.lifecyclePolicy?.id
  const list = editModal.lifecycleForGroup
  if (!tenantPid || !Array.isArray(list)) return false
  return list.some((pol) => pol.id === tenantPid)
})

function syncLifecycleFormFromStore() {
  const p = groupsStore.lifecyclePolicy
  if (p) {
    lifecyclePolicyForm.groupLifetimeInDays = p.groupLifetimeInDays || 400
    lifecyclePolicyForm.managedGroupTypes = p.managedGroupTypes === 'All' ? 'All' : 'Selected'
    lifecyclePolicyForm.alternateNotificationEmails = p.alternateNotificationEmails || ''
  } else {
    lifecyclePolicyForm.groupLifetimeInDays = 400
    lifecyclePolicyForm.managedGroupTypes = 'Selected'
    lifecyclePolicyForm.alternateNotificationEmails = ''
  }
}

async function openLifecyclePolicyModal() {
  lifecyclePolicyModal.show = true
  await groupsStore.fetchLifecyclePolicies()
  syncLifecycleFormFromStore()
}

async function saveLifecyclePolicyFromModal() {
  lifecyclePolicyModal.saving = true
  const p = groupsStore.lifecyclePolicy
  const ok = await groupsStore.saveLifecyclePolicy({
    policyId: p?.id || null,
    groupLifetimeInDays: lifecyclePolicyForm.groupLifetimeInDays,
    managedGroupTypes: lifecyclePolicyForm.managedGroupTypes,
    alternateNotificationEmails: lifecyclePolicyForm.alternateNotificationEmails.trim() || undefined
  })
  lifecyclePolicyModal.saving = false
  if (ok) {
    await groupsStore.fetchLifecyclePolicies()
    syncLifecycleFormFromStore()
  }
}

async function runBulkLifecycleAdd() {
  const p = groupsStore.lifecyclePolicy
  if (!p?.id || !bulkLifecycleM365Ids.value.length) return
  bulkLifecycleModal.running = true
  const { ok } = await groupsStore.addGroupsToLifecyclePolicy({
    policyId: p.id,
    groupIds: [...bulkLifecycleM365Ids.value]
  })
  bulkLifecycleModal.running = false
  if (ok) {
    bulkLifecycleModal.show = false
    clearGroupSelection()
  }
}

async function addEditGroupToLifecycle() {
  const g = editModal.group
  const p = groupsStore.lifecyclePolicy
  if (!g?.id || !p?.id || p.managedGroupTypes !== 'Selected' || !isM365UnifiedGroup(g)) return
  editModal.addLifecycleBusy = true
  const { ok } = await groupsStore.addGroupsToLifecyclePolicy({ policyId: p.id, groupIds: [g.id] })
  editModal.addLifecycleBusy = false
  if (ok) {
    const row = groupsStore.groups.find((x) => x.id === g.id)
    if (row) Object.assign(editModal.group, row)
    await refreshEditModalLifecycleForGroup()
  }
}

async function removeEditGroupFromLifecycle() {
  const g = editModal.group
  const p = groupsStore.lifecyclePolicy
  if (!g?.id || !p?.id || p.managedGroupTypes !== 'Selected' || !isM365UnifiedGroup(g)) return
  editModal.removeLifecycleBusy = true
  const { ok } = await groupsStore.removeGroupsFromLifecyclePolicy({ policyId: p.id, groupIds: [g.id] })
  editModal.removeLifecycleBusy = false
  if (ok) {
    const row = groupsStore.groups.find((x) => x.id === g.id)
    if (row) Object.assign(editModal.group, row)
    await refreshEditModalLifecycleForGroup()
  }
}

async function refreshEditModalLifecycleForGroup() {
  const g = editModal.group
  editModal.lifecycleForGroup = null
  editModal.lifecycleForGroupError = null
  if (!g?.id || !isM365UnifiedGroup(g) || !groupsStore.lifecyclePolicy) {
    editModal.lifecycleForGroupLoading = false
    return
  }
  if (groupsStore.lifecyclePolicy.managedGroupTypes !== 'Selected') {
    editModal.lifecycleForGroup = []
    editModal.lifecycleForGroupLoading = false
    return
  }
  editModal.lifecycleForGroupLoading = true
  try {
    const res = await groupsStore.listLifecyclePoliciesForGroup(g.id)
    if (res.status === 'ok') editModal.lifecycleForGroup = res.policies || []
    else {
      editModal.lifecycleForGroupError = res.message || 'Abfrage fehlgeschlagen'
      editModal.lifecycleForGroup = []
    }
  } catch (e) {
    editModal.lifecycleForGroupError = e.message
    editModal.lifecycleForGroup = []
  } finally {
    editModal.lifecycleForGroupLoading = false
  }
}

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

function formatGroupDateTime(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })
}

async function openEditGroup(g) {
  editModal.group = g
  editForm.displayName = g.displayName || ''
  editForm.description = g.description || ''
  editModal.lifecycleForGroup = null
  editModal.lifecycleForGroupError = null
  editModal.lifecycleForGroupLoading = isM365UnifiedGroup(g)
  editModal.show = true
  editModal.loadingOwners = true
  await groupsStore.fetchLifecyclePolicies()
  await Promise.all([groupsStore.fetchGroupOwners(g.id), refreshEditModalLifecycleForGroup()])
  editModal.loadingOwners = false
}

async function saveEditGroup() {
  if (!editModal.group) return
  editModal.saving = true
  const ok = await groupsStore.updateGroup({
    groupId: editModal.group.id,
    displayName: editForm.displayName.trim(),
    description: editForm.description
  })
  editModal.saving = false
  if (ok) editModal.show = false
}

const deleteModal = reactive({ show: false, saving: false, group: null, confirmName: '' })

function openDeleteGroup(g) {
  deleteModal.group = g
  deleteModal.confirmName = ''
  deleteModal.show = true
}

async function runDeleteGroup() {
  if (!deleteModal.group || deleteModal.confirmName !== deleteModal.group.displayName) return
  deleteModal.saving = true
  const ok = await groupsStore.deleteGroup(deleteModal.group.id)
  deleteModal.saving = false
  if (ok) deleteModal.show = false
}

const membersModal = reactive({
  show: false,
  loading: false,
  busy: false,
  group: null,
  members: []
})
const memberListFilter = ref('')
const addUserSearch = ref('')
const addUserIds = ref([])

const memberIdSet = computed(() => new Set((membersModal.members || []).map((m) => m.id)))

const filteredMembersList = computed(() => {
  const q = memberListFilter.value.trim().toLowerCase()
  let list = membersModal.members || []
  if (q) {
    list = list.filter(
      (m) =>
        (m.displayName || '').toLowerCase().includes(q) ||
        (m.mail || '').toLowerCase().includes(q) ||
        (m.userPrincipalName || '').toLowerCase().includes(q)
    )
  }
  return list
})

const usersToShowForAdd = computed(() => {
  const q = addUserSearch.value.trim().toLowerCase()
  let list = usersStore.users.filter((u) => u.id && !memberIdSet.value.has(u.id))
  if (q) {
    list = list.filter(
      (u) =>
        (u.displayName || '').toLowerCase().includes(q) ||
        (u.userPrincipalName || '').toLowerCase().includes(q)
    )
  }
  return list.slice(0, 80)
})

function memberTypeLabel(m) {
  const t = m.odataType || ''
  if (t.includes('user')) return 'User'
  if (t.includes('group')) return 'Gruppe'
  if (t.includes('servicePrincipal')) return 'App'
  return t.replace('#microsoft.graph.', '') || '—'
}

function canRemoveMember(m) {
  const t = (m.odataType || '').toLowerCase()
  return t.includes('user') || t.includes('group') || t.includes('serviceprincipal')
}

async function openMembersModal(g) {
  membersModal.group = g
  membersModal.members = []
  memberListFilter.value = ''
  addUserSearch.value = ''
  addUserIds.value = []
  membersModal.show = true
  if (g.isDynamic) {
    await groupsStore.fetchGroupOwners(g.id)
    return
  }
  membersModal.loading = true
  const [, memRes] = await Promise.all([
    groupsStore.fetchGroupOwners(g.id),
    groupsStore.fetchGroupMembers(g.id)
  ])
  membersModal.loading = false
  if (memRes.status === 'ok') {
    membersModal.members = memRes.members || []
  }
}

function closeMembersModal() {
  if (membersModal.busy) return
  membersModal.show = false
}

async function removeMember(m) {
  if (!membersModal.group || !m.id) return
  membersModal.busy = true
  const ok = await groupsStore.removeGroupMember({ groupId: membersModal.group.id, memberId: m.id })
  if (ok) {
    membersModal.members = membersModal.members.filter((x) => x.id !== m.id)
  }
  membersModal.busy = false
}

async function submitAddMembers() {
  if (!membersModal.group || !addUserIds.value.length) return
  membersModal.busy = true
  const { ok, result } = await groupsStore.addMembersToGroup({
    groupId: membersModal.group.id,
    userIds: [...addUserIds.value]
  })
  if (ok && result) {
    addUserIds.value = []
    membersModal.loading = true
    const res = await groupsStore.fetchGroupMembers(membersModal.group.id)
    membersModal.loading = false
    if (res.status === 'ok') membersModal.members = res.members || []
  }
  membersModal.busy = false
}

watch(
  () => groupsStore.groups.map((g) => g.id).join(','),
  () => {
    const valid = new Set(groupsStore.groups.map((g) => g.id))
    selectedGroupIds.value = selectedGroupIds.value.filter((id) => valid.has(id))
  }
)

onMounted(() => {
  if (!groupsStore.lastFetched) groupsStore.fetchGroupsDetail()
  groupsStore.fetchLifecyclePolicies()
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

.add-user-pick-list {
  max-height: 180px;
  overflow: auto;
  border: 1px solid #30363d;
  border-radius: 6px;
}

.members-modal-dialog {
  height: 80vh;
  max-height: 80vh;
  margin-top: 10vh;
  margin-bottom: 10vh;
}

.members-modal-dialog .modal-content {
  height: 100%;
  max-height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.members-modal-dialog .members-modal-body {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
}

.members-table-scroll {
  overflow-x: auto;
}
</style>
