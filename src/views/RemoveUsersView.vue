<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- Copyright (C) Mag. Thomas Michael Weissel <valueerror@gmail.com> -->

<template>
    <div class="remove-users-view">
        <!-- Header -->
        <div class="page-header">
            <h1 class="page-title">CSV Batch-Verwaltung</h1>
            <p class="page-subtitle">Benutzer per CSV suchen und Batch-Aktionen ausführen</p>
        </div>

        <div class="content-card">
            <div class="content-card-body">
                <!-- Import Area -->
                <div class="d-flex gap-2 mb-3">
                    <button class="btn btn-primary" @click="importCsv" :disabled="usersStore.bulkRunning">
                        <i class="bi bi-upload me-1"></i> CSV-Datei importieren
                    </button>
                    <button v-if="usersStore.batchEntries.length" class="btn btn-outline-secondary" @click="usersStore.batchEntries = []">
                        <i class="bi bi-x-circle me-1"></i> Liste leeren
                    </button>
                </div>

                <!-- CSV Format Info -->
                <div v-if="!usersStore.batchEntries.length" class="mb-4">
                    <div style="background:rgba(88,166,255,0.06);border:1px solid rgba(88,166,255,0.15);border-radius:6px;padding:1rem;">
                        <div style="font-size:0.85rem;font-weight:600;margin-bottom:0.5rem;">
                            <i class="bi bi-info-circle me-1" style="color:#58a6ff;"></i> CSV-Format
                        </div>
                        <pre style="font-family:monospace;font-size:0.78rem;color:#8b949e;margin:0;white-space:pre-wrap;">Vorname;Familienname
