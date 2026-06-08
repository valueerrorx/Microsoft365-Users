// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) Mag. Thomas Michael Weissel <valueerror@gmail.com>

import { app, BrowserWindow, ipcMain, dialog, shell, Tray, Menu, nativeImage } from 'electron'
import os from 'os'
import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import { spawn, execSync, spawnSync } from 'child_process'
import { createScheduledDirectoryRolesManager } from './scheduled-directory-roles.mjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

function getAppRoot() {
  return app.isPackaged ? app.getAppPath() : __dirname
}

let managedRolesConfigCachePath = null

async function resolveManagedRolesConfigPath() {
  if (!app.isPackaged) {
    return path.join(__dirname, 'config', 'managed-directory-roles.json')
  }
  if (managedRolesConfigCachePath) return managedRolesConfigCachePath
  const bundled = path.join(getAppRoot(), 'config', 'managed-directory-roles.json')
  const dest = path.join(os.tmpdir(), 'ms365-managed-directory-roles.json')
  await fs.copyFile(bundled, dest)
  managedRolesConfigCachePath = dest
  return dest
}

const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL

let win
let tray = null
let isQuitting = false
let deviceLoginBrowserOpened = false
let deviceLoginCodeEmitted = null
let graphSessionWarm = false
let pendingDeviceLoginCode = null
let csvData = []
let scheduledDirectoryRoles = null

// Verbose auth/ps tracing (set MS365_AUTH_DEBUG=0 to disable).
const AUTH_DEBUG = process.env.MS365_AUTH_DEBUG !== '0'

function authDebug(tag, payload) {
  if (!AUTH_DEBUG) return
  const ts = new Date().toISOString().slice(11, 23)
  if (payload === undefined) {
    console.log(`[ms365-auth ${ts}] ${tag}`)
    return
  }
  const text = typeof payload === 'string' ? payload : JSON.stringify(payload)
  console.log(`[ms365-auth ${ts}] ${tag}`, text.length > 1200 ? `${text.slice(0, 1200)}…` : text)
}

// Essential auth milestones only — shown in the app log panel.
function authLogUi(message, type = 'info') {
  uiSend('ps-operation-log', { type, message: `[AUTH] ${message}` })
}

function isAuthNoisePsLine(line) {
  return (
    /^\[MG365-AUTH\]/i.test(line) ||
    /^To sign in, use a web browser/i.test(line) ||
    /Device-Code-Anmeldung/i.test(line) ||
    /Code steht unten/i.test(line) ||
    /^Verbinde mit Microsoft Graph/i.test(line) ||
    /Connect-MgGraph/i.test(line) ||
    /useDeviceCode=/i.test(line) ||
    /authRecordPath=/i.test(line) ||
    /Connect OK account=/i.test(line)
  )
}

