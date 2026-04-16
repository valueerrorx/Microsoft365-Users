<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- Copyright (C) Mag. Thomas Michael Weissel <valueerror@gmail.com> -->

<template>
  <div :class="hintsPosition === 'side' ? 'pi-wrap-side' : ''">
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

      <div v-if="$slots.below" class="mt-2">
        <slot name="below" />
      </div>

      <div v-if="modelValue && hintsPosition !== 'side'" class="mt-1">
        <div style="height:3px;background:#21262d;border-radius:2px;overflow:hidden;">
          <div
            style="height:100%;border-radius:2px;transition:width 0.2s,background 0.2s;"
            :style="{ width: (v.strength / 4 * 100) + '%', background: strengthColors[v.strength] }"
          ></div>
        </div>
      </div>
    </div>

    <div :class="hintsPosition === 'side' ? 'pi-hints-side' : 'mt-1'" :style="{ visibility: modelValue ? 'visible' : 'hidden' }">
      <div v-if="hintsPosition === 'side' && modelValue" style="margin-bottom:0.35rem;">
        <div style="height:3px;background:#21262d;border-radius:2px;overflow:hidden;">
          <div
            style="height:100%;border-radius:2px;transition:width 0.2s,background 0.2s;"
            :style="{ width: (v.strength / 4 * 100) + '%', background: strengthColors[v.strength] }"
          ></div>
        </div>
      </div>
      <div class="d-flex justify-content-between align-items-start gap-2 flex-wrap">
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
        <span style="font-size:0.72rem;font-weight:600;" :style="{ color: strengthColors[v.strength] }">
          {{ strengthLabels[v.strength] }}
        </span>
      </div>
      <div v-if="!v.valid && v.minLength" style="font-size:0.72rem;color:#d29922;margin-top:0.2rem;">
        8+ Zeichen und mind. 3 von 4 Kategorien erforderlich
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { validatePassword, strengthLabels, strengthColors } from '../utils/passwordValidator.js'

const props = defineProps({
  modelValue: { type: String, default: '' },
  placeholder: { type: String, default: 'Mindestens 8 Zeichen...' },
  hintsPosition: { type: String, default: 'below' }
})
defineEmits(['update:modelValue'])

const show = ref(false)
const v = computed(() => validatePassword(props.modelValue))
</script>

<style scoped>
.pi-wrap-side { display: grid; grid-template-columns: minmax(240px, 1fr) minmax(220px, 1fr); gap: 0.75rem; align-items: start; }
.pi-hints-side { padding-top: 0.15rem; min-height: 6.1rem; }
.pi-wrap-side .mt-1 { margin-top: 0 !important; }
.req-ok   { color: #3fb950; }
.req-fail { color: #484f58; }
</style>