Max;Mustermann
Anna;Schmidt</pre>
                        <div style="font-size:0.78rem;color:#8b949e;margin-top:0.5rem;">
                            Nur <strong>Vorname</strong> + <strong>Familienname</strong> werden verwendet. Die Erstell-CSV
                            (mit Abteilung, Passwort usw.) funktioniert ebenso — Zusatzspalten werden ignoriert.
                            Der UPN wird daraus exakt wie beim Erstellen gebildet
                            (<span style="font-family:monospace;">nachname.vorname@{{ domain || 'domain' }}</span>)
                            und gegen die geladene Benutzerliste abgeglichen.
                        </div>
                    </div>
                </div>

                <!-- Userlist required hint -->
                <div v-if="usersStore.batchEntries.length && !usersStore.users.length" class="mb-3">
                    <div class="alert mb-0" style="background:rgba(210,153,34,0.1);border:1px solid rgba(210,153,34,0.3);color:#d29922;border-radius:6px;">
                        <i class="bi bi-exclamation-triangle me-2"></i>
                        Benutzerliste ist nicht geladen — ohne sie kann kein Abgleich erfolgen.
                        <button class="btn btn-sm btn-outline-secondary ms-2" :disabled="usersStore.loading" @click="usersStore.fetchUsers()">
                            <i class="bi" :class="usersStore.loading ? 'bi-arrow-repeat spin' : 'bi-people'"></i>
                            {{ usersStore.loading ? 'Lädt...' : 'Benutzerliste laden' }}
                        </button>
                    </div>
                </div>

                <!-- Domain missing hint -->
                <div v-if="usersStore.batchEntries.length && !domain" class="mb-3">
                    <div class="alert mb-0" style="background:rgba(210,153,34,0.1);border:1px solid rgba(210,153,34,0.3);color:#d29922;border-radius:6px;">
                        <i class="bi bi-exclamation-triangle me-2"></i>
                        Keine Tenant-Domain bekannt — bitte zuerst die Benutzerliste laden.
                    </div>
                </div>

                <!-- Preview Table -->
                <div v-if="usersStore.batchEntries.length" class="preview-block">
                    <div class="d-flex align-items-center justify-content-between mb-2 flex-wrap gap-2">
                        <div class="d-flex align-items-center gap-3 flex-wrap" style="font-size:0.875rem;">
                            <span style="color:#3fb950;font-weight:600;">{{ matchedRows.length }} gefunden</span>
                            <span v-if="lazyRows.length" style="color:#58a6ff;">(inkl. {{ lazyRows.length }} bestätigt)</span>
                            <span style="color:#8b949e;">· {{ unmatchedRows.length }} nicht gefunden</span>
                            <span v-if="ambiguousRows.length" style="color:#d29922;">· {{ ambiguousRows.length }} mehrdeutig</span>
                            <span class="d-inline-flex align-items-center gap-3 ms-2" style="font-size:0.8rem;">
                                <label class="d-inline-flex align-items-center gap-1 mb-0" style="cursor:pointer;color:#3fb950;">
                                    <input type="checkbox" class="form-check-input mt-0" style="width:14px;height:14px;flex:none;" v-model="filters.green" /> gefunden
                                </label>
                                <label class="d-inline-flex align-items-center gap-1 mb-0" style="cursor:pointer;color:#d29922;">
                                    <input type="checkbox" class="form-check-input mt-0" style="width:14px;height:14px;flex:none;" v-model="filters.orange" /> fuzzy
                                </label>
                                <label class="d-inline-flex align-items-center gap-1 mb-0" style="cursor:pointer;color:#8b949e;">
                                    <input type="checkbox" class="form-check-input mt-0" style="width:14px;height:14px;flex:none;" v-model="filters.gray" /> nicht gefunden
                                </label>
                            </span>
                        </div>
                        <div class="d-flex gap-2 flex-wrap">
                            <button
                                class="btn btn-outline-secondary btn-sm"
                                :disabled="!matchedRows.length || !usersStore.users.length || usersStore.bulkRunning"
                                @click="openAddGroup"
                            >
                                <i class="bi bi-collection me-1"></i> Zu Gruppe hinzufügen
                            </button>
                            <button
                                class="btn btn-outline-secondary btn-sm"
                                :disabled="!matchedRows.length || !usersStore.users.length || usersStore.bulkRunning"
                                @click="openSetDept"
                            >
                                <i class="bi bi-building me-1"></i> Abteilung setzen
                            </button>
                            <button
                                class="btn btn-danger btn-sm"
                                :disabled="!matchedRows.length || !usersStore.users.length || usersStore.bulkRunning"
                                @click="openConfirm"
                            >
                                <i class="bi bi-trash me-1"></i> {{ matchedRows.length }} Benutzer löschen
                            </button>
                        </div>
                    </div>

                    <div class="table-ms365-hscroll table-ms365-hscroll--y preview-table-scroll">
                        <table class="table table-ms365">
                            <thead>
                                <tr>
                                    <th>#</th>
                                    <th>Nachname</th>
                                    <th>Vorname</th>
                                    <th>Abteilung</th>
                                    <th>UPN</th>
                                    <th @click="toggleStatusSort" style="cursor:pointer;user-select:none;">
                                        Status
                                        <i class="bi" :class="statusSortDir === 'asc' ? 'bi-caret-up-fill' : 'bi-caret-down-fill'" style="font-size:0.7rem;"></i>
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr v-for="(row, i) in sortedRows" :key="i">
                                    <td style="color:#8b949e;">{{ i + 1 }}</td>
                                    <td>{{ row.entry.nachname }}</td>
                                    <td>{{ row.entry.vorname }}</td>
                                    <td style="font-size:0.82rem;color:#8b949e;">{{ row.department || '—' }}</td>
                                    <td style="font-family:monospace;font-size:0.72rem;" :style="{ color: row.candidate ? '#d29922' : (row.status === 'matched' || row.status === 'lazy') ? '#3fb950' : '#8b949e' }">{{ row.upn || '—' }}</td>
                                    <td>
                                        <span v-if="row.status === 'matched'" style="color:#3fb950;font-size:0.8rem;">
                                            <i class="bi bi-check-circle-fill me-1"></i> gefunden
                                        </span>
                                        <span v-else-if="row.status === 'lazy'" class="d-inline-flex align-items-center gap-2" style="color:#58a6ff;font-size:0.8rem;">
                                            <span><i class="bi bi-link-45deg me-1"></i> bestätigt</span>
                                            <button class="btn-action" style="font-size:0.7rem;" title="Bestätigung aufheben" @click="unconfirmMatch(row)">
                                                <i class="bi bi-x-lg"></i>
                                            </button>
                                        </span>
                                        <span v-else-if="row.status === 'ambiguous'" style="color:#d29922;font-size:0.8rem;">
                                            <i class="bi bi-exclamation-triangle-fill me-1"></i> mehrdeutig ({{ row.count }})
                                        </span>
                                        <span v-else-if="row.candidate" class="d-inline-flex align-items-center gap-2" style="font-size:0.8rem;">
                                            <span style="color:#d29922;" :title="'Vorschlag: ' + row.candidate.upn">
                                                <i class="bi bi-question-circle"></i>
                                            </span>
                                            <button class="btn-action success" style="font-size:0.7rem;" title="Als gefunden bestätigen" @click="confirmCandidate(row)">
                                                <i class="bi bi-check-lg"></i>
                                            </button>
                                        </span>
                                        <span v-else style="color:#8b949e;font-size:0.8rem;">
                                            <i class="bi bi-dash-circle me-1"></i> nicht gefunden
                                        </span>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>

        <!-- Delete confirm modal -->
        <div v-if="confirm.show" class="modal d-block" tabindex="-1" style="background:rgba(0,0,0,0.6);">
            <div class="modal-dialog modal-lg">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">
                            <i class="bi bi-trash me-2" style="color:#f85149;"></i>
                            Benutzer löschen (CSV)
                        </h5>
                        <button type="button" class="btn-close" :disabled="usersStore.bulkRunning" @click="confirm.show = false"></button>
                    </div>
                    <div class="modal-body">
                        <div class="alert" style="background:rgba(248,81,73,0.1);border:1px solid rgba(248,81,73,0.25);color:#f85149;border-radius:6px;">
                            <i class="bi bi-exclamation-triangle-fill me-2"></i>
                            <strong>Achtung:</strong> {{ matchedRows.length }} Benutzer werden endgültig gelöscht (Graph Batch).
                        </div>
                        <ul class="list-unstyled mb-3 small" style="color:#8b949e;max-height:240px;overflow:auto;">
                            <li v-for="row in matchedRows" :key="row.upn" class="py-1 border-bottom border-secondary border-opacity-25">
                                <span class="font-monospace" style="font-size:0.78rem;">{{ row.upn }}</span>
                            </li>
                        </ul>
                        <label class="form-label">Zur Bestätigung <strong>{{ confirmWord }}</strong> eintippen</label>
                        <input v-model="confirm.text" type="text" class="form-control" style="font-family:monospace;" :disabled="usersStore.bulkRunning" />
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary btn-sm" :disabled="usersStore.bulkRunning" @click="confirm.show = false">Abbrechen</button>
                        <button
                            type="button"
                            class="btn btn-danger btn-sm"
                            :disabled="usersStore.bulkRunning || confirm.text !== confirmWord"
                            @click="runDelete"
                        >
                            <i class="bi bi-trash me-1"></i>
                            {{ usersStore.bulkRunning ? 'Löscht...' : 'Alle endgültig löschen' }}
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <!-- Add to Group modal -->
        <div v-if="groupModal.show" class="modal d-block" tabindex="-1" style="background:rgba(0,0,0,0.6);">
            <div class="modal-dialog modal-lg">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">
                            <i class="bi bi-collection me-2" style="color:#58a6ff;"></i>
                            Zu Gruppe hinzufügen
                        </h5>
                        <button type="button" class="btn-close" :disabled="usersStore.bulkRunning" @click="groupModal.show = false"></button>
                    </div>
                    <div class="modal-body">
                        <div v-if="!groupsStore.groups.length" class="mb-3">
                            <div class="alert mb-0" style="background:rgba(210,153,34,0.1);border:1px solid rgba(210,153,34,0.3);color:#d29922;border-radius:6px;">
                                <i class="bi bi-exclamation-triangle me-2"></i>
                                Gruppen nicht geladen.
                                <button class="btn btn-sm btn-outline-secondary ms-2" :disabled="groupsStore.loading" @click="groupsStore.fetchGroupsDetail()">
                                    <i class="bi" :class="groupsStore.loading ? 'bi-arrow-repeat spin' : 'bi-collection'"></i>
                                    {{ groupsStore.loading ? 'Lädt...' : 'Gruppen laden' }}
                                </button>
                            </div>
                        </div>
                        <template v-else>
                            <input
                                v-model="groupModal.search"
                                type="text"
                                class="form-control form-control-sm mb-2"
                                placeholder="Gruppe suchen..."
                            />
                            <div style="max-height:260px;overflow-y:auto;border:1px solid rgba(255,255,255,0.08);border-radius:6px;">
                                <div
                                    v-for="g in filteredGroups"
                                    :key="g.id"
                                    @click="groupModal.selectedId = g.id"
                                    style="padding:0.45rem 0.75rem;cursor:pointer;font-size:0.85rem;border-bottom:1px solid rgba(255,255,255,0.05);"
                                    :style="groupModal.selectedId === g.id ? 'background:rgba(88,166,255,0.15);color:#58a6ff;' : 'color:#e6edf3;'"
                                >
                                    <i class="bi bi-collection me-2" style="font-size:0.78rem;opacity:0.6;"></i>
                                    {{ g.displayName }}
                                </div>
                                <div v-if="!filteredGroups.length" style="padding:0.75rem;color:#8b949e;font-size:0.82rem;text-align:center;">
                                    Keine Gruppen gefunden
                                </div>
                            </div>
                        </template>
                        <p class="mt-2 mb-0" style="font-size:0.8rem;color:#8b949e;">
                            {{ matchedRows.length }} Benutzer werden zur gewählten Gruppe hinzugefügt.
                        </p>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary btn-sm" :disabled="usersStore.bulkRunning" @click="groupModal.show = false">Abbrechen</button>
                        <button
                            type="button"
                            class="btn btn-primary btn-sm"
                            :disabled="!groupModal.selectedId || usersStore.bulkRunning"
                            @click="runAddToGroup"
                        >
                            <i class="bi bi-collection me-1"></i>
                            {{ usersStore.bulkRunning ? 'Läuft...' : 'Hinzufügen' }}
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <!-- Set Department modal -->
        <div v-if="deptModal.show" class="modal d-block" tabindex="-1" style="background:rgba(0,0,0,0.6);">
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">
                            <i class="bi bi-building me-2" style="color:#58a6ff;"></i>
                            Abteilung setzen
                        </h5>
                        <button type="button" class="btn-close" :disabled="usersStore.bulkRunning" @click="deptModal.show = false"></button>
                    </div>
                    <div class="modal-body">
                        <label class="form-label">Neue Abteilung für {{ matchedRows.length }} Benutzer</label>
                        <input
                            v-model="deptModal.value"
                            type="text"
                            class="form-control"
                            placeholder="z.B. IT-Abteilung"
                            :disabled="usersStore.bulkRunning"
                        />
                        <div v-if="deptModal.progress" class="mt-2" style="font-size:0.82rem;color:#8b949e;">
                            {{ deptModal.progress }}
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary btn-sm" :disabled="usersStore.bulkRunning" @click="deptModal.show = false">Abbrechen</button>
                        <button
                            type="button"
                            class="btn btn-primary btn-sm"
                            :disabled="!deptModal.value.trim() || usersStore.bulkRunning"
                            @click="runSetDept"
                        >
                            <i class="bi bi-building me-1"></i>
                            {{ usersStore.bulkRunning ? 'Läuft...' : 'Setzen' }}
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
import { useGroupsStore } from '../stores/groupsStore'
import { buildUpn, normalizeForUPN } from '../utils/upn.js'

