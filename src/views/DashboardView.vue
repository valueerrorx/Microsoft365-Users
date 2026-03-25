<template>
  <div>
    <!-- Header -->
    <div class="page-header d-flex align-items-center justify-content-between">
      <div>
        <h1 class="page-title">Dashboard</h1>
        <p class="page-subtitle">Übersicht über Microsoft 365 Benutzer und Lizenzen</p>
      </div>
      <button class="btn btn-primary btn-sm" @click="loadUsers" :disabled="usersStore.loading">
        <i class="bi" :class="usersStore.loading ? 'bi-arrow-repeat spin' : 'bi-arrow-clockwise'"></i>
        {{ usersStore.loading ? 'Lädt...' : 'Benutzer laden' }}
      </button>
    </div>

    <!-- Connection Alert -->
    <div v-if="!authStore.connected && !usersStore.loading && !usersStore.users.length" class="alert-dark-info p-3 rounded mb-4 d-flex align-items-start gap-3">
      <i class="bi bi-info-circle-fill fs-5 mt-1" style="flex-shrink:0"></i>
      <div>
        <strong>Nicht verbunden</strong>
        <p class="mb-2 mt-1" style="font-size:0.85rem;color:#8b949e;">
          Klicke auf "Benutzer laden" um dich mit Microsoft 365 zu verbinden.
          Beim ersten Start öffnet sich ein Browser-Fenster zur Authentifizierung.
        </p>
        <button class="btn btn-primary btn-sm" @click="loadUsers" :disabled="usersStore.loading">
          <i class="bi bi-plug me-1"></i> Verbinden &amp; Laden
        </button>
      </div>
    </div>

    <!-- Error Alert -->
    <div v-if="usersStore.error" class="alert" style="background:rgba(248,81,73,0.1);border:1px solid rgba(248,81,73,0.25);color:#f85149;border-radius:6px;" role="alert">
      <i class="bi bi-exclamation-triangle-fill me-2"></i>
      {{ usersStore.error }}
    </div>

    <!-- Stats Cards -->
    <div class="row g-3 mb-4">
      <div class="col-6 col-lg-3">
        <div class="stat-card">
          <div class="d-flex align-items-center gap-3">
            <div class="stat-icon" style="background:rgba(88,166,255,0.12);color:#58a6ff;">
              <i class="bi bi-people-fill"></i>
            </div>
            <div>
              <div class="stat-value">{{ usersStore.loading ? '—' : usersStore.totalUsers }}</div>
              <div class="stat-label">Gesamt</div>
            </div>
          </div>
        </div>
      </div>
      <div class="col-6 col-lg-3">
        <div class="stat-card">
          <div class="d-flex align-items-center gap-3">
            <div class="stat-icon" style="background:rgba(63,185,80,0.12);color:#3fb950;">
              <i class="bi bi-person-check-fill"></i>
            </div>
            <div>
              <div class="stat-value">{{ usersStore.loading ? '—' : usersStore.activeUsers }}</div>
              <div class="stat-label">Aktiv</div>
            </div>
          </div>
        </div>
      </div>
      <div class="col-6 col-lg-3">
        <div class="stat-card">
          <div class="d-flex align-items-center gap-3">
            <div class="stat-icon" style="background:rgba(248,81,73,0.12);color:#f85149;">
              <i class="bi bi-person-x-fill"></i>
            </div>
            <div>
              <div class="stat-value">{{ usersStore.loading ? '—' : usersStore.inactiveUsers }}</div>
              <div class="stat-label">Deaktiviert</div>
            </div>
          </div>
        </div>
      </div>
      <div class="col-6 col-lg-3">
        <div class="stat-card">
          <div class="d-flex align-items-center gap-3">
            <div class="stat-icon" style="background:rgba(210,153,34,0.12);color:#d29922;">
              <i class="bi bi-award-fill"></i>
            </div>
            <div>
              <div class="stat-value">{{ usersStore.loading ? '—' : usersStore.licensedUsers }}</div>
              <div class="stat-label">Lizenziert</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Quick Actions + License Overview -->
    <div class="row g-3">
      <!-- Quick Actions -->
      <div class="col-lg-5">
        <div class="content-card h-100">
          <div class="content-card-header">
            <span style="font-weight:600;font-size:0.9rem;">Schnellzugriff</span>
          </div>
          <div class="content-card-body d-flex flex-column gap-2">
            <RouterLink to="/users" class="d-flex align-items-center gap-3 p-3 rounded" style="text-decoration:none;background:rgba(88,166,255,0.06);border:1px solid rgba(88,166,255,0.15);transition:all 0.15s;">
              <div style="width:36px;height:36px;background:rgba(88,166,255,0.12);border-radius:8px;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                <i class="bi bi-people" style="color:#58a6ff;font-size:1.1rem;"></i>
              </div>
              <div>
                <div style="font-size:0.875rem;font-weight:600;color:#e6edf3;">Benutzerliste verwalten</div>
                <div style="font-size:0.775rem;color:#8b949e;">Benutzer ansehen, bearbeiten, Passwort & MFA verwalten</div>
              </div>
              <i class="bi bi-chevron-right ms-auto" style="color:#58a6ff;"></i>
            </RouterLink>

            <RouterLink to="/create" class="d-flex align-items-center gap-3 p-3 rounded" style="text-decoration:none;background:rgba(63,185,80,0.06);border:1px solid rgba(63,185,80,0.15);transition:all 0.15s;">
              <div style="width:36px;height:36px;background:rgba(63,185,80,0.12);border-radius:8px;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                <i class="bi bi-person-plus" style="color:#3fb950;font-size:1.1rem;"></i>
              </div>
              <div>
                <div style="font-size:0.875rem;font-weight:600;color:#e6edf3;">Benutzer erstellen</div>
                <div style="font-size:0.775rem;color:#8b949e;">Einzeln oder per CSV-Import erstellen</div>
              </div>
              <i class="bi bi-chevron-right ms-auto" style="color:#3fb950;"></i>
            </RouterLink>

            <div class="d-flex align-items-center gap-3 p-3 rounded" style="background:rgba(210,153,34,0.06);border:1px solid rgba(210,153,34,0.15);cursor:pointer;" @click="loadUsers">
              <div style="width:36px;height:36px;background:rgba(210,153,34,0.12);border-radius:8px;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                <i class="bi bi-arrow-repeat" style="color:#d29922;font-size:1.1rem;" :class="{ spin: usersStore.loading }"></i>
              </div>
              <div>
                <div style="font-size:0.875rem;font-weight:600;color:#e6edf3;">Daten aktualisieren</div>
                <div style="font-size:0.775rem;color:#8b949e;">Benutzerliste neu von MS365 laden</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Licenses -->
      <div class="col-lg-7">
        <div class="content-card h-100">
          <div class="content-card-header">
            <span style="font-weight:600;font-size:0.9rem;">Verfügbare Lizenzen</span>
            <span style="font-size:0.78rem;color:#8b949e;">{{ usersStore.licenses.length }} SKUs</span>
          </div>
          <div class="content-card-body">
            <div v-if="!usersStore.licenses.length" style="color:#8b949e;font-size:0.85rem;text-align:center;padding:1.5rem 0;">
              <i class="bi bi-award fs-3 d-block mb-2"></i>
              Noch keine Lizenzdaten geladen
            </div>
            <div v-else class="d-flex flex-column gap-2">
              <div v-for="sku in usersStore.licenses.slice(0, 8)" :key="sku.skuId"
                class="d-flex align-items-center justify-content-between p-2 rounded"
                style="background:rgba(88,166,255,0.04);border:1px solid rgba(88,166,255,0.1);">
                <div>
                  <div style="font-size:0.82rem;font-weight:500;color:#e6edf3;">{{ sku.skuPartNumber }}</div>
                  <div style="font-size:0.72rem;color:#8b949e;">{{ sku.consumedUnits }} / {{ sku.prepaidUnits?.enabled || '?' }} genutzt</div>
                </div>
                <div class="text-end">
                  <div style="font-size:0.75rem;color:#58a6ff;">
                    {{ sku.prepaidUnits?.enabled ? (sku.prepaidUnits.enabled - sku.consumedUnits) : '?' }} frei
                  </div>
                  <div style="width:80px;height:4px;background:#21262d;border-radius:2px;margin-top:4px;">
                    <div style="height:100%;border-radius:2px;"
                      :style="{
                        width: sku.prepaidUnits?.enabled ? Math.round(sku.consumedUnits / sku.prepaidUnits.enabled * 100) + '%' : '0%',
                        background: licenseBarColor(sku)
                      }"></div>
                  </div>
                </div>
              </div>
              <div v-if="usersStore.licenses.length > 8" style="font-size:0.78rem;color:#8b949e;text-align:center;">
                + {{ usersStore.licenses.length - 8 }} weitere
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useAuthStore } from '../stores/authStore'
import { useUsersStore } from '../stores/usersStore'

const authStore = useAuthStore()
const usersStore = useUsersStore()

function loadUsers() {
  if (!usersStore.loading) usersStore.fetchUsers()
}

function licenseBarColor(sku) {
  if (!sku.prepaidUnits?.enabled) return '#58a6ff'
  const pct = sku.consumedUnits / sku.prepaidUnits.enabled
  if (pct >= 0.9) return '#f85149'
  if (pct >= 0.7) return '#d29922'
  return '#3fb950'
}
</script>

<style scoped>
.spin { animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
</style>
