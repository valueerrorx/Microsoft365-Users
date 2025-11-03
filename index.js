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
        width: 760, // Width
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
function parseCsvText(text) {
  const lines = String(text).split(/\r?\n/).filter(l => l.trim().length > 0)
  if (lines.length === 0) return []
  const header = lines[0]
  // Detect delimiter (comma or semicolon)
  const delimiter = header.includes(';') && !header.includes(',') ? ';' : ','
  const [h1, h2, h3] = header.split(delimiter).map(h => h.trim())
  const mapIndex = {
    upn: h1,
    pwd: h2,
    force: h3
  }
  const entries = []
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(delimiter)
    if (parts.length < 2) continue
    const upn = (parts[0] || '').trim()
    const pwd = (parts[1] || '').trim()
    const forceRaw = (parts[2] || '').trim()
    if (!upn) continue
    entries.push({ userPrincipalName: upn, newPassword: pwd, forceChange: forceRaw === '1' || /true/i.test(forceRaw) })
  }
  return entries
}

function toSemicolonCsv(entries) {
  const lines = ['UserPrincipalName;NewPassword;ForceChange']
  for (const e of entries) {
    const force = e.forceChange ? '1' : '0'
    const upn = e.userPrincipalName ?? ''
    const pwd = e.newPassword ?? ''
    // Basic escaping: replace semicolons to avoid delimiter breakage
    lines.push(`${String(upn).replaceAll(';', ',')};${String(pwd).replaceAll(';', ',')};${force}`)
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
    width: 800,
    height: 600,
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
    const content = await fs.readFile(filePaths[0], 'utf8')
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
  // Normalize fields
  csvData = data.map(e => ({
    userPrincipalName: String(e.userPrincipalName || '').trim(),
    newPassword: String(e.newPassword || ''),
    forceChange: Boolean(e.forceChange)
  })).filter(e => e.userPrincipalName)
  return { status: 'ok', count: csvData.length }
})

// ===================== PowerShell Execution =====================
ipcMain.handle('run-password-update', async () => {
  try {
    if (!csvData || csvData.length === 0) {
      return { status: 'error', message: 'Keine CSV-Daten geladen' }
    }
    // Write temp semicolon-separated CSV to match PowerShell script expectations
    const tmpDir = os.tmpdir()
    const tmpCsv = path.join(tmpDir, `user-passwords-${Date.now()}.csv`)
    await fs.writeFile(tmpCsv, toSemicolonCsv(csvData), 'utf8')

    // Copy script to temp dir with adjusted CSV path via env var or working directory
    const scriptPath = path.join(__dirname, 'update-user-passwords.ps1')

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
        uiSend('pwsh-complete', { status: code === 0 ? 'success' : 'error', failedUsers: Array.from(failedUsers), exitCode: code })
        resolve({ status: code === 0 ? 'ok' : 'failed', failedUsers: Array.from(failedUsers) })
      })
      pwsh.on('error', async (err) => {
        try { await fs.unlink(tmpCsv) } catch {}
        uiSend('pwsh-complete', { status: 'error', message: err?.message || String(err), failedUsers: [] })
        resolve({ status: 'error', message: err?.message || String(err) })
      })
    })
  } catch (e) {
    return { status: 'error', message: e?.message || 'Fehler beim Ausführen' }
  }
})