const usersStore = useUsersStore()
const authStore = useAuthStore()
const groupsStore = useGroupsStore()

const confirmWord = 'LÖSCHEN'
const confirm = reactive({ show: false, text: '' })
const groupModal = reactive({ show: false, search: '', selectedId: '' })
const deptModal = reactive({ show: false, value: '', progress: '' })

const domain = computed(() => authStore.tenantDomain || '')

// Lowercased UPN -> count, to detect matches/duplicates against the loaded user list.
const upnCounts = computed(() => {
    const m = new Map()
    for (const u of usersStore.users) {
        const upn = String(u.userPrincipalName || '').toLowerCase()
        if (upn) m.set(upn, (m.get(upn) || 0) + 1)
    }
    return m
})

// Lowercased UPN -> user object index for quick department lookup.
const userByUpn = computed(() => {
    const m = new Map()
    for (const u of usersStore.users) {
        const upn = String(u.userPrincipalName || '').toLowerCase()
        if (upn) m.set(upn, u)
    }
    return m
})

// Index: normalized lastname -> [{ upn, firstNorm, user }] for fuzzy candidate lookup.
const usersByLastName = computed(() => {
    const m = new Map()
    for (const u of usersStore.users) {
        const upn = String(u.userPrincipalName || '').toLowerCase()
        const local = upn.split('@')[0] || ''
        const dot = local.indexOf('.')
        if (dot < 1) continue
        const lastNorm = local.slice(0, dot)
        const firstNorm = local.slice(dot + 1)
        if (!m.has(lastNorm)) m.set(lastNorm, [])
        m.get(lastNorm).push({ upn, firstNorm, user: u })
    }
    return m
})

