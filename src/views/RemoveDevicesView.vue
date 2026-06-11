<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- Copyright (C) Mag. Thomas Michael Weissel <valueerror@gmail.com> -->

<template>
    <div class="remove-devices-view">
        <!-- Header -->
        <div class="page-header">
            <h1 class="page-title">Geräte entfernen</h1>
            <p class="page-subtitle">Geräte von Schulabgängern per CSV (Besitzer) identifizieren und aus dem Tenant entfernen</p>
        </div>

        <div class="content-card">
            <div class="content-card-body">
                <!-- Import Area -->
                <div class="d-flex gap-2 mb-3">
                    <button class="btn btn-primary" @click="importCsv" :disabled="running">
                        <i class="bi bi-upload me-1"></i> CSV-Datei importieren
                    </button>
                    <button v-if="devicesStore.csvEntries.length" class="btn btn-outline-secondary" @click="devicesStore.csvEntries = []">
                        <i class="bi bi-x-circle me-1"></i> Liste leeren
                    </button>
                </div>

                <!-- CSV Format Info -->
                <div v-if="!devicesStore.csvEntries.length" class="mb-4">
                    <div style="background:rgba(88,166,255,0.06);border:1px solid rgba(88,166,255,0.15);border-radius:6px;padding:1rem;">
                        <div style="font-size:0.85rem;font-weight:600;margin-bottom:0.5rem;">
                            <i class="bi bi-info-circle me-1" style="color:#58a6ff;"></i> CSV-Format
                        </div>
                        <pre style="font-family:monospace;font-size:0.78rem;color:#8b949e;margin:0;white-space:pre-wrap;">Vorname;Familienname
