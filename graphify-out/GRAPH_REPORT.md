# Graph Report - Microsoft365-Manager  (2026-06-08)

## Corpus Check
- 62 files · ~54,437 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 597 nodes · 632 edges · 109 communities (87 shown, 22 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 5 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `4a502fdb`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 34|Community 34]]
- [[_COMMUNITY_Community 35|Community 35]]
- [[_COMMUNITY_Community 36|Community 36]]
- [[_COMMUNITY_Community 37|Community 37]]
- [[_COMMUNITY_Community 38|Community 38]]
- [[_COMMUNITY_Community 39|Community 39]]
- [[_COMMUNITY_Community 40|Community 40]]
- [[_COMMUNITY_Community 41|Community 41]]
- [[_COMMUNITY_Community 42|Community 42]]
- [[_COMMUNITY_Community 43|Community 43]]
- [[_COMMUNITY_Community 44|Community 44]]
- [[_COMMUNITY_Community 45|Community 45]]
- [[_COMMUNITY_Community 46|Community 46]]
- [[_COMMUNITY_Community 47|Community 47]]
- [[_COMMUNITY_Community 48|Community 48]]
- [[_COMMUNITY_Community 49|Community 49]]
- [[_COMMUNITY_Community 50|Community 50]]
- [[_COMMUNITY_Community 51|Community 51]]
- [[_COMMUNITY_Community 52|Community 52]]
- [[_COMMUNITY_Community 53|Community 53]]
- [[_COMMUNITY_Community 54|Community 54]]
- [[_COMMUNITY_Community 55|Community 55]]
- [[_COMMUNITY_Community 57|Community 57]]
- [[_COMMUNITY_Community 58|Community 58]]
- [[_COMMUNITY_Community 59|Community 59]]
- [[_COMMUNITY_Community 60|Community 60]]
- [[_COMMUNITY_Community 61|Community 61]]
- [[_COMMUNITY_Community 62|Community 62]]
- [[_COMMUNITY_Community 63|Community 63]]
- [[_COMMUNITY_Community 66|Community 66]]
- [[_COMMUNITY_Community 67|Community 67]]
- [[_COMMUNITY_Community 74|Community 74]]
- [[_COMMUNITY_Community 78|Community 78]]
- [[_COMMUNITY_Community 83|Community 83]]
- [[_COMMUNITY_Community 84|Community 84]]
- [[_COMMUNITY_Community 86|Community 86]]
- [[_COMMUNITY_Community 89|Community 89]]

## God Nodes (most connected - your core abstractions)
1. `MS-365 Benutzer-Verwaltungs Tool` - 13 edges
2. `MS-365 Benutzer-Verwaltungs Tool` - 13 edges
3. `build` - 12 edges
4. `Project: MS-365 User Management Dashboard (Electron + Vue + PowerShell/Graph)` - 12 edges
5. `Project: MS-365 User Management Dashboard (Electron + Vue + PowerShell/Graph)` - 12 edges
6. `resetAllDataStores()` - 10 edges
7. `authDebug()` - 9 edges
8. `runPsScriptBody()` - 9 edges
9. `scripts` - 9 edges
10. `linux` - 9 edges

## Surprising Connections (you probably didn't know these)
- `Connect-Mg365App()` --calls--> `Ensure-Mg365GraphModule()`  [INFERRED]
  scripts/Connect-Mg365App.ps1 → scripts/Mg365-GraphModules.ps1
- `resetAllDataStores()` --calls--> `useDevicesStore`  [INFERRED]
  src/stores/sessionReset.js → src/stores/devicesStore.js
- `resetAllDataStores()` --calls--> `useGroupsStore`  [INFERRED]
  src/stores/sessionReset.js → src/stores/groupsStore.js
- `resetAllDataStores()` --calls--> `useRolesStore`  [INFERRED]
  src/stores/sessionReset.js → src/stores/rolesStore.js
- `resetAllDataStores()` --calls--> `useUsersStore`  [INFERRED]
  src/stores/sessionReset.js → src/stores/usersStore.js