// Stable per-row key so confirmed lazy matches survive recomputes.
const rowKey = (entry) => `${normalizeForUPN(entry.vorname)}|${normalizeForUPN(entry.nachname)}`

// User-confirmed lazy matches: rowKey -> chosen account UPN.
const confirmedMatches = reactive({})

// Does an account's first-name part plausibly match the CSV first name?
// allowExact: when the lastname itself is a reduced double-name variant, an exact
// first-name match is a valid candidate (the full UPN already failed to match anyway).
function firstNameMatches(accountFirst, vn, vnFirstPart, allowExact) {
    if (accountFirst === vn) return allowExact
    const longer = accountFirst.length >= vn.length ? accountFirst : vn
    const shorter = accountFirst.length >= vn.length ? vn : accountFirst
    return (shorter.length >= 3 && longer.startsWith(shorter)) || accountFirst === vnFirstPart
}

// Find best fuzzy candidate for an unmatched entry.
// Handles double names in BOTH parts: "Köfler-Leschanz" -> also tries "koefler",
// "Sophie Frederike" -> also tries "sophie".
function findCandidate(entry) {
    const vn = normalizeForUPN(entry.vorname)
    const nn = normalizeForUPN(entry.nachname)
    if (!vn || !nn) return null
    // Lastname variants: full + first part of a double name.
    const nnFirstPart = normalizeForUPN(String(entry.nachname).split(/[-\s]/)[0])
    const lastNameVariants = nnFirstPart && nnFirstPart !== nn ? [nn, nnFirstPart] : [nn]
    const vnFirstPart = normalizeForUPN(String(entry.vorname).split(/[-\s]/)[0])
    for (const ln of lastNameVariants) {
        const list = usersByLastName.value.get(ln)
        if (!list) continue
        const isReducedLastName = ln !== nn // a shortened double-name variant
        for (const c of list) {
            if (firstNameMatches(c.firstNorm, vn, vnFirstPart, isReducedLastName)) return c
        }
    }
    return null
}

