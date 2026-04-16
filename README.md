# MS-365 Benutzer-Verwaltungs Tool

Eine Electron-App zum Verwalten von Microsoft-365-/Entra-ID-**Benutzern**, **Gruppen** und **Geräten** (inkl. Intune-Aktionen) über die Microsoft Graph API.

![App UI](./ui.png)

## Übersicht

Administratoren können **neue** Microsoft-365-/Entra-ID-Konten anlegen (Einzeln oder per CSV) und **bestehende** Benutzer in der **Benutzerliste** pflegen. Zusätzlich stehen eine **Gruppenübersicht** (Bearbeiten, Mitglieder, Ablaufrichtlinien) und eine **Geräteübersicht** (Filter, Intune **Retire**/Bulk-Retire, **Remote Wipe**) zur Verfügung. Neuanlagen über den Erstellungs-Workflow erhalten passende **A3-Edu-Lizenzen** (Schüler/Lehrer), sofern die SKUs im Tenant gefunden werden. Die App nutzt die Microsoft Graph PowerShell SDK und eine Electron-Oberfläche.

## Features

- **Dashboard**: Kennzahlen zu Benutzern, Lizenzen, Gruppen (u. a. Teams, Ablaufrichtlinie) und Geräten (MDM/Intune, Konformität); **Schnellzugriff** zum Aktualisieren der Daten und Links zu Microsoft-Verwaltungsportalen; unter Linux/macOS Hinweis, wenn **PowerShell Core (`pwsh`)** fehlt
- **Benutzerliste** (`/users`): Suche, Filter, Sortierung; pro Benutzer **Bearbeiten** (Stammdaten), **Passwort**, **MFA zurücksetzen**, **Konto aktivieren/deaktivieren**, **Lizenzen** (Tenant-SKUs zuweisen/entfernen, mit Nutzungsstandort), **Löschen** (mit UPN-Bestätigung)
- **Gruppen** (`/groups`): Suche, Gruppentyp-Filter, Sortierung; **Bearbeiten** (Anzeigename, Beschreibung, Besitzer-Anzeige); **Mitglieder** hinzufügen und entfernen; **Gruppe löschen**; **Gruppenablauf (Lifecycle)**: Richtlinien anlegen/bearbeiten, Gruppen (auch mehrere Microsoft-365-Gruppen) einer Richtlinie zuordnen
- **Geräte** (`/devices`): Suche; Filter nach Verknüpfungstyp (Entra gejoint/registriert/Hybrid), Aktivierung und Konformität; **Abkoppeln (Retire)** einzeln oder für mehrere Geräte (optional Benutzerkonto deaktivieren); **Remote Wipe** mit Bestätigung über den Gerätenamen — für verwaltete Geräte sind passende Intune-/Graph-Berechtigungen nötig
- **Benutzer erstellen / importieren** (`/create`): **Einzelner Benutzer** oder **CSV-Import** — es werden nur **neue** Konten angelegt (UPN noch frei)
- **CSV-basierter Massenimport**: Tabelle in der App bearbeiten, dann Anlage starten
- **Automatische UPN-/Anzeigenamen-Generierung** aus Vorname/Nachname
- **Lizenzzuweisung bei Neuanlage**: A3 Schüler/Lehrer gemäß `UserType`, wenn die passende SKU im Tenant erkannt wird
- **Microsoft Graph** über PowerShell; **Echtzeit-Logs** und Toasts bei Fehlern

## Voraussetzungen

