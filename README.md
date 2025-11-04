# MS-365 Benutzer-Verwaltungs Tool

Eine Electron-App zum Erstellen und Aktualisieren von Microsoft 365/Entra ID (Azure AD) Benutzern über die Microsoft Graph API.

## Übersicht

Dieses Tool ermöglicht es Administratoren, neue Benutzer in Microsoft 365 zu erstellen oder bestehende Benutzer zu aktualisieren. Neue Benutzer erhalten automatisch MS A3 Lizenzen (Schüler oder Lehrer). Die App verwendet die Microsoft Graph PowerShell SDK und bietet eine benutzerfreundliche GUI für den Prozess.

## Features

- **CSV-basierte Benutzer-Verwaltung**: Importiere CSV-Dateien mit Benutzerdaten
- **Automatische Benutzer-Erstellung**: Neue Benutzer werden automatisch erstellt, wenn sie nicht existieren
- **Lizenzzuweisung**: Automatische Zuweisung von MS A3 Lizenzen (Schüler/Lehrer)
- **Automatische UPN-Generierung**: UserPrincipalName wird aus Vorname/Nachname generiert
- **Integrierter CSV-Editor**: Bearbeite Benutzerdaten direkt in der App
- **Microsoft Graph Integration**: Nutzt die offizielle Microsoft Graph API
- **Linux-Unterstützung**: Funktioniert mit PowerShell Core auf Linux
- **Echtzeit-Logging**: Sieh alle Vorgänge in Echtzeit
- **Fehlerbehandlung**: Zeigt fehlgeschlagene Benutzer an

## Voraussetzungen

