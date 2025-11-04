import { app, BrowserWindow, ipcMain, dialog } from 'electron' // Electron core modules
import os from 'os' // OS utilities
import fs from 'fs/promises' // Promise-based FS API
import path from 'path' // Path utilities
import { fileURLToPath } from 'url' // ESM helpers
import { spawn, execSync } from 'child_process' // Process spawning

const __filename = fileURLToPath(import.meta.url) // Current file path
const __dirname = path.dirname(__filename) // Current dir path

let win // BrowserWindow ref
let authWindow = null // (unused placeholder for potential extra windows)
let isQuitting = false // App shutdown flag
let csvData = [] // In-memory CSV entries

// (OneDrive-specific configuration removed)

function createWindow() {
    win = new BrowserWindow({
        title: "Passwort-Update Tool", // Title
        width: 860, // Width
        height: 700, // Height
        icon: path.join(__dirname, 'icon.png'), // Icon
        webPreferences:{ preload: path.join(__dirname, 'preload.js') } // Preload script
    })

    win.loadFile('index.html') // Load UI
    win.removeMenu() // Hide menu
}

// Enforce single-instance behavior; on second start, focus/show existing window
const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    try {
      if (win && !win.isDestroyed()) {
        if (win.isMinimized()) win.restore()
        win.show()
        win.focus()
      } else {
        // In rare cases, recreate if no window exists yet
        createWindow()
      }
    } catch {}
  })
}

app.whenReady().then(() => { createWindow() }) // Init app

// Quit the app when all windows are closed (including on macOS for simplicity)
app.on('window-all-closed', () => {
  app.quit()
})

// Cleanup beim Beenden
app.on('before-quit', async () => {
  isQuitting = true
  if (authWindow) {
    authWindow.close()
  }
})

// Safe UI sender
function uiSend(channel, payload) {
  if (isQuitting) return
  try {
    if (win && !win.isDestroyed() && win.webContents && !win.webContents.isDestroyed()) {
      win.webContents.send(channel, payload)
    }
  } catch {}
}

// ===================== CSV Import & Editor =====================
// Normalisiere String für UPN (lowercase, alle Sonderzeichen ersetzen)
function normalizeForUPN(text) {
  if (!text) return ''
  let str = String(text)
  
  // Ersetze zuerst alle Sonderzeichen (auch Großbuchstaben-Varianten)
  // Deutsche Umlaute
  str = str.replace(/[äÄ]/g, 'ae')
  str = str.replace(/[öÖ]/g, 'oe')
  str = str.replace(/[üÜ]/g, 'ue')
  str = str.replace(/[ß]/g, 'ss')
  // Französische/Italienische Akzente
  str = str.replace(/[àáâãÀÁÂÃ]/g, 'a')
  str = str.replace(/[èéêëÈÉÊË]/g, 'e')
  str = str.replace(/[ìíîïÌÍÎÏ]/g, 'i')
  str = str.replace(/[òóôõÒÓÔÕ]/g, 'o')
  str = str.replace(/[ùúûÙÚÛ]/g, 'u')
  str = str.replace(/[ýÿÝŸ]/g, 'y')
  str = str.replace(/[çÇ]/g, 'c')
  str = str.replace(/[ñÑ]/g, 'n')
  
  // Dann zu lowercase konvertieren
  str = str.toLowerCase()
  
  // Zum Schluss alle verbleibenden Sonderzeichen entfernen (außer a-z, 0-9, Punkt)
  str = str.replace(/[^a-z0-9.]/g, '')
  
  return str
}

