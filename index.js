import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import os from 'os'
import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import { spawn, execSync } from 'child_process'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL

let win
let isQuitting = false
let csvData = []

// ===================== Window Management =====================

function createWindow() {
  win = new BrowserWindow({
    title: 'MS365 User Management',
    icon: path.join(__dirname, 'icon.png'),
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      spellcheck: false
    }
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
    win.webContents.openDevTools()
  } else {
    const indexPath = path.join(
      app.isPackaged ? app.getAppPath() : __dirname,
      'dist', 'index.html'
    )
    win.loadFile(indexPath)
  }
  win.removeMenu()
}

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
      }
    } catch {}
  })
}

app.whenReady().then(() => { createWindow() })
app.on('window-all-closed', () => { app.quit() })
app.on('before-quit', async () => { isQuitting = true })

function uiSend(channel, payload) {
  if (isQuitting) return
  try {
    if (win && !win.isDestroyed() && win.webContents && !win.webContents.isDestroyed()) {
      win.webContents.send(channel, payload)
    }
  } catch {}
}

// ===================== PowerShell Utilities =====================

const stripAnsi = (t) => t.replace(/\x1b\[[0-9;]*[mGK]/g, '').replace(/\x1b\[[0-9;]*[HJ]/g, '')

function detectPowerShell() {
  try { execSync('which pwsh', { stdio: 'ignore' }); return 'pwsh' } catch {}
  try { execSync('where.exe pwsh', { stdio: 'ignore' }); return 'pwsh' } catch {}
  try { execSync('which powershell', { stdio: 'ignore' }); return 'powershell' } catch {}
  return 'pwsh'
}

async function getScriptPath(scriptRelPath) {
  const appPath = app.isPackaged ? app.getAppPath() : __dirname
  const tmpScript = path.join(os.tmpdir(), `ms365-${Date.now()}-${path.basename(scriptRelPath)}`)
  const candidates = [
    path.join(appPath, scriptRelPath),
    path.join(__dirname, scriptRelPath)
  ]
  for (const src of candidates) {
    try {
      await fs.copyFile(src, tmpScript)
      return tmpScript
    } catch {}
  }
  throw new Error(`Skript nicht gefunden: ${scriptRelPath}`)
}

async function runPsScript(scriptRelPath, args = [], onLog = null) {
  let tmpScript = null
  try {
    tmpScript = await getScriptPath(scriptRelPath)
  } catch (err) {
    return { exitCode: -1, stdout: '', stderr: err.message }
  }

  const psCmd = detectPowerShell()
  const env = {
    ...process.env,
    POWERSHELL_UPDATECHECK: 'Off',
    POWERSHELL_TELEMETRY_OPTOUT: '1'
  }

  const PS_TIMEOUT_MS = 5 * 60 * 1000

  return new Promise((resolve) => {
    let stdout = ''
    let stderr = ''
    let timedOut = false
    let settled = false
    const ps = spawn(
      psCmd,
      ['-NoLogo', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', tmpScript, ...args],
      { cwd: path.dirname(tmpScript), env, stdio: ['ignore', 'pipe', 'pipe'] }
    )

    const timer = setTimeout(() => {
      timedOut = true
      try { ps.kill('SIGTERM') } catch {}
    }, PS_TIMEOUT_MS)

    const finish = async (payload) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      try { if (tmpScript) await fs.unlink(tmpScript) } catch {}
      resolve(payload)
    }

    ps.stdout?.on('data', (d) => {
      const text = d.toString()
      stdout += text
      if (onLog) {
        for (const line of text.split(/\r?\n/)) {
          const clean = stripAnsi(line.trim())
          if (clean && !clean.includes('###JSON_')) onLog({ type: 'info', message: clean })
        }
      }
    })

    ps.stderr?.on('data', (d) => {
      const text = d.toString()
      stderr += text
      if (onLog) {
        for (const line of text.split(/\r?\n/)) {
          const clean = stripAnsi(line.trim())
          if (clean) onLog({ type: 'error', message: clean })
        }
      }
    })

    ps.on('exit', async (code) => {
      const out = stdout.trim()
      const err = stderr.trim()
      if (timedOut) {
        await finish({
          exitCode: -1,
          stdout: out,
          stderr: err || 'Timeout: PowerShell hat zu lange gebraucht (z. B. Browser-Anmeldung bei Microsoft Graph abschließen).'
        })
        return
      }
      await finish({ exitCode: code, stdout: out, stderr: err })
    })

    ps.on('error', async (err) => {
      await finish({ exitCode: -1, stdout: '', stderr: err.message })
    })
  })
}

function parseJsonFromOutput(stdout) {
  const patterns = [
    /###JSON_START###\s*\r?\n([\s\S]*?)\r?\n\s*###JSON_END###/,
    /###JSON_START###\s*([\s\S]*?)\s*###JSON_END###/
  ]
  for (const re of patterns) {
    const match = stdout.match(re)
    if (match) {
      try { return JSON.parse(match[1].trim()) } catch {}
    }
  }
  try { return JSON.parse(stdout) } catch {}
  return null
}

// ===================== CSV Utilities =====================

function normalizeForUPN(text) {
  if (!text) return ''
  let s = String(text)
  s = s.replace(/[äÄ]/g, 'ae').replace(/[öÖ]/g, 'oe').replace(/[üÜ]/g, 'ue').replace(/[ß]/g, 'ss')
  s = s.replace(/[àáâãÀÁÂÃ]/g, 'a').replace(/[èéêëÈÉÊË]/g, 'e').replace(/[ìíîïÌÍÎÏ]/g, 'i')
  s = s.replace(/[òóôõÒÓÔÕ]/g, 'o').replace(/[ùúûÙÚÛ]/g, 'u').replace(/[ýÿÝŸ]/g, 'y')
  s = s.replace(/[çÇ]/g, 'c').replace(/[ñÑ]/g, 'n')
  return s.toLowerCase().replace(/[^a-z0-9.]/g, '')
}

function parseCsvText(text) {
  const lines = String(text).split(/\r?\n/).filter(l => l.trim().length > 0)
  if (lines.length === 0) return []
  const header = lines[0]
  const delimiter = header.includes(';') && !header.includes(',') ? ';' : ','
  const headerParts = header.split(delimiter).map(h => h.trim().toLowerCase())

  const getIdx = (names) => {
    for (const n of names) {
      const i = headerParts.findIndex(h => h.includes(n.toLowerCase()))
      if (i !== -1) return i
    }
    return -1
  }

  const entries = []
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(delimiter)
    if (parts.length < 2) continue
    const vi = getIdx(['vorname', 'givenname', 'firstname'])
    const ni = getIdx(['nachname', 'surname', 'lastname'])
    const vorname = vi >= 0 ? (parts[vi] || '').trim() : ''
    const nachname = ni >= 0 ? (parts[ni] || '').trim() : ''
    if (!vorname || !nachname) continue

    const vni = getIdx(['vornamenormalized'])
    const nni = getIdx(['nachnamenormalized'])
    const ai = getIdx(['abteilung', 'department'])
    const ti = getIdx(['usertype', 'type'])
    const pi = getIdx(['newpassword', 'password', 'passwort'])
    const fi = getIdx(['forcechange', 'force'])

    const abteilung = ai >= 0 ? (parts[ai] || '').trim() : ''
    const userType = ti >= 0 ? (parts[ti] || '').trim() : 'Schüler'
    const pwd = pi >= 0 ? (parts[pi] || '').trim() : ''
    const forceRaw = fi >= 0 ? (parts[fi] || '').trim() : ''
    const vnorm = vni >= 0 ? (parts[vni] || '').trim() : ''
    const nnorm = nni >= 0 ? (parts[nni] || '').trim() : ''

    entries.push({
      vorname, nachname,
      vornameNormalized: vnorm || normalizeForUPN(vorname),
      nachnameNormalized: nnorm || normalizeForUPN(nachname),
      abteilung,
      userType: userType || 'Schüler',
      newPassword: pwd,
      forceChange: forceRaw === '1' || /true/i.test(forceRaw)
    })
  }
  return entries
}

function toSemicolonCsv(entries) {
  const lines = ['Vorname;Nachname;VornameNormalized;NachnameNormalized;Abteilung;UserType;NewPassword;ForceChange']
  for (const e of entries) {
    const esc = (s) => String(s || '').replaceAll(';', ',')
    const vn = e.vornameNormalized || normalizeForUPN(e.vorname || '')
    const nn = e.nachnameNormalized || normalizeForUPN(e.nachname || '')
    lines.push(`${esc(e.vorname)};${esc(e.nachname)};${vn};${nn};${esc(e.abteilung)};${esc(e.userType)};${esc(e.newPassword)};${e.forceChange ? '1' : '0'}`)
  }
  return lines.join('\n')
}

// ===================== IPC: CSV Import =====================

ipcMain.handle('open-csv-dialog', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(win, {
    title: 'CSV-Datei wählen',
    properties: ['openFile'],
    filters: [{ name: 'CSV', extensions: ['csv'] }]
  })
  if (canceled || !filePaths?.length) return { status: 'cancelled' }
  try {
    const buffer = await fs.readFile(filePaths[0])
    let content
    if (buffer.length >= 3 && buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF) {
      content = buffer.slice(3).toString('utf8')
    } else {
      const latin1 = buffer.toString('latin1')
      content = /[öäüÖÄÜß]/.test(latin1) ? latin1 : buffer.toString('utf8')
    }
    csvData = parseCsvText(content)
    return { status: 'ok', count: csvData.length }
  } catch (e) {
    return { status: 'error', message: e?.message || 'CSV konnte nicht gelesen werden' }
  }
})

