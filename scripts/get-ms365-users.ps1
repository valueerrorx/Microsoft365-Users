# Listet alle Microsoft 365 Benutzer mit Lizenzinformationen auf
# Ausgabe: JSON an stdout mit Sentry-Markierungen

$ErrorActionPreference = 'Continue'
$ProgressPreference = 'SilentlyContinue'

# Installiere / Importiere benötigte Module
function Ensure-Module {
    param([string]$Name)
    if (-not (Get-Module -ListAvailable -Name $Name)) {
        Write-Host "Installiere Modul: $Name"
        Install-Module $Name -Force -Scope CurrentUser -AllowClobber
    }
    Import-Module $Name -Force -ErrorAction SilentlyContinue
}

Ensure-Module "Microsoft.Graph.Users"
Ensure-Module "Microsoft.Graph.Identity.DirectoryManagement"

Write-Host "Verbinde mit Microsoft Graph..."

try {
    Connect-MgGraph -Scopes "User.Read.All", "Organization.Read.All", "Directory.Read.All" -NoWelcome -ErrorAction Stop
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
    $selectFields = "id,userPrincipalName,displayName,givenName,surname,department,jobTitle,accountEnabled,usageLocation,assignedLicenses,mail,mobilePhone,createdDateTime"
    $users = Get-MgUser -All -Property $selectFields -ErrorAction Stop

    foreach ($user in $users) {
        $assignedLics = @()
        if ($user.AssignedLicenses) {
            foreach ($lic in $user.AssignedLicenses) {
                $assignedLics += @{ skuId = $lic.SkuId }
            }
        }

        $usersData += @{
            id                  = $user.Id
            userPrincipalName   = $user.UserPrincipalName
            displayName         = $user.DisplayName
            givenName           = $user.GivenName
            surname             = $user.Surname
            department          = $user.Department
            jobTitle            = $user.JobTitle
            accountEnabled      = $user.AccountEnabled
            usageLocation       = $user.UsageLocation
            mail                = $user.Mail
            mobilePhone         = $user.MobilePhone
            assignedLicenses    = $assignedLics
            createdDateTime     = $user.CreatedDateTime
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