function parseCsvText(text) {
  const lines = String(text).split(/\r?\n/).filter(l => l.trim().length > 0)
  if (lines.length === 0) return []
  const header = lines[0]
  // Detect delimiter (comma or semicolon)
  const delimiter = header.includes(';') && !header.includes(',') ? ';' : ','
  const headerParts = header.split(delimiter).map(h => h.trim().toLowerCase())
  
  const entries = []
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(delimiter)
    if (parts.length < 2) continue
    
    // Finde Spaltenindizes basierend auf Header
    const getIndex = (names) => {
      for (const name of names) {
        const idx = headerParts.findIndex(h => h.includes(name.toLowerCase()))
        if (idx !== -1) return idx
      }
      return -1
    }
    
    const vornameIdx = getIndex(['vorname', 'givenname', 'firstname'])
    const nachnameIdx = getIndex(['nachname', 'surname', 'lastname'])
    const vornameNormIdx = getIndex(['vornamenormalized'])
    const nachnameNormIdx = getIndex(['nachnamenormalized'])
    const abteilungIdx = getIndex(['abteilung', 'department'])
    const userTypeIdx = getIndex(['usertype', 'type'])
    const pwdIdx = getIndex(['newpassword', 'password', 'passwort'])
    const forceIdx = getIndex(['forcechange', 'force'])
    
    const vorname = vornameIdx >= 0 ? (parts[vornameIdx] || '').trim() : ''
    const nachname = nachnameIdx >= 0 ? (parts[nachnameIdx] || '').trim() : ''
    const abteilung = abteilungIdx >= 0 ? (parts[abteilungIdx] || '').trim() : ''
    const userType = userTypeIdx >= 0 ? (parts[userTypeIdx] || '').trim() : 'Schüler'
    const pwd = pwdIdx >= 0 ? (parts[pwdIdx] || '').trim() : ''
    const forceRaw = forceIdx >= 0 ? (parts[forceIdx] || '').trim() : ''
    
    // Wenn Vorname oder Nachname fehlt, überspringe Eintrag
    if (!vorname || !nachname) continue
    
    // Verwende normalisierte Werte aus CSV falls vorhanden, sonst normalisiere selbst
    let normalizedVorname = vornameNormIdx >= 0 ? (parts[vornameNormIdx] || '').trim() : ''
    let normalizedNachname = nachnameNormIdx >= 0 ? (parts[nachnameNormIdx] || '').trim() : ''
    
    if (!normalizedVorname) normalizedVorname = normalizeForUPN(vorname)
    if (!normalizedNachname) normalizedNachname = normalizeForUPN(nachname)
    
    entries.push({
      vorname,
      nachname,
      vornameNormalized: normalizedVorname,
      nachnameNormalized: normalizedNachname,
      abteilung,
      userType: userType || 'Schüler',
      newPassword: pwd,
      forceChange: forceRaw === '1' || /true/i.test(forceRaw)
    })
  }
  return entries
}

function toSemicolonCsv(entries) {
  // CSV enthält auch die normalisierten Werte für PowerShell-Skript
  const lines = ['Vorname;Nachname;VornameNormalized;NachnameNormalized;Abteilung;UserType;NewPassword;ForceChange']
  for (const e of entries) {
    const force = e.forceChange ? '1' : '0'
    const vorname = String(e.vorname || '').replaceAll(';', ',')
    const nachname = String(e.nachname || '').replaceAll(';', ',')
    // Normalisiere falls nicht bereits vorhanden
    const vornameNorm = e.vornameNormalized || normalizeForUPN(e.vorname || '')
    const nachnameNorm = e.nachnameNormalized || normalizeForUPN(e.nachname || '')
    const abteilung = String(e.abteilung || '').replaceAll(';', ',')
    const userType = String(e.userType || 'Schüler').replaceAll(';', ',')
    const pwd = String(e.newPassword || '').replaceAll(';', ',')
    lines.push(`${vorname};${nachname};${vornameNorm};${nachnameNorm};${abteilung};${userType};${pwd};${force}`)
  }
  return lines.join('\n')
}

let csvEditorWindow = null
function openCsvEditorWindow() {
  if (csvEditorWindow && !csvEditorWindow.isDestroyed()) {
    csvEditorWindow.focus()
    return
  }
  csvEditorWindow = new BrowserWindow({
    title: 'CSV bearbeiten',
    width: 1200,
    height: 600,
    minWidth: 1200,
    webPreferences:{ preload: path.join(__dirname, 'preload.js') }
  })
  csvEditorWindow.loadFile('editor.html')
  csvEditorWindow.removeMenu()
  csvEditorWindow.on('closed', () => { csvEditorWindow = null })
}

