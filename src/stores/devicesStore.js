// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) Mag. Thomas Michael Weissel <valueerror@gmail.com>

import { defineStore } from 'pinia'
import { useAuthStore } from './authStore'

let devicesInflight = null

export const useDevicesStore = defineStore('devices', {
  state: () => ({
    devices: [],
    loading: false,
    error: null,
    lastFetched: null,
    // Imported owner CSV for the device-removal view; kept here so it survives navigation.
    csvEntries: []
  }),

  getters: {
    totalDevices: (state) => state.devices.length,
    // Counts Graph directory devices with isManaged true (MDM/Intune per Microsoft Graph).
    managedDevicesCount: (state) => state.devices.filter((d) => d.isIntuneManaged === true).length,
    // Counts devices where isCompliant is explicitly true (Intune/MDM compliance signal from Graph).
    compliantDevicesCount: (state) => state.devices.filter((d) => d.isCompliant === true).length
  },

  actions: {
    clearSession() {
      devicesInflight = null
      this.$reset()
    },

    async fetchDevices() {
      if (devicesInflight) return devicesInflight
      const auth = useAuthStore()
      this.loading = true
      this.error = null
      auth.beginGraphOperation('Geräte')
      devicesInflight = (async () => {
        try {
          const result = await window.ipcRenderer.invoke('get-devices')
          if (result.status === 'ok') {
            auth.markGraphConnected()
            this.devices = result.devices || []
            this.lastFetched = new Date()
            auth.addLog({ type: 'success', message: `${this.devices.length} Geräte geladen` })
            auth.showToast(`${this.devices.length} Geräte geladen`, 'success')
          } else {
            this.error = result.message
            this.devices = []
            auth.addLog({ type: 'error', message: result.message })
            auth.showToast(result.message, 'error')
          }
        } catch (e) {
          this.error = e.message
          this.devices = []
          auth.addLog({ type: 'error', message: e.message })
          auth.showToast(e.message, 'error')
        } finally {
          this.loading = false
          devicesInflight = null
        }
      })()
      return devicesInflight
    },

    // Silent list refresh after Intune actions (no full-page loading or count toast).
    async refreshDevicesList() {
      const auth = useAuthStore()
      try {
        const result = await window.ipcRenderer.invoke('get-devices')
        if (result.status === 'ok') {
          this.devices = result.devices || []
          this.lastFetched = new Date()
          auth.addLog({ type: 'info', message: `${this.devices.length} Geräte aktualisiert` })
        }
      } catch {
        /* ignore */
      }
    },

    async retireIntuneDevice({ azureAdDeviceId, intuneManagedDeviceId, disableUserAccount, userUpn }) {
      const auth = useAuthStore()
      try {
        const result = await window.ipcRenderer.invoke('retire-intune-device', {
          azureAdDeviceId,
          intuneManagedDeviceId: intuneManagedDeviceId || undefined,
          disableUserAccount: !!disableUserAccount,
          userUpn: userUpn || undefined
        })
        if (result.status === 'ok') {
          auth.showToast(result.message || 'Retire ausgeführt', 'success')
          await this.refreshDevicesList()
          return true
        }
        if (result.status === 'partial') {
          auth.showToast(result.message || 'Teilweise erfolgreich', 'warning')
          await this.refreshDevicesList()
          return true
        }
        auth.showToast(result.message || 'Fehler', 'error')
        return false
      } catch (e) {
        auth.showToast(e.message, 'error')
        return false
      }
    },

    async deleteEntraDevice(deviceId) {
      const auth = useAuthStore()
      const id = String(deviceId || '').trim()
      if (!id) return false
      auth.addLog({ type: 'info', message: `Entra-Gerät löschen: ${id}` })
      try {
        const result = await window.ipcRenderer.invoke('delete-entra-device', { deviceId: id })
        if (result.status === 'ok') {
          const idx = this.devices.findIndex((d) => d.id === id)
          if (idx !== -1) this.devices.splice(idx, 1)
          auth.addLog({ type: 'success', message: result.message || 'Entra-Gerät gelöscht' })
          auth.showToast(result.message || 'Entra-Gerät gelöscht', 'success')
          return true
        }
        auth.addLog({ type: 'error', message: result.message || 'Fehler' })
        auth.showToast(result.message || 'Fehler', 'error')
        return false
      } catch (e) {
        auth.addLog({ type: 'error', message: e.message })
        auth.showToast(e.message, 'error')
        return false
      }
    },

    // Fetches BitLocker recovery keys for an Entra device (by azureADDeviceId).
    async fetchBitlockerKeys(azureAdDeviceId) {
      const id = String(azureAdDeviceId || '').trim()
      if (!id) return { status: 'error', message: 'azureAdDeviceId erforderlich', keys: [] }
      try {
        return await window.ipcRenderer.invoke('get-bitlocker-keys', { azureAdDeviceId: id })
      } catch (e) {
        return { status: 'error', message: e.message, keys: [] }
      }
    },

    async wipeIntuneDevice({ azureAdDeviceId, intuneManagedDeviceId }) {
      const auth = useAuthStore()
      try {
        const result = await window.ipcRenderer.invoke('wipe-intune-device', {
          azureAdDeviceId,
          intuneManagedDeviceId: intuneManagedDeviceId || undefined
        })
        if (result.status === 'ok') {
          auth.showToast(result.message || 'Wipe ausgelöst', 'success')
          await this.refreshDevicesList()
          return true
        }
        auth.showToast(result.message || 'Fehler', 'error')
        return false
      } catch (e) {
        auth.showToast(e.message, 'error')
        return false
      }
    },

    // Sequential retire for multiple rows; one summary toast (no per-device toasts).
    async retireIntuneDevicesBatch(deviceRows, disableUserAccount) {
      const auth = useAuthStore()
      const rows = Array.isArray(deviceRows) ? deviceRows.filter((r) => r?.id) : []
      if (!rows.length) return { ok: 0, partial: 0, fail: 0 }
      let ok = 0
      let partial = 0
      let fail = 0
      for (const row of rows) {
        const label = row.displayName || row.id
        try {
          const result = await window.ipcRenderer.invoke('retire-intune-device', {
            azureAdDeviceId: row.deviceId || row.id,
            intuneManagedDeviceId: row.intuneManagedDeviceId || undefined,
            disableUserAccount: !!disableUserAccount,
            userUpn: row.ownerUserPrincipalName || undefined
          })
          if (result.status === 'ok') {
            ok++
            auth.addLog({ type: 'success', message: `${label}: ${result.message || 'OK'}` })
          } else if (result.status === 'partial') {
            partial++
            auth.addLog({ type: 'warning', message: `${label}: ${result.message || 'Teilweise'}` })
          } else {
            fail++
            auth.addLog({ type: 'error', message: `${label}: ${result.message || 'Fehler'}` })
          }
        } catch (e) {
          fail++
          auth.addLog({ type: 'error', message: `${label}: ${e.message}` })
        }
      }
      await this.refreshDevicesList()
      const parts = [`${ok} ok`]
      if (partial) parts.push(`${partial} teilweise`)
      if (fail) parts.push(`${fail} Fehler`)
      const msg = `Abkoppeln (Batch): ${parts.join(', ')}`
      if (fail && !ok && !partial) auth.showToast(msg, 'error')
      else if (fail || partial) auth.showToast(msg, 'warning')
      else auth.showToast(msg, 'success')
      return { ok, partial, fail }
    },

    // Removes devices fully from the tenant: Intune-managed -> retire (unenroll) then delete the Entra object;
    // Entra-only -> delete the directory object directly. Leaves no orphaned directory entry.
    async removeDevicesAutoBatch(deviceRows) {
      const auth = useAuthStore()
      const rows = Array.isArray(deviceRows) ? deviceRows.filter((r) => r?.id) : []
      if (!rows.length) return { ok: 0, fail: 0 }
      let ok = 0
      let fail = 0
      for (const row of rows) {
        const label = row.displayName || row.id
        try {
          // Intune-Geräte zuerst sauber aus dem Management lösen
          if (row.isIntuneManaged) {
            const retireRes = await window.ipcRenderer.invoke('retire-intune-device', {
              azureAdDeviceId: row.deviceId || row.id,
              intuneManagedDeviceId: row.intuneManagedDeviceId || undefined,
              disableUserAccount: false,
              userUpn: row.ownerUserPrincipalName || undefined
            })
            if (retireRes.status !== 'ok' && retireRes.status !== 'partial') {
              fail++
              auth.addLog({ type: 'error', message: `${label}: Retire fehlgeschlagen — ${retireRes.message || 'Fehler'}` })
              continue
            }
          }
          // Entra-Verzeichnisobjekt entfernen (für alle Geräte)
          const delRes = await window.ipcRenderer.invoke('delete-entra-device', { deviceId: row.id })
          if (delRes.status === 'ok') {
            ok++
            auth.addLog({ type: 'success', message: `${label}: aus Tenant entfernt${row.isIntuneManaged ? ' (Retire + Entra-Delete)' : ' (Entra-Delete)'}` })
          } else {
            fail++
            auth.addLog({ type: 'error', message: `${label}: Entra-Delete fehlgeschlagen — ${delRes.message || 'Fehler'}` })
          }
        } catch (e) {
          fail++
          auth.addLog({ type: 'error', message: `${label}: ${e.message}` })
        }
      }
      await this.refreshDevicesList()
      const msg = `Geräte entfernen (CSV): ${ok} ok${fail ? `, ${fail} Fehler` : ''}`
      auth.showToast(msg, fail && !ok ? 'error' : fail ? 'warning' : 'success')
      return { ok, fail }
    },

    // Adds device directory-object IDs to a group via the shared add-group-members handler.
    async addDevicesToGroup({ groupId, deviceIds }) {
      const auth = useAuthStore()
      const ids = (deviceIds || []).filter(Boolean)
      if (!groupId || !ids.length) {
        auth.showToast('Gruppe und Geräte erforderlich', 'error')
        return { ok: false, result: null }
      }
      auth.addLog({ type: 'info', message: `Füge ${ids.length} Geräte zur Gruppe hinzu...` })
      try {
        const result = await window.ipcRenderer.invoke('add-group-members', { groupId, userIds: ids })
        if (result.status === 'error') {
          auth.addLog({ type: 'error', message: result.message || 'Gruppenzuweisung fehlgeschlagen' })
          auth.showToast(result.message || 'Gruppenzuweisung fehlgeschlagen', 'error')
          return { ok: false, result }
        }
        const msg = result.message || `${result.added ?? 0} hinzugefügt`
        if (result.status === 'partial') {
          auth.addLog({ type: 'info', message: msg })
          auth.showToast(msg, 'warning')
        } else {
          auth.addLog({ type: 'success', message: msg })
          auth.showToast(msg, 'success')
        }
        return { ok: true, result }
      } catch (e) {
        auth.addLog({ type: 'error', message: e.message })
        auth.showToast(e.message, 'error')
        return { ok: false, result: null }
      }
    }
  }
})
