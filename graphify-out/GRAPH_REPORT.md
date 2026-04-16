# Graph Report - /home/valueerror/Nextcloud/WORKINPROGRESS/Microsoft365-Users  (2026-04-16)

## Corpus Check
- 35 files · ~40,178 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 110 nodes · 73 edges · 49 communities detected
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 32|Community 32]]
- [[_COMMUNITY_Community 33|Community 33]]
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

## God Nodes (most connected - your core abstractions)
1. `Resolve-OwnerLabel()` - 5 edges
2. `runPsScriptBody()` - 4 edges
3. `normalizeForUPN()` - 3 edges
4. `detectPowerShell()` - 2 edges
5. `getScriptPath()` - 2 edges
6. `runPsScript()` - 2 edges
7. `parseCsvText()` - 2 edges
8. `toSemicolonCsv()` - 2 edges
9. `Get-ManagementLabel()` - 2 edges
10. `Get-SecurityManagementLabel()` - 2 edges

## Surprising Connections (you probably didn't know these)
- None detected - all connections are within the same source files.

## Hyperedges (group relationships)
- **IPC-to-PowerShell Execution Bridge** — indexjs_ipc_getusers, indexjs_runpsscript, ps_getms365users [EXTRACTED 1.00]
- **JSON Sentinel Output Protocol (PS scripts + parser)** — ps_getms365users, ps_resetmfa, ps_updateuser, ps_deleteuser, ps_updateuserlicenses, indexjs_parsejsonfromoutput, indexjs_json_sentinel_protocol [EXTRACTED 1.00]
- **Auth Store Log Aggregation and UI Display Flow** — app_authstore, app_logconsole, app_toastnotifications [EXTRACTED 0.95]
- **Bulk User Creation Flow: CreateUsersView → usersStore.runBulkCreate → IPC → PowerShell** — createusersview_csvtab, usersstore_runbulkcreate, projectmd_ipcchannels [EXTRACTED 0.95]
- **Pinia Store Coordination: usersStore calls authStore for logging and toast notifications on every IPC action** — usersstore_usersstore, authstore_authstore, authstore_logs [EXTRACTED 0.98]
- **License Display Pipeline: usersStore.licenseMap + humanLicenseLabel → UsersView badges & DashboardView bars** — usersstore_getters, licenselabel_humanlicenselabel, dashboardview_licenseoverview [INFERRED 0.88]

## Communities

### Community 0 - "Community 0"
Cohesion: 0.18
Nodes (7): detectPowerShell(), getScriptPath(), normalizeForUPN(), parseCsvText(), runPsScript(), runPsScriptBody(), toSemicolonCsv()

### Community 1 - "Community 1"
Cohesion: 0.39
Nodes (5): Resolve-OwnerLabel(), Try-GroupLabel(), Try-OrgContactLabel(), Try-SpLabel(), Try-UserLabel()

### Community 2 - "Community 2"
Cohesion: 0.32
Nodes (4): createSingleUser(), entryError(), entryUpn(), normalizeForUPN()

### Community 3 - "Community 3"
Cohesion: 0.4
Nodes (2): Get-ManagementLabel(), Get-SecurityManagementLabel()

### Community 4 - "Community 4"
Cohesion: 0.33
Nodes (0): 

### Community 5 - "Community 5"
Cohesion: 0.5
Nodes (0): 

### Community 6 - "Community 6"
Cohesion: 0.67
Nodes (0): 

### Community 7 - "Community 7"
Cohesion: 0.67
Nodes (0): 

### Community 8 - "Community 8"
Cohesion: 0.67
Nodes (0): 

### Community 9 - "Community 9"
Cohesion: 0.67
Nodes (0): 

### Community 10 - "Community 10"
Cohesion: 1.0
Nodes (0): 

### Community 11 - "Community 11"
Cohesion: 1.0
Nodes (0): 

### Community 12 - "Community 12"
Cohesion: 1.0
Nodes (0): 

### Community 13 - "Community 13"
Cohesion: 1.0
Nodes (0): 

### Community 14 - "Community 14"
Cohesion: 1.0
Nodes (0): 

