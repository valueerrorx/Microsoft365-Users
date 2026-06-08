# SPDX-License-Identifier: GPL-3.0-or-later
# Copyright (C) Mag. Thomas Michael Weissel <valueerror@gmail.com>

# Retire or remote wipe an Intune managed device linked to an Entra directory device id (azureADDeviceId).
param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('Retire', 'Wipe')]
    [string]$Action,

    [Parameter(Mandatory = $true)]
    [string]$AzureAdDeviceId,

    [Parameter(Mandatory = $false)]
    [string]$DisableUserAccount = '0',

    [Parameter(Mandatory = $false)]
    [string]$UserUpn = '',

    [Parameter(Mandatory = $false)]
    [string]$IntuneManagedDeviceId = ''
)

$ErrorActionPreference = 'Continue'
$ProgressPreference = 'SilentlyContinue'

$__mg365ScriptsRoot = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
. (Join-Path $__mg365ScriptsRoot 'Mg365-GraphModules.ps1')

Ensure-Module "Microsoft.Graph.Identity.DirectoryManagement"
Ensure-Module "Microsoft.Graph.Users"

$__ms365ConnRoot = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
. (Join-Path $__ms365ConnRoot 'Connect-Mg365App.ps1')
Write-Host "Verbinde mit Microsoft Graph..."
try {
    Connect-Mg365App -ErrorAction Stop
} catch {
    $result = @{ status = "error"; message = "Verbindung fehlgeschlagen: $($_.Exception.Message)" } | ConvertTo-Json -Compress
    Write-Output "###JSON_START###"
    Write-Output $result
    Write-Output "###JSON_END###"
    exit 1
}

function Write-JsonResult {
    param([hashtable]$Obj)
    $json = $Obj | ConvertTo-Json -Depth 4 -Compress
    Write-Output "###JSON_START###"
    Write-Output $json
    Write-Output "###JSON_END###"
}

$aid = $AzureAdDeviceId.Trim()
$managedId = $IntuneManagedDeviceId.Trim()
if (-not $aid -and -not $managedId) {
    Write-JsonResult @{ status = "error"; message = "AzureAdDeviceId oder IntuneManagedDeviceId erforderlich" }
    exit 1
}

try {
    $managed = $null
    if ($managedId) {
        Write-Host "Intune-Aktion für managedDeviceId=$managedId ..."
        $managed = @{ id = $managedId; userPrincipalName = $null }
        try {
            $md = Invoke-MgGraphRequest -Method GET -Uri "/v1.0/deviceManagement/managedDevices/$managedId?`$select=id,userPrincipalName,deviceName,azureADDeviceId" -ErrorAction Stop
            $managed = @{ id = [string]$md.id; userPrincipalName = $md.userPrincipalName }
        } catch {
            Write-Host "Hinweis: managedDevice-Details nicht geladen, nutze übergebene ID"
        }
    } else {
        $escaped = $aid -replace "'", "''"
        $listUri = "/v1.0/deviceManagement/managedDevices?`$filter=azureADDeviceId eq '$escaped'&`$select=id,userPrincipalName,deviceName,azureADDeviceId"
        Write-Host "Suche Intune-Eintrag für Azure AD deviceId $aid ..."
        $listResp = Invoke-MgGraphRequest -Method GET -Uri $listUri -ErrorAction Stop
        $rows = @($listResp.value)
        if (-not $rows.Count) {
            Write-JsonResult @{
                status  = "error"
                message = "Kein Intune-verwaltetes Gerät für diese deviceId gefunden (Gerät ist möglicherweise nicht bei Intune eingeschrieben)."
            }
            exit 1
        }
        $managed = $rows[0]
    }
    $managedId = [string]$managed.id
    $verb = if ($Action -eq 'Wipe') { 'wipe' } else { 'retire' }
    Write-Host "Führe Intune-$verb aus (managedDeviceId=$managedId) ..."
    Invoke-MgGraphRequest -Method POST -Uri "/v1.0/deviceManagement/managedDevices/$managedId/$verb" -Body '{}' -ErrorAction Stop

    $userDisabled = $false
    $userDisableNote = $null

    if ($Action -eq 'Retire' -and $DisableUserAccount -eq '1') {
        $upn = $UserUpn.Trim()
        if (-not $upn -and $managed.userPrincipalName) { $upn = [string]$managed.userPrincipalName }
        if (-not $upn) {
            try {
                $ownUri = "/v1.0/devices/$aid/registeredOwners?`$select=userPrincipalName"
                $ownResp = Invoke-MgGraphRequest -Method GET -Uri $ownUri -ErrorAction Stop
                foreach ($o in @($ownResp.value)) {
                    if ($o.userPrincipalName) {
                        $upn = [string]$o.userPrincipalName
                        break
                    }
                }
            } catch { }
        }
        if (-not $upn) {
            $userDisableNote = "Retire ausgeführt, aber kein Benutzer-UPN ermittelbar – Konto nicht deaktiviert."
        } else {
            try {
                Write-Host "Deaktiviere Benutzerkonto: $upn"
                Update-MgUser -UserId $upn -AccountEnabled:$false -ErrorAction Stop
                $userDisabled = $true
            } catch {
                $userDisableNote = "Retire ausgeführt, Konto konnte nicht deaktiviert werden: $($_.Exception.Message)"
            }
        }
    }

    $msg = if ($Action -eq 'Wipe') {
        "Remote-Wipe (Werkseinstellungen) wurde ausgelöst. Das Gerät setzt sich zurück, sobald es online ist."
    } else {
        if ($userDisableNote) { $userDisableNote }
        elseif ($userDisabled) { "Gerät abgekoppelt (Retire) und Benutzerkonto deaktiviert." }
        else { "Gerät abgekoppelt (Retire)." }
    }

    $st = if ($Action -eq 'Retire' -and $DisableUserAccount -eq '1' -and -not $userDisabled) { "partial" } else { "ok" }

    Write-JsonResult @{
        status = $st
        message         = $msg
        action          = $Action
        managedDeviceId = $managedId
        userDisabled    = $userDisabled
    }
    exit 0
} catch {
    Write-Host "FEHLER: $($_.Exception.Message)"
    Write-JsonResult @{
        status  = "error"
        message = "Intune-Aktion fehlgeschlagen: $($_.Exception.Message)"
    }
    exit 1
}