## Import Cycles
- 3-file cycle: `src/stores/authStore.js -> src/stores/sessionReset.js -> src/stores/devicesStore.js -> src/stores/authStore.js`
- 3-file cycle: `src/stores/authStore.js -> src/stores/sessionReset.js -> src/stores/groupsStore.js -> src/stores/authStore.js`
- 3-file cycle: `src/stores/authStore.js -> src/stores/sessionReset.js -> src/stores/rolesStore.js -> src/stores/authStore.js`
- 3-file cycle: `src/stores/authStore.js -> src/stores/sessionReset.js -> src/stores/usersStore.js -> src/stores/authStore.js`

## Hyperedges (group relationships)
- **IPC-to-PowerShell Execution Bridge** — indexjs_ipc_getusers, indexjs_runpsscript, ps_getms365users [EXTRACTED 1.00]
- **JSON Sentinel Output Protocol (PS scripts + parser)** — ps_getms365users, ps_resetmfa, ps_updateuser, ps_deleteuser, ps_updateuserlicenses, indexjs_parsejsonfromoutput, indexjs_json_sentinel_protocol [EXTRACTED 1.00]
- **Auth Store Log Aggregation and UI Display Flow** — app_authstore, app_logconsole, app_toastnotifications [EXTRACTED 0.95]
- **Bulk User Creation Flow: CreateUsersView → usersStore.runBulkCreate → IPC → PowerShell** — createusersview_csvtab, usersstore_runbulkcreate, projectmd_ipcchannels [EXTRACTED 0.95]
- **Pinia Store Coordination: usersStore calls authStore for logging and toast notifications on every IPC action** — usersstore_usersstore, authstore_authstore, authstore_logs [EXTRACTED 0.98]
- **License Display Pipeline: usersStore.licenseMap + humanLicenseLabel → UsersView badges & DashboardView bars** — usersstore_getters, licenselabel_humanlicenselabel, dashboardview_licenseoverview [INFERRED 0.88]

## Communities (109 total, 22 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.07
Nodes (51): ALLOWED_MS_ADMIN_HOSTS, authDebug(), authLogUi(), buildPsScriptEnv(), buildPsSpawnOptions(), checkPwshForDashboard(), copyPsHelperScripts(), createTray() (+43 more)

### Community 1 - "Community 1"
Cohesion: 0.48
Nodes (5): Resolve-OwnerLabel(), Try-GroupLabel(), Try-OrgContactLabel(), Try-SpLabel(), Try-UserLabel()

### Community 2 - "Community 2"
Cohesion: 0.32
Nodes (4): createSingleUser(), entryError(), entryUpn(), normalizeForUPN()

### Community 49 - "Community 49"
Cohesion: 0.07
Nodes (29): 1. Verbindung herstellen / Daten laden, 2. Benutzer verwalten (Benutzerliste), 3. Gruppen verwalten, 4. Geräte und Intune-Aktionen, 5. Neue Benutzer anlegen (Einzeln oder CSV), 6. Logs anzeigen, ANSI-Escape-Codes in den Logs, Architektur (+21 more)

### Community 50 - "Community 50"
Cohesion: 0.10
Nodes (20): useAuthStore, useDevicesStore, useGroupsStore, useRolesStore, resetAllDataStores(), useUsersStore, a3LicenseBucket(), humanLicenseLabel() (+12 more)

### Community 51 - "Community 51"
Cohesion: 0.05
Nodes (43): build, appId, dmg, files, icon, linux, mac, msi (+35 more)

### Community 52 - "Community 52"
Cohesion: 0.09
Nodes (22): Architektur & Datenfluss, CSV / UPN Normalisierung: wichtige Stelle, Dev/Build/Run, Electron Main Process, JSON-Rückgaben aus PowerShell, Nicht-Ziele / Out-of-scope (aktuell), PowerShell Scripts: Aufgaben & Graph Permissions, Project: MS-365 User Management Dashboard (Electron + Vue + PowerShell/Graph) (+14 more)

### Community 53 - "Community 53"
Cohesion: 0.06
Nodes (32): author, dependencies, @azure/identity, bootstrap, bootstrap-icons, pinia, vue, vue-router (+24 more)

### Community 54 - "Community 54"
Cohesion: 0.08
Nodes (15): routes, app, strengthColors, strengthLabels, validatePassword(), authStore, createSingleUser(), entryError() (+7 more)