Max;Mustermann
Anna;Schmidt</pre>
                        <div style="font-size:0.78rem;color:#8b949e;margin-top:0.5rem;">
                            Nur <strong>Vorname</strong> + <strong>Familienname</strong> werden verwendet. Der Besitzer-UPN
                            wird daraus gebildet (<span style="font-family:monospace;">nachname.vorname@{{ domain || 'domain' }}</span>)
                            und gegen den Besitzer der geladenen Geräte abgeglichen. Pro Schüler werden <strong>alle</strong>
                            zugeordneten Geräte entfernt: Intune-verwaltete werden abgekoppelt (Retire), reine
                            Entra-Geräte aus dem Verzeichnis gelöscht.
                        </div>
                    </div>
                </div>

                <!-- Devicelist required hint -->
                <div v-if="devicesStore.csvEntries.length && !devicesStore.devices.length" class="mb-3">
                    <div class="alert mb-0" style="background:rgba(210,153,34,0.1);border:1px solid rgba(210,153,34,0.3);color:#d29922;border-radius:6px;">
                        <i class="bi bi-exclamation-triangle me-2"></i>
                        Geräteliste ist nicht geladen — ohne sie kann kein Abgleich erfolgen.
                        <button class="btn btn-sm btn-outline-secondary ms-2" :disabled="devicesStore.loading" @click="devicesStore.fetchDevices()">
                            <i class="bi" :class="devicesStore.loading ? 'bi-arrow-repeat spin' : 'bi-pc-display'"></i>
                            {{ devicesStore.loading ? 'Lädt...' : 'Geräteliste laden' }}
                        </button>
                    </div>
                </div>

                <!-- Domain missing hint -->
                <div v-if="devicesStore.csvEntries.length && !domain" class="mb-3">
                    <div class="alert mb-0" style="background:rgba(210,153,34,0.1);border:1px solid rgba(210,153,34,0.3);color:#d29922;border-radius:6px;">
                        <i class="bi bi-exclamation-triangle me-2"></i>
                        Keine Tenant-Domain bekannt — bitte zuerst die Benutzer- oder Geräteliste laden.
                    </div>
                </div>

                <!-- Preview Table -->
                <div v-if="devicesStore.csvEntries.length" class="preview-block">
                    <div class="d-flex align-items-center justify-content-between mb-2 flex-wrap gap-2">
                        <div class="d-flex align-items-center gap-3 flex-wrap" style="font-size:0.875rem;">
                            <span style="color:#3fb950;font-weight:600;">{{ devicesToRemove.length }} Geräte gefunden</span>
                            <span style="color:#8b949e;">· {{ matchedRows.length }} Schüler mit Geräten</span>
                            <span v-if="lazyRows.length" style="color:#58a6ff;">(inkl. {{ lazyRows.length }} bestätigt)</span>
                            <span style="color:#8b949e;">· {{ unmatchedRows.length }} ohne Geräte</span>
                            <span class="d-inline-flex align-items-center gap-3 ms-2" style="font-size:0.8rem;">
                                <label class="d-inline-flex align-items-center gap-1 mb-0" style="cursor:pointer;color:#3fb950;">
                                    <input type="checkbox" class="form-check-input mt-0" style="width:14px;height:14px;flex:none;" v-model="filters.green" /> mit Geräten
                                </label>
                                <label class="d-inline-flex align-items-center gap-1 mb-0" style="cursor:pointer;color:#d29922;">
                                    <input type="checkbox" class="form-check-input mt-0" style="width:14px;height:14px;flex:none;" v-model="filters.orange" /> fuzzy
                                </label>
                                <label class="d-inline-flex align-items-center gap-1 mb-0" style="cursor:pointer;color:#8b949e;">
                                    <input type="checkbox" class="form-check-input mt-0" style="width:14px;height:14px;flex:none;" v-model="filters.gray" /> ohne Geräte
                                </label>
                            </span>
                        </div>
                        <button
                            class="btn btn-danger"
                            :disabled="!devicesToRemove.length || running"
                            @click="openConfirm"
                        >
                            <i class="bi bi-trash me-1"></i> {{ devicesToRemove.length }} Geräte entfernen
                        </button>
                    </div>

                    <div class="table-ms365-hscroll table-ms365-hscroll--y preview-table-scroll">
                        <table class="table table-ms365">
                            <thead>
                                <tr>
                                    <th>#</th>
                                    <th>Vorname</th>
                                    <th>Nachname</th>
                                    <th>Besitzer-UPN</th>
                                    <th @click="toggleDeviceSort" style="cursor:pointer;user-select:none;">
                                        Geräte
                                        <i v-if="deviceSortDir" class="bi" :class="deviceSortDir === 'asc' ? 'bi-caret-up-fill' : 'bi-caret-down-fill'" style="font-size:0.7rem;"></i>
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr v-for="(row, i) in sortedRows" :key="i">
                                    <td style="color:#8b949e;">{{ i + 1 }}</td>
                                    <td>{{ row.entry.vorname }}</td>
                                    <td>{{ row.entry.nachname }}</td>
                                    <td style="font-family:monospace;font-size:0.72rem;" :style="{ color: row.candidate ? '#d29922' : row.devices.length ? '#3fb950' : '#8b949e' }">{{ row.upn || '—' }}</td>
                                    <td>
                                        <span v-if="row.devices.length" :style="{ color: row.lazy ? '#58a6ff' : '#3fb950', 'font-size': '0.8rem' }" class="d-inline-flex align-items-center gap-2">
                                            <span>
                                                <i class="bi" :class="row.lazy ? 'bi-link-45deg' : 'bi-check-circle-fill'"></i>
                                                {{ row.devices.length }} Gerät(e)
                                                <span class="text-secondary">— {{ deviceSummary(row.devices) }}</span>
                                            </span>
                                            <button v-if="row.lazy" class="btn-action" style="font-size:0.7rem;" title="Bestätigung aufheben" @click="unconfirmMatch(row)">
                                                <i class="bi bi-x-lg"></i>
                                            </button>
                                        </span>
                                        <span v-else-if="row.candidate" class="d-inline-flex align-items-center gap-2" style="font-size:0.8rem;">
                                            <span style="color:#d29922;" :title="'Vorschlag: ' + row.candidate.upn + ' (' + (devicesByOwner.get(row.candidate.upn)?.length || 0) + ' Geräte)'">
                                                <i class="bi bi-question-circle"></i>
                                            </span>
                                            <button class="btn-action success" style="font-size:0.7rem;" title="Als gefunden bestätigen" @click="confirmCandidate(row)">
                                                <i class="bi bi-check-lg"></i>
                                            </button>
                                        </span>
                                        <span v-else style="color:#8b949e;font-size:0.8rem;">
                                            <i class="bi bi-dash-circle me-1"></i> keine Geräte
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
                            Geräte entfernen (CSV)
                        </h5>
                        <button type="button" class="btn-close" :disabled="running" @click="confirm.show = false"></button>
                    </div>
                    <div class="modal-body">
                        <div class="alert" style="background:rgba(248,81,73,0.1);border:1px solid rgba(248,81,73,0.25);color:#f85149;border-radius:6px;">
                            <i class="bi bi-exclamation-triangle-fill me-2"></i>
                            <strong>Achtung:</strong> {{ devicesToRemove.length }} Geräte werden vollständig aus dem Tenant entfernt.
                            Intune-verwaltete werden abgekoppelt (Retire) und das Entra-Objekt gelöscht, reine Entra-Geräte nur gelöscht.
                        </div>
                        <ul class="list-unstyled mb-3 small" style="color:#8b949e;max-height:240px;overflow:auto;">
                            <li v-for="d in devicesToRemove" :key="d.id" class="py-1 border-bottom border-secondary border-opacity-25 d-flex justify-content-between">
                                <span>{{ d.displayName || d.id }} <span class="text-secondary font-monospace" style="font-size:0.72rem;">{{ d.ownerUserPrincipalName }}</span></span>
                                <span class="badge rounded-pill" :style="d.isIntuneManaged ? 'background:#1f6feb;color:#fff;' : 'background:#30363d;color:#8b949e;'">
                                    {{ d.isIntuneManaged ? 'Retire + Delete' : 'Entra-Delete' }}
                                </span>
                            </li>
                        </ul>
                        <label class="form-label">Zur Bestätigung <strong>{{ confirmWord }}</strong> eintippen</label>
                        <input v-model="confirm.text" type="text" class="form-control" style="font-family:monospace;" :disabled="running" />
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary btn-sm" :disabled="running" @click="confirm.show = false">Abbrechen</button>
                        <button
                            type="button"
                            class="btn btn-danger btn-sm"
                            :disabled="running || confirm.text !== confirmWord"
                            @click="runRemove"
                        >
                            <i class="bi bi-trash me-1"></i>
                            {{ running ? 'Entfernt...' : 'Alle entfernen' }}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref, computed, reactive } from 'vue'
