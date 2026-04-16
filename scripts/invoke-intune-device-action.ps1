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
    [string]$UserUpn = ''
)

$ErrorActionPreference = 'Continue'
$ProgressPreference = 'SilentlyContinue'

function Ensure-Module {
    param([string]$Name)
    try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 } catch {}
    try { Install-PackageProvider -Name NuGet -Force -Scope CurrentUser -Confirm:$false -ErrorAction Stop | Out-Null } catch {}
    try { Set-PSRepository -Name PSGallery -InstallationPolicy Trusted -ErrorAction SilentlyContinue } catch {}
    if (-not (Get-Module -ListAvailable -Name $Name)) {
        Write-Host "Installiere Modul: $Name"
        Install-Module $Name -Force -Scope CurrentUser -AllowClobber -Confirm:$false -ErrorAction Stop
    }
    Import-Module $Name -Force -ErrorAction Stop
}

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
if (-not $aid) {
    Write-JsonResult @{ status = "error"; message = "AzureAdDeviceId fehlt" }
    exit 1
}

$escaped = $aid -replace "'", "''"
$listUri = "/v1.0/deviceManagement/managedDevices?`$filter=azureADDeviceId eq '$escaped'&`$select=id,userPrincipalName,deviceName,azureADDeviceId"

try {
    Write-Host "Suche Intune-Eintrag für Entra-Gerät $aid ..."
    $listResp = Invoke-MgGraphRequest -Method GET -Uri $listUri -ErrorAction Stop
    $rows = @($listResp.value)
    if (-not $rows.Count) {
        Write-JsonResult @{
            status  = "error"
            message = "Kein Intune-verwaltetes Gerät für diese Entra-ID gefunden (Gerät ist möglicherweise nicht bei Intune eingeschrieben)."
        }
        exit 1
    }
    $managed = $rows[0]
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
