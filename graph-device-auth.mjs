// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) Mag. Thomas Michael Weissel <valueerror@gmail.com>

import fs from 'fs/promises'
import path from 'path'
import {
    InteractiveBrowserCredential,
    serializeAuthenticationRecord,
    deserializeAuthenticationRecord,
    useIdentityPlugin
} from '@azure/identity'
import { cachePersistencePlugin } from '@azure/identity-cache-persistence'

// Default Microsoft Graph PowerShell public client id.
export const GRAPH_PS_CLIENT_ID = '14d82eec-204b-4c2f-b7e8-296a70dab67e'

export const GRAPH_DELEGATED_SCOPES = [
    'AuditLog.Read.All',
    'Device.Read.All',
    'DeviceManagementManagedDevices.Read.All',
    'DeviceManagementManagedDevices.PrivilegedOperations.All',
    'Directory.ReadWrite.All',
    'Group.ReadWrite.All',
    'GroupMember.ReadWrite.All',
    'Organization.Read.All',
    'User.Read.All',
    'User.ReadWrite.All',
    'UserAuthenticationMethod.ReadWrite.All',
    'RoleManagement.ReadWrite.Directory'
]

const AUTH_RECORD_FILE = 'ms365-authentication-record.json'
const TOKEN_CACHE_NAME = 'ms365-manager'

let persistenceRegistered = false
let storageDir = null
let graphCredential = null

function scopeUrls() {
    return GRAPH_DELEGATED_SCOPES.map((s) => `https://graph.microsoft.com/${s}`)
}

function tenantDomainFromAccount(account) {
    const username = String(account || '').trim()
    const at = username.indexOf('@')
    return at > 0 ? username.slice(at + 1) : ''
}

function registerPersistence() {
    if (persistenceRegistered) return
    useIdentityPlugin(cachePersistencePlugin)
    persistenceRegistered = true
}

function authRecordPath() {
    if (!storageDir) return null
    return path.join(storageDir, AUTH_RECORD_FILE)
}

// Electron userData path for persisted MSAL auth record.
export function setGraphAuthStorageDir(dir) {
    storageDir = dir
}

async function loadAuthRecord() {
    const filePath = authRecordPath()
    if (!filePath) return null
    try {
        const raw = await fs.readFile(filePath, 'utf8')
        return deserializeAuthenticationRecord(raw)
    } catch {
        return null
    }
}

async function saveAuthRecord(record) {
    const filePath = authRecordPath()
    if (!filePath || !record) return
    await fs.mkdir(path.dirname(filePath), { recursive: true })
    await fs.writeFile(filePath, serializeAuthenticationRecord(record), 'utf8')
}

function buildCredential(authenticationRecord) {
    registerPersistence()
    return new InteractiveBrowserCredential({
        clientId: GRAPH_PS_CLIENT_ID,
        tokenCachePersistenceOptions: { enabled: true, name: TOKEN_CACHE_NAME },
        ...(authenticationRecord ? { authenticationRecord } : {})
    })
}

// Drops cached MSAL credential after sign-out.
export function resetGraphCredential() {
    graphCredential = null
}

// Removes persisted auth record on sign-out.
export async function deletePersistedGraphAuth() {
    resetGraphCredential()
    const filePath = authRecordPath()
    if (!filePath) return
    try {
        await fs.unlink(filePath)
    } catch {}
}

// Silent session restore for app startup (no browser when MSAL cache is valid).
export async function tryRestoreGraphSession() {
    if (!storageDir) return null
    const record = await loadAuthRecord()
    if (!record) return null
    registerPersistence()
    graphCredential = buildCredential(record)
    try {
        const result = await graphCredential.getToken(scopeUrls())
        if (!result?.token) return null
        return {
            token: result.token,
            expiresOnTimestamp: result.expiresOnTimestamp,
            account: record.username,
            tenantDomain: tenantDomainFromAccount(record.username)
        }
    } catch {
        graphCredential = null
        return null
    }
}

// Acquires a delegated Graph access token once in Electron main (avoids per-pwsh WAM prompts).
export async function getGraphDelegatedToken() {
    registerPersistence()
    const scopes = scopeUrls()
    let record = await loadAuthRecord()

    if (record) {
        graphCredential = buildCredential(record)
        try {
            const result = await graphCredential.getToken(scopes)
            if (result?.token) {
                return {
                    token: result.token,
                    expiresOnTimestamp: result.expiresOnTimestamp,
                    account: record.username,
                    tenantDomain: tenantDomainFromAccount(record.username)
                }
            }
        } catch {
            graphCredential = null
        }
    }

    graphCredential = buildCredential()
    record = await graphCredential.authenticate(scopes)
    await saveAuthRecord(record)
    const result = await graphCredential.getToken(scopes)
    if (!result?.token) throw new Error('Graph token acquisition failed')
    return {
        token: result.token,
        expiresOnTimestamp: result.expiresOnTimestamp,
        account: record.username,
        tenantDomain: tenantDomainFromAccount(record.username)
    }
}