// Reconstruct UPN per CSV row (same logic as create) and classify against the user list.
const rows = computed(() =>
    usersStore.batchEntries.map((entry) => {
        const upn = buildUpn(entry.vorname, entry.nachname, domain.value)
        const count = upn ? (upnCounts.value.get(upn.toLowerCase()) || 0) : 0
        const key = rowKey(entry)
        let status = count === 1 ? 'matched' : count > 1 ? 'ambiguous' : 'unmatched'
        let effectiveUpn = upn
        let candidate = null
        // Only run fuzzy logic for rows that didn't match exactly.
        if (status === 'unmatched') {
            const confirmed = confirmedMatches[key]
            if (confirmed && upnCounts.value.get(confirmed)) {
                status = 'lazy'
                effectiveUpn = confirmed
            } else {
                candidate = findCandidate(entry)
                // Show the real candidate UPN in the UPN column instead of the theoretical one.
                if (candidate) effectiveUpn = candidate.upn
            }
        }
        const department =
            status === 'matched' || status === 'lazy'
                ? userByUpn.value.get(effectiveUpn.toLowerCase())?.department || ''
                : ''
        return { entry, key, upn: effectiveUpn, count, status, department, candidate }
    })
)

// Category filter: green = gefunden (inkl. bestätigt), orange = fuzzy-Kandidat, gray = nicht gefunden/mehrdeutig.
const categoryOf = (r) => {
    if (r.status === 'matched' || r.status === 'lazy') return 'green'
    if (r.status === 'unmatched' && r.candidate) return 'orange'
    return 'gray'
}
const filters = reactive({ green: true, orange: true, gray: true })
const visibleRows = computed(() => rows.value.filter((r) => filters[categoryOf(r)]))