function forwardPsLineToUi(line, onLog, type = 'info') {
  if (/to sign in, use a web browser/i.test(line)) {
    authLogUi('Browser-Anmeldung — Bitte im geoeffneten Browserfenster bei Microsoft anmelden.')
    return
  }
  if (isAuthNoisePsLine(line) || /Anmeldung erfolgreich/i.test(line)) return
  if (/^\{.*"status"\s*:/.test(line) || /^###JSON_/.test(line)) return
  if (onLog) onLog({ type, message: line })
}

// Scripts that must never bootstrap Electron device-code auth (silent cache probe only).
const SKIPS_ELECTRON_AUTH = new Set(['scripts/check-graph-connection.ps1'])

function extractDeviceLoginCode(line) {
  if (!/enter the code|to authenticate|login\.microsoft\.com\/device/i.test(line)) return null
  const patterns = [
    /enter the code\s+([A-Z0-9]+)\s+to authenticate/i,
    /enter the code\s+([A-Z0-9]+)/i,
    /user[_\s]?code[:\s]+([A-Z0-9]+)/i
  ]
  for (const re of patterns) {
    const m = line.match(re)
    if (m?.[1]) return m[1].trim()
  }
  return null
}

function maybeEmitDeviceLoginCode(line, runId) {
  if (graphSessionWarm) {
    authDebug('device-code:skip', { runId, reason: 'graphSessionWarm' })
    return
  }
  if (/Bestehende Anmeldung wiederverwendet/i.test(line)) {
    authDebug('device-code:skip', { runId, reason: 'reuse-line' })
    return
  }
  const code = extractDeviceLoginCode(line)
  if (!code) return
  if (code === deviceLoginCodeEmitted) {
    authDebug('device-code:skip', { runId, reason: 'duplicate', code })
    return
  }
  const rotated = deviceLoginCodeEmitted !== null
  deviceLoginCodeEmitted = code
  if (rotated) deviceLoginBrowserOpened = false
  authDebug('device-code', { runId, code, rotated })
  emitDeviceLoginCode(code)
  maybeOpenDeviceLoginBrowser('enter the code device-code-anmeldung', runId)
}

function maybeOpenDeviceLoginBrowser(line, runId) {
  if (graphSessionWarm) {
    authDebug('browser:skip', { runId, reason: 'graphSessionWarm' })
    return
  }
  if (deviceLoginBrowserOpened) return
  if (/Bestehende Anmeldung wiederverwendet/i.test(line)) return
  if (!/to sign in|devicelogin|enter the code|device-code-anmeldung|browser oeffnet|code erscheint/i.test(line)) return
  deviceLoginBrowserOpened = true
  authDebug('browser:open', { runId })
  void shell.openExternal('https://microsoft.com/devicelogin')
}

// Logs whether Graph PowerShell persisted tokens under ~/.mg/mg.authrecord.json.
async function logMgAuthCacheStatus() {
  const cachePath = getMgAuthRecordPath()
  const ok = await hasMgAuthCache()
  authLogUi(
    ok ? `Session gespeichert: ${cachePath}` : `Warnung: keine Cache-Datei unter ${cachePath}`,
    ok ? 'success' : 'warning'
  )
}

// Marks Graph session ready as soon as pwsh reports a successful Connect (not only on script exit).
function noteGraphAuthSuccess(source, runId) {
  if (graphSessionWarm) return
  graphSessionWarm = true
  authLogUi('Mit Microsoft Graph verbunden', 'success')
  void logMgAuthCacheStatus()
  authDebug('graph-session-warm', { source, runId })
  markGraphSessionReady()
  resetGraphAuthUiState(source)
}

function resetGraphAuthUiState(reason = 'unknown') {
  authDebug('reset-ui', { reason, hadCode: deviceLoginCodeEmitted, browserOpened: deviceLoginBrowserOpened })
  deviceLoginBrowserOpened = false
  deviceLoginCodeEmitted = null
  emitDeviceLoginCode(null)
}

function markGraphSessionReady() {
  scheduledDirectoryRoles?.setGraphSessionReady(true)
}

function onGraphResponse(data, source = 'graph') {
  authDebug('graph-response', { source, status: data?.status, message: data?.message })
  if (data && (data.status === 'ok' || data.status === 'partial')) {
    graphSessionWarm = true
    authDebug('graph-response:warm', { source, status: data.status })
    markGraphSessionReady()
    resetGraphAuthUiState(`graph-response:${source}`)
  }
  return data
}

const ALLOWED_MS_ADMIN_HOSTS = new Set([
  'intune.microsoft.com',
  'admin.microsoft.com',
  'entra.microsoft.com',
  'security.microsoft.com',
  'learn.microsoft.com',
  'microsoft.com',
  'www.microsoft.com',
  'login.microsoft.com',
  'xapient.solutions',
  'www.xapient.solutions'
])

function isAllowedExternalHttpsUrl(rawUrl) {
  try {
    const u = new URL(String(rawUrl || '').trim())
    if (u.protocol !== 'https:') return false
    return ALLOWED_MS_ADMIN_HOSTS.has(u.hostname.toLowerCase())
  } catch {
    return false
  }
}

// ===================== Window Management =====================

function resolveIconPath(fileName) {
  return path.join(getAppRoot(), fileName)
}

function loadTrayIcon() {
  const small = nativeImage.createFromPath(resolveIconPath('icon-small.png'))
  if (!small.isEmpty()) return small
  return nativeImage.createFromPath(resolveIconPath('icon.png'))
}

function showMainWindow() {
  if (!win || win.isDestroyed()) return
  win.setSkipTaskbar(false)
  if (win.isMinimized()) win.restore()
  win.show()
  win.focus()
}

function hideToTray() {
  if (!win || win.isDestroyed()) return
  win.hide()
  win.setSkipTaskbar(true)
}

function createTray() {
  if (tray) return
  tray = new Tray(loadTrayIcon())
  tray.setToolTip('MS365 Manager')
  tray.on('click', () => showMainWindow())
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Öffnen', click: () => showMainWindow() },
    { type: 'separator' },
    { label: 'Programm schliessen', click: () => { void promptQuitChoice() } }
  ]))
}

function createWindow() {
  win = new BrowserWindow({
    title: 'MS365 User Management',
    icon: resolveIconPath('icon.png'),
    width: 1600,
    height: 940,
    minWidth: 1600,
    minHeight: 940,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      spellcheck: false
    }
  })

  win.once('ready-to-show', () => {
    win.maximize()
    win.show()
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
  win.webContents.on('will-navigate', (event, navigationUrl) => {
    try {
      const target = new URL(navigationUrl)
      const curRaw = win.webContents.getURL()
      if (!curRaw || curRaw === 'about:blank') return
      const cur = new URL(curRaw)
      if (target.origin === cur.origin) return
      if (!isAllowedExternalHttpsUrl(navigationUrl)) return
      event.preventDefault()
      void shell.openExternal(navigationUrl)
    } catch {}
  })
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (!isAllowedExternalHttpsUrl(url)) return { action: 'deny' }
    void shell.openExternal(url)
    return { action: 'deny' }
  })
  // Ctrl+Shift+D (Cmd+Shift+D on macOS): open Chromium DevTools for the main window.
  win.webContents.on('before-input-event', (event, input) => {
    const primary = process.platform === 'darwin' ? input.meta : input.control
    if (primary && input.shift && !input.alt && String(input.key).toLowerCase() === 'd') {
      event.preventDefault()
      win.webContents.openDevTools()
    }
  })

  win.on('close', (e) => {
    if (isQuitting) return
    e.preventDefault()
    hideToTray()
  })
}

