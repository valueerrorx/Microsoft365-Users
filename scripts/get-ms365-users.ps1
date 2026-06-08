# SPDX-License-Identifier: GPL-3.0-or-later
# Copyright (C) Mag. Thomas Michael Weissel <valueerror@gmail.com>

# Listet alle Microsoft 365 Benutzer mit Lizenzinformationen auf
# Ausgabe: JSON an stdout mit Sentry-Markierungen

$ErrorActionPreference = 'Continue'
$ProgressPreference = 'SilentlyContinue'

# Installiere / Importiere benötigte Module
$__mg365ScriptsRoot = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
. (Join-Path $__mg365ScriptsRoot 'Mg365-GraphModules.ps1')

# Pick the best cached sign-in timestamp from the user object's signInActivity block.
function Get-LastActivityFromSignInActivity {
    param($Sa)
    if (-not $Sa) { return $null }
    # Graph hashtable output uses camelCase keys.
    if ($Sa.lastSuccessfulSignInDateTime) { return $Sa.lastSuccessfulSignInDateTime }
    $fallbacks = @(
        $Sa.lastNonInteractiveSignInDateTime
        $Sa.lastSignInDateTime
    ) | Where-Object { $_ }
    if (-not $fallbacks.Count) { return $null }
    return $fallbacks | Sort-Object -Descending | Select-Object -First 1
}

$__ms365ConnRoot = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
. (Join-Path $__ms365ConnRoot 'Connect-Mg365App.ps1')
Write-Host "Verbinde mit Microsoft Graph..."

try {
    Connect-Mg365App -ErrorAction Stop
} catch {
    $result = @{
        status  = "error"
        message = "Verbindung fehlgeschlagen: $($_.Exception.Message)"
        users   = @()
        licenses = @()
        tenantDomain = ""
    } | ConvertTo-Json -Depth 3 -Compress
    Write-Output "###JSON_START###"
    Write-Output $result
    Write-Output "###JSON_END###"
    exit 1
}

Ensure-Module "Microsoft.Graph.Users"
Ensure-Module "Microsoft.Graph.Identity.DirectoryManagement"

# Tenant-Domain ermitteln
$tenantDomain = ""
try {
    $org = Get-MgOrganization -Top 1
    $tenantDomain = ($org.VerifiedDomains | Where-Object { $_.IsDefault -eq $true } | Select-Object -ExpandProperty Name -First 1)
    if (-not $tenantDomain) { $tenantDomain = $org.VerifiedDomains[0].Name }
    Write-Host "Tenant: $tenantDomain"
} catch {
    Write-Host "Warnung: Tenant-Domain konnte nicht ermittelt werden"
}

# Lizenzen (SKUs) laden
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
                enabled = $sku.PrepaidUnits.Enabled
                warning = $sku.PrepaidUnits.Warning
                suspended = $sku.PrepaidUnits.Suspended
            }
        }
    }
    Write-Host "Lizenzen geladen: $($licensesData.Count) SKUs"
} catch {
    Write-Host "Warnung: Lizenzen konnten nicht geladen werden: $($_.Exception.Message)"
}

# Benutzer laden mit wichtigen Feldern
Write-Host "Lade Benutzerliste..."
$usersData = @()
try {
    $selectFields = "id,userPrincipalName,displayName,givenName,surname,department,jobTitle,accountEnabled,usageLocation,assignedLicenses,mail,mobilePhone,createdDateTime,signInActivity"
    # Manual paging (instead of Get-MgUser -All) so we can log progress while loading, not only after.
    $users = New-Object System.Collections.Generic.List[object]
    $next = "/v1.0/users?`$select=$selectFields&`$top=999"
    while ($next) {
        $resp = Invoke-MgGraphRequest -Method GET -Uri $next -OutputType HashTable -ErrorAction Stop
        $page = @($resp['value'])
        foreach ($p in $page) { $users.Add($p) }
        Write-Host "  $($users.Count) Benutzer geladen..."
        $next = $resp['@odata.nextLink']
    }

    $totalUsers = $users.Count
    Write-Host "$totalUsers Benutzer gefunden, verarbeite..."
    foreach ($user in $users) {
        # Graph hashtable output uses camelCase keys.
        $lastActivity = Get-LastActivityFromSignInActivity -Sa $user.signInActivity
        $assignedLics = @()
        if ($user.assignedLicenses) {
            foreach ($lic in @($user.assignedLicenses)) {
                $assignedLics += @{ skuId = $lic.skuId }
            }
        }

        $usersData += @{
            id                  = $user.id
            userPrincipalName   = $user.userPrincipalName
            displayName         = $user.displayName
            givenName           = $user.givenName
            surname             = $user.surname
            department          = $user.department
            jobTitle            = $user.jobTitle
            accountEnabled      = $user.accountEnabled
            usageLocation       = $user.usageLocation
            mail                = $user.mail
            mobilePhone         = $user.mobilePhone
            assignedLicenses    = $assignedLics
            createdDateTime     = $user.createdDateTime
            lastActivityDateTime = $lastActivity
        }
    }
    Write-Host "Benutzer geladen: $($usersData.Count)"
} catch {
    $result = @{
        status  = "error"
        message = "Fehler beim Laden der Benutzer: $($_.Exception.Message)"
        users   = @()
        licenses = @()
        tenantDomain = $tenantDomain
    } | ConvertTo-Json -Depth 5 -Compress
    Write-Output "###JSON_START###"
    Write-Output $result
    Write-Output "###JSON_END###"
    exit 1
}

$output = @{
    status       = "ok"
    tenantDomain = $tenantDomain
    users        = $usersData
    licenses     = $licensesData
    count        = $usersData.Count
} | ConvertTo-Json -Depth 6 -Compress

Write-Output "###JSON_START###"
Write-Output $output
Write-Output "###JSON_END###"