ipcMain.handle('get-csv-data', async () => ({ status: 'ok', data: csvData }))

ipcMain.handle('set-csv-data', async (_event, data) => {
  if (!Array.isArray(data)) return { status: 'error', message: 'Invalid data' }
  csvData = data.map(e => {
    const vorname = String(e.vorname || '').trim()
    const nachname = String(e.nachname || '').trim()
    return {
      vorname, nachname,
      vornameNormalized: normalizeForUPN(vorname),
      nachnameNormalized: normalizeForUPN(nachname),
      abteilung: String(e.abteilung || '').trim(),
      userType: String(e.userType || 'Schüler').trim(),
      newPassword: String(e.newPassword || ''),
      forceChange: Boolean(e.forceChange)
    }
  }).filter(e => e.vorname && e.nachname)
  return { status: 'ok', count: csvData.length }
})

ipcMain.handle('normalize-for-upn', async (_event, text) => normalizeForUPN(text))

// ===================== IPC: Bulk Create/Update =====================

ipcMain.handle('run-password-update', async () => {
  try {
    if (!csvData?.length) {
      uiSend('pwsh-log', { type: 'error', message: 'FEHLER: Keine CSV-Daten vorhanden. Bitte zuerst Daten hinzufügen.' })
      uiSend('pwsh-complete', { status: 'error', message: 'Keine CSV-Daten geladen', exitCode: -1, failedUsers: [] })
      return { status: 'error', message: 'Keine CSV-Daten geladen' }
    }

    const tmpDir = os.tmpdir()
    const tmpCsv = path.join(tmpDir, `user-passwords-${Date.now()}.csv`)
    await fs.writeFile(tmpCsv, '\uFEFF' + toSemicolonCsv(csvData), 'utf8')

    let scriptPath
    for (const rel of ['scripts/update-user-passwords.ps1', 'update-user-passwords.ps1']) {
      try { scriptPath = await getScriptPath(rel); break } catch {}
    }
    if (!scriptPath) return { status: 'error', message: 'PowerShell-Skript nicht gefunden' }

    const psCmd = detectPowerShell()
    const failedUsers = new Set()
    const failedUserDetails = {}
    const env = { ...process.env, POWERSHELL_UPDATECHECK: 'Off', POWERSHELL_TELEMETRY_OPTOUT: '1' }

    const pwsh = spawn(psCmd, ['-NoLogo', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', scriptPath, '-CSVPath', tmpCsv], {
      cwd: path.dirname(tmpCsv), env
    })

    const parseFail = (line) => {
      const markerIdx = line.indexOf('###USER_FAIL###')
      if (markerIdx !== -1) {
        const payload = line.slice(markerIdx)
        const parts = payload.split('###')
        const upn = parts?.[2]?.trim()
        const message = parts?.slice(3).join('###')?.trim()
        if (upn) {
          failedUsers.add(upn)
          failedUserDetails[upn] = message || 'Unbekannter Fehler'
        }
        return
      }
      const m = /FEHLER.*(?:für|for)\s+([^:\s]+)\s*:/.exec(line)
      if (m?.[1]) failedUsers.add(m[1])
    }

    pwsh.stdout?.on('data', (d) => {
      for (const line of d.toString().split(/\r?\n/)) {
        const clean = stripAnsi(line.trim())
        if (!clean) continue
        parseFail(clean)
        if (clean.startsWith('###USER_FAIL###')) continue
        uiSend('pwsh-log', { type: /FEHLER/i.test(clean) ? 'error' : 'info', message: clean })
      }
    })
    pwsh.stderr?.on('data', (d) => {
      for (const line of d.toString().split(/\r?\n/)) {
        const clean = stripAnsi(line.trim())
        if (!clean) continue
        uiSend('pwsh-log', { type: 'error', message: clean })
        parseFail(clean)
      }
    })

    return await new Promise((resolve) => {
      pwsh.on('exit', async (code) => {
        try { await fs.unlink(tmpCsv) } catch {}
        try { await fs.unlink(scriptPath) } catch {}
        const ok = code === 0
        const message = ok
          ? undefined
          : (Object.keys(failedUserDetails).length
            ? 'Ein oder mehrere Benutzer sind fehlgeschlagen'
            : 'PowerShell-Fehler')
        uiSend('pwsh-complete', { status: ok ? 'success' : 'error', message, failedUsers: [...failedUsers], failedUserDetails, exitCode: code })
        resolve({ status: ok ? 'ok' : 'failed', message, failedUsers: [...failedUsers], failedUserDetails })
      })
      pwsh.on('error', async (err) => {
        try { await fs.unlink(tmpCsv) } catch {}
        try { await fs.unlink(scriptPath) } catch {}
        uiSend('pwsh-complete', { status: 'error', message: err?.message, failedUsers: [], failedUserDetails: {} })
        resolve({ status: 'error', message: err?.message, failedUsers: [], failedUserDetails: {} })
      })
    })
  } catch (e) {
    return { status: 'error', message: e?.message }
  }
})