// Quit dialog: Abmelden und beenden | Beenden | Abbrechen.
async function promptQuitChoice() {
  if (!win || win.isDestroyed()) return
  const { response } = await dialog.showMessageBox(win, {
    type: 'question',
    title: 'App beenden',
    message: 'Möchten Sie sich auch von Microsoft Graph abmelden?',
    detail: 'Abmelden löscht die gespeicherte Anmeldung. Beenden behält die Session für den nächsten Start.',
    buttons: ['Abmelden und beenden', 'Beenden', 'Abbrechen'],
    defaultId: 1,
    cancelId: 2,
    noLink: true
  })
  if (response === 2) return
  if (response === 0) {
    await performDisconnectMg365({ notifyUi: false })
  }
  isQuitting = true
  if (tray) {
    tray.destroy()
    tray = null
  }
  win.destroy()
  app.quit()
}

const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    try {
      showMainWindow()
    } catch {}
  })
}

app.whenReady().then(() => {
  authDebug('app:ready', { platform: process.platform, authDebug: AUTH_DEBUG, electron: process.versions.electron })
  scheduledDirectoryRoles = createScheduledDirectoryRolesManager({
    app,
    runPsScript,
    parseJsonFromOutput,
    uiSend
  })
  scheduledDirectoryRoles.startTicker()
  createWindow()
  createTray()
  authDebug('app:ready-ui', { platform: process.platform, authDebug: AUTH_DEBUG })
})
app.on('will-quit', () => {
  scheduledDirectoryRoles?.stopTicker()
  if (tray) {
    tray.destroy()
    tray = null
  }
})
app.on('window-all-closed', () => {
  if (!isQuitting) return
  app.quit()
})
app.on('before-quit', async () => { isQuitting = true })

// Persists the latest device code so the renderer can recover it if IPC fired before listeners mounted.
function emitDeviceLoginCode(code) {
  pendingDeviceLoginCode = code ? String(code) : null
  uiSend('device-login-code', { code: pendingDeviceLoginCode })
}

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

function isPwshCommand(cmd) {
  return /(?:^|[\\/])pwsh(?:-preview)?(?:\.exe)?$/i.test(String(cmd || '').trim())
}

// Windows: UTF-8 via -Command wrapper — must not prepend to .ps1 files (breaks leading param blocks).
function buildPsSpawnArgs(scriptPath, args = []) {
  const base = ['-NoLogo', '-NoProfile', '-ExecutionPolicy', 'Bypass']
  if (process.platform !== 'win32') {
    return [...base, '-File', scriptPath, ...args]
  }
  const escapedScript = String(scriptPath).replace(/'/g, "''")
  const argTail = args.map((a) => {
    const s = String(a)
    if (s.startsWith('-')) return s
    return `'${s.replace(/'/g, "''")}'`
  }).join(' ')
  const cmd = `[Console]::OutputEncoding=[System.Text.UTF8Encoding]::new($false);$OutputEncoding=[System.Text.UTF8Encoding]::new($false);& '${escapedScript}'${argTail ? ` ${argTail}` : ''}`
  return [...base, '-Command', cmd]
}

function detectPowerShell() {
  const tryCmd = (cmd) => {
    const r = spawnSync(cmd, ['-NoLogo', '-NoProfile', '-Command', 'exit 0'], {
      stdio: 'ignore',
      timeout: 15000,
      windowsHide: true
    })
    return r.status === 0 && !r.error ? cmd : null
  }
  const candidates = [
    process.env.PWSH_PATH,
    'pwsh',
    ...(process.platform === 'darwin'
      ? ['/opt/homebrew/bin/pwsh', '/usr/local/bin/pwsh']
      : []),
    'pwsh-preview',
    ...(process.platform === 'darwin'
      ? ['/opt/homebrew/bin/pwsh-preview', '/usr/local/bin/pwsh-preview']
      : []),
    ...(process.platform === 'win32'
      ? [
          path.join(process.env.ProgramFiles || 'C:\\Program Files', 'PowerShell', '7', 'pwsh.exe'),
          path.join(process.env.ProgramFiles || 'C:\\Program Files', 'PowerShell', '7-preview', 'pwsh.exe'),
          path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'WindowsApps', 'pwsh.exe')
        ]
      : [])
  ].filter(Boolean)
  for (const cmd of candidates) {
    const ok = tryCmd(cmd)
    if (ok) return ok
  }
  if (process.platform === 'win32') {
    return tryCmd('powershell.exe') || 'powershell.exe'
  }
  return tryCmd('powershell') || 'pwsh'
}