### Community 15 - "Community 15"
Cohesion: 1.0
Nodes (0): 

### Community 16 - "Community 16"
Cohesion: 1.0
Nodes (0): 

### Community 17 - "Community 17"
Cohesion: 1.0
Nodes (0): 

### Community 18 - "Community 18"
Cohesion: 1.0
Nodes (0): 

### Community 19 - "Community 19"
Cohesion: 1.0
Nodes (0): 

### Community 20 - "Community 20"
Cohesion: 1.0
Nodes (0): 

### Community 21 - "Community 21"
Cohesion: 1.0
Nodes (0): 

### Community 22 - "Community 22"
Cohesion: 1.0
Nodes (0): 

### Community 23 - "Community 23"
Cohesion: 1.0
Nodes (0): 

### Community 24 - "Community 24"
Cohesion: 1.0
Nodes (0): 

### Community 25 - "Community 25"
Cohesion: 1.0
Nodes (0): 

### Community 26 - "Community 26"
Cohesion: 1.0
Nodes (0): 

### Community 27 - "Community 27"
Cohesion: 1.0
Nodes (0): 

### Community 28 - "Community 28"
Cohesion: 1.0
Nodes (0): 

### Community 29 - "Community 29"
Cohesion: 1.0
Nodes (0): 

### Community 30 - "Community 30"
Cohesion: 1.0
Nodes (0): 

### Community 31 - "Community 31"
Cohesion: 1.0
Nodes (0): 

### Community 32 - "Community 32"
Cohesion: 1.0
Nodes (0): 

### Community 33 - "Community 33"
Cohesion: 1.0
Nodes (0): 

### Community 34 - "Community 34"
Cohesion: 1.0
Nodes (1): README: MS-365 User Management Tool Documentation

### Community 35 - "Community 35"
Cohesion: 1.0
Nodes (1): Architecture: Renderer→IPC→Electron→PowerShell→Graph

### Community 36 - "Community 36"
Cohesion: 1.0
Nodes (1): Design Decision: Bulk create only creates NEW users — existing UPN = error, no update

### Community 37 - "Community 37"
Cohesion: 1.0
Nodes (1): Feature: Auto A3 License Assignment (Schüler/Lehrer) on new user creation

### Community 38 - "Community 38"
Cohesion: 1.0
Nodes (1): Security: Passwords in-memory only, temp CSV deleted, OAuth2 delegated auth

### Community 39 - "Community 39"
Cohesion: 1.0
Nodes (1): project.md: Architecture & Developer Reference

### Community 40 - "Community 40"
Cohesion: 1.0
Nodes (1): Design Note: UPN Normalization implemented in 4 places (index.js, ps1, editor.html, CreateUsersView)

### Community 41 - "Community 41"
Cohesion: 1.0
Nodes (1): IPC Channel Catalogue: get-users, update-user, reset-password, reset-mfa, open-csv-dialog, get-csv-data, set-csv-data, run-password-update, check-pwsh

### Community 42 - "Community 42"
Cohesion: 1.0
Nodes (1): Rationale: No backend server — all local via PowerShell + Graph, no persistent DB

### Community 43 - "Community 43"
Cohesion: 1.0
Nodes (1): claude.md: Claude Working Instructions for this Repo

### Community 44 - "Community 44"
Cohesion: 1.0
Nodes (1): Instruction: Read project.md first as single source of truth before any work

### Community 45 - "Community 45"
Cohesion: 1.0
Nodes (1): App Icon: Microsoft 365 style hexagonal logo (blue-purple gradient)

### Community 46 - "Community 46"
Cohesion: 1.0
Nodes (1): UI Screenshot: Dashboard view showing stats (2081 total, 2077 active, 4 disabled, 1832 licensed), quick actions, available licenses list with usage bars

### Community 47 - "Community 47"
Cohesion: 1.0
Nodes (1): UI Design: Dark theme (GitHub-style dark), sidebar navigation, card-based layout

### Community 48 - "Community 48"
Cohesion: 1.0
Nodes (1): UI Element: License usage progress bars with color-coded saturation (green/yellow/red)

