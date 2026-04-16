<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- Copyright (C) Mag. Thomas Michael Weissel <valueerror@gmail.com> -->

<template>
  <div class="log-console">
    <div
      v-show="expanded"
      class="log-console-resize-handle"
      title="Höhe ziehen"
      @mousedown.prevent="onResizeStart"
    />
    <div class="log-console-header" @click="expanded = !expanded">
      <div class="d-flex align-items-center gap-2">
        <i class="bi bi-terminal-fill" style="color:#58a6ff;font-size:0.8rem;"></i>
        <span>Ausgabe</span>
        <span v-if="authStore.logs.length" style="color:#484f58;">({{ authStore.logs.length }})</span>
      </div>
      <div class="d-flex align-items-center gap-3">
        <span
          v-if="authStore.logs.length"
          @click.stop="authStore.clearLogs()"
          style="cursor:pointer;color:#484f58;font-size:0.72rem;"
          title="Löschen"
        >Leeren</span>
        <i class="bi" :class="expanded ? 'bi-chevron-down' : 'bi-chevron-up'"></i>
      </div>
    </div>
    <div
      v-show="expanded"
      class="log-console-body"
      ref="logBody"
      :style="{ height: `${bodyHeightPx}px` }"
    >
      <div
        v-for="(log, i) in authStore.logs"
        :key="i"
        class="log-entry"
        :class="`log-${log.type || 'info'}`"
      >
        <span class="log-timestamp">{{ log.timestamp }}</span>{{ log.message }}
      </div>
      <div v-if="!authStore.logs.length" style="color:#484f58;font-size:0.75rem;">
        Noch keine Ausgaben...
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { useAuthStore } from '../stores/authStore'

const STORAGE_KEY = 'ms365-log-console-body-height'
const DEFAULT_HEIGHT = 150
const MIN_HEIGHT = 64

const authStore = useAuthStore()
const expanded = ref(true)
const logBody = ref(null)
const bodyHeightPx = ref(DEFAULT_HEIGHT)

function maxBodyHeight() {
  return Math.max(MIN_HEIGHT, Math.floor(window.innerHeight * 0.82) - 140)
}

function clampBody(h) {
  return Math.min(Math.max(h, MIN_HEIGHT), maxBodyHeight())
}

let resizing = false
let startY = 0
let startH = 0

function onResizeStart(e) {
  resizing = true
  startY = e.clientY
  startH = bodyHeightPx.value
  window.addEventListener('mousemove', onResizeMove)
  window.addEventListener('mouseup', onResizeEnd)
  document.body.style.cursor = 'ns-resize'
  document.body.style.userSelect = 'none'
}

function onResizeMove(e) {
  if (!resizing) return
  bodyHeightPx.value = clampBody(startH + (startY - e.clientY))
}

function onResizeEnd() {
  resizing = false
  window.removeEventListener('mousemove', onResizeMove)
  window.removeEventListener('mouseup', onResizeEnd)
  document.body.style.cursor = ''
  document.body.style.userSelect = ''
  try {
    localStorage.setItem(STORAGE_KEY, String(bodyHeightPx.value))
  } catch {}
}

function onWindowResize() {
  bodyHeightPx.value = clampBody(bodyHeightPx.value)
}

onMounted(() => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const n = raw ? parseInt(raw, 10) : NaN
    bodyHeightPx.value = clampBody(Number.isFinite(n) ? n : DEFAULT_HEIGHT)
  } catch {
    bodyHeightPx.value = clampBody(DEFAULT_HEIGHT)
  }
  window.addEventListener('resize', onWindowResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', onWindowResize)
  window.removeEventListener('mousemove', onResizeMove)
  window.removeEventListener('mouseup', onResizeEnd)
  document.body.style.cursor = ''
  document.body.style.userSelect = ''
})

watch(() => authStore.logs.length, async () => {
  if (expanded.value) {
    await nextTick()
    if (logBody.value) logBody.value.scrollTop = logBody.value.scrollHeight
  } else if (authStore.logs.length > 0) {
    expanded.value = true
  }
})
</script>
