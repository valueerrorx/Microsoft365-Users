# SPDX-License-Identifier: GPL-3.0-or-later
# Copyright (C) Mag. Thomas Michael Weissel <valueerror@gmail.com>

# Stellt EINE Graph-Verbindung her (interaktiver Browser-Login) und fuellt den Token-Cache,
# bevor die Daten-Scripts parallel laufen. Verhindert mehrfache Anmelde-Vorgaenge.
# Ausgabe: JSON an stdout mit Sentry-Markierungen.

$ErrorActionPreference = 'Continue'
$ProgressPreference = 'SilentlyContinue'

$__ms365ConnRoot = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
. (Join-Path $__ms365ConnRoot 'Connect-Mg365App.ps1')

try {
    Connect-Mg365App -ErrorAction Stop
    $tenantDomain = ""
    try {
        $ctx = Get-MgContext
        if ($ctx) {
            $tenantDomain = [string]$ctx.TenantId
        }
    } catch {}
    Write-Host "Anmeldung erfolgreich."
    $result = @{ status = "ok"; message = "Verbunden mit Microsoft Graph."; tenantDomain = $tenantDomain } | ConvertTo-Json -Compress
    Write-Output "###JSON_START###"
    Write-Output $result
    Write-Output "###JSON_END###"
    exit 0
} catch {
    $result = @{ status = "error"; message = "Verbindung fehlgeschlagen: $($_.Exception.Message)"; tenantDomain = "" } | ConvertTo-Json -Compress
    Write-Output "###JSON_START###"
    Write-Output $result
    Write-Output "###JSON_END###"
    exit 1
}