// Status-Spalte sortierbar: nach Status-Rang, Richtung umschaltbar
const statusSortDir = ref('asc')
// Sort groups in display order; unconfirmed fuzzy candidates always pinned to the very top.
const statusRank = { candidate: 0, lazy: 1, matched: 2, unmatched: 3, ambiguous: 4 }
const rankOf = (r) => {
    if (r.status === 'unmatched' && r.candidate) return statusRank.candidate
    return statusRank[r.status] ?? 99
}
const sortedRows = computed(() => {
    const dir = statusSortDir.value === 'asc' ? 1 : -1
    return [...visibleRows.value]
        .map((r, idx) => [r, idx])
        .sort(([a, ia], [b, ib]) => {
            const ra = rankOf(a)
            const rb = rankOf(b)
            // Candidates (rank 0) stay on top regardless of direction.
            if (ra === 0 || rb === 0) {
                if (ra !== rb) return ra - rb
                return ia - ib
            }
            if (ra !== rb) return (ra - rb) * dir
            return ia - ib // stable within a group
        })
        .map(([r]) => r)
})
const toggleStatusSort = () => {
    statusSortDir.value = statusSortDir.value === 'asc' ? 'desc' : 'asc'
}

// "matched" for batch actions = exact matches + user-confirmed lazy matches.
const matchedRows = computed(() => rows.value.filter((r) => r.status === 'matched' || r.status === 'lazy'))
const lazyRows = computed(() => rows.value.filter((r) => r.status === 'lazy'))
const unmatchedRows = computed(() => rows.value.filter((r) => r.status === 'unmatched'))
const ambiguousRows = computed(() => rows.value.filter((r) => r.status === 'ambiguous'))

// Confirm a fuzzy candidate as a real match (used for batch processing).
function confirmCandidate(row) {
    if (row.candidate) confirmedMatches[row.key] = row.candidate.upn
}
// Undo a confirmed lazy match.
function unconfirmMatch(row) {
    delete confirmedMatches[row.key]
}

