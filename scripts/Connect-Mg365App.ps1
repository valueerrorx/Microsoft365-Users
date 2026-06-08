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
    $useDeviceCode = $env:MS365_ELECTRON_APP -eq '1'
    Write-Mg365AuthLog "useDeviceCode=$useDeviceCode scopeCount=$($scopes.Count)"
    if ($useDeviceCode) {
        $authRecordPath = Join-Path $HOME '.mg\mg.authrecord.json'
        $hasCache = Test-Path -LiteralPath $authRecordPath
        Write-Mg365AuthLog "authRecordPath=$authRecordPath exists=$hasCache"
        if (-not $hasCache) {
            Write-Host "Device-Code-Anmeldung - Browser oeffnet sich automatisch..." -ForegroundColor Yellow
            Write-Host "Code steht unten im Ausgabefenster; auf der Seite eingeben und anmelden." -ForegroundColor Yellow
        } else {
            Write-Mg365AuthLog "Cache vorhanden — Connect-MgGraph -UseDeviceCode (MSAL soll Cache still nutzen)"
        }
        Write-Mg365AuthLog "Connect-MgGraph -UseDeviceCode start (ClientTimeout=600)"
        try {
            Connect-MgGraph -Scopes $scopes -UseDeviceCode -NoWelcome -ClientTimeout 600 -ErrorAction Stop
            $ctx = Get-MgContext
            if ($ctx) {
                Write-Mg365AuthLog "Connect OK account=$($ctx.Account) tenant=$($ctx.TenantId) scopes=$($ctx.Scopes -join ',')"
            } else {
                Write-Mg365AuthLog "Connect fertig aber Get-MgContext ist leer"
            }
            Write-Host "Anmeldung erfolgreich."
        } catch {
            Write-Mg365AuthLog "Connect FEHLER: $($_.Exception.Message)"
            throw
        }
        return
    }
    $authRecordPath = Join-Path $HOME '.mg\mg.authrecord.json'
    $hasCache = Test-Path -LiteralPath $authRecordPath
    Write-Mg365AuthLog "Linux browser mode hasCache=$hasCache authRecordPath=$authRecordPath"
    if ($hasCache) {
        Write-Host "Bestehende Microsoft-Anmeldung wird verwendet."
    } else {
        Write-Host "Browser-Anmeldung — Gleich oeffnet sich ein Browserfenster zur Microsoft-Anmeldung." -ForegroundColor Yellow
        Write-Host "Bitte dort anmelden. Falls kein Fenster sichtbar ist: Taskleiste oder andere Arbeitsflaeche pruefen." -ForegroundColor Yellow
    }
    Write-Mg365AuthLog "Connect-MgGraph Browser-Modus start"
    Connect-MgGraph -Scopes $scopes -NoWelcome -ErrorAction Stop
    $ctxLinux = Get-MgContext
    if ($ctxLinux) {
        Write-Mg365AuthLog "Connect OK account=$($ctxLinux.Account) tenant=$($ctxLinux.TenantId)"
    }
    Write-Host "Anmeldung erfolgreich."
}
