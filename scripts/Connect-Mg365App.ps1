# SPDX-License-Identifier: GPL-3.0-or-later
# Copyright (C) Mag. Thomas Michael Weissel <valueerror@gmail.com>

# Writes auth trace lines visible in Electron log console and pwsh output panel.
function Write-Mg365AuthLog {
    param([string]$Message)
    Write-Host "[MG365-AUTH] $Message"
}

$__mg365GraphRoot = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
. (Join-Path $__mg365GraphRoot 'Mg365-GraphModules.ps1')

# Shared Graph login; never Import-Module Microsoft.Graph.Authentication -Force after another Graph module loaded it (same assembly twice -> error on Linux/Windows).
function Connect-Mg365App {
    [CmdletBinding()]
    param()
    Write-Mg365AuthLog "Connect-Mg365App start (PID=$PID)"
    Write-Mg365AuthLog "HOME=$HOME USERPROFILE=$env:USERPROFILE MS365_ELECTRON_APP=$env:MS365_ELECTRON_APP MS365_GRAPH_SESSION_WARM=$env:MS365_GRAPH_SESSION_WARM"
    Ensure-Mg365GraphModule -Name 'Microsoft.Graph.Authentication'
    Write-Mg365AuthLog "Microsoft.Graph.Authentication version=$((Get-Module Microsoft.Graph.Authentication).Version)"

    # Electron main already acquired the token — avoid a second WAM/browser prompt in this pwsh process.
    if ($env:MS365_GRAPH_ACCESS_TOKEN) {
        Write-Mg365AuthLog 'connect via MS365_GRAPH_ACCESS_TOKEN'
        $secure = ConvertTo-SecureString -String $env:MS365_GRAPH_ACCESS_TOKEN -AsPlainText -Force
        Connect-MgGraph -AccessToken $secure -NoWelcome -ErrorAction Stop
        return
    }

    $scopes = @(
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
    )
    $authRecordPath = Join-Path $HOME '.mg\mg.authrecord.json'
    $hasCache = Test-Path -LiteralPath $authRecordPath
    Write-Mg365AuthLog "hasCache=$hasCache authRecordPath=$authRecordPath sessionWarm=$($env:MS365_GRAPH_SESSION_WARM)"

    # Same app session + cache: reconnect with full scopes (no extra login UI when cache is fresh).
    if ($env:MS365_GRAPH_SESSION_WARM -eq '1' -and $hasCache) {
        Write-Mg365AuthLog 'warm reconnect'
        Connect-MgGraph -Scopes $scopes -NoWelcome -ErrorAction Stop
        return
    }

    Write-Mg365AuthLog "authMode=wam-browser hasCache=$hasCache"
    Connect-MgGraph -Scopes $scopes -NoWelcome -ErrorAction Stop
    $ctxLinux = Get-MgContext
    if ($ctxLinux) {
        Write-Mg365AuthLog "Connect OK account=$($ctxLinux.Account) tenant=$($ctxLinux.TenantId)"
    }
}