### Community 55 - "Community 55"
Cohesion: 0.07
Nodes (29): 1. Verbindung herstellen / Daten laden, 2. Benutzer verwalten (Benutzerliste), 3. Gruppen verwalten, 4. Geräte und Intune-Aktionen, 5. Neue Benutzer anlegen (Einzeln oder CSV), 6. Logs anzeigen, ANSI-Escape-Codes in den Logs, Architektur (+21 more)

### Community 57 - "Community 57"
Cohesion: 0.07
Nodes (35): addTemporary, addUserIds, addUserSearch, authStore, busy, confirmActionEnabled, confirmModal, durationLabelForValue() (+27 more)

### Community 58 - "Community 58"
Cohesion: 0.09
Nodes (22): Architektur & Datenfluss, CSV / UPN Normalisierung: wichtige Stelle, Dev/Build/Run, Electron Main Process, JSON-Rückgaben aus PowerShell, Nicht-Ziele / Out-of-scope (aktuell), PowerShell Scripts: Aufgaben & Graph Permissions, Project: MS-365 User Management Dashboard (Electron + Vue + PowerShell/Graph) (+14 more)

### Community 59 - "Community 59"
Cohesion: 0.17
Nodes (10): 0. Compact replies (token budget), 1. Think Before Coding, 2. Simplicity First, 3. Surgical Changes, 4. Goal-Driven Execution, 5. Project memory (`memory.md`), 6. Graphify (repository knowledge graph), Encoding format (keep stable; extend only with necessity) (+2 more)

### Community 60 - "Community 60"
Cohesion: 0.12
Nodes (14): 0. Compact replies (token budget), 1. Think Before Coding, 2. Simplicity First, 3. Surgical Changes, 4. Goal-Driven Execution, 5. Project memory (`memory.md`), 6. Graphify (repository knowledge graph), Arbeitsweise (+6 more)

### Community 61 - "Community 61"
Cohesion: 0.40
Nodes (3): permissions, allow, deny

### Community 67 - "Community 67"
Cohesion: 0.32
Nodes (10): Connect-Mg365App(), Connect-Mg365InteractiveBrowser(), Ensure-WamConsoleWindow(), Get-Mg365MsalAssemblyPath(), Get-Ms365ParentWindowHandle(), Register-Mg365MsalCache(), Save-Mg365AuthRecord(), Write-Mg365AuthLog() (+2 more)

### Community 74 - "Community 74"
Cohesion: 0.05
Nodes (23): allPageDevicesSelected, clearDeviceSelection(), currentPage, deleteEntraConfirmExpected, deleteEntraConfirmLabel, deviceConfirmTarget(), filterCompliant, filteredDevices (+15 more)

### Community 78 - "Community 78"
Cohesion: 0.20
Nodes (5): canLogout, devicesStore, groupsStore, rolesStore, usersStore

### Community 84 - "Community 84"
Cohesion: 0.67
Nodes (4): Get-ActivatedDirectoryRoleByTemplateId(), Get-DirectoryRoleUserMembers(), Get-OrActivateDirectoryRole(), New-DirectoryRoleFromTemplate()

## Knowledge Gaps
- **265 isolated node(s):** `allow`, `allow`, `deny`, `GRAPH_DELEGATED_SCOPES`, `__filename` (+260 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **22 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `build` connect `Community 51` to `Community 53`?**
  _High betweenness centrality (0.012) - this node is a cross-community bridge._
- **What connects `allow`, `allow`, `deny` to the rest of the system?**
  _265 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.07130333138515488 - nodes in this community are weakly interconnected._
- **Should `Community 49` be split into smaller, more focused modules?**
  _Cohesion score 0.06666666666666667 - nodes in this community are weakly interconnected._
- **Should `Community 50` be split into smaller, more focused modules?**
  _Cohesion score 0.10252100840336134 - nodes in this community are weakly interconnected._
- **Should `Community 51` be split into smaller, more focused modules?**
  _Cohesion score 0.046511627906976744 - nodes in this community are weakly interconnected._
- **Should `Community 52` be split into smaller, more focused modules?**
  _Cohesion score 0.08695652173913043 - nodes in this community are weakly interconnected._