// Same resolution as detectPowerShell (PATH + default install paths), not bare "pwsh" only.
function checkPwshForDashboard() {
  const ok = isPwshCommand(detectPowerShell())
  return { shouldWarn: !ok, usingLegacyPowerShell: process.platform === 'win32' && !ok }
}

async function resolveScriptsDir(appPath) {
  for (const dir of [path.join(appPath, 'scripts'), path.join(__dirname, 'scripts')]) {
    try {
      const st = await fs.stat(dir)
      if (st.isDirectory()) return dir
    } catch {}
  }
  return null
}

// Copy every scripts/*.ps1 into one flat temp dir so dot-sourced helpers are always present.
async function getScriptPath(scriptRelPath) {
  const appPath = getAppRoot()
  const mainName = path.basename(scriptRelPath)
  const scriptsDir = await resolveScriptsDir(appPath)
  if (!scriptsDir) {
    throw new Error('scripts/ Verzeichnis nicht gefunden')
  }
  const workDir = path.join(os.tmpdir(), `ms365-run-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`)
  await fs.mkdir(workDir, { recursive: true })
  const names = await fs.readdir(scriptsDir)
  let mainCopied = false
  for (const name of names) {
    if (!name.endsWith('.ps1')) continue
    const srcPath = path.join(scriptsDir, name)
    const destPath = path.join(workDir, name)
    const content = await fs.readFile(srcPath, 'utf8')
    const body = content.charCodeAt(0) === 0xfeff ? content.slice(1) : content
    await fs.writeFile(destPath, `\uFEFF${body}`, 'utf8')
    if (name === mainName) mainCopied = true
  }
  if (!mainCopied) {
    try { await fs.rm(workDir, { recursive: true, force: true }) } catch {}
    throw new Error(`Skript nicht gefunden: ${scriptRelPath}`)
  }
  return path.join(workDir, mainName)
}

function getMgAuthRecordPath() {
  const home = process.env.USERPROFILE || process.env.HOME || os.homedir()
  return path.join(home, '.mg', 'mg.authrecord.json')
}

async function hasMgAuthCache() {
  try {
    await fs.access(getMgAuthRecordPath())
    return true
  } catch {
    return false
  }
}

// Bulk/read Graph scripts may run in parallel; writes stay serialized (MSAL token cache / login prompts).
const PARALLEL_PS_SCRIPTS = new Set([
  'scripts/get-ms365-users.ps1',
  'scripts/get-ms365-licenses.ps1',
  'scripts/get-groups-detail.ps1',
  'scripts/get-devices.ps1',
  'scripts/get-managed-directory-roles.ps1',
  'scripts/get-groups.ps1',
  'scripts/get-group-owners.ps1',
  'scripts/get-group-members.ps1',
  'scripts/group-lifecycle.ps1'
])

let psScriptQueueTail = Promise.resolve()