// ===================== IPC: User Management =====================

ipcMain.handle('get-users', async () => {
  try {
    const result = await runPsScript('scripts/get-ms365-users.ps1', [], (log) => {
      uiSend('ps-operation-log', log)
    })
    if (result.exitCode === -1 && !result.stdout) {
      return { status: 'error', message: result.stderr || 'PowerShell konnte nicht gestartet werden' }
    }
    const data = parseJsonFromOutput(result.stdout)
    if (!data) {
      return { status: 'error', message: result.stderr || 'Keine Daten von PowerShell erhalten. Bitte prüfe ob pwsh installiert ist.' }
    }
    uiSend('ps-operation-complete', { status: data.status })
    return data
  } catch (e) {
    return { status: 'error', message: e?.message }
  }
})

ipcMain.handle('reset-password', async (_event, { upn, newPassword, forceChange }) => {
  try {
    const args = ['-UPN', upn, '-NewPassword', newPassword, '-ForceChange', forceChange ? '1' : '0']
    const result = await runPsScript('scripts/reset-password.ps1', args, (log) => {
      uiSend('ps-operation-log', log)
    })
    const data = parseJsonFromOutput(result.stdout)
    if (!data) return { status: 'error', message: result.stderr || 'Fehler beim Passwort-Reset' }
    uiSend('ps-operation-complete', { status: data.status, upn })
    return data
  } catch (e) {
    return { status: 'error', message: e?.message }
  }
})

