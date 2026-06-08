# SPDX-License-Identifier: GPL-3.0-or-later
# Copyright (C) Mag. Thomas Michael Weissel <valueerror@gmail.com>

# Lists subscribed SKUs (license inventory) without loading users
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
    $result = @{
        status   = "error"
        message  = "Verbindung fehlgeschlagen: $($_.Exception.Message)"
        licenses = @()
    } | ConvertTo-Json -Depth 3 -Compress
    Write-Output "###JSON_START###"
    Write-Output $result
    Write-Output "###JSON_END###"
    exit 1
}

Ensure-Module "Microsoft.Graph.Identity.DirectoryManagement"

$licensesData = @()
try {
    Write-Host "Lade Lizenzen..."
    $skus = Get-MgSubscribedSku -All
    foreach ($sku in $skus) {
        $licensesData += @{
            skuId         = $sku.SkuId
            skuPartNumber = $sku.SkuPartNumber
            consumedUnits = $sku.ConsumedUnits
            prepaidUnits  = @{
                enabled   = $sku.PrepaidUnits.Enabled
                warning   = $sku.PrepaidUnits.Warning
                suspended = $sku.PrepaidUnits.Suspended
            }
        }
    }
    Write-Host "Lizenzen geladen: $($licensesData.Count) SKUs"
} catch {
    $result = @{
        status   = "error"
        message  = "Fehler beim Laden der Lizenzen: $($_.Exception.Message)"
        licenses = @()
    } | ConvertTo-Json -Depth 4 -Compress
    Write-Output "###JSON_START###"
    Write-Output $result
    Write-Output "###JSON_END###"
    exit 1
}

$output = @{
    status   = "ok"
    licenses = $licensesData
    count    = $licensesData.Count
} | ConvertTo-Json -Depth 6 -Compress

Write-Output "###JSON_START###"
Write-Output $output
Write-Output "###JSON_END###"
