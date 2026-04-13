import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import os from 'os'
import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import { spawn, execSync, spawnSync } from 'child_process'

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
    width: 1600,
    height: 940,
    minWidth: 1600,
    minHeight: 940,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      spellcheck: false
    }
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
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

/** On Linux/macOS: true if pwsh runs; Windows always returns shouldWarn: false. */
function checkPwshForDashboard() {
  if (process.platform === 'win32') return { shouldWarn: false }
  const r = spawnSync('pwsh', ['-NoLogo', '-NoProfile', '-Command', 'exit 0'], {
    stdio: 'ignore',
    timeout: 15000,
    windowsHide: true
  })
  const ok = r.status === 0 && !r.error
  return { shouldWarn: !ok }
}

// Copy main script plus Connect-Mg365App.ps1 into one temp dir so pwsh can dot-source shared Graph scopes.
async function getScriptPath(scriptRelPath) {
  const appPath = app.isPackaged ? app.getAppPath() : __dirname
  const workDir = path.join(os.tmpdir(), `ms365-run-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`)
  await fs.mkdir(workDir, { recursive: true })
  const mainName = path.basename(scriptRelPath)
  const tmpScript = path.join(workDir, mainName)
  const candidates = [
    path.join(appPath, scriptRelPath),
    path.join(__dirname, scriptRelPath)
  ]
  let copied = false
  for (const src of candidates) {
    try {
      await fs.copyFile(src, tmpScript)
      copied = true
      break
    } catch {}
  }
  if (!copied) {
    try { await fs.rm(workDir, { recursive: true, force: true }) } catch {}
    throw new Error(`Skript nicht gefunden: ${scriptRelPath}`)
  }
  const helperName = 'Connect-Mg365App.ps1'
  const helperDest = path.join(workDir, helperName)
  const helperCandidates = [
    path.join(appPath, 'scripts', helperName),
    path.join(__dirname, 'scripts', helperName)
  ]
  let helperOk = false
  for (const hsrc of helperCandidates) {
    try {
      await fs.copyFile(hsrc, helperDest)
      helperOk = true
      break
    } catch {}
  }
  if (!helperOk) {
    try { await fs.rm(workDir, { recursive: true, force: true }) } catch {}
    throw new Error(`Hilfsskript nicht gefunden: scripts/${helperName}`)
  }
  return tmpScript
}

// Serialize Graph PowerShell runs so concurrent Connect-MgGraph does not race MSAL token cache (duplicate browser prompts).
let psScriptQueueTail = Promise.resolve()

async function runPsScript(scriptRelPath, args = [], onLog = null) {
  const prev = psScriptQueueTail
  let release
  psScriptQueueTail = new Promise((r) => {
    release = r
  })
  await prev.catch(() => {})
  try {
    return await runPsScriptBody(scriptRelPath, args, onLog)
  } finally {
    release()
  }
}