import { useDevicesStore } from '../stores/devicesStore'
import { useAuthStore } from '../stores/authStore'
import { buildUpn, normalizeForUPN } from '../utils/upn.js'

const devicesStore = useDevicesStore()
const authStore = useAuthStore()

const confirmWord = 'LÖSCHEN'
const confirm = reactive({ show: false, text: '' })
const running = ref(false)

const domain = computed(() => authStore.tenantDomain || '')

// Lowercased owner-UPN -> list of devices owned by that user, for matching CSV rows.
const devicesByOwner = computed(() => {
    const m = new Map()
    for (const d of devicesStore.devices) {
        const upn = String(d.ownerUserPrincipalName || '').toLowerCase()
        if (!upn) continue
        if (!m.has(upn)) m.set(upn, [])
        m.get(upn).push(d)
    }
    return m
})

// Index of device owners by normalized lastname, for fuzzy candidate lookup.
// Only owners that actually have devices are relevant (otherwise nothing to remove).
const ownersByLastName = computed(() => {
    const m = new Map()
    for (const upn of devicesByOwner.value.keys()) {
        const local = upn.split('@')[0] || ''
        const dot = local.indexOf('.')
        if (dot < 1) continue
        const lastNorm = local.slice(0, dot)
        const firstNorm = local.slice(dot + 1)
        if (!m.has(lastNorm)) m.set(lastNorm, [])
        m.get(lastNorm).push({ upn, firstNorm })
    }
    return m
})

// Stable per-row key so confirmed lazy matches survive recomputes.
const rowKey = (entry) => `${normalizeForUPN(entry.vorname)}|${normalizeForUPN(entry.nachname)}`

// User-confirmed lazy matches: rowKey -> chosen owner UPN.
const confirmedMatches = reactive({})

// First-name plausibility check (same rules as the user batch view).
function firstNameMatches(accountFirst, vn, vnFirstPart, allowExact) {
    if (accountFirst === vn) return allowExact
    const longer = accountFirst.length >= vn.length ? accountFirst : vn
    const shorter = accountFirst.length >= vn.length ? vn : accountFirst
    return (shorter.length >= 3 && longer.startsWith(shorter)) || accountFirst === vnFirstPart
}

// Find a fuzzy owner candidate (with devices) for an unmatched CSV row.
// Handles double names in both parts ("Köfler-Leschanz", "Sophie Frederike").
function findCandidate(entry) {
    const vn = normalizeForUPN(entry.vorname)
    const nn = normalizeForUPN(entry.nachname)
    if (!vn || !nn) return null
    const nnFirstPart = normalizeForUPN(String(entry.nachname).split(/[-\s]/)[0])
    const lastNameVariants = nnFirstPart && nnFirstPart !== nn ? [nn, nnFirstPart] : [nn]
    const vnFirstPart = normalizeForUPN(String(entry.vorname).split(/[-\s]/)[0])
    for (const ln of lastNameVariants) {
        const list = ownersByLastName.value.get(ln)
        if (!list) continue
        const isReducedLastName = ln !== nn
        for (const c of list) {
            if (firstNameMatches(c.firstNorm, vn, vnFirstPart, isReducedLastName)) return c
        }
    }
    return null
}

