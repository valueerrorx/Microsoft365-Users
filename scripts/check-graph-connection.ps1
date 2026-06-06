# SPDX-License-Identifier: GPL-3.0-or-later
# Copyright (C) Mag. Thomas Michael Weissel <valueerror@gmail.com>

# Stiller Status-Check beim App-Start: prueft ob bereits ein gueltiges Token im
# Cache liegt. Reconnectet OHNE Device-Code; bei leerem Cache schlaegt es sofort
# fehl statt einen Anmeldecode anzufordern.
# Ausgabe: JSON an stdout mit Sentry-Markierungen.

$ErrorActionPreference = 'Continue'
$ProgressPreference = 'SilentlyContinue'

function Write-Mg365AuthLog {
    param([string]$Message)
    Write-Host "[MG365-AUTH] check-graph: $Message"
}

try {
    Write-Mg365AuthLog "start HOME=$HOME MS365_ELECTRON_APP=$env:MS365_ELECTRON_APP"
    $authRecordPath = Join-Path $HOME '.mg\mg.authrecord.json'
    Write-Mg365AuthLog "authRecordPath=$authRecordPath exists=$(Test-Path -LiteralPath $authRecordPath)"
    if (-not (Test-Path -LiteralPath $authRecordPath)) {
        throw "Keine bestehende Anmeldung."
    }
    Import-Module Microsoft.Graph.Authentication -ErrorAction Stop
    if ($env:MS365_ELECTRON_APP -eq '1') {
        Write-Mg365AuthLog "Connect-MgGraph -UseDeviceCode User.Read (Cache-Reconnect)"
        Connect-MgGraph -Scopes @('User.Read') -UseDeviceCode -NoWelcome -ErrorAction Stop | Out-Null
    } else {
        Write-Mg365AuthLog "Connect-MgGraph -NoWelcome (Linux Cache-Reconnect)"
        Connect-MgGraph -NoWelcome -ErrorAction Stop | Out-Null
    }
    $ctx = Get-MgContext
    if (-not $ctx -or -not $ctx.Account) { throw "Keine aktive Sitzung" }
    Write-Mg365AuthLog "Session OK account=$($ctx.Account) tenant=$($ctx.TenantId)"
    $tenantDomain = ""
    if ($ctx.Account -match '@(.+)$') { $tenantDomain = $Matches[1] }
    if (-not $tenantDomain) { $tenantDomain = [string]$ctx.TenantId }
    $result = @{ status = "ok"; tenantDomain = $tenantDomain; account = [string]$ctx.Account } | ConvertTo-Json -Compress
    Write-Output "###JSON_START###"
    Write-Output $result
    Write-Output "###JSON_END###"
    exit 0
} catch {
    Write-Mg365AuthLog "FEHLER: $($_.Exception.Message)"
    $result = @{ status = "error"; message = "Keine bestehende Anmeldung."; tenantDomain = "" } | ConvertTo-Json -Compress
    Write-Output "###JSON_START###"
    Write-Output $result
    Write-Output "###JSON_END###"
    exit 1
}
