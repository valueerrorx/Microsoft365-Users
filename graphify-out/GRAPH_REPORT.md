# Graph Report - .  (2026-04-13)

## Corpus Check
- Corpus is ~18,434 words - fits in a single context window. You may not need a graph.

## Summary
- 143 nodes · 171 edges · 29 communities detected
- Extraction: 93% EXTRACTED · 7% INFERRED · 0% AMBIGUOUS · INFERRED: 12 edges (avg confidence: 0.76)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Auth & User Creation|Auth & User Creation]]
- [[_COMMUNITY_App Shell & IPC Bridge|App Shell & IPC Bridge]]
- [[_COMMUNITY_Electron Main Process|Electron Main Process]]
- [[_COMMUNITY_IPC Handlers|IPC Handlers]]
- [[_COMMUNITY_CSV Import & Bulk Create|CSV Import & Bulk Create]]
- [[_COMMUNITY_PowerShell MS Graph Core|PowerShell MS Graph Core]]
- [[_COMMUNITY_Security & UPN Policy|Security & UPN Policy]]
- [[_COMMUNITY_CSV Data Pipeline|CSV Data Pipeline]]
- [[_COMMUNITY_Project Docs & Assets|Project Docs & Assets]]
- [[_COMMUNITY_User Edit & License Modal|User Edit & License Modal]]
- [[_COMMUNITY_Dashboard Load & Colors|Dashboard Load & Colors]]
- [[_COMMUNITY_Stats & License Display|Stats & License Display]]
- [[_COMMUNITY_Get Users Script|Get Users Script]]
- [[_COMMUNITY_Reset MFA Script|Reset MFA Script]]
- [[_COMMUNITY_Update User Script|Update User Script]]
- [[_COMMUNITY_Delete User Script|Delete User Script]]
- [[_COMMUNITY_Update Licenses Script|Update Licenses Script]]
- [[_COMMUNITY_Vue App Entry|Vue App Entry]]
- [[_COMMUNITY_Password Reset Flow|Password Reset Flow]]
- [[_COMMUNITY_PowerShell Status Check|PowerShell Status Check]]
- [[_COMMUNITY_MFA Reset Flow|MFA Reset Flow]]
- [[_COMMUNITY_Preload Bridge|Preload Bridge]]
- [[_COMMUNITY_Vite Build Config|Vite Build Config]]
- [[_COMMUNITY_Log Console Component|Log Console Component]]
- [[_COMMUNITY_App Sidebar Component|App Sidebar Component]]
- [[_COMMUNITY_Vue Router|Vue Router]]
- [[_COMMUNITY_Auth Store|Auth Store]]
- [[_COMMUNITY_Users Store|Users Store]]
- [[_COMMUNITY_Users View|Users View]]

## God Nodes (most connected - your core abstractions)
1. `runPsScript Function` - 9 edges
2. `uiSend IPC Push Function` - 8 edges
3. `App.vue Root Component` - 7 edges
4. `Auth Store (Pinia)` - 7 edges
5. `parseJsonFromOutput Function` - 6 edges
6. `JSON Sentinel Protocol (###JSON_START###/###JSON_END###)` - 6 edges
7. `Microsoft Graph PowerShell Module` - 6 edges
8. `Ensure-Module Helper Function` - 6 edges
9. `Action: runBulkCreate() — IPC set-csv-data + run-password-update` - 6 edges
10. `DashboardView — Stats Overview & License Summary` - 6 edges

## Surprising Connections (you probably didn't know these)
- `UI Element: License usage progress bars with color-coded saturation (green/yellow/red)` --semantically_similar_to--> `DashboardView: License Overview with bar chart progress`  [INFERRED] [semantically similar]
  ui.png → src/views/DashboardView.vue
- `Security: Passwords in-memory only, temp CSV deleted, OAuth2 delegated auth` --rationale_for--> `Action: runBulkCreate() — IPC set-csv-data + run-password-update`  [INFERRED]
  README.md → src/stores/usersStore.js
- `IPC Channel Catalogue: get-users, update-user, reset-password, reset-mfa, open-csv-dialog, get-csv-data, set-csv-data, run-password-update, check-pwsh` --references--> `Action: fetchUsers() — IPC get-users`  [EXTRACTED]
  project.md → src/stores/usersStore.js
- `Design Decision: Bulk create only creates NEW users — existing UPN = error, no update` --rationale_for--> `Action: runBulkCreate() — IPC set-csv-data + run-password-update`  [EXTRACTED]
  README.md → src/stores/usersStore.js
- `Feature: Auto A3 License Assignment (Schüler/Lehrer) on new user creation` --rationale_for--> `SKU Part Number to Human Label Mapping (A1/A3/A5, Exchange, Teams, Intune etc.)`  [INFERRED]
  README.md → src/utils/licenseLabel.js

