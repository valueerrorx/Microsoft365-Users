// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) Mag. Thomas Michael Weissel <valueerror@gmail.com>

import { DeviceCodeCredential } from '@azure/identity'

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

// Runs device-code auth in Electron main where MSAL polling is reliable (vs piped pwsh on Windows).
export async function acquireGraphTokenViaDeviceCode(onDeviceCode) {
    const credential = new DeviceCodeCredential({
        clientId: GRAPH_PS_CLIENT_ID,
        userPromptCallback: (info) => {
            onDeviceCode?.({
                userCode: info.userCode,
                verificationUri: info.verificationUri
            })
        }
    })
    const scopeUrls = GRAPH_DELEGATED_SCOPES.map((s) => `https://graph.microsoft.com/${s}`)
    const token = await credential.getToken(scopeUrls)
    return token?.token ?? null
}