async function runPsScript(scriptRelPath, args = [], onLog = null) {
  const allowParallel = process.platform !== 'win32' && graphSessionWarm && PARALLEL_PS_SCRIPTS.has(scriptRelPath)
  authDebug('ps:queue', { scriptRelPath, allowParallel, graphSessionWarm })
  if (allowParallel) {
    return runPsScriptBody(scriptRelPath, args, onLog)
  }
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
  const runId = `${scriptRelPath}#${Date.now().toString(36)}`
  if (!graphSessionWarm) {
    deviceLoginBrowserOpened = false
    deviceLoginCodeEmitted = null
  }
  let tmpScript = null
  try {
    tmpScript = await getScriptPath(scriptRelPath)
  } catch (err) {
    authDebug('ps:error', { runId, stage: 'getScriptPath', message: err.message })
    authLogUi(`Skript nicht gefunden: ${scriptRelPath}`, 'error')
    return { exitCode: -1, stdout: '', stderr: err.message }
  }

  const psCmd = detectPowerShell()
  if (onLog && !isPwshCommand(psCmd)) {
    onLog({
      type: 'warning',
      message: process.platform === 'win32'
        ? 'Hinweis: PowerShell 7 (pwsh) nicht gefunden — Windows PowerShell 5.1 kann bei Graph deutlich langsamer sein. Empfehlung: winget install Microsoft.PowerShell'
        : 'Hinweis: pwsh nicht im PATH — Graph-Aktionen sind möglicherweise eingeschränkt.'
    })
  }
  const env = {
    ...process.env,
    POWERSHELL_UPDATECHECK: 'Off',
    POWERSHELL_TELEMETRY_OPTOUT: '1',
    ...(process.platform === 'win32' ? { MS365_ELECTRON_APP: '1' } : {}),
    ...(graphSessionWarm ? { MS365_GRAPH_SESSION_WARM: '1' } : {})
  }

  const PS_TIMEOUT_MS = 5 * 60 * 1000
  const psCwd = path.dirname(tmpScript)
  const stdio = process.platform === 'win32'
    ? ['pipe', 'pipe', 'pipe']
    : ['ignore', 'pipe', 'pipe']

  authDebug('ps:start', {
    runId,
    scriptRelPath,
    args,
    psCmd,
    psCwd,
    graphSessionWarm,
    ms365ElectronApp: env.MS365_ELECTRON_APP,
    ms365GraphSessionWarm: env.MS365_GRAPH_SESSION_WARM,
    userProfile: env.USERPROFILE || env.HOME,
    stdinMode: stdio[0]
  })
  authDebug('ps:start-ui', { runId, scriptRelPath, graphSessionWarm })
  if (!graphSessionWarm && !SKIPS_ELECTRON_AUTH.has(scriptRelPath) && !(await hasMgAuthCache())) {
    if (process.platform === 'win32') {
      authLogUi('Device-Code-Anmeldung — Browser oeffnet sich gleich. Code im Dialog eingeben.')
    } else {
      authLogUi('Browser-Anmeldung — Ein Browserfenster oeffnet sich gleich. Bitte bei Microsoft anmelden.')
    }
  }

  return new Promise((resolve) => {
    let stdout = ''
    let stderr = ''
    let timedOut = false
    let settled = false
    const ps = spawn(psCmd, buildPsSpawnArgs(tmpScript, args), { cwd: psCwd, env, stdio })
    if (process.platform === 'win32') {
      try { ps.stdin?.end() } catch {}
    }
    ps.stdout?.setEncoding('utf8')
    ps.stderr?.setEncoding('utf8')
    ps.stdout?.resume()
    ps.stderr?.resume()

    const timer = setTimeout(() => {
      timedOut = true
      try { ps.kill('SIGTERM') } catch {}
    }, PS_TIMEOUT_MS)

    const finish = async (payload) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      if (timedOut || payload.exitCode !== 0) deviceLoginBrowserOpened = false
      authDebug('ps:finish', {
        runId,
        exitCode: payload.exitCode,
        timedOut,
        stdoutLen: payload.stdout?.length || 0,
        stderrLen: payload.stderr?.length || 0,
        graphSessionWarm,
        deviceLoginCodeEmitted,
        stdoutTail: (payload.stdout || '').slice(-400),
        stderrTail: (payload.stderr || '').slice(-400)
      })
      authDebug('ps:end-ui', { runId, scriptRelPath, exitCode: payload.exitCode, graphSessionWarm })
      try {
        if (tmpScript) await fs.rm(path.dirname(tmpScript), { recursive: true, force: true })
      } catch {}
      resolve(payload)
    }

    ps.stdout?.on('data', (d) => {
      const text = d.toString()
      stdout += text
      authDebug(`ps:${runId}:stdout-chunk`, text)
      for (const line of text.split(/\r?\n/)) {
        const clean = stripAnsi(line.trim())
        if (!clean) continue
        if (!clean.includes('###JSON_')) {
          authDebug(`ps:${runId}:stdout-line`, clean)
          maybeOpenDeviceLoginBrowser(clean, runId)
          maybeEmitDeviceLoginCode(clean, runId)
          if (/Anmeldung erfolgreich|Connect OK account=/i.test(clean)) {
            noteGraphAuthSuccess('stdout:connect-ok', runId)
          }
          forwardPsLineToUi(clean, onLog, 'info')
        } else {
          authDebug(`ps:${runId}:stdout-json-marker`, clean)
        }
      }
    })

    ps.stderr?.on('data', (d) => {
      const text = d.toString()
      stderr += text
      authDebug(`ps:${runId}:stderr-chunk`, text)
      for (const line of text.split(/\r?\n/)) {
        const clean = stripAnsi(line.trim())
        if (!clean) continue
        authDebug(`ps:${runId}:stderr-line`, clean)
        maybeOpenDeviceLoginBrowser(clean, runId)
        maybeEmitDeviceLoginCode(clean, runId)
        if (/Anmeldung erfolgreich|Connect OK account=/i.test(clean)) {
          noteGraphAuthSuccess('stderr:connect-ok', runId)
        }
        const isDeviceLoginHint = /to sign in|enter the code|devicelogin|device-code/i.test(clean)
        forwardPsLineToUi(clean, onLog, isDeviceLoginHint ? 'info' : 'error')
      }
    })

    ps.on('exit', async (code) => {
      const out = stdout.trim()
      const err = stderr.trim()
      const authOk = /Anmeldung erfolgreich|Bestehende Anmeldung wiederverwendet|Connect OK account=/i.test(out)
      authDebug('ps:exit', { runId, code, timedOut, authOk, graphSessionWarmBefore: graphSessionWarm })
      if (authOk) noteGraphAuthSuccess(`ps:exit:${scriptRelPath}`, runId)
      if (timedOut) {
        authLogUi('Anmeldung-Timeout — bitte erneut versuchen', 'error')
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
      authDebug('ps:spawn-error', { runId, message: err.message })
      authLogUi(`PowerShell-Fehler: ${err.message}`, 'error')
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

ipcMain.handle('open-external-url', async (_event, rawUrl) => {
  const s = String(rawUrl || '').trim()
  if (!isAllowedExternalHttpsUrl(s)) {
    try {
      const u = new URL(s)
      if (u.protocol !== 'https:') return { ok: false, error: 'protocol' }
    } catch {
      return { ok: false, error: 'invalid-url' }
    }
    return { ok: false, error: 'host' }
  }
  await shell.openExternal(s)
  return { ok: true }
})

ipcMain.handle('check-pwsh', async () => checkPwshForDashboard())

ipcMain.handle('request-app-close', async () => {
  await promptQuitChoice()
  return { ok: true }
})

ipcMain.handle('get-device-login-code', async () => ({ code: pendingDeviceLoginCode }))

async function performDisconnectMg365({ notifyUi = true } = {}) {
  authDebug('disconnect-ms365', { graphSessionWarm: false })
  csvData = []
  graphSessionWarm = false
  scheduledDirectoryRoles?.setGraphSessionReady(false)
  try {
    const result = await runPsScript('scripts/disconnect-mg365.ps1', [], (log) => {
      if (notifyUi) uiSend('ps-operation-log', log)
    })
    const data = parseJsonFromOutput(result.stdout)
    if (data) {
      if (data.status === 'ok') resetGraphAuthUiState()
      if (notifyUi) uiSend('ps-operation-complete', { status: data.status })
      return data
    }
    if (result.exitCode === 0) {
      return { status: 'ok', message: 'Abgemeldet' }
    }
    return { status: 'error', message: result.stderr || 'Abmelden fehlgeschlagen' }
  } catch (e) {
    return { status: 'error', message: e?.message }
  }
}

ipcMain.handle('disconnect-ms365', async () => performDisconnectMg365({ notifyUi: true }))

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

    const pwsh = spawn(psCmd, buildPsSpawnArgs(scriptPath, ['-CSVPath', tmpCsv]), {
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

// Stiller Status-Check beim App-Start: erkennt vorhandene Anmeldung ohne Device-Code
ipcMain.handle('graph-connection-status', async () => {
  authDebug('ipc:graph-connection-status')
  try {
    if (graphSessionWarm) {
      return { status: 'ok', tenantDomain: 'Microsoft 365' }
    }
    const cachePath = getMgAuthRecordPath()
    if (!(await hasMgAuthCache())) {
      authDebug('start-check:no-cache-file', { cachePath })
      authLogUi(`Keine gespeicherte Session (${cachePath})`, 'info')
      return { status: 'error', message: 'Keine bestehende Anmeldung.' }
    }
    authDebug('start-check:cache-found', { cachePath })
    const result = await runPsScript('scripts/check-graph-connection.ps1', [], (log) => {
      uiSend('ps-operation-log', log)
    })
    const data = parseJsonFromOutput(result.stdout)
    authDebug('ipc:graph-connection-status', {
      exitCode: result.exitCode,
      parsedStatus: data?.status,
      stderr: result.stderr?.slice(0, 500)
    })
    if (data?.status === 'ok') {
      graphSessionWarm = true
      authLogUi(`Sitzung aktiv (${data.tenantDomain || data.account || 'Microsoft 365'})`, 'success')
      markGraphSessionReady()
      return data
    }
    authDebug('start-check:no-session', { exitCode: result.exitCode })
    return { status: 'error', message: data?.message || result.stderr || 'Keine bestehende Anmeldung.' }
  } catch (e) {
    authDebug('ipc:graph-connection-status:error', e?.message)
    return { status: 'error', message: e?.message }
  }
})

// Stellt einmalig die Graph-Verbindung her (1 Device-Code), bevor parallele Reads laufen
ipcMain.handle('ensure-graph-connected', async () => {
  authDebug('ipc:ensure-graph-connected')
  try {
    const result = await runPsScript('scripts/ensure-graph-connection.ps1', [], (log) => {
      uiSend('ps-operation-log', log)
    })
    authDebug('ipc:ensure-graph-connected', { exitCode: result.exitCode, stdoutLen: result.stdout?.length })
    if (result.exitCode === -1 && !result.stdout) {
      authLogUi(`Verbindung fehlgeschlagen: ${result.stderr}`, 'error')
      return { status: 'error', message: result.stderr || 'PowerShell konnte nicht gestartet werden' }
    }
    const data = parseJsonFromOutput(result.stdout)
    if (!data) {
      authLogUi('Verbindung fehlgeschlagen — keine Antwort von PowerShell', 'error')
      return { status: 'error', message: result.stderr || 'Keine Antwort von PowerShell erhalten.' }
    }
    return onGraphResponse(data, 'ensure-graph-connected')
  } catch (e) {
    authLogUi(`Verbindung fehlgeschlagen: ${e?.message}`, 'error')
    return { status: 'error', message: e?.message }
  }
})

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
    return onGraphResponse(data)
  } catch (e) {
    return { status: 'error', message: e?.message }
  }
})

ipcMain.handle('get-licenses', async () => {
  try {
    const result = await runPsScript('scripts/get-ms365-licenses.ps1', [], (log) => {
      uiSend('ps-operation-log', log)
    })
    if (result.exitCode === -1 && !result.stdout) {
      return { status: 'error', message: result.stderr || 'PowerShell konnte nicht gestartet werden', licenses: [] }
    }
    const data = parseJsonFromOutput(result.stdout)
    if (!data) {
      return { status: 'error', message: result.stderr || 'Keine Lizenzdaten erhalten.', licenses: [] }
    }
    uiSend('ps-operation-complete', { status: data.status })
    return onGraphResponse(data)
  } catch (e) {
    return { status: 'error', message: e?.message, licenses: [] }
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

ipcMain.handle('delete-users', async (_event, { upns = [] }) => {
  const empty = { status: 'error', message: 'upns erforderlich', deleted: 0, failed: 0, deletedUpns: [], errors: [] }
  try {
    const list = Array.isArray(upns) ? upns.map((u) => String(u || '').trim()).filter(Boolean) : []
    if (!list.length) return empty
    const result = await runPsScript('scripts/delete-users.ps1', ['-UPNs', list.join(',')], (log) => {
      uiSend('ps-operation-log', log)
    })
    if (result.exitCode === -1 && !result.stdout) {
      return { ...empty, message: result.stderr || 'PowerShell konnte nicht gestartet werden' }
    }
    const data = parseJsonFromOutput(result.stdout)
    if (!data) return { ...empty, message: result.stderr || 'Fehler beim Batch-Löschen' }
    uiSend('ps-operation-complete', { status: data.status, count: list.length })
    return data
  } catch (e) {
    return { ...empty, message: e?.message }
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

ipcMain.handle('get-scheduled-directory-role-expirations', async () => {
  try {
    const entries = (await scheduledDirectoryRoles?.getEntries()) || []
    return { status: 'ok', entries }
  } catch (e) {
    return { status: 'error', message: e?.message, entries: [] }
  }
})

ipcMain.handle('schedule-temporary-directory-roles', async (_event, { entries = [] } = {}) => {
  try {
    if (!scheduledDirectoryRoles) {
      return { status: 'error', message: 'Scheduler nicht initialisiert', entries: [] }
    }
    return await scheduledDirectoryRoles.scheduleEntries(entries)
  } catch (e) {
    return { status: 'error', message: e?.message, entries: [] }
  }
})

ipcMain.handle('cancel-scheduled-directory-role', async (_event, { roleTemplateId, userId }) => {
  try {
    if (!scheduledDirectoryRoles) {
      return { status: 'error', message: 'Scheduler nicht initialisiert', entries: [] }
    }
    return await scheduledDirectoryRoles.cancelEntry(roleTemplateId, userId)
  } catch (e) {
    return { status: 'error', message: e?.message, entries: [] }
  }
})

ipcMain.handle('get-managed-directory-roles', async () => {
  authDebug('ipc:get-managed-directory-roles')
  try {
    const configPath = await resolveManagedRolesConfigPath()
    const result = await runPsScript('scripts/get-managed-directory-roles.ps1', ['-ConfigPath', configPath], (log) => {
      uiSend('ps-operation-log', log)
    })
    authDebug('ipc:get-managed-directory-roles', { exitCode: result.exitCode, stdoutLen: result.stdout?.length })
    if (result.exitCode === -1 && !result.stdout) {
      authLogUi(`Rollen laden fehlgeschlagen: ${result.stderr}`, 'error')
      return { status: 'error', message: result.stderr || 'PowerShell konnte nicht gestartet werden', roles: [] }
    }
    const data = parseJsonFromOutput(result.stdout)
    if (!data) {
      authLogUi('Rollen laden fehlgeschlagen — keine Antwort von PowerShell', 'error')
      return { status: 'error', message: result.stderr || 'Keine Rollendaten von PowerShell erhalten.', roles: [] }
    }
    uiSend('ps-operation-complete', { status: data.status })
    return onGraphResponse(data, 'get-managed-directory-roles')
  } catch (e) {
    authLogUi(`Rollen laden fehlgeschlagen: ${e?.message}`, 'error')
    return { status: 'error', message: e?.message, roles: [] }
  }
})

ipcMain.handle('add-directory-role-member', async (_event, { roleTemplateId, userId }) => {
  try {
    const tid = String(roleTemplateId || '').trim()
    const uid = String(userId || '').trim()
    if (!tid || !uid) {
      return { status: 'error', message: 'roleTemplateId und userId erforderlich' }
    }
    const result = await runPsScript('scripts/add-directory-role-member.ps1', ['-RoleTemplateId', tid, '-UserId', uid], (log) => {
      uiSend('ps-operation-log', log)
    })
    const data = parseJsonFromOutput(result.stdout)
    if (!data) return { status: 'error', message: result.stderr || 'Fehler beim Hinzufuegen zur Rolle' }
    uiSend('ps-operation-complete', { status: data.status, roleTemplateId: tid })
    return onGraphResponse(data)
  } catch (e) {
    return { status: 'error', message: e?.message }
  }
})

ipcMain.handle('remove-directory-role-member', async (_event, { roleTemplateId, userId }) => {
  try {
    const tid = String(roleTemplateId || '').trim()
    const uid = String(userId || '').trim()
    if (!tid || !uid) {
      return { status: 'error', message: 'roleTemplateId und userId erforderlich' }
    }
    const result = await runPsScript('scripts/remove-directory-role-member.ps1', ['-RoleTemplateId', tid, '-UserId', uid], (log) => {
      uiSend('ps-operation-log', log)
    })
    const data = parseJsonFromOutput(result.stdout)
    if (!data) return { status: 'error', message: result.stderr || 'Fehler beim Entfernen aus der Rolle' }
    if (data.status === 'ok') {
      await scheduledDirectoryRoles?.cancelEntry(tid, uid)
    }
    uiSend('ps-operation-complete', { status: data.status, roleTemplateId: tid })
    return onGraphResponse(data)
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

ipcMain.handle('get-devices', async () => {
  try {
    const result = await runPsScript('scripts/get-devices.ps1', [], (log) => {
      uiSend('ps-operation-log', log)
    })
    if (result.exitCode === -1 && !result.stdout) {
      return { status: 'error', message: result.stderr || 'PowerShell konnte nicht gestartet werden', devices: [] }
    }
    const data = parseJsonFromOutput(result.stdout)
    if (!data) {
      return { status: 'error', message: result.stderr || 'Keine Gerätedaten erhalten.', devices: [] }
    }
    uiSend('ps-operation-complete', { status: data.status })
    return data
  } catch (e) {
    return { status: 'error', message: e?.message, devices: [] }
  }
})

ipcMain.handle('retire-intune-device', async (_event, body = {}) => {
  try {
    const azureAdDeviceId = String(body?.azureAdDeviceId || '').trim()
    const intuneManagedDeviceId = String(body?.intuneManagedDeviceId || '').trim()
    if (!azureAdDeviceId && !intuneManagedDeviceId) return { status: 'error', message: 'azureAdDeviceId oder intuneManagedDeviceId erforderlich' }
    const disableUserAccount = body?.disableUserAccount ? '1' : '0'
    const args = ['-Action', 'Retire', '-AzureAdDeviceId', azureAdDeviceId, '-DisableUserAccount', disableUserAccount]
    if (intuneManagedDeviceId) args.push('-IntuneManagedDeviceId', intuneManagedDeviceId)
    const upn = String(body?.userUpn || '').trim()
    if (upn) args.push('-UserUpn', upn)
    const result = await runPsScript('scripts/invoke-intune-device-action.ps1', args, (log) => {
      uiSend('ps-operation-log', log)
    })
    const data = parseJsonFromOutput(result.stdout)
    if (!data) return { status: 'error', message: result.stderr || 'Keine Antwort von PowerShell.' }
    uiSend('ps-operation-complete', { status: data.status })
    return data
  } catch (e) {
    return { status: 'error', message: e?.message }
  }
})

ipcMain.handle('delete-entra-device', async (_event, body = {}) => {
  try {
    const deviceId = String(body?.deviceId || '').trim()
    if (!deviceId) return { status: 'error', message: 'deviceId erforderlich' }
    const result = await runPsScript('scripts/delete-entra-device.ps1', ['-DeviceId', deviceId], (log) => {
      uiSend('ps-operation-log', log)
    })
    const data = parseJsonFromOutput(result.stdout)
    if (!data) return { status: 'error', message: result.stderr || 'Keine Antwort von PowerShell.' }
    uiSend('ps-operation-complete', { status: data.status, deviceId })
    return data
  } catch (e) {
    return { status: 'error', message: e?.message }
  }
})

ipcMain.handle('wipe-intune-device', async (_event, body = {}) => {
  try {
    const azureAdDeviceId = String(body?.azureAdDeviceId || '').trim()
    const intuneManagedDeviceId = String(body?.intuneManagedDeviceId || '').trim()
    if (!azureAdDeviceId && !intuneManagedDeviceId) return { status: 'error', message: 'azureAdDeviceId oder intuneManagedDeviceId erforderlich' }
    const wipeArgs = ['-Action', 'Wipe', '-AzureAdDeviceId', azureAdDeviceId]
    if (intuneManagedDeviceId) wipeArgs.push('-IntuneManagedDeviceId', intuneManagedDeviceId)
    const result = await runPsScript(
      'scripts/invoke-intune-device-action.ps1',
      wipeArgs,
      (log) => {
        uiSend('ps-operation-log', log)
      }
    )
    const data = parseJsonFromOutput(result.stdout)
    if (!data) return { status: 'error', message: result.stderr || 'Keine Antwort von PowerShell.' }
    uiSend('ps-operation-complete', { status: data.status })
    return data
  } catch (e) {
    return { status: 'error', message: e?.message }
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
