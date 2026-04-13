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
    failedUsers: [],
    failedUserDetails: {},
    directoryGroups: [],
    directoryGroupsLoading: false,
    directoryGroupsError: null
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
          this.licenses = [...(result.licenses || [])].sort((a, b) => {
            const ac = Number.isFinite(a?.consumedUnits) ? a.consumedUnits : 0
            const bc = Number.isFinite(b?.consumedUnits) ? b.consumedUnits : 0
            if (bc !== ac) return bc - ac
            return String(a?.skuPartNumber || '').localeCompare(String(b?.skuPartNumber || ''))
          })
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

    async resetMfa(upn, opts = {}) {
      const quietToast = opts.quietToast === true
      const auth = useAuthStore()
      auth.addLog({ type: 'info', message: `MFA zurücksetzen für: ${upn}` })
      try {
        const result = await window.ipcRenderer.invoke('reset-mfa', { upn })
        if (result.status === 'ok') {
          auth.addLog({ type: 'success', message: `MFA für ${upn} zurückgesetzt` })
          if (!quietToast) auth.showToast(`MFA für ${upn} zurückgesetzt`, 'success')
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

    async updateUser(params, opts = {}) {
      const quietToast = opts.quietToast === true
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
          if (!quietToast) auth.showToast(`Benutzer aktualisiert`, 'success')
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

    async updateUserLicenses({ upn, addSkuIds, removeSkuIds }) {
      const auth = useAuthStore()
      auth.addLog({ type: 'info', message: `Lizenzen aktualisieren: ${upn}` })
      try {
        const result = await window.ipcRenderer.invoke('update-user-licenses', {
          upn,
          addSkuIds: addSkuIds || [],
          removeSkuIds: removeSkuIds || []
        })
        if (result.status === 'ok') {
          const idx = this.users.findIndex(u => u.userPrincipalName === upn)
          const list = result.assignedLicenses || result.AssignedLicenses
          if (idx !== -1 && list) {
            this.users[idx].assignedLicenses = list
          }
          auth.addLog({ type: 'success', message: `Lizenzen für ${upn} aktualisiert` })
          auth.showToast('Lizenzen aktualisiert', 'success')
          return true
        }
        auth.addLog({ type: 'error', message: `Fehler: ${result.message}` })
        auth.showToast(result.message, 'error')
        return false
      } catch (e) {
        auth.addLog({ type: 'error', message: e.message })
        auth.showToast(e.message, 'error')
        return false
      }
    },

    async deleteUser(upn, opts = {}) {
      const quietToast = opts.quietToast === true
      const auth = useAuthStore()
      auth.addLog({ type: 'info', message: `Benutzer löschen: ${upn}` })
      try {
        const result = await window.ipcRenderer.invoke('delete-user', { upn })
        if (result.status === 'ok') {
          const idx = this.users.findIndex(u => u.userPrincipalName === upn)
          if (idx !== -1) this.users.splice(idx, 1)
          auth.addLog({ type: 'success', message: `Benutzer gelöscht: ${upn}` })
          if (!quietToast) auth.showToast(`Benutzer gelöscht`, 'success')
          return true
        }
        auth.addLog({ type: 'error', message: `Fehler: ${result.message}` })
        auth.showToast(result.message, 'error')
        return false
      } catch (e) {
        auth.addLog({ type: 'error', message: e.message })
        auth.showToast(e.message, 'error')
        return false
      }
    },

    async fetchDirectoryGroups() {
      const auth = useAuthStore()
      this.directoryGroupsLoading = true
      this.directoryGroupsError = null
      auth.addLog({ type: 'info', message: 'Lade Verzeichnisgruppen...' })
      try {
        const result = await window.ipcRenderer.invoke('get-directory-groups')
        if (result.status === 'ok') {
          const list = result.groups || []
          this.directoryGroups = [...list].sort((a, b) =>
            String(a?.displayName || '').localeCompare(String(b?.displayName || ''), undefined, { sensitivity: 'base' })
          )
          auth.addLog({ type: 'success', message: `${this.directoryGroups.length} Gruppen geladen` })
          return true
        }
        this.directoryGroups = []
        this.directoryGroupsError = result.message || 'Gruppen konnten nicht geladen werden'
        auth.addLog({ type: 'error', message: this.directoryGroupsError })
        auth.showToast(this.directoryGroupsError, 'error')
        return false
      } catch (e) {
        this.directoryGroups = []
        this.directoryGroupsError = e.message
        auth.addLog({ type: 'error', message: e.message })
        auth.showToast(e.message, 'error')
        return false
      } finally {
        this.directoryGroupsLoading = false
      }
    },

    async addUsersToGroup({ groupId, userIds }) {
      const auth = useAuthStore()
      const ids = (userIds || []).filter(Boolean)
      if (!groupId || !ids.length) {
        auth.showToast('Gruppe und Benutzer-IDs erforderlich', 'error')
        return { ok: false, result: null }
      }
      auth.addLog({ type: 'info', message: `Füge ${ids.length} Benutzer zur Gruppe hinzu...` })
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
      this.failedUserDetails = {}

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
        this.failedUserDetails = result.failedUserDetails || {}
        if (result.status === 'ok') {
          auth.addLog({ type: 'success', message: 'Massenoperation erfolgreich abgeschlossen.' })
          auth.showToast(`Operation erfolgreich abgeschlossen`, 'success')
        } else {
          const msg = result.message || (this.failedUsers.length ? 'Ein oder mehrere Benutzer sind fehlgeschlagen' : 'Unbekannter Fehler')
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
