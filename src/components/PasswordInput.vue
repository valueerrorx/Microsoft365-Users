<template>
  <div>
    <div class="input-group">
      <input
        :value="modelValue"
        @input="$emit('update:modelValue', $event.target.value)"
        :type="show ? 'text' : 'password'"
        class="form-control"
        :class="modelValue && !v.valid ? 'border-warning' : modelValue && v.valid ? 'border-success' : ''"
        :placeholder="placeholder"
      />
      <button class="btn btn-outline-secondary" type="button" @click="show = !show" tabindex="-1">
        <i class="bi" :class="show ? 'bi-eye-slash' : 'bi-eye'"></i>
      </button>
    </div>

    <!-- Strength bar -->
    <div v-if="modelValue" class="mt-1">
      <div style="height:3px;background:#21262d;border-radius:2px;overflow:hidden;">
        <div
          style="height:100%;border-radius:2px;transition:width 0.2s,background 0.2s;"
          :style="{ width: (v.strength / 4 * 100) + '%', background: strengthColors[v.strength] }"
        ></div>
      </div>
      <div class="d-flex justify-content-between align-items-start mt-1 gap-2 flex-wrap">
        <!-- Requirements checklist -->
        <div style="font-size:0.72rem;display:flex;gap:0.5rem;flex-wrap:wrap;">
          <span :class="v.minLength ? 'req-ok' : 'req-fail'">
            <i class="bi" :class="v.minLength ? 'bi-check2' : 'bi-x'"></i> 8+ Zeichen
          </span>
          <span :class="v.hasUpper ? 'req-ok' : 'req-fail'">
            <i class="bi" :class="v.hasUpper ? 'bi-check2' : 'bi-x'"></i> Großbuchstabe
          </span>
          <span :class="v.hasLower ? 'req-ok' : 'req-fail'">
            <i class="bi" :class="v.hasLower ? 'bi-check2' : 'bi-x'"></i> Kleinbuchstabe
          </span>
          <span :class="v.hasDigit ? 'req-ok' : 'req-fail'">
            <i class="bi" :class="v.hasDigit ? 'bi-check2' : 'bi-x'"></i> Ziffer
          </span>
          <span :class="v.hasSpecial ? 'req-ok' : 'req-fail'">
            <i class="bi" :class="v.hasSpecial ? 'bi-check2' : 'bi-x'"></i> Sonderzeichen
          </span>
        </div>
        <!-- Strength label -->
        <span style="font-size:0.72rem;font-weight:600;" :style="{ color: strengthColors[v.strength] }">
          {{ strengthLabels[v.strength] }}
        </span>
      </div>
      <div v-if="!v.valid && v.minLength" style="font-size:0.72rem;color:#d29922;margin-top:0.2rem;">
        Mind. 3 von 4 Kategorien erforderlich ({{ v.categories }}/3 erfüllt)
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { validatePassword, strengthLabels, strengthColors } from '../utils/passwordValidator.js'

const props = defineProps({
  modelValue: { type: String, default: '' },
  placeholder: { type: String, default: 'Mindestens 8 Zeichen...' }
})
defineEmits(['update:modelValue'])

const show = ref(false)
const v = computed(() => validatePassword(props.modelValue))
</script>

<style scoped>
.req-ok   { color: #3fb950; }
.req-fail { color: #484f58; }
</style>