const filteredGroups = computed(() => {
    const q = groupModal.search.toLowerCase()
    if (!q) return groupsStore.groups
    return groupsStore.groups.filter((g) => g.displayName?.toLowerCase().includes(q))
})

async function importCsv() {
    await usersStore.importBatchCsv()
    if (usersStore.batchEntries.length && !usersStore.users.length) usersStore.fetchUsers()
}

function openConfirm() {
    if (!matchedRows.value.length) return
    confirm.text = ''
    confirm.show = true
}

async function runDelete() {
    const upns = matchedRows.value.map((r) => r.upn)
    if (!upns.length) return
    usersStore.bulkRunning = true
    try {
        const res = await usersStore.deleteUsersBatch(upns)
        confirm.show = false
        // Drop successfully deleted rows from the CSV list so the preview reflects reality.
        if (res?.deletedUpns?.length) {
            const gone = new Set(res.deletedUpns.map((u) => String(u).toLowerCase()))
            // Map each CSV entry to its effective UPN (incl. confirmed lazy matches) via rows.
            const upnByKey = new Map(rows.value.map((r) => [r.key, (r.upn || '').toLowerCase()]))
            usersStore.batchEntries = usersStore.batchEntries.filter(
                (e) => !gone.has(upnByKey.get(rowKey(e)) || '')
            )
        }
    } finally {
        usersStore.bulkRunning = false
    }
}

function openAddGroup() {
    if (!matchedRows.value.length) return
    groupModal.search = ''
    groupModal.selectedId = ''
    groupModal.show = true
    if (!groupsStore.groups.length) groupsStore.fetchGroupsDetail()
}

async function runAddToGroup() {
    if (!groupModal.selectedId || !matchedRows.value.length) return
    const userIds = matchedRows.value
        .map((r) => usersStore.users.find((u) => u.userPrincipalName?.toLowerCase() === r.upn?.toLowerCase())?.id)
        .filter(Boolean)
    if (!userIds.length) return
    usersStore.bulkRunning = true
    try {
        await usersStore.addUsersToGroup({ groupId: groupModal.selectedId, userIds })
        groupModal.show = false
    } finally {
        usersStore.bulkRunning = false
    }
}

function openSetDept() {
    if (!matchedRows.value.length) return
    deptModal.value = ''
    deptModal.progress = ''
    deptModal.show = true
}

async function runSetDept() {
    const dept = deptModal.value.trim()
    if (!dept || !matchedRows.value.length) return
    usersStore.bulkRunning = true
    let ok = 0
    let fail = 0
    try {
        const total = matchedRows.value.length
        for (const row of matchedRows.value) {
            deptModal.progress = `${ok + fail + 1} / ${total}...`
            const res = await usersStore.updateUser({ upn: row.upn, department: dept }, { quietToast: true })
            if (res) ok++
            else fail++
        }
        const msg = `Abteilung gesetzt: ${ok}${fail ? `, fehlgeschlagen: ${fail}` : ''}`
        if (fail && !ok) authStore.showToast(msg, 'error')
        else if (fail) authStore.showToast(msg, 'warning')
        else authStore.showToast(msg, 'success')
        deptModal.show = false
    } finally {
        deptModal.progress = ''
        usersStore.bulkRunning = false
    }
}
</script>

<style scoped>
.spin { animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

/* Userliste füllt verfügbare Höhe bis zum Log-Terminal */
.remove-users-view {
    height: 100%;
    display: flex;
    flex-direction: column;
    min-height: 0;
}
.remove-users-view > .content-card {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
}
.remove-users-view > .content-card > .content-card-body {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
}
.remove-users-view .preview-block {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
}
.remove-users-view .preview-table-scroll {
    flex: 1;
    max-height: none;
    min-height: 0;
}
</style>