- **Node.js** und **npm** (für die Entwicklung)
- **PowerShell Core** (`pwsh`) oder **PowerShell** (auf Linux installiert)
  - Auf Arch Linux: `yay -S powershell-bin` oder `paru -S powershell-bin`
  - Alternativ: Installiere PowerShell Core über [Microsoft Docs](https://learn.microsoft.com/powershell/scripting/install/installing-powershell-on-linux)
- **Microsoft Graph-Berechtigungen**: Ein Microsoft 365-Konto mit `User.ReadWrite.All` Berechtigung
- **Microsoft.Graph.Users Modul**: Wird automatisch beim ersten Start installiert
- **Microsoft.Graph.Identity.DirectoryManagement Modul**: Wird automatisch installiert (für Lizenzzuweisung)

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

**Verhalten:**
- Wenn ein Benutzer mit dem generierten UserPrincipalName bereits existiert: Nur das Passwort wird aktualisiert
- Wenn ein Benutzer nicht existiert: Neuer Benutzer wird erstellt mit allen Feldern und erhält die entsprechende Lizenz (Schüler oder Lehrer)

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

### 1. CSV-Datei importieren

- Klicke auf **"CSV importieren"**
- Wähle eine CSV-Datei im oben beschriebenen Format aus
- Die Anzahl der importierten Einträge wird angezeigt

### 2. Einträge bearbeiten (optional)

- Klicke auf **"Einträge bearbeiten"** um den integrierten CSV-Editor zu öffnen
- Füge, bearbeite oder entferne Benutzereinträge
- Änderungen werden automatisch gespeichert

### 3. Benutzer aktualisieren/erstellen

- Klicke auf **"Benutzer aktualisieren/erstellen"**
- Bei der ersten Ausführung wird die Microsoft Graph-Anmeldung durchgeführt:
  - Ein Browser-Fenster öffnet sich automatisch
  - Melde dich mit deinem Microsoft 365 Admin-Konto an
  - Gewähre die erforderlichen Berechtigungen (`User.ReadWrite.All` und `Organization.Read.All`)
- Der Fortschritt wird in Echtzeit angezeigt
- Für jeden Benutzer wird angezeigt, ob er erstellt oder aktualisiert wurde
- Bei Erfolg erscheint: "Alle Benutzer erfolgreich verarbeitet"
- Bei Fehlern werden die betroffenen Benutzer in einer Liste angezeigt

### 4. Logs anzeigen

- Klicke auf das Info-Icon (unten rechts) um das detaillierte Log zu öffnen
- Alle Vorgänge werden mit Zeitstempel angezeigt

## Technische Details

### Architektur

```
Electron Main Process (index.js)
├── CSV Import & Editor
├── PowerShell Process Spawn
│   └── update-user-passwords.ps1
│       ├── Microsoft Graph Authentication
│       └── Batch Password Updates
└── UI Communication (IPC)
```

### Workflow

1. **CSV-Import**: Datei wird geladen und geparst
2. **Temporäre CSV**: Daten werden in eine temporäre CSV-Datei geschrieben
3. **PowerShell-Skript**: Wird mit dem CSV-Pfad als Parameter gestartet
4. **Graph-Authentifizierung**: `Connect-MgGraph` stellt die Verbindung her
5. **Tenant-Domain ermitteln**: Die Domain wird automatisch aus dem angemeldeten Tenant ermittelt
6. **Lizenzen ermitteln**: Verfügbare A3-Lizenzen (Schüler/Lehrer) werden identifiziert
7. **Benutzer-Verarbeitung**: Für jeden CSV-Eintrag:
   - UserPrincipalName und DisplayName werden generiert
   - Prüfung ob Benutzer existiert
   - **Wenn nicht vorhanden**: Neuer Benutzer wird erstellt (`New-MgUser`) und Lizenz zugewiesen (`Set-MgUserLicense`)
   - **Wenn vorhanden**: Nur Passwort wird aktualisiert (`Update-MgUser`)
8. **Fehlerbehandlung**: Fehlgeschlagene Operationen werden erfasst und angezeigt
9. **Aufräumen**: Temporäre Dateien werden gelöscht

### Dateien

- `index.js`: Electron Main Process mit CSV-Handling und PowerShell-Integration
- `index.html`: Benutzeroberfläche
- `editor.html`: CSV-Editor Fenster
- `preload.js`: IPC-Brücke für sichere Kommunikation
- `update-user-passwords.ps1`: PowerShell-Skript für Microsoft Graph API-Aufrufe (Benutzer-Erstellung, Passwort-Update, Lizenzzuweisung)

## Build

Erstelle eine AppImage für Linux:

```bash
npm run build
```

Die AppImage wird im `dist/` Verzeichnis erstellt.

## PowerShell-Kompatibilität

Die App erkennt automatisch, ob `pwsh` (PowerShell Core) oder `powershell` installiert ist und verwendet entsprechend den verfügbaren Befehl.

### Manuelle Ausführung des PowerShell-Skripts

Falls du das Skript manuell testen möchtest:

```bash
pwsh -NoLogo -NoProfile -ExecutionPolicy Bypass \
  -File update-user-passwords.ps1 \
  -CSVPath /pfad/zur/user-passwords.csv
```

## Fehlerbehebung

### "CSV-Pfad ungültig"
- Stelle sicher, dass die CSV-Datei existiert und lesbar ist
- Prüfe, ob der Pfad Leerzeichen enthält (sollte funktionieren, aber prüfe die Logs)

### "PowerShell mit Fehlern beendet"
- Prüfe die Logs für detaillierte Fehlermeldungen
- Stelle sicher, dass PowerShell mit `Microsoft.Graph.Users` und `Microsoft.Graph.Identity.DirectoryManagement` Modulen installiert ist
- Prüfe die Berechtigungen deines Microsoft 365-Kontos (`User.ReadWrite.All` und `Organization.Read.All`)
- Stelle sicher, dass A3-Lizenzen im Tenant verfügbar sind

### Authentifizierungsprobleme
- Beim ersten Start wird ein Browser-Fenster zur Anmeldung geöffnet
- Stelle sicher, dass du dich mit einem Konto anmeldest, das `User.ReadWrite.All` und `Organization.Read.All` Berechtigung hat
- Die Authentifizierung wird für spätere Ausführungen gespeichert

### Lizenzzuweisung funktioniert nicht
- Prüfe, ob A3-Lizenzen im Tenant verfügbar sind
- Stelle sicher, dass genügend Lizenzen vorhanden sind
- Prüfe die Logs für detaillierte Fehlermeldungen zur Lizenzzuweisung

### ANSI-Escape-Codes in den Logs
- Die App filtert automatisch ANSI-Farbcodes aus den Logs
- Falls dennoch Codes erscheinen, melde einen Bug

## Sicherheit

- **Passwörter**: Werden nur während der Verarbeitung im Speicher gehalten
- **Temporäre Dateien**: CSV-Dateien werden im System-Temp-Verzeichnis erstellt und nach Abschluss gelöscht
- **Authentifizierung**: Verwendet OAuth 2.0 mit Microsoft Graph (delegated access)
- **Lokale Speicherung**: Keine Passwörter werden dauerhaft gespeichert

## Lizenz

ISC

## Autor

valueerror

![App UI](./ui.png)
