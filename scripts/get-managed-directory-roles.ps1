# SPDX-License-Identifier: GPL-3.0-or-later
# Copyright (C) Mag. Thomas Michael Weissel <valueerror@gmail.com>

# Loads whitelisted Entra directory roles and their user members from config JSON
param(
    [Parameter(Mandatory = $true)]
    [string]$ConfigPath
)

$ErrorActionPreference = 'Continue'
$ProgressPreference = 'SilentlyContinue'

$__mg365ScriptsRoot = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
. (Join-Path $__mg365ScriptsRoot 'Mg365-GraphModules.ps1')

$__ms365ConnRoot = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
. (Join-Path $__ms365ConnRoot 'Connect-Mg365App.ps1')
Write-Host "Verbinde mit Microsoft Graph..."
try {
    Connect-Mg365App -ErrorAction Stop
} catch {
    $result = @{ status = "error"; message = "Verbindung fehlgeschlagen: $($_.Exception.Message)"; roles = @() } | ConvertTo-Json -Depth 6 -Compress
    Write-Output "###JSON_START###"
    Write-Output $result
    Write-Output "###JSON_END###"
    exit 1
}

$__dirRoleHelper = Join-Path $__ms365ConnRoot 'DirectoryRole-Mg365.ps1'
if (-not (Test-Path -LiteralPath $__dirRoleHelper)) {
    throw "DirectoryRole-Mg365.ps1 fehlt (erwartet in: $__ms365ConnRoot)"
}
. $__dirRoleHelper
if (-not (Get-Command Get-OrActivateDirectoryRole -ErrorAction SilentlyContinue)) {
    throw "DirectoryRole-Mg365.ps1 konnte nicht geladen werden"
}

if (-not (Test-Path -LiteralPath $ConfigPath)) {
    $result = @{ status = "error"; message = "Konfiguration nicht gefunden: $ConfigPath"; roles = @() } | ConvertTo-Json -Depth 6 -Compress
    Write-Output "###JSON_START###"
    Write-Output $result
    Write-Output "###JSON_END###"
    exit 1
}

try {
    $configRaw = Get-Content -LiteralPath $ConfigPath -Raw -Encoding UTF8
    $configEntries = $configRaw | ConvertFrom-Json
} catch {
    $result = @{ status = "error"; message = "Konfiguration ungueltig: $($_.Exception.Message)"; roles = @() } | ConvertTo-Json -Depth 6 -Compress
    Write-Output "###JSON_START###"
    Write-Output $result
    Write-Output "###JSON_END###"
    exit 1
}

$rolesOut = New-Object System.Collections.Generic.List[hashtable]
$hadError = $false
$roleTotal = @($configEntries).Count
$roleIndex = 0
Write-Host "Lade $roleTotal Rollen aus Microsoft Graph..."

foreach ($entry in $configEntries) {
    $roleIndex++
    $templateId = [string]$entry.templateId
    $label = [string]$entry.label
    $dangerous = $false
    if ($null -ne $entry.dangerous) { $dangerous = [bool]$entry.dangerous }
    if ([string]::IsNullOrWhiteSpace($templateId)) { continue }

    Write-Host "Rolle $roleIndex/$roleTotal : $label ($templateId)"
    try {
        $dirRole = Get-OrActivateDirectoryRole -TemplateId $templateId
        $members = Get-DirectoryRoleUserMembers -TemplateId $templateId
        $rolesOut.Add(@{
            templateId       = $templateId
            label            = $label
            dangerous        = $dangerous
            directoryRoleId  = $dirRole.Id
            displayName      = $dirRole.DisplayName
            memberCount      = @($members).Count
            members          = @($members)
            loadError        = $null
        })
        Write-Host "  Mitglieder (User): $($members.Count)"
    } catch {
        $hadError = $true
        $err = $_.Exception.Message
        Write-Host "  FEHLER: $err"
        $rolesOut.Add(@{
            templateId       = $templateId
            label            = $label
            dangerous        = $dangerous
            directoryRoleId  = $null
            displayName      = $label
            memberCount      = 0
            members          = @()
            loadError        = $err
        })
    }
}

$status = if ($hadError) { "partial" } else { "ok" }
$output = @{
    status  = $status
    message = if ($hadError) { "Einige Rollen konnten nicht geladen werden" } else { "Rollen geladen" }
    roles   = @($rolesOut)
} | ConvertTo-Json -Depth 10 -Compress

Write-Output "###JSON_START###"
Write-Output $output
Write-Output "###JSON_END###"
exit 0