## Hyperedges (group relationships)
- **IPC-to-PowerShell Execution Bridge** — indexjs_ipc_getusers, indexjs_runpsscript, ps_getms365users [EXTRACTED 1.00]
- **JSON Sentinel Output Protocol (PS scripts + parser)** — ps_getms365users, ps_resetmfa, ps_updateuser, ps_deleteuser, ps_updateuserlicenses, indexjs_parsejsonfromoutput, indexjs_json_sentinel_protocol [EXTRACTED 1.00]
- **Auth Store Log Aggregation and UI Display Flow** — app_authstore, app_logconsole, app_toastnotifications [EXTRACTED 0.95]
- **Bulk User Creation Flow: CreateUsersView → usersStore.runBulkCreate → IPC → PowerShell** — createusersview_csvtab, usersstore_runbulkcreate, projectmd_ipcchannels [EXTRACTED 0.95]
- **Pinia Store Coordination: usersStore calls authStore for logging and toast notifications on every IPC action** — usersstore_usersstore, authstore_authstore, authstore_logs [EXTRACTED 0.98]
- **License Display Pipeline: usersStore.licenseMap + humanLicenseLabel → UsersView badges & DashboardView bars** — usersstore_getters, licenselabel_humanlicenselabel, dashboardview_licenseoverview [INFERRED 0.88]

## Communities

### Community 0 - "Auth & User Creation"
Cohesion: 0.11
Nodes (24): Auth Store (Pinia), Auth State: connected / tenantDomain, Auth Store: Activity Logs (max 300, auto-purge), CreateUsersView — User Creation & CSV Import View, CreateUsersView: Single User Tab (form + UPN preview), DashboardView — Stats Overview & License Summary, DashboardView: License Overview with bar chart progress, humanLicenseLabel() (+16 more)

### Community 1 - "App Shell & IPC Bridge"
Cohesion: 0.2
Nodes (14): AppSidebar Component, authStore (Pinia Store), window.ipcRenderer (Exposed IPC Bridge), LogConsole Component, Pinia State Management, Vue Router, Toast Notification System, usersStore (Pinia Store) (+6 more)

### Community 2 - "Electron Main Process"
Cohesion: 0.21
Nodes (6): detectPowerShell(), getScriptPath(), normalizeForUPN(), parseCsvText(), runPsScript(), toSemicolonCsv()

### Community 3 - "IPC Handlers"
Cohesion: 0.27
Nodes (13): checkPwshForDashboard Function, detectPowerShell Function, getScriptPath Function, IPC Handler: check-pwsh, IPC Handler: delete-user, IPC Handler: get-users, IPC Handler: reset-mfa, IPC Handler: reset-password (+5 more)

### Community 4 - "CSV Import & Bulk Create"
Cohesion: 0.28
Nodes (5): createSingleUser(), entryError(), entryUpn(), normalizeForUPN(), Design Note: UPN Normalization implemented in 4 places (index.js, ps1, editor.html, CreateUsersView)