## Knowledge Gaps
- **15 isolated node(s):** `README: MS-365 User Management Tool Documentation`, `Architecture: Renderer→IPC→Electron→PowerShell→Graph`, `Design Decision: Bulk create only creates NEW users — existing UPN = error, no update`, `Feature: Auto A3 License Assignment (Schüler/Lehrer) on new user creation`, `Security: Passwords in-memory only, temp CSV deleted, OAuth2 delegated auth` (+10 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Community 10`** (2 nodes): `Connect-Mg365App()`, `Connect-Mg365App.ps1`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 11`** (2 nodes): `Ensure-Module()`, `delete-group.ps1`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 12`** (2 nodes): `Ensure-Module()`, `delete-user.ps1`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 13`** (2 nodes): `Ensure-Module()`, `get-group-members.ps1`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 14`** (2 nodes): `Ensure-Module()`, `get-groups.ps1`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 15`** (2 nodes): `Ensure-Module()`, `get-ms365-users.ps1`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 16`** (2 nodes): `remove-group-member.ps1`, `Ensure-Module()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 17`** (2 nodes): `reset-mfa.ps1`, `Ensure-Module()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 18`** (2 nodes): `update-group.ps1`, `Ensure-Module()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 19`** (2 nodes): `update-user-licenses.ps1`, `Ensure-Module()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 20`** (2 nodes): `update-user.ps1`, `Ensure-Module()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 21`** (2 nodes): `App.vue`, `main.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 22`** (1 nodes): `preload.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 23`** (1 nodes): `vite.config.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 24`** (1 nodes): `AppSidebar.vue`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 25`** (1 nodes): `LogConsole.vue`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 26`** (1 nodes): `index.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 27`** (1 nodes): `authStore.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 28`** (1 nodes): `devicesStore.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 29`** (1 nodes): `groupsStore.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 30`** (1 nodes): `usersStore.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 31`** (1 nodes): `DevicesView.vue`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 32`** (1 nodes): `GroupsView.vue`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 33`** (1 nodes): `UsersView.vue`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 34`** (1 nodes): `README: MS-365 User Management Tool Documentation`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 35`** (1 nodes): `Architecture: Renderer→IPC→Electron→PowerShell→Graph`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 36`** (1 nodes): `Design Decision: Bulk create only creates NEW users — existing UPN = error, no update`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 37`** (1 nodes): `Feature: Auto A3 License Assignment (Schüler/Lehrer) on new user creation`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 38`** (1 nodes): `Security: Passwords in-memory only, temp CSV deleted, OAuth2 delegated auth`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 39`** (1 nodes): `project.md: Architecture & Developer Reference`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 40`** (1 nodes): `Design Note: UPN Normalization implemented in 4 places (index.js, ps1, editor.html, CreateUsersView)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 41`** (1 nodes): `IPC Channel Catalogue: get-users, update-user, reset-password, reset-mfa, open-csv-dialog, get-csv-data, set-csv-data, run-password-update, check-pwsh`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 42`** (1 nodes): `Rationale: No backend server — all local via PowerShell + Graph, no persistent DB`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 43`** (1 nodes): `claude.md: Claude Working Instructions for this Repo`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 44`** (1 nodes): `Instruction: Read project.md first as single source of truth before any work`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 45`** (1 nodes): `App Icon: Microsoft 365 style hexagonal logo (blue-purple gradient)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 46`** (1 nodes): `UI Screenshot: Dashboard view showing stats (2081 total, 2077 active, 4 disabled, 1832 licensed), quick actions, available licenses list with usage bars`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 47`** (1 nodes): `UI Design: Dark theme (GitHub-style dark), sidebar navigation, card-based layout`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 48`** (1 nodes): `UI Element: License usage progress bars with color-coded saturation (green/yellow/red)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What connects `README: MS-365 User Management Tool Documentation`, `Architecture: Renderer→IPC→Electron→PowerShell→Graph`, `Design Decision: Bulk create only creates NEW users — existing UPN = error, no update` to the rest of the system?**
  _15 weakly-connected nodes found - possible documentation gaps or missing edges._