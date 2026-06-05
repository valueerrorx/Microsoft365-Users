// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) Mag. Thomas Michael Weissel <valueerror@gmail.com>

import { defineStore } from 'pinia'
import { resetAllDataStores } from './sessionReset.js'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    connected: false,
    tenantDomain: null,
    connecting: false,
    loggingOut: false,
    error: null,
    logs: [],
    toasts: [],
    deviceLoginCode: null
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
      this.deviceLoginCode = null
    },

    setDisconnected() {
      this.connected = false
      this.tenantDomain = null
      this.deviceLoginCode = null
    },

    setDeviceLoginCode(code) {
      this.deviceLoginCode = code ? String(code) : null
    },

    async clearLocalSession() {
      await resetAllDataStores()
      this.setDisconnected()
      this.clearLogs()
    },

    async logout() {
      if (this.loggingOut) return
      this.loggingOut = true
      try {
        if (typeof window !== 'undefined' && window.ipcRenderer?.invoke) {
          const result = await window.ipcRenderer.invoke('disconnect-ms365')
          if (result?.status === 'error') {
            this.showToast(result.message || 'Abmelden fehlgeschlagen', 'error')
          }
        }
        await this.clearLocalSession()
        this.showToast('Abgemeldet — beim nächsten Zugriff erneut anmelden.', 'success')
      } catch (e) {
        await this.clearLocalSession()
        this.showToast(e?.message || 'Abmelden fehlgeschlagen', 'error')
      } finally {
        this.loggingOut = false
      }
    }
  }
})
