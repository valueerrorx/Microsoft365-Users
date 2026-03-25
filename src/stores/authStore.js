import { defineStore } from 'pinia'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    connected: false,
    tenantDomain: null,
    connecting: false,
    error: null,
    logs: [],
    toasts: []
  }),

  actions: {
    addLog(log) {
      this.logs.push({
        ...log,
        timestamp: new Date().toLocaleTimeString('de-AT', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      })
      if (this.logs.length > 300) this.logs.splice(0, 100)
    },

    clearLogs() {
      this.logs = []
    },

    showToast(message, type = 'info', duration = 4000) {
      const id = Date.now() + Math.random()
      this.toasts.push({ id, message, type })
      setTimeout(() => {
        this.toasts = this.toasts.filter(t => t.id !== id)
      }, duration)
    },

    setConnected(domain) {
      this.connected = true
      this.tenantDomain = domain
      this.error = null
    },

    setDisconnected() {
      this.connected = false
      this.tenantDomain = null
    }
  }
})