### Community 5 - "PowerShell MS Graph Core"
Cohesion: 0.58
Nodes (9): JSON Sentinel Protocol (###JSON_START###/###JSON_END###), Connect-MgGraph Authentication, delete-user.ps1 Script, Ensure-Module Helper Function, get-ms365-users.ps1 Script, Microsoft Graph PowerShell Module, reset-mfa.ps1 Script, update-user.ps1 Script (+1 more)

### Community 6 - "Security & UPN Policy"
Cohesion: 0.22
Nodes (9): Auth Store: Toast Notifications, createSingleUser() — wraps single entry into csvEntries then runBulkCreate, CreateUsersView: CSV Import Tab (preview table + bulk run), Security: Passwords in-memory only, temp CSV deleted, OAuth2 delegated auth, Design Decision: Bulk create only creates NEW users — existing UPN = error, no update, Action: deleteUser() — IPC delete-user, Action: importCsv() — IPC open-csv-dialog + get-csv-data, Action: runBulkCreate() — IPC set-csv-data + run-password-update (+1 more)

### Community 7 - "CSV Data Pipeline"
Cohesion: 0.36
Nodes (8): csvData In-Memory Store, IPC Handler: get-csv-data, IPC Handler: open-csv-dialog, IPC Handler: run-password-update, IPC Handler: set-csv-data, normalizeForUPN Function, parseCsvText Function, toSemicolonCsv Function

### Community 8 - "Project Docs & Assets"
Cohesion: 0.29
Nodes (7): claude.md: Claude Working Instructions for this Repo, Instruction: Read project.md first as single source of truth before any work, App Icon: Microsoft 365 style hexagonal logo (blue-purple gradient), Rationale: No backend server — all local via PowerShell + Graph, no persistent DB, project.md: Architecture & Developer Reference, Architecture: Renderer→IPC→Electron→PowerShell→Graph, README: MS-365 User Management Tool Documentation

### Community 9 - "User Edit & License Modal"
Cohesion: 0.5
Nodes (4): Action: updateUser() — IPC update-user, Action: updateUserLicenses() — IPC update-user-licenses, UsersView: Edit User Modal (attributes + license assignment), UsersView: Account Enable/Disable Toggle Modal

### Community 10 - "Dashboard Load & Colors"
Cohesion: 0.67
Nodes (0): 

### Community 11 - "Stats & License Display"
Cohesion: 0.67
Nodes (3): DashboardView: Stats Cards (total/active/inactive/licensed users), Users Store Getters: totalUsers, activeUsers, inactiveUsers, licensedUsers, licenseMap, UsersView: local licenseLabel() bridging licenseMap + humanLicenseLabel

### Community 12 - "Get Users Script"
Cohesion: 1.0
Nodes (0): 

### Community 13 - "Reset MFA Script"
Cohesion: 1.0
Nodes (0): 

### Community 14 - "Update User Script"
Cohesion: 1.0
Nodes (0): 

### Community 15 - "Delete User Script"
Cohesion: 1.0
Nodes (0): 

### Community 16 - "Update Licenses Script"
Cohesion: 1.0
Nodes (0): 

### Community 17 - "Vue App Entry"
Cohesion: 1.0
Nodes (0): 

### Community 18 - "Password Reset Flow"
Cohesion: 1.0
Nodes (2): Action: resetPassword() — IPC reset-password, UsersView: Password Reset Modal

### Community 19 - "PowerShell Status Check"
Cohesion: 1.0
Nodes (2): DashboardView: onMounted check-pwsh IPC call, DashboardView: PowerShell Core (pwsh) missing warning (Linux/macOS)

### Community 20 - "MFA Reset Flow"
Cohesion: 1.0
Nodes (2): Action: resetMfa() — IPC reset-mfa, UsersView: MFA Reset Modal

### Community 21 - "Preload Bridge"
Cohesion: 1.0
Nodes (0): 

### Community 22 - "Vite Build Config"
Cohesion: 1.0
Nodes (0): 

### Community 23 - "Log Console Component"
Cohesion: 1.0
Nodes (0): 

### Community 24 - "App Sidebar Component"
Cohesion: 1.0
Nodes (0): 

### Community 25 - "Vue Router"
Cohesion: 1.0
Nodes (0): 

### Community 26 - "Auth Store"
Cohesion: 1.0
Nodes (0): 

### Community 27 - "Users Store"
Cohesion: 1.0
Nodes (0): 

### Community 28 - "Users View"
Cohesion: 1.0
Nodes (0): 

## Knowledge Gaps
- **30 isolated node(s):** `createWindow Function`, `getScriptPath Function`, `IPC Handler: check-pwsh`, `IPC Handler: get-csv-data`, `IPC Handler: reset-password` (+25 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Get Users Script`** (2 nodes): `Ensure-Module()`, `get-ms365-users.ps1`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Reset MFA Script`** (2 nodes): `Ensure-Module()`, `reset-mfa.ps1`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Update User Script`** (2 nodes): `update-user.ps1`, `Ensure-Module()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Delete User Script`** (2 nodes): `Ensure-Module()`, `delete-user.ps1`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Update Licenses Script`** (2 nodes): `update-user-licenses.ps1`, `Ensure-Module()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Vue App Entry`** (2 nodes): `App.vue`, `main.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Password Reset Flow`** (2 nodes): `Action: resetPassword() — IPC reset-password`, `UsersView: Password Reset Modal`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `PowerShell Status Check`** (2 nodes): `DashboardView: onMounted check-pwsh IPC call`, `DashboardView: PowerShell Core (pwsh) missing warning (Linux/macOS)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `MFA Reset Flow`** (2 nodes): `Action: resetMfa() — IPC reset-mfa`, `UsersView: MFA Reset Modal`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Preload Bridge`** (1 nodes): `preload.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Vite Build Config`** (1 nodes): `vite.config.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Log Console Component`** (1 nodes): `LogConsole.vue`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `App Sidebar Component`** (1 nodes): `AppSidebar.vue`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Vue Router`** (1 nodes): `index.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Auth Store`** (1 nodes): `authStore.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Users Store`** (1 nodes): `usersStore.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Users View`** (1 nodes): `UsersView.vue`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `uiSend IPC Push Function` connect `IPC Handlers` to `App Shell & IPC Bridge`, `CSV Data Pipeline`?**
  _High betweenness centrality (0.058) - this node is a cross-community bridge._
- **Why does `window.ipcRenderer (Exposed IPC Bridge)` connect `App Shell & IPC Bridge` to `IPC Handlers`?**
  _High betweenness centrality (0.042) - this node is a cross-community bridge._
- **Why does `Auth Store (Pinia)` connect `Auth & User Creation` to `Security & UPN Policy`?**
  _High betweenness centrality (0.036) - this node is a cross-community bridge._
- **What connects `createWindow Function`, `getScriptPath Function`, `IPC Handler: check-pwsh` to the rest of the system?**
  _30 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Auth & User Creation` be split into smaller, more focused modules?**
  _Cohesion score 0.11 - nodes in this community are weakly interconnected._