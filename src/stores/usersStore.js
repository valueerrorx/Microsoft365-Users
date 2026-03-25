import { defineStore } from 'pinia'
import { useAuthStore } from './authStore'

export const useUsersStore = defineStore('users', {
  state: () => ({
    users: [],
    licenses: [],
    loading: false,
    error: null,
    lastFetched: null,
    csvEntries: [],
    bulkRunning: false,
    bulkLogs: [],
    failedUsers: []
  }),

  getters: {
    totalUsers: (state) => state.users.length,
    activeUsers: (state) => state.users.filter(u => u.accountEnabled).length,
    inactiveUsers: (state) => state.users.filter(u => !u.accountEnabled).length,
    licensedUsers: (state) => state.users.filter(u => u.assignedLicenses?.length > 0).length,

    licenseMap: (state) => {
      const map = {}
      for (const sku of state.licenses) {
        map[sku.skuId] = sku
      }
      return map
    }
  },

  actions: {
    async fetchUsers() {
      const auth = useAuthStore()
      this.loading = true
      this.error = null
      auth.addLog({ type: 'info', message: 'Lade Benutzerliste von Microsoft 365...' })
      try {
        const result = await window.ipcRenderer.invoke('get-users')
        if (result.status === 'ok') {
          this.users = result.users || []
          this.licenses = result.licenses || []
          this.lastFetched = new Date()
          auth.setConnected(result.tenantDomain || 'unbekannt')
          auth.addLog({ type: 'success', message: `${this.users.length} Benutzer geladen` })
          auth.showToast(`${this.users.length} Benutzer geladen`, 'success')
        } else {
          this.error = result.message
          auth.addLog({ type: 'error', message: `Fehler: ${result.message}` })
          auth.showToast(result.message, 'error')
        }
      } catch (e) {
        this.error = e.message
        auth.addLog({ type: 'error', message: e.message })
      } finally {
        this.loading = false
      }
    },

    async resetPassword(upn, newPassword, forceChange) {
      const auth = useAuthStore()
      auth.addLog({ type: 'info', message: `Passwort zurücksetzen für: ${upn}` })
      try {
        const result = await window.ipcRenderer.invoke('reset-password', { upn, newPassword, forceChange })
        if (result.status === 'ok') {
          auth.addLog({ type: 'success', message: `Passwort für ${upn} zurückgesetzt` })
          auth.showToast(`Passwort für ${upn} zurückgesetzt`, 'success')
          return true
        } else {
          auth.addLog({ type: 'error', message: `Fehler: ${result.message}` })
          auth.showToast(result.message, 'error')
          return false
        }
      } catch (e) {
        auth.addLog({ type: 'error', message: e.message })
        return false
      }
    },

    async resetMfa(upn) {
      const auth = useAuthStore()
      auth.addLog({ type: 'info', message: `MFA zurücksetzen für: ${upn}` })
      try {
        const result = await window.ipcRenderer.invoke('reset-mfa', { upn })
        if (result.status === 'ok') {
          auth.addLog({ type: 'success', message: `MFA für ${upn} zurückgesetzt` })
          auth.showToast(`MFA für ${upn} zurückgesetzt`, 'success')
          return true
        } else {
          auth.addLog({ type: 'error', message: `Fehler: ${result.message}` })
          auth.showToast(result.message, 'error')
          return false
        }
      } catch (e) {
        auth.addLog({ type: 'error', message: e.message })
        return false
      }
    },

    async updateUser(params) {
      const auth = useAuthStore()
      auth.addLog({ type: 'info', message: `Benutzer aktualisieren: ${params.upn}` })
      try {
        const result = await window.ipcRenderer.invoke('update-user', params)
        if (result.status === 'ok') {
          // Refresh user in local list
          const idx = this.users.findIndex(u => u.userPrincipalName === params.upn)
          if (idx !== -1) {
            this.users[idx] = { ...this.users[idx], ...result.user }
          }
          auth.addLog({ type: 'success', message: `Benutzer ${params.upn} aktualisiert` })
          auth.showToast(`Benutzer aktualisiert`, 'success')
          return true
        } else {
          auth.addLog({ type: 'error', message: `Fehler: ${result.message}` })
          auth.showToast(result.message, 'error')
          return false
        }
      } catch (e) {
        auth.addLog({ type: 'error', message: e.message })
        return false
      }
    },

    setCsvEntries(entries) {
      this.csvEntries = entries
    },

    async importCsv() {
      const auth = useAuthStore()
      const result = await window.ipcRenderer.invoke('open-csv-dialog')
      if (result.status === 'cancelled') return
      if (result.status === 'ok') {
        const dataResult = await window.ipcRenderer.invoke('get-csv-data')
        if (dataResult.status === 'ok') {
          this.csvEntries = dataResult.data
          auth.addLog({ type: 'success', message: `${dataResult.data.length} Einträge aus CSV importiert` })
          auth.showToast(`${dataResult.data.length} Einträge importiert`, 'success')
        }
      } else {
        auth.showToast(result.message || 'Importfehler', 'error')
      }
    },

    async runBulkCreate() {
      const auth = useAuthStore()
      this.bulkRunning = true
      this.bulkLogs = []
      this.failedUsers = []

      // Serialize to plain objects — Vue reactive proxies don't clone correctly over IPC
      const plainEntries = JSON.parse(JSON.stringify(this.csvEntries))

      auth.addLog({ type: 'info', message: `Starte Massenoperation für ${plainEntries.length} Benutzer...` })
      auth.addLog({ type: 'info', message: 'PowerShell wird gestartet — beim ersten Mal öffnet sich ein Browser zur Anmeldung.' })

      // Sync CSV data to main process
      const syncResult = await window.ipcRenderer.invoke('set-csv-data', plainEntries)
      if (syncResult.status !== 'ok' || syncResult.count === 0) {
        auth.addLog({ type: 'error', message: `Fehler: CSV-Daten konnten nicht übertragen werden (${syncResult.message || 'count=0'})` })
        auth.showToast('Fehler beim Übertragen der Daten', 'error')
        this.bulkRunning = false
        return
      }
      auth.addLog({ type: 'info', message: `${syncResult.count} Einträge übertragen, PowerShell läuft...` })

      try {
        const result = await window.ipcRenderer.invoke('run-password-update')
        this.failedUsers = result.failedUsers || []
        if (result.status === 'ok') {
          auth.addLog({ type: 'success', message: 'Massenoperation erfolgreich abgeschlossen.' })
          auth.showToast(`Operation erfolgreich abgeschlossen`, 'success')
        } else {
          const msg = result.message || 'Unbekannter Fehler'
          auth.addLog({ type: 'error', message: `Fehler: ${msg}` })
          auth.showToast(`Fehler: ${msg}`, 'error')
        }
      } catch (e) {
        auth.addLog({ type: 'error', message: `Exception: ${e.message}` })
        auth.showToast(e.message, 'error')
      } finally {
        this.bulkRunning = false
      }
    }
  }
})