// Reconstruct owner-UPN per CSV row and collect that owner's devices.
// Unmatched rows get a fuzzy candidate; confirmed ones adopt the candidate owner's devices.
const rows = computed(() =>
    devicesStore.csvEntries.map((entry) => {
        const upn = buildUpn(entry.vorname, entry.nachname, domain.value)
        const key = rowKey(entry)
        let effectiveUpn = upn
        let devices = upn ? (devicesByOwner.value.get(upn.toLowerCase()) || []) : []
        let lazy = false
        let candidate = null
        if (!devices.length) {
            const confirmed = confirmedMatches[key]
            if (confirmed && devicesByOwner.value.get(confirmed)) {
                effectiveUpn = confirmed
                devices = devicesByOwner.value.get(confirmed)
                lazy = true
            } else {
                candidate = findCandidate(entry)
                if (candidate) effectiveUpn = candidate.upn
            }
        }
        return { entry, key, upn: effectiveUpn, devices, lazy, candidate }
    })
)

const matchedRows = computed(() => rows.value.filter((r) => r.devices.length))
const lazyRows = computed(() => rows.value.filter((r) => r.lazy))
const unmatchedRows = computed(() => rows.value.filter((r) => !r.devices.length))
const devicesToRemove = computed(() => matchedRows.value.flatMap((r) => r.devices))

// Category filter: green = hat Geräte (inkl. bestätigt), orange = fuzzy-Kandidat, gray = keine Geräte.
const categoryOf = (r) => {
    if (r.devices.length) return 'green'
    if (r.candidate) return 'orange'
    return 'gray'
}
const filters = reactive({ green: true, orange: true, gray: true })
const visibleRows = computed(() => rows.value.filter((r) => filters[categoryOf(r)]))

// "Geräte"-Spalte sortierbar nach Geräteanzahl; null = Originalreihenfolge.
const deviceSortDir = ref(null)
const sortedRows = computed(() => {
    if (!deviceSortDir.value) return visibleRows.value
    const dir = deviceSortDir.value === 'asc' ? 1 : -1
    return [...visibleRows.value]
        .map((r, idx) => [r, idx])
        .sort(([a, ia], [b, ib]) => (a.devices.length - b.devices.length) * dir || ia - ib)
        .map(([r]) => r)
})
const toggleDeviceSort = () => {
    deviceSortDir.value = deviceSortDir.value === 'desc' ? 'asc' : 'desc'
}

// Confirm a fuzzy candidate as a real match.
function confirmCandidate(row) {
    if (row.candidate) confirmedMatches[row.key] = row.candidate.upn
}
// Undo a confirmed lazy match.
function unconfirmMatch(row) {
    delete confirmedMatches[row.key]
}

// Short "2 Intune / 1 Entra" style summary for the preview row.
function deviceSummary(devices) {
    const intune = devices.filter((d) => d.isIntuneManaged).length
    const entra = devices.length - intune
    const parts = []
    if (intune) parts.push(`${intune} Intune`)
    if (entra) parts.push(`${entra} Entra`)
    return parts.join(' / ')
}

async function importCsv() {
    const result = await window.ipcRenderer.invoke('open-csv-dialog')
    if (result.status === 'cancelled') return
    if (result.status !== 'ok') {
        authStore.showToast(result.message || 'Importfehler', 'error')
        return
    }
    const dataResult = await window.ipcRenderer.invoke('get-csv-data')
    if (dataResult.status === 'ok') {
        devicesStore.csvEntries = dataResult.data
        authStore.showToast(`${dataResult.data.length} Einträge importiert`, 'success')
        if (!devicesStore.devices.length) devicesStore.fetchDevices()
    }
}

function openConfirm() {
    if (!devicesToRemove.value.length) return
    confirm.text = ''
    confirm.show = true
}

async function runRemove() {
    const rowsToRemove = devicesToRemove.value
    if (!rowsToRemove.length) return
    running.value = true
    try {
        await devicesStore.removeDevicesAutoBatch(rowsToRemove)
        confirm.show = false
    } finally {
        running.value = false
    }
}
</script>

<style scoped>
.spin { animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

/* Geräteliste füllt verfügbare Höhe bis zum Log-Terminal */
.remove-devices-view {
    height: 100%;
    display: flex;
    flex-direction: column;
    min-height: 0;
}
.remove-devices-view > .content-card {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
}
.remove-devices-view > .content-card > .content-card-body {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
}
.remove-devices-view .preview-block {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
}
.remove-devices-view .preview-table-scroll {
    flex: 1;
    max-height: none;
    min-height: 0;
}
</style>
