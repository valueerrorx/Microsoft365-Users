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
    lastFetched: null
  }),

  getters: {
    totalDevices: (state) => state.devices.length,
    // Counts Graph directory devices with isManaged true (MDM/Intune per Microsoft Graph).
    managedDevicesCount: (state) => state.devices.filter((d) => d.isManaged === true).length,
    // Counts devices where isCompliant is explicitly true (Intune/MDM compliance signal from Graph).
    compliantDevicesCount: (state) => state.devices.filter((d) => d.isCompliant === true).length
  },

  actions: {
    async fetchDevices() {
      if (devicesInflight) return devicesInflight
      const auth = useAuthStore()
      this.loading = true
      this.error = null
      auth.addLog({ type: 'info', message: 'Lade Geräte (Microsoft Graph)…' })
      devicesInflight = (async () => {
        try {
          const result = await window.ipcRenderer.invoke('get-devices')
          if (result.status === 'ok') {
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

    async retireIntuneDevice({ azureAdDeviceId, disableUserAccount, userUpn }) {
      const auth = useAuthStore()
      try {
        const result = await window.ipcRenderer.invoke('retire-intune-device', {
          azureAdDeviceId,
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

    async wipeIntuneDevice({ azureAdDeviceId }) {
      const auth = useAuthStore()
      try {
        const result = await window.ipcRenderer.invoke('wipe-intune-device', { azureAdDeviceId })
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
            azureAdDeviceId: row.id,
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
    }
  }
})