ipcMain.handle('reset-mfa', async (_event, { upn }) => {
  try {
    const result = await runPsScript('scripts/reset-mfa.ps1', ['-UPN', upn], (log) => {
      uiSend('ps-operation-log', log)
    })
    const data = parseJsonFromOutput(result.stdout)
    if (!data) return { status: 'error', message: result.stderr || 'Fehler beim MFA-Reset' }
    uiSend('ps-operation-complete', { status: data.status, upn })
    return data
  } catch (e) {
    return { status: 'error', message: e?.message }
  }
})

ipcMain.handle('update-user', async (_event, params) => {
  try {
    const { upn, displayName, givenName, surname, department, jobTitle, accountEnabled, usageLocation } = params
    const args = ['-UPN', upn]
    if (displayName !== undefined) args.push('-DisplayName', displayName)
    if (givenName !== undefined) args.push('-GivenName', givenName)
    if (surname !== undefined) args.push('-Surname', surname)
    if (department !== undefined) args.push('-Department', department)
    if (jobTitle !== undefined) args.push('-JobTitle', jobTitle)
    if (accountEnabled !== undefined) args.push('-AccountEnabled', accountEnabled ? '1' : '0')
    if (usageLocation !== undefined) args.push('-UsageLocation', usageLocation)

    const result = await runPsScript('scripts/update-user.ps1', args, (log) => {
      uiSend('ps-operation-log', log)
    })
    const data = parseJsonFromOutput(result.stdout)
    if (!data) return { status: 'error', message: result.stderr || 'Fehler beim Aktualisieren' }
    uiSend('ps-operation-complete', { status: data.status, upn })
    return data
  } catch (e) {
    return { status: 'error', message: e?.message }
  }
})

