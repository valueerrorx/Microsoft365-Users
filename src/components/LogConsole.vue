<template>
  <div class="log-console">
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
    <div v-show="expanded" class="log-console-body" ref="logBody">
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
import { ref, watch, nextTick } from 'vue'
import { useAuthStore } from '../stores/authStore'

const authStore = useAuthStore()
const expanded = ref(true)
const logBody = ref(null)

watch(() => authStore.logs.length, async () => {
  if (expanded.value) {
    await nextTick()
    if (logBody.value) logBody.value.scrollTop = logBody.value.scrollHeight
  } else if (authStore.logs.length > 0) {
    // Auto-open when new logs arrive
    expanded.value = true
  }
})
</script>
