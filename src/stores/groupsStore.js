import { defineStore } from 'pinia'
import { useAuthStore } from './authStore'

let groupsDetailInflight = null

export const useGroupsStore = defineStore('groups', {
  state: () => ({
    groups: [],
    loading: false,
    error: null,
    lastFetched: null,
    lifecyclePolicy: null,
    lifecycleLoading: false
  }),

  getters: {
    totalGroups: (state) => state.groups.length
  },

  actions: {
    async fetchGroupsDetail() {
      if (groupsDetailInflight) return groupsDetailInflight
      const auth = useAuthStore()
      this.loading = true
      this.error = null
      auth.addLog({ type: 'info', message: 'Lade Gruppen (Detail, kann bei vielen Gruppen dauern)...' })
      groupsDetailInflight = (async () => {
        try {
          const result = await window.ipcRenderer.invoke('get-groups-detail')
          if (result.status === 'ok') {
            this.groups = result.groups || []
            this.lastFetched = new Date()
            auth.addLog({ type: 'success', message: `${this.groups.length} Gruppen geladen` })
            auth.showToast(`${this.groups.length} Gruppen geladen`, 'success')
          } else {
            this.error = result.message
            this.groups = []
            auth.addLog({ type: 'error', message: result.message })
            auth.showToast(result.message, 'error')
          }
        } catch (e) {
          this.error = e.message
          this.groups = []
          auth.addLog({ type: 'error', message: e.message })
          auth.showToast(e.message, 'error')
        } finally {
          this.loading = false
          groupsDetailInflight = null
        }
      })()
      return groupsDetailInflight
    },

    async fetchGroupOwners(groupId) {
      const g = this.groups.find((x) => x.id === groupId)
      if (!g) return { status: 'error', ownerEmails: [] }
      if (g.ownersDetailLoaded) return { status: 'ok', ownerEmails: g.ownerEmails || [] }
      const result = await window.ipcRenderer.invoke('get-group-owners', { groupId })
      if (result.status === 'ok') {
        g.ownerEmails = result.ownerEmails || []
        g.ownersDetailLoaded = true
      }
      return result
    },

    async fetchGroupMembers(groupId) {
      return await window.ipcRenderer.invoke('get-group-members', { groupId })
    },

    async updateGroup({ groupId, displayName, description }) {
      const auth = useAuthStore()
      try {
        const result = await window.ipcRenderer.invoke('update-group', { groupId, displayName, description })
        if (result.status === 'ok') {
          const g = this.groups.find((x) => x.id === groupId)
          if (g) {
            if (displayName !== undefined) g.displayName = displayName
            if (description !== undefined) g.description = description
          }
          auth.showToast('Gruppe aktualisiert', 'success')
          return true
        }
        auth.showToast(result.message, 'error')
        return false
      } catch (e) {
        auth.showToast(e.message, 'error')
        return false
      }
    },

    async deleteGroup(groupId) {
      const auth = useAuthStore()
      try {
        const result = await window.ipcRenderer.invoke('delete-group', { groupId })
        if (result.status === 'ok') {
          this.groups = this.groups.filter((g) => g.id !== groupId)
          auth.showToast('Gruppe gelöscht', 'success')
          return true
        }
        auth.showToast(result.message, 'error')
        return false
      } catch (e) {
        auth.showToast(e.message, 'error')
        return false
      }
    },

    async removeGroupMember({ groupId, memberId }) {
      const auth = useAuthStore()
      try {
        const result = await window.ipcRenderer.invoke('remove-group-member', { groupId, memberId })
        if (result.status === 'ok') {
          auth.showToast('Mitglied entfernt', 'success')
          return true
        }
        auth.showToast(result.message, 'error')
        return false
      } catch (e) {
        auth.showToast(e.message, 'error')
        return false
      }
    },

    async addMembersToGroup({ groupId, userIds }) {
      const auth = useAuthStore()
      const result = await window.ipcRenderer.invoke('add-group-members', { groupId, userIds })
      if (result.status === 'error') {
        auth.showToast(result.message, 'error')
        return { ok: false, result }
      }
      const msg = result.message || 'Mitglieder aktualisiert'
      if (result.status === 'partial') auth.showToast(msg, 'warning')
      else auth.showToast(msg, 'success')
      return { ok: true, result }
    },

    async listLifecyclePoliciesForGroup(groupId) {
      const gid = String(groupId || '').trim()
      if (!gid) return { status: 'error', message: 'groupId fehlt', policies: [] }
      try {
        return await window.ipcRenderer.invoke('list-group-lifecycle-policies-for-group', { groupId: gid })
      } catch (e) {
        return { status: 'error', message: e.message, policies: [] }
      }
    },

    async fetchLifecyclePolicies() {
      const auth = useAuthStore()
      this.lifecycleLoading = true
      try {
        const result = await window.ipcRenderer.invoke('list-group-lifecycle-policies')
        if (result.status === 'ok') {
          const list = result.policies || []
          this.lifecyclePolicy = list[0] || null
        } else {
          this.lifecyclePolicy = null
          auth.addLog({ type: 'error', message: result.message })
          auth.showToast(result.message, 'error')
        }
      } catch (e) {
        this.lifecyclePolicy = null
        auth.showToast(e.message, 'error')
      } finally {
        this.lifecycleLoading = false
      }
    },

    async saveLifecyclePolicy({ policyId, groupLifetimeInDays, managedGroupTypes, alternateNotificationEmails }) {
      const auth = useAuthStore()
      try {
        const mode = policyId ? 'update' : 'create'
        const result = await window.ipcRenderer.invoke('save-group-lifecycle-policy', {
          mode,
          policyId,
          groupLifetimeInDays,
          managedGroupTypes,
          alternateNotificationEmails
        })
        if (result.status === 'ok' && result.policy) {
          this.lifecyclePolicy = result.policy
          auth.showToast(result.message || 'Ablaufrichtlinie gespeichert', 'success')
          return true
        }
        auth.showToast(result.message || 'Fehler', 'error')
        return false
      } catch (e) {
        auth.showToast(e.message, 'error')
        return false
      }
    },

    async addGroupsToLifecyclePolicy({ policyId, groupIds }) {
      const auth = useAuthStore()
      try {
        const result = await window.ipcRenderer.invoke('add-groups-to-lifecycle-policy', { policyId, groupIds })
        if (result.status === 'ok' || result.status === 'partial') {
          const msg = result.message || 'Gruppen zugeordnet'
          if (result.status === 'partial') auth.showToast(msg, 'warning')
          else auth.showToast(msg, 'success')
          await this.fetchGroupsDetail()
          return { ok: true, result }
        }
        auth.showToast(result.message || 'Zuordnung fehlgeschlagen', 'error')
        return { ok: false, result }
      } catch (e) {
        auth.showToast(e.message, 'error')
        return { ok: false, result: null }
      }
    },

    async removeGroupsFromLifecyclePolicy({ policyId, groupIds }) {
      const auth = useAuthStore()
      try {
        const result = await window.ipcRenderer.invoke('remove-groups-from-lifecycle-policy', { policyId, groupIds })
        if (result.status === 'ok' || result.status === 'partial') {
          const msg = result.message || 'Aus Ablaufrichtlinie entfernt'
          if (result.status === 'partial') auth.showToast(msg, 'warning')
          else auth.showToast(msg, 'success')
          await this.fetchGroupsDetail()
          return { ok: true, result }
        }
        auth.showToast(result.message || 'Entfernen fehlgeschlagen', 'error')
        return { ok: false, result }
      } catch (e) {
        auth.showToast(e.message, 'error')
        return { ok: false, result: null }
      }
    }
  }
})