ipcMain.handle('delete-user', async (_event, { upn }) => {
  try {
    const result = await runPsScript('scripts/delete-user.ps1', ['-UPN', upn], (log) => {
      uiSend('ps-operation-log', log)
    })
    const data = parseJsonFromOutput(result.stdout)
    if (!data) return { status: 'error', message: result.stderr || 'Fehler beim Löschen' }
    uiSend('ps-operation-complete', { status: data.status, upn })
    return data
  } catch (e) {
    return { status: 'error', message: e?.message }
  }
})

ipcMain.handle('update-user-licenses', async (_event, { upn, addSkuIds = [], removeSkuIds = [] }) => {
  try {
    const add = Array.isArray(addSkuIds) ? addSkuIds.filter(Boolean).join(',') : ''
    const rem = Array.isArray(removeSkuIds) ? removeSkuIds.filter(Boolean).join(',') : ''
    const result = await runPsScript('scripts/update-user-licenses.ps1', ['-UPN', upn, '-AddSkuIds', add, '-RemoveSkuIds', rem], (log) => {
      uiSend('ps-operation-log', log)
    })
    const data = parseJsonFromOutput(result.stdout)
    if (!data) return { status: 'error', message: result.stderr || 'Fehler bei Lizenzen' }
    uiSend('ps-operation-complete', { status: data.status, upn })
    return data
  } catch (e) {
    return { status: 'error', message: e?.message }
  }
})
