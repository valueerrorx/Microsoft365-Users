# SPDX-License-Identifier: GPL-3.0-or-later
# Copyright (C) Mag. Thomas Michael Weissel <valueerror@gmail.com>

# Removes an Entra ID directory device (not Intune retire — use invoke-intune-device-action for that)
param(
    [Parameter(Mandatory = $true)]
    [string]$DeviceId
)

$ErrorActionPreference = 'Continue'
$ProgressPreference = 'SilentlyContinue'

$__mg365ScriptsRoot = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
. (Join-Path $__mg365ScriptsRoot 'Mg365-GraphModules.ps1')

function Write-JsonResult {
    param([hashtable]$Payload, [int]$ExitCode = 0)
    $json = $Payload | ConvertTo-Json -Depth 4 -Compress
    Write-Output "###JSON_START###"
    Write-Output $json
    Write-Output "###JSON_END###"
    exit $ExitCode
}

Ensure-Module "Microsoft.Graph.Identity.DirectoryManagement"

$__ms365ConnRoot = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
. (Join-Path $__ms365ConnRoot 'Connect-Mg365App.ps1')
Write-Host "Verbinde mit Microsoft Graph..."
try {
    Connect-Mg365App -ErrorAction Stop
} catch {
    Write-JsonResult @{ status = "error"; message = "Verbindung fehlgeschlagen: $($_.Exception.Message)"; deviceId = $DeviceId } 1
}

$id = $DeviceId.Trim()
if (-not $id) {
    Write-JsonResult @{ status = "error"; message = "DeviceId fehlt"; deviceId = "" } 1
}

try {
    Write-Host "Pruefe Entra-Geraet $id ..."
    $dev = Get-MgDevice -DeviceId $id -Property displayName,deviceId -ErrorAction Stop
    $lookupId = [string]$dev.DeviceId
    if ([string]::IsNullOrWhiteSpace($lookupId)) { $lookupId = $id }

    $escaped = $lookupId -replace "'", "''"
    $listUri = "/v1.0/deviceManagement/managedDevices?`$filter=azureADDeviceId eq '$escaped'&`$select=id&`$top=1"
    try {
        $md = Invoke-MgGraphRequest -Method GET -Uri $listUri -ErrorAction Stop
        if (@($md.value).Count -gt 0) {
            Write-JsonResult @{
                status   = "error"
                message  = "Geraet ist noch in Intune eingeschrieben. Zuerst Retire ausfuehren, danach optional Entra-Eintrag loeschen."
                deviceId = $id
            } 1
        }
    } catch {
        Write-Host "Hinweis: Intune-Pruefung uebersprungen: $($_.Exception.Message)"
    }

    Write-Host "Loesche Entra-Geraet: $($dev.DisplayName) ($id)"
    Remove-MgDevice -DeviceId $id -ErrorAction Stop

    Write-JsonResult @{
        status      = "ok"
        message     = "Entra-Geraet geloescht"
        deviceId    = $id
        displayName = [string]$dev.DisplayName
    } 0
} catch {
    Write-Host "FEHLER: $($_.Exception.Message)"
    Write-JsonResult @{
        status   = "error"
        message  = "Fehler beim Loeschen: $($_.Exception.Message)"
        deviceId = $id
    } 1
}