async function runPsScriptBody(scriptRelPath, args = [], onLog = null) {
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
      try {
        if (tmpScript) await fs.rm(path.dirname(tmpScript), { recursive: true, force: true })
      } catch {}
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

// ===================== IPC: Environment =====================

ipcMain.handle('check-pwsh', async () => checkPwshForDashboard())

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
    try {
      scriptPath = await getScriptPath('scripts/update-user-passwords.ps1')
    } catch {
      return { status: 'error', message: 'PowerShell-Skript nicht gefunden' }
    }

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
        try { await fs.rm(path.dirname(scriptPath), { recursive: true, force: true }) } catch {}
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
        try { await fs.rm(path.dirname(scriptPath), { recursive: true, force: true }) } catch {}
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

ipcMain.handle('get-directory-groups', async () => {
  try {
    const result = await runPsScript('scripts/get-groups.ps1', [], (log) => {
      uiSend('ps-operation-log', log)
    })
    if (result.exitCode === -1 && !result.stdout) {
      return { status: 'error', message: result.stderr || 'PowerShell konnte nicht gestartet werden', groups: [] }
    }
    const data = parseJsonFromOutput(result.stdout)
    if (!data) {
      return { status: 'error', message: result.stderr || 'Keine Gruppendaten von PowerShell erhalten.', groups: [] }
    }
    uiSend('ps-operation-complete', { status: data.status })
    return data
  } catch (e) {
    return { status: 'error', message: e?.message, groups: [] }
  }
})

ipcMain.handle('add-group-members', async (_event, { groupId, userIds = [] }) => {
  try {
    const gid = String(groupId || '').trim()
    const ids = Array.isArray(userIds) ? userIds.filter(Boolean).join(',') : ''
    if (!gid || !ids) {
      return { status: 'error', message: 'groupId und userIds erforderlich', added: 0, skipped: 0, failed: 0, errors: [] }
    }
    const result = await runPsScript('scripts/add-group-members.ps1', ['-GroupId', gid, '-UserIds', ids], (log) => {
      uiSend('ps-operation-log', log)
    })
    if (result.exitCode === -1 && !result.stdout) {
      return { status: 'error', message: result.stderr || 'PowerShell konnte nicht gestartet werden', added: 0, skipped: 0, failed: 0, errors: [] }
    }
    const data = parseJsonFromOutput(result.stdout)
    if (!data) {
      return { status: 'error', message: result.stderr || 'Keine Antwort von PowerShell.', added: 0, skipped: 0, failed: 0, errors: [] }
    }
    uiSend('ps-operation-complete', { status: data.status, groupId: gid })
    return data
  } catch (e) {
    return { status: 'error', message: e?.message, added: 0, skipped: 0, failed: 0, errors: [] }
  }
})

ipcMain.handle('get-groups-detail', async () => {
  try {
    const result = await runPsScript('scripts/get-groups-detail.ps1', [], (log) => {
      uiSend('ps-operation-log', log)
    })
    if (result.exitCode === -1 && !result.stdout) {
      return { status: 'error', message: result.stderr || 'PowerShell konnte nicht gestartet werden', groups: [] }
    }
    const data = parseJsonFromOutput(result.stdout)
    if (!data) {
      return { status: 'error', message: result.stderr || 'Keine Gruppendaten erhalten.', groups: [] }
    }
    uiSend('ps-operation-complete', { status: data.status })
    return data
  } catch (e) {
    return { status: 'error', message: e?.message, groups: [] }
  }
})

ipcMain.handle('get-group-owners', async (_event, { groupId }) => {
  try {
    const gid = String(groupId || '').trim()
    if (!gid) return { status: 'error', message: 'groupId erforderlich', ownerEmails: [] }
    const result = await runPsScript('scripts/get-group-owners.ps1', ['-GroupId', gid], (log) => {
      uiSend('ps-operation-log', log)
    })
    if (result.exitCode === -1 && !result.stdout) {
      return { status: 'error', message: result.stderr || 'PowerShell konnte nicht gestartet werden', ownerEmails: [] }
    }
    const data = parseJsonFromOutput(result.stdout)
    if (!data) {
      return { status: 'error', message: result.stderr || 'Keine Besitzerdaten erhalten.', ownerEmails: [] }
    }
    uiSend('ps-operation-complete', { status: data.status, groupId: gid })
    return data
  } catch (e) {
    return { status: 'error', message: e?.message, ownerEmails: [] }
  }
})

ipcMain.handle('get-group-members', async (_event, { groupId }) => {
  try {
    const gid = String(groupId || '').trim()
    if (!gid) return { status: 'error', message: 'groupId erforderlich', members: [] }
    const result = await runPsScript('scripts/get-group-members.ps1', ['-GroupId', gid], (log) => {
      uiSend('ps-operation-log', log)
    })
    if (result.exitCode === -1 && !result.stdout) {
      return { status: 'error', message: result.stderr || 'PowerShell konnte nicht gestartet werden', members: [] }
    }
    const data = parseJsonFromOutput(result.stdout)
    if (!data) {
      return { status: 'error', message: result.stderr || 'Keine Mitgliederdaten erhalten.', members: [] }
    }
    uiSend('ps-operation-complete', { status: data.status, groupId: gid })
    return data
  } catch (e) {
    return { status: 'error', message: e?.message, members: [] }
  }
})

ipcMain.handle('update-group', async (_event, { groupId, displayName, description }) => {
  try {
    const gid = String(groupId || '').trim()
    if (!gid) return { status: 'error', message: 'groupId erforderlich' }
    const args = ['-GroupId', gid]
    if (displayName !== undefined && displayName !== null) args.push('-DisplayName', String(displayName))
    if (description !== undefined && description !== null) args.push('-Description', String(description))
    if (args.length === 2) return { status: 'error', message: 'Keine Felder zum Aktualisieren' }
    const result = await runPsScript('scripts/update-group.ps1', args, (log) => {
      uiSend('ps-operation-log', log)
    })
    const data = parseJsonFromOutput(result.stdout)
    if (!data) return { status: 'error', message: result.stderr || 'Fehler beim Aktualisieren der Gruppe' }
    uiSend('ps-operation-complete', { status: data.status, groupId: gid })
    return data
  } catch (e) {
    return { status: 'error', message: e?.message }
  }
})

ipcMain.handle('delete-group', async (_event, { groupId }) => {
  try {
    const gid = String(groupId || '').trim()
    if (!gid) return { status: 'error', message: 'groupId erforderlich' }
    const result = await runPsScript('scripts/delete-group.ps1', ['-GroupId', gid], (log) => {
      uiSend('ps-operation-log', log)
    })
    const data = parseJsonFromOutput(result.stdout)
    if (!data) return { status: 'error', message: result.stderr || 'Fehler beim Löschen der Gruppe' }
    uiSend('ps-operation-complete', { status: data.status, groupId: gid })
    return data
  } catch (e) {
    return { status: 'error', message: e?.message }
  }
})

ipcMain.handle('remove-group-member', async (_event, { groupId, memberId }) => {
  try {
    const gid = String(groupId || '').trim()
    const mid = String(memberId || '').trim()
    if (!gid || !mid) return { status: 'error', message: 'groupId und memberId erforderlich' }
    const result = await runPsScript('scripts/remove-group-member.ps1', ['-GroupId', gid, '-MemberId', mid], (log) => {
      uiSend('ps-operation-log', log)
    })
    const data = parseJsonFromOutput(result.stdout)
    if (!data) return { status: 'error', message: result.stderr || 'Mitglied konnte nicht entfernt werden' }
    uiSend('ps-operation-complete', { status: data.status, groupId: gid })
    return data
  } catch (e) {
    return { status: 'error', message: e?.message }
  }
})

ipcMain.handle('list-group-lifecycle-policies', async () => {
  try {
    const result = await runPsScript('scripts/group-lifecycle.ps1', ['-Action', 'list'], (log) => {
      uiSend('ps-operation-log', log)
    })
    if (result.exitCode === -1 && !result.stdout) {
      return { status: 'error', message: result.stderr || 'PowerShell konnte nicht gestartet werden', policies: [] }
    }
    const data = parseJsonFromOutput(result.stdout)
    if (!data) return { status: 'error', message: result.stderr || 'Keine Policy-Daten', policies: [] }
    uiSend('ps-operation-complete', { status: data.status })
    return data
  } catch (e) {
    return { status: 'error', message: e?.message, policies: [] }
  }
})

ipcMain.handle('list-group-lifecycle-policies-for-group', async (_event, { groupId } = {}) => {
  try {
    const gid = String(groupId || '').trim()
    if (!gid) return { status: 'error', message: 'groupId erforderlich', policies: [] }
    const result = await runPsScript(
      'scripts/group-lifecycle.ps1',
      ['-Action', 'listForGroup', '-GroupId', gid],
      (log) => {
        uiSend('ps-operation-log', log)
      }
    )
    if (result.exitCode === -1 && !result.stdout) {
      return { status: 'error', message: result.stderr || 'PowerShell konnte nicht gestartet werden', policies: [] }
    }
    const data = parseJsonFromOutput(result.stdout)
    if (!data) return { status: 'error', message: result.stderr || 'Keine Policy-Daten', policies: [] }
    uiSend('ps-operation-complete', { status: data.status })
    return data
  } catch (e) {
    return { status: 'error', message: e?.message, policies: [] }
  }
})

ipcMain.handle('save-group-lifecycle-policy', async (_event, body = {}) => {
  try {
    const mode = String(body.mode || '').toLowerCase() === 'update' ? 'update' : 'create'
    const days = Number(body.groupLifetimeInDays)
    const mgt = String(body.managedGroupTypes || '').trim()
    const alt = body.alternateNotificationEmails != null ? String(body.alternateNotificationEmails).trim() : ''
    if (!Number.isFinite(days) || days < 1) return { status: 'error', message: 'Ungültige Lebensdauer (Tage)' }
    if (mgt !== 'All' && mgt !== 'Selected') return { status: 'error', message: 'managedGroupTypes muss All oder Selected sein' }
    const args = ['-Action', mode, '-GroupLifetimeInDays', String(Math.floor(days)), '-ManagedGroupTypes', mgt]
    if (alt) args.push('-AlternateNotificationEmails', alt)
    if (mode === 'update') {
      const pid = String(body.policyId || '').trim()
      if (!pid) return { status: 'error', message: 'policyId für Update erforderlich' }
      args.push('-PolicyId', pid)
    }
    const result = await runPsScript('scripts/group-lifecycle.ps1', args, (log) => {
      uiSend('ps-operation-log', log)
    })
    const data = parseJsonFromOutput(result.stdout)
    if (!data) return { status: 'error', message: result.stderr || 'Policy speichern fehlgeschlagen' }
    uiSend('ps-operation-complete', { status: data.status })
    return data
  } catch (e) {
    return { status: 'error', message: e?.message }
  }
})

ipcMain.handle('add-groups-to-lifecycle-policy', async (_event, { policyId, groupIds = [] }) => {
  try {
    const pid = String(policyId || '').trim()
    if (!pid) return { status: 'error', message: 'policyId erforderlich', results: [], added: 0, failed: 0 }
    const ids = Array.isArray(groupIds) ? groupIds.map((x) => String(x).trim()).filter(Boolean) : []
    if (!ids.length) return { status: 'error', message: 'Keine Gruppen-IDs', results: [], added: 0, failed: 0 }
    const result = await runPsScript(
      'scripts/group-lifecycle.ps1',
      ['-Action', 'addGroups', '-PolicyId', pid, '-GroupIdsJson', JSON.stringify(ids)],
      (log) => {
        uiSend('ps-operation-log', log)
      }
    )
    const data = parseJsonFromOutput(result.stdout)
    if (!data) return { status: 'error', message: result.stderr || 'addGroup fehlgeschlagen', results: [], added: 0, failed: 0 }
    uiSend('ps-operation-complete', { status: data.status })
    return data
  } catch (e) {
    return { status: 'error', message: e?.message, results: [], added: 0, failed: 0 }
  }
})

ipcMain.handle('remove-groups-from-lifecycle-policy', async (_event, { policyId, groupIds = [] }) => {
  try {
    const pid = String(policyId || '').trim()
    if (!pid) return { status: 'error', message: 'policyId erforderlich', results: [], removed: 0, failed: 0 }
    const ids = Array.isArray(groupIds) ? groupIds.map((x) => String(x).trim()).filter(Boolean) : []
    if (!ids.length) return { status: 'error', message: 'Keine Gruppen-IDs', results: [], removed: 0, failed: 0 }
    const result = await runPsScript(
      'scripts/group-lifecycle.ps1',
      ['-Action', 'removeGroups', '-PolicyId', pid, '-GroupIdsJson', JSON.stringify(ids)],
      (log) => {
        uiSend('ps-operation-log', log)
      }
    )
    const data = parseJsonFromOutput(result.stdout)
    if (!data) return { status: 'error', message: result.stderr || 'removeGroup fehlgeschlagen', results: [], removed: 0, failed: 0 }
    uiSend('ps-operation-complete', { status: data.status })
    return data
  } catch (e) {
    return { status: 'error', message: e?.message, results: [], removed: 0, failed: 0 }
  }
})