ipcMain.handle('open-csv-dialog', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(win, {
    title: 'CSV-Datei wählen',
    properties: ['openFile'],
    filters: [{ name: 'CSV', extensions: ['csv'] }]
  })
  if (canceled || !filePaths || filePaths.length === 0) {
    return { status: 'cancelled' }
  }
  try {
    // Lese Datei als Buffer für Encoding-Erkennung
    const buffer = await fs.readFile(filePaths[0])
    let content = null
    
    // Prüfe auf UTF-8 BOM
    if (buffer.length >= 3 && buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF) {
      // UTF-8 mit BOM
      content = buffer.slice(3).toString('utf8')
    } else {
      // Versuche verschiedene Encodings
      // Excel/Windows speichert CSV oft als Windows-1252 (ähnlich Latin-1), nicht UTF-8
      const encodings = [
        { name: 'latin1', func: () => buffer.toString('latin1') }, // Windows-1252 ist fast identisch zu Latin-1
        { name: 'utf8', func: () => buffer.toString('utf8') }
      ]
      
      // Versuche jedes Encoding und prüfe auf gültige deutsche Umlaute
      for (const encoding of encodings) {
        try {
          const testContent = encoding.func()
          // Prüfe auf ungültige UTF-8 Replacement Characters
          if (encoding.name === 'utf8' && testContent.includes('\uFFFD')) {
            continue // Ungültiges UTF-8, versuche nächstes Encoding
          }
          // Prüfe ob deutsche Umlaute korrekt vorhanden sind
          // Wenn wir "ö", "ä", "ü" oder deren Großbuchstaben finden, ist das Encoding wahrscheinlich richtig
          const hasGermanChars = /[öäüÖÄÜß]/.test(testContent)
          if (hasGermanChars || encoding.name === 'latin1') {
            // Latin-1 bevorzugen wenn es deutsche Zeichen gibt (typisch für Windows CSV)
            content = testContent
            if (hasGermanChars && encoding.name === 'latin1') {
              break // Latin-1 ist wahrscheinlich richtig wenn deutsche Zeichen gefunden wurden
            }
          }
        } catch (e) {
          continue
        }
      }
      
      // Fallback: UTF-8 wenn nichts funktioniert
      if (!content) {
        content = buffer.toString('utf8')
      }
    }
    
    csvData = parseCsvText(content)
    return { status: 'ok', count: csvData.length }
  } catch (e) {
    return { status: 'error', message: e?.message || 'CSV konnte nicht gelesen werden' }
  }
})

ipcMain.handle('open-csv-editor', async () => {
  openCsvEditorWindow()
  return { status: 'ok' }
})

ipcMain.handle('get-csv-data', async () => {
  return { status: 'ok', data: csvData }
})

ipcMain.handle('set-csv-data', async (_event, data) => {
  if (!Array.isArray(data)) return { status: 'error', message: 'Invalid data' }
  // Normalize fields und normalisiere Vorname/Nachname für UPN
  csvData = data.map(e => {
    const vorname = String(e.vorname || '').trim()
    const nachname = String(e.nachname || '').trim()
    return {
      vorname,
      nachname,
      vornameNormalized: normalizeForUPN(vorname),
      nachnameNormalized: normalizeForUPN(nachname),
      abteilung: String(e.abteilung || '').trim(),
      userType: String(e.userType || 'Schüler').trim(),
      newPassword: String(e.newPassword || ''),
      forceChange: Boolean(e.forceChange)
    }
  }).filter(e => e.vorname && e.nachname) // Mindestens Vorname und Nachname müssen vorhanden sein
  return { status: 'ok', count: csvData.length }
})

