<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- Copyright (C) Mag. Thomas Michael Weissel <valueerror@gmail.com> -->

<template>
    <div>
        <!-- Header -->
        <div class="page-header">
            <h1 class="page-title">Benutzer entfernen</h1>
            <p class="page-subtitle">Benutzer per CSV-Datei eindeutig identifizieren und endgültig löschen</p>
        </div>

        <div class="content-card">
            <div class="content-card-body">
                <!-- Import Area -->
                <div class="d-flex gap-2 mb-3">
                    <button class="btn btn-primary" @click="importCsv" :disabled="usersStore.bulkRunning">
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
                            <i class="bi bi-info-circle me-1" style="color:#58a6ff;"></i> CSV-Format
                        </div>
                        <pre style="font-family:monospace;font-size:0.78rem;color:#8b949e;margin:0;white-space:pre-wrap;">Vorname;Nachname
Max;Mustermann
Anna;Schmidt</pre>
                        <div style="font-size:0.78rem;color:#8b949e;margin-top:0.5rem;">
                            Nur <strong>Vorname</strong> + <strong>Nachname</strong> werden verwendet. Die Erstell-CSV
                            (mit Abteilung, Passwort usw.) funktioniert ebenso — Zusatzspalten werden ignoriert.
                            Der UPN wird daraus exakt wie beim Erstellen gebildet
                            (<span style="font-family:monospace;">nachname.vorname@{{ domain || 'domain' }}</span>)
                            und gegen die geladene Benutzerliste abgeglichen.
                        </div>
                    </div>
                </div>

                <!-- Userlist required hint -->
                <div v-if="usersStore.csvEntries.length && !usersStore.users.length" class="mb-3">
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
                <div v-if="usersStore.csvEntries.length && !domain" class="mb-3">
                    <div class="alert mb-0" style="background:rgba(210,153,34,0.1);border:1px solid rgba(210,153,34,0.3);color:#d29922;border-radius:6px;">
                        <i class="bi bi-exclamation-triangle me-2"></i>
                        Keine Tenant-Domain bekannt — bitte zuerst die Benutzerliste laden.
                    </div>
                </div>

                <!-- Preview Table -->
                <div v-if="usersStore.csvEntries.length">
                    <div class="d-flex align-items-center justify-content-between mb-2">
                        <span style="font-size:0.875rem;">
                            <span style="color:#3fb950;font-weight:600;">{{ matchedRows.length }} gefunden</span>
                            <span style="color:#8b949e;"> · {{ unmatchedRows.length }} nicht gefunden</span>
                            <span v-if="ambiguousRows.length" style="color:#d29922;"> · {{ ambiguousRows.length }} mehrdeutig</span>
                        </span>
                        <button
                            class="btn btn-danger"
                            :disabled="!matchedRows.length || !usersStore.users.length || usersStore.bulkRunning"
                            @click="openConfirm"
                        >
                            <i class="bi bi-trash me-1"></i> {{ matchedRows.length }} Benutzer löschen
                        </button>
                    </div>

                    <div class="table-ms365-hscroll table-ms365-hscroll--y">
                        <table class="table table-ms365">
                            <thead>
                                <tr>
                                    <th>#</th>
                                    <th>Vorname</th>
                                    <th>Nachname</th>
                                    <th>UPN</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr v-for="(row, i) in rows" :key="i">
                                    <td style="color:#8b949e;">{{ i + 1 }}</td>
                                    <td>{{ row.entry.vorname }}</td>
                                    <td>{{ row.entry.nachname }}</td>
                                    <td style="font-family:monospace;font-size:0.72rem;color:#8b949e;">{{ row.upn || '—' }}</td>
                                    <td>
                                        <span v-if="row.status === 'matched'" style="color:#3fb950;font-size:0.8rem;">
                                            <i class="bi bi-check-circle-fill me-1"></i> gefunden
                                        </span>
                                        <span v-else-if="row.status === 'ambiguous'" style="color:#d29922;font-size:0.8rem;">
                                            <i class="bi bi-exclamation-triangle-fill me-1"></i> mehrdeutig ({{ row.count }})
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

        <!-- Confirm modal -->
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
    </div>
</template>

<script setup>
import { ref, computed, reactive } from 'vue'
import { useUsersStore } from '../stores/usersStore'
import { useAuthStore } from '../stores/authStore'
import { buildUpn } from '../utils/upn.js'

const usersStore = useUsersStore()
const authStore = useAuthStore()

const confirmWord = 'LÖSCHEN'
const confirm = reactive({ show: false, text: '' })

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

// Reconstruct UPN per CSV row (same logic as create) and classify against the user list.
const rows = computed(() =>
    usersStore.csvEntries.map((entry) => {
        const upn = buildUpn(entry.vorname, entry.nachname, domain.value)
        const count = upn ? (upnCounts.value.get(upn.toLowerCase()) || 0) : 0
        const status = count === 1 ? 'matched' : count > 1 ? 'ambiguous' : 'unmatched'
        return { entry, upn, count, status }
    })
)

const matchedRows = computed(() => rows.value.filter((r) => r.status === 'matched'))
const unmatchedRows = computed(() => rows.value.filter((r) => r.status === 'unmatched'))
const ambiguousRows = computed(() => rows.value.filter((r) => r.status === 'ambiguous'))

async function importCsv() {
    await usersStore.importCsv()
    if (usersStore.csvEntries.length && !usersStore.users.length) usersStore.fetchUsers()
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
            usersStore.csvEntries = usersStore.csvEntries.filter(
                (e) => !gone.has(buildUpn(e.vorname, e.nachname, domain.value).toLowerCase())
            )
        }
    } finally {
        usersStore.bulkRunning = false
    }
}
</script>

<style scoped>
.spin { animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
</style>
