# SPDX-License-Identifier: GPL-3.0-or-later
# Copyright (C) Mag. Thomas Michael Weissel <valueerror@gmail.com>

# Löscht einen Benutzer in Microsoft 365 (Microsoft Graph)
param(
    [Parameter(Mandatory = $true)]
    [string]$UPN
)

$ErrorActionPreference = 'Continue'
$ProgressPreference = 'SilentlyContinue'

$__mg365ScriptsRoot = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
. (Join-Path $__mg365ScriptsRoot 'Mg365-GraphModules.ps1')

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

Write-Host "Lösche Benutzer: $UPN"
try {
    Remove-MgUser -UserId $UPN -ErrorAction Stop
    Write-Host "Benutzer gelöscht: $UPN"

    $result = @{
        status  = "ok"
        message = "Benutzer gelöscht"
        upn     = $UPN
    } | ConvertTo-Json -Compress
    Write-Output "###JSON_START###"
    Write-Output $result
    Write-Output "###JSON_END###"
    exit 0
} catch {
    $errMsg = $_.Exception.Message
    Write-Host "FEHLER: $errMsg"
    $result = @{
        status  = "error"
        message = "Fehler beim Löschen: $errMsg"
        upn     = $UPN
    } | ConvertTo-Json -Compress
    Write-Output "###JSON_START###"
    Write-Output $result
    Write-Output "###JSON_END###"
    exit 1
}