// ===================== PowerShell Execution =====================
ipcMain.handle('run-password-update', async () => {
  try {
    if (!csvData || csvData.length === 0) {
      return { status: 'error', message: 'Keine CSV-Daten geladen' }
    }
    // Write temp semicolon-separated CSV to match PowerShell script expectations
    // UTF-8 mit BOM für PowerShell-Kompatibilität
    const tmpDir = os.tmpdir()
    const tmpCsv = path.join(tmpDir, `user-passwords-${Date.now()}.csv`)
    const csvContent = '\uFEFF' + toSemicolonCsv(csvData) // UTF-8 BOM hinzufügen
    await fs.writeFile(tmpCsv, csvContent, 'utf8')

    // Get script path - use app.getAppPath() for AppImage compatibility
    // In AppImages, __dirname may not work correctly
    const appPath = app.isPackaged ? app.getAppPath() : __dirname
    const scriptPathSource = path.join(appPath, 'update-user-passwords.ps1')
    
    // Copy script to temp dir to ensure it's accessible in AppImage
    const scriptPath = path.join(tmpDir, `update-user-passwords-${Date.now()}.ps1`)
    try {
      await fs.copyFile(scriptPathSource, scriptPath)
    } catch (err) {
      // Fallback: try __dirname if app.getAppPath() doesn't work
      const fallbackPath = path.join(__dirname, 'update-user-passwords.ps1')
      try {
        await fs.copyFile(fallbackPath, scriptPath)
      } catch (err2) {
        return { status: 'error', message: `PowerShell-Skript nicht gefunden: ${err.message}` }
      }
    }

    // Detect PowerShell command (pwsh or powershell)
    const powershellCmd = (() => {
      try { execSync('which pwsh', { stdio: 'ignore' }); return 'pwsh' } catch {}
      try { execSync('which powershell', { stdio: 'ignore' }); return 'powershell' } catch {}
      return 'pwsh' // fallback
    })()

    const env = { 
      ...process.env,
      POWERSHELL_UPDATECHECK: 'Off',
      POWERSHELL_TELEMETRY_OPTOUT: '1',
      CSV_PATH: tmpCsv  // Übergebe CSV-Pfad als Umgebungsvariable
    }
    const failedUsers = new Set()
    const pwsh = spawn(powershellCmd, ['-NoLogo', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', scriptPath, '-CSVPath', tmpCsv], {
      cwd: path.dirname(tmpCsv),
      env
    })

    const sendLog = (type, message) => uiSend('pwsh-log', { type, message })

    const parseFail = (line) => {
      // Expect lines like: "-> FEHLER ... für <UPN>: <message>"
      const m = /FEHLER.*(?:für|for)\s+([^:\s]+)\s*:/.exec(line)
      if (m && m[1]) failedUsers.add(m[1])
    }

    // Remove ANSI escape codes from text
    const stripAnsiCodes = (text) => {
      return text.replace(/\x1b\[[0-9;]*[mGK]/g, '').replace(/\x1b\[[0-9;]*[HJ]/g, '')
    }

    // Filter out PowerShell help messages
    const isHelpMessage = (line) => {
      const helpPatterns = [
        /^All parameters are case-insensitive/i,
        /^PowerShell Online Help/i,
        /^pwsh\[?\.exe\]?.*-h.*-Help/i,
        /^\[-.*\]$/,
        /^\[-Version\]/,
        /^\[-WindowStyle/,
        /^\[-WorkingDirectory/
      ]
      return helpPatterns.some(pattern => pattern.test(line))
    }

    pwsh.stdout?.on('data', (d) => {
      const text = d.toString()
      for (const line of text.split(/\r?\n/)) {
        if (!line.trim()) continue
        const cleanLine = stripAnsiCodes(line)
        if (isHelpMessage(cleanLine)) continue // Skip help messages
        sendLog('info', cleanLine)
        if (/FEHLER/i.test(cleanLine)) parseFail(cleanLine)
      }
    })
    pwsh.stderr?.on('data', (d) => {
      const text = d.toString()
      for (const line of text.split(/\r?\n/)) {
        if (!line.trim()) continue
        const cleanLine = stripAnsiCodes(line)
        if (isHelpMessage(cleanLine)) continue // Skip help messages
        sendLog('error', cleanLine)
        // Sometimes errors include UPN
        parseFail(cleanLine)
      }
    })

    return await new Promise((resolve) => {
      pwsh.on('exit', async (code) => {
        try { await fs.unlink(tmpCsv) } catch {}
        try { await fs.unlink(scriptPath) } catch {}
        uiSend('pwsh-complete', { status: code === 0 ? 'success' : 'error', failedUsers: Array.from(failedUsers), exitCode: code })
        resolve({ status: code === 0 ? 'ok' : 'failed', failedUsers: Array.from(failedUsers) })
      })
      pwsh.on('error', async (err) => {
        try { await fs.unlink(tmpCsv) } catch {}
        try { await fs.unlink(scriptPath) } catch {}
        uiSend('pwsh-complete', { status: 'error', message: err?.message || String(err), failedUsers: [] })
        resolve({ status: 'error', message: err?.message || String(err) })
      })
    })
  } catch (e) {
    return { status: 'error', message: e?.message || 'Fehler beim Ausführen' }
  }
})