- **Node.js** und **npm** (für die Entwicklung)
- **PowerShell**: Unter **Linux und macOS** ist **PowerShell Core (`pwsh`)** erforderlich und sollte im `PATH` liegen (die App prüft das und warnt im Dashboard, falls nichts startet). Unter Windows nutzt die App `pwsh`, falls vorhanden, sonst passende PowerShell-Installationen.
  - Linux z. B. Arch: `yay -S powershell-bin` oder [Microsoft: Installation](https://learn.microsoft.com/powershell/scripting/install/installing-powershell-on-linux)
  - macOS: z. B. Homebrew oder [Microsoft: Installation](https://learn.microsoft.com/powershell/scripting/install/installing-powershell-on-macos)
- **Microsoft Graph (delegiert)**: Ein Konto mit den in `scripts/Connect-Mg365App.ps1` konfigurierten **Scopes**, u. a. `User.ReadWrite.All`, `Directory.ReadWrite.All`, `Group.ReadWrite.All`, `GroupMember.ReadWrite.All`, `UserAuthenticationMethod.ReadWrite.All`, `Organization.Read.All`, `User.Read.All`, sowie für Geräte `Device.Read.All` und für Intune-Verwaltungsaktionen `DeviceManagementManagedDevices.Read.All` und `DeviceManagementManagedDevices.PrivilegedOperations.All`
- **Microsoft Graph PowerShell-Module**: Werden bei Bedarf beim ersten Aufruf der jeweiligen Skripte installiert (z. B. `Microsoft.Graph.Authentication`, `Microsoft.Graph.Users`, `Microsoft.Graph.Groups`, `Microsoft.Graph.Identity.DirectoryManagement`)

## CSV-Format

Die CSV-Datei muss folgendes Format haben (Semikolon- oder Komma-getrennt):

```csv
Vorname;Nachname;Abteilung;UserType;NewPassword;ForceChange
Max;Mustermann;2024;Schüler;Passwort123!;1
Anna;Schmidt;2024;Lehrer;Passwort456!;0
```

**Felder:**
- **Vorname**: Der Vorname des Benutzers (erforderlich)
- **Nachname**: Der Nachname des Benutzers (erforderlich)
- **Abteilung**: Die Abteilung (z.B. Erstellungsjahr) - optional
- **UserType**: "Schüler" oder "Lehrer" (bestimmt die zugewiesene Lizenz) - Standard: "Schüler"
- **NewPassword**: Das Passwort für den Benutzer (erforderlich)
- **ForceChange**: `1` = Benutzer muss Passwort bei nächster Anmeldung ändern, `0` = nicht erforderlich

**Automatisch generiert:**
- **UserPrincipalName**: Wird automatisch als `nachname.vorname@{tenant-domain}` generiert
- **DisplayName**: Wird automatisch als "Nachname Vorname" generiert

**Verhalten (Erstellen / CSV / Einzeln):**

- Es wird ein fester **UserPrincipalName** aus Vorname/Nachname und der **Tenant-Domain** gebildet (`nachname.vorname@…`).
- **Existiert dieser Benutzer bereits**, schlägt der Vorgang für diese Zeile fehl (**kein** Passwort-Update und **keine** Stammdaten-Änderung über diesen Weg — dafür **Benutzerliste** nutzen).
- **Existiert er nicht**, wird ein neues Konto angelegt; bei Erfolg werden **UsageLocation** (Standard AT) und die passende **A3-Lizenz** (Schüler/Lehrer) zugewiesen, sofern die SKU im Tenant gefunden wird.

## Installation

1. **Repository klonen** oder herunterladen:
   ```bash
   git clone git@github.com:valueerrorx/Microsoft365-Users.git
   cd Microsoft365-Users
   ```

2. **Abhängigkeiten installieren**:
   ```bash
   npm install
   ```

3. **App starten**:
   ```bash
   npm run dev
   ```

## Verwendung

### 1. Verbindung herstellen / Daten laden

- Öffne **Dashboard** und klicke auf **„Verbinden & Laden“** bzw. **„Daten aktualisieren“** (lädt Benutzer, Gruppen und Geräte)
- Beim ersten Start öffnet sich ein Browser-Fenster zur Microsoft-Graph-Anmeldung (bei Bedarf Fallback auf Device Code laut `Connect-Mg365App.ps1`)
- Danach werden Benutzerliste, Lizenz-SKUs, Gruppen und Geräte je nach Aktion geladen

### 2. Benutzer verwalten (Benutzerliste)

- Öffne **Benutzerliste** (`/users`)
- Pro Zeile (Aktionen):
  - **Bearbeiten**: Stammdaten (z. B. Anzeigename, Abteilung, Jobtitel, UsageLocation, Konto aktiv)
  - **Passwort**: neues Passwort setzen, optional „bei nächster Anmeldung ändern“
  - **MFA**: registrierte Anmeldemethoden entfernen (2FA zurücksetzen)
  - **Aktivieren / Deaktivieren**: Konto ein- oder ausschalten
  - **Löschen**: UPN zur Bestätigung erneut eingeben — Benutzer wird in Entra ID entfernt
- Im Bearbeiten-Dialog: **Lizenzen** aus den Tenant-SKUs an- oder abwählen (für Zuweisungen ist ein **Nutzungsstandort** nötig)

### 3. Gruppen verwalten

- Öffne **Gruppen** (`/groups`) und lade die Liste bei Bedarf über **Aktualisieren**
- **Bearbeiten**: Anzeigename und Beschreibung; Besitzer werden angezeigt; Zuordnung zu einer **Ablaufrichtlinie** möglich
- **Mitglieder**: Benutzer zur Gruppe hinzufügen oder entfernen
- **Ablaufrichtlinie** (Toolbar): Richtlinien verwalten; bei mehreren ausgewählten Microsoft-365-Gruppen **gemeinsam** einer Richtlinie zuweisen
- **Gruppe löschen**: mit Bestätigung

### 4. Geräte und Intune-Aktionen

- Öffne **Geräte** (`/devices`) und lade die Liste bei Bedarf über **Aktualisieren**
- Filter und Suche nutzen; **Retire** (Abkoppeln) für ein Gerät oder **mehrere ausgewählte** Geräte — optional zugehöriges Benutzerkonto deaktivieren
- **Remote Wipe**: nur nach Eingabe des erwarteten Bestätigungsnamens (siehe Dialog); wirkt auf verwaltete Geräte gemäß Tenant/Intune-Konfiguration

### 5. Neue Benutzer anlegen (Einzeln oder CSV)

- Öffne **Benutzer erstellen / importieren** (`/create`)
- **Einzelner Benutzer**: Formular ausfüllen → **Benutzer erstellen** (nur wenn der erzeugte UPN noch **frei** ist)
- **CSV Import**: Datei wählen → Zeilen in der Tabelle prüfen/anpassen → Massenoperation starten
- Existiert der UPN bereits, meldet das Skript einen Fehler — Änderungen an bestehenden Konten erfolgen über die **Benutzerliste**

### 6. Logs anzeigen

- Unten gibt es eine **Ausgabe-Konsole** (klappbar), die PowerShell/Graph Logs live anzeigt
- Toasts (rechts unten) zeigen Erfolg/Fehler kurz an

## Technische Details

### Architektur

```
Renderer (Vue + Vite)
└── window.ipcRenderer.invoke(...)
    ↓
Electron Main Process (index.js)
├── IPC (u. a. check-pwsh, get-users, get-directory-groups, get-groups-detail, get-group-members,
│         get-group-owners, add-group-members, remove-group-member, update-group, delete-group,
│         list-group-lifecycle-policies, list-group-lifecycle-policies-for-group,
│         save-group-lifecycle-policy, add-groups-to-lifecycle-policy, remove-groups-from-lifecycle-policy,
│         get-devices, retire-intune-device, wipe-intune-device,
│         update-user, update-user-licenses, reset-password, reset-mfa, delete-user, CSV / run-password-update)
├── CSV Parsing + Temp CSV (os.tmpdir)
└── PowerShell Spawn (pwsh / powershell) → scripts/*.ps1
    ↓
Microsoft Graph PowerShell SDK (Connect-MgGraph, Benutzer/Gruppen/Geräte, Lizenzen, Intune-Aktionen)
```

### Workflow

**Benutzerliste laden**
1. Renderer ruft `get-users` per IPC auf
2. Main startet `scripts/get-ms365-users.ps1`
3. PowerShell verbindet sich mit Graph (`Connect-Mg365App`) und gibt JSON zurück (`###JSON_START/END###`)
4. Renderer zeigt Users/Lizenzen an

**Gruppen (Detail)**
1. Renderer ruft z. B. `get-groups-detail`, `get-group-members`, `update-group` usw. auf
2. Main führt die passenden Skripte unter `scripts/` aus (gemeinsame Anmeldung über `Connect-Mg365App.ps1`)

**Geräte**
1. `get-devices` lädt Verzeichnisgeräte inkl. verwaltungsbezogener Kennzeichnung
2. `retire-intune-device` / `wipe-intune-device` rufen `scripts/invoke-intune-device-action.ps1` mit der jeweiligen Aktion auf

**Bulk Create (CSV / Einzeln → gleiches Skript)**
1. CSV wird im Main Process geparst und normalisiert
2. Einträge werden als temporäre CSV ins System-Temp geschrieben
3. Main startet `scripts/update-user-passwords.ps1 -CSVPath <tmp>`
4. Script ermittelt Tenant-Domain, SKUs (A3 Schüler/Lehrer) und verarbeitet jede Zeile:
   - **UPN existiert bereits** → Fehler für diese Zeile (kein Update)
   - **sonst** → `New-MgUser`, UsageLocation, Lizenzzuweisung
5. Logs werden live an die UI gestreamt, Temp-Dateien werden gelöscht

**Einzelkonten in der Benutzerliste** laufen über andere Skripte (`update-user.ps1`, `reset-password.ps1`, `reset-mfa.ps1`, `delete-user.ps1`, Lizenzen über `update-user-licenses.ps1`).

### Dateien

- `index.js`: Electron Main Process mit CSV-Handling und PowerShell-Integration
- `index.html`: Renderer-Entry (Vite) → `src/main.js`
- `preload.js`: IPC-Brücke für sichere Kommunikation
- `scripts/Connect-Mg365App.ps1`: gemeinsame Graph-Anmeldung und Scope-Liste
- `scripts/get-ms365-users.ps1`: Benutzer + Lizenzen laden (JSON Output)
- `scripts/get-groups.ps1`, `get-groups-detail.ps1`: Gruppenlisten
- `scripts/get-group-members.ps1`, `get-group-owners.ps1`, `add-group-members.ps1`, `remove-group-member.ps1`: Mitglieder und Besitzer
- `scripts/update-group.ps1`, `delete-group.ps1`: Gruppe bearbeiten/löschen
- `scripts/group-lifecycle.ps1`: Ablaufrichtlinien (Lifecycle)
- `scripts/get-devices.ps1`: Geräteübersicht
- `scripts/invoke-intune-device-action.ps1`: Intune-Aktionen (z. B. Retire, Wipe)
- `scripts/update-user.ps1`: Benutzerattribute aktualisieren (JSON Output)
- `scripts/reset-password.ps1`: Passwort zurücksetzen (JSON Output)
- `scripts/reset-mfa.ps1`: MFA/2FA Methoden entfernen (JSON Output)
- `scripts/delete-user.ps1`: Benutzer löschen (JSON Output)
- `scripts/update-user-licenses.ps1`: Lizenzen zuweisen/entfernen
- `scripts/update-user-passwords.ps1`: **nur Neuanlage** aus CSV/Einzelbatch + Lizenzzuweisung für neue Konten (Log-Streaming)

## Build

Installierbare Pakete (je nach Plattform) erzeugen:

```bash
npm run build
```

Ausgabe liegt unter `dist/` (z. B. **Linux AppImage**, **Windows NSIS-Setup**, **macOS DMG** — je nachdem, auf welchem OS du baust).

## PowerShell-Kompatibilität

Die App erkennt automatisch, ob `pwsh` (PowerShell Core) oder `powershell` installiert ist und verwendet entsprechend den verfügbaren Befehl.

### Manuelle Ausführung des PowerShell-Skripts

Falls du das Skript manuell testen möchtest:

```bash
pwsh -NoLogo -NoProfile -ExecutionPolicy Bypass \
  -File scripts/update-user-passwords.ps1 \
  -CSVPath /pfad/zur/user-passwords.csv
```

## Fehlerbehebung

### "CSV-Pfad ungültig"
- Stelle sicher, dass die CSV-Datei existiert und lesbar ist
- Prüfe, ob der Pfad Leerzeichen enthält (sollte funktionieren, aber prüfe die Logs)

### "PowerShell mit Fehlern beendet"
- Prüfe die Logs für detaillierte Fehlermeldungen
- Stelle sicher, dass die benötigten `Microsoft.Graph.*`-Module installiert werden können (Internet/PSGallery)
- Prüfe die Berechtigungen deines Microsoft-365-Kontos (je nach Aktion z. B. Benutzer, Gruppen, Geräte, Intune-Privileged Operations)

### Authentifizierungsprobleme
- Beim ersten Start wird ein Browser-Fenster zur Anmeldung geöffnet
- Stelle sicher, dass du dich mit einem Konto anmeldest, das die in `Connect-Mg365App.ps1` genannten Scopes abdeckt
- Die Authentifizierung wird für spätere Ausführungen gespeichert

### Lizenzzuweisung funktioniert nicht
- Prüfe, ob A3-Lizenzen im Tenant verfügbar sind
- Stelle sicher, dass genügend Lizenzen vorhanden sind
- Prüfe die Logs für detaillierte Fehlermeldungen zur Lizenzzuweisung

### Gruppen- oder Geräteaktionen schlagen fehl
- Prüfe, ob die App mit einem Konto verbunden ist, das **Gruppen** bzw. **Geräte/Intune** verwalten darf
- Für **Wipe/Retire** sind u. a. `DeviceManagementManagedDevices.PrivilegedOperations.All` und ein in Intune verwaltetes Gerät nötig

### ANSI-Escape-Codes in den Logs
- Die App filtert automatisch ANSI-Farbcodes aus den Logs
- Falls dennoch Codes erscheinen, melde einen Bug

## Sicherheit

- **Passwörter**: Werden nur während der Verarbeitung im Speicher gehalten
- **Temporäre Dateien**: CSV-Dateien werden im System-Temp-Verzeichnis erstellt und nach Abschluss gelöscht
- **Authentifizierung**: Verwendet OAuth 2.0 mit Microsoft Graph (delegated access)
- **Lokale Speicherung**: Keine Passwörter werden dauerhaft gespeichert
- **Destruktive Geräteaktionen** (Wipe, Retire): bewusst mit Bestätigungsdialogen; nur mit verstandenen Auswirkungen ausführen

## Lizenz

GPL-3.0-or-later — siehe [LICENSE](./LICENSE).
