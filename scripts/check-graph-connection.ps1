# SPDX-License-Identifier: GPL-3.0-or-later
# Copyright (C) Mag. Thomas Michael Weissel <valueerror@gmail.com>

# Stiller Status-Check beim App-Start: prueft ob bereits ein gueltiges Token im
# Cache liegt. Reconnectet OHNE Device-Code; bei leerem Cache schlaegt es sofort
# fehl statt einen Anmeldecode anzufordern.
# Ausgabe: JSON an stdout mit Sentry-Markierungen.

$ErrorActionPreference = 'Continue'
$ProgressPreference = 'SilentlyContinue'

try {
    Import-Module Microsoft.Graph.Authentication -ErrorAction Stop
    try { Set-MgGraphOption -DisableLoginByWAM $true -ErrorAction SilentlyContinue } catch {}
    # KEIN -UseDeviceCode: reconnectet still aus dem Token-Cache oder schlaegt sofort fehl.
    Connect-MgGraph -NoWelcome -ErrorAction Stop | Out-Null
    $ctx = Get-MgContext
    if (-not $ctx -or -not $ctx.Account) { throw "Keine aktive Sitzung" }
    $tenantDomain = ""
    if ($ctx.Account -match '@(.+)$') { $tenantDomain = $Matches[1] }
    if (-not $tenantDomain) { $tenantDomain = [string]$ctx.TenantId }
    $result = @{ status = "ok"; tenantDomain = $tenantDomain; account = [string]$ctx.Account } | ConvertTo-Json -Compress
    Write-Output "###JSON_START###"
    Write-Output $result
    Write-Output "###JSON_END###"
    exit 0
} catch {
    $result = @{ status = "error"; message = "Keine bestehende Anmeldung."; tenantDomain = "" } | ConvertTo-Json -Compress
    Write-Output "###JSON_START###"
    Write-Output $result
    Write-Output "###JSON_END###"
    exit 1
}
