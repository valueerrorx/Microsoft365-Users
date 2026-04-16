# Assign or remove Microsoft 365 license SKUs for a user (Microsoft Graph)
param(
    [Parameter(Mandatory = $true)]
    [string]$UPN,

    [Parameter(Mandatory = $false)]
    [string]$AddSkuIds = "",

    [Parameter(Mandatory = $false)]
    [string]$RemoveSkuIds = ""
)

$ErrorActionPreference = 'Continue'
$ProgressPreference = 'SilentlyContinue'

function Ensure-Module {
    param([string]$Name)
    try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 } catch {}
    try { Install-PackageProvider -Name NuGet -Force -Scope CurrentUser -Confirm:$false | Out-Null } catch {}
    try { Set-PSRepository -Name PSGallery -InstallationPolicy Trusted -ErrorAction SilentlyContinue } catch {}
    if (-not (Get-Module -ListAvailable -Name $Name)) {
        Write-Host "Installiere Modul: $Name"
        Install-Module $Name -Force -Scope CurrentUser -AllowClobber -Confirm:$false
    }
    Import-Module $Name -Force -ErrorAction Stop
}

Ensure-Module "Microsoft.Graph.Users"
Ensure-Module "Microsoft.Graph.Users.Actions"

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

$addArr = @()
if (-not [string]::IsNullOrWhiteSpace($AddSkuIds)) {
    foreach ($part in $AddSkuIds.Split(',')) {
        $id = $part.Trim()
        if ($id) { $addArr += @{ SkuId = $id } }
    }
}

$remArr = @()
if (-not [string]::IsNullOrWhiteSpace($RemoveSkuIds)) {
    foreach ($part in $RemoveSkuIds.Split(',')) {
        $id = $part.Trim()
        if ($id) { $remArr += $id }
    }
}

Write-Host "Lizenzen für: $UPN (hinzufügen: $($addArr.Count), entfernen: $($remArr.Count))"

try {
    if ($addArr.Count -gt 0 -or $remArr.Count -gt 0) {
        Set-MgUserLicense -UserId $UPN -AddLicenses $addArr -RemoveLicenses $remArr -ErrorAction Stop
        Write-Host "Lizenzen aktualisiert"
    } else {
        Write-Host "Keine Lizenzänderung angefordert"
    }

    $u = Get-MgUser -UserId $UPN -Property "assignedLicenses" -ErrorAction Stop
    $assigned = @()
    if ($u.AssignedLicenses) {
        foreach ($lic in $u.AssignedLicenses) {
            $assigned += @{ skuId = $lic.SkuId.ToString() }
        }
    }

    $result = @{
        status             = "ok"
        message            = "Lizenzen aktualisiert"
        upn                = $UPN
        assignedLicenses   = $assigned
    } | ConvertTo-Json -Compress -Depth 6
    Write-Output "###JSON_START###"
    Write-Output $result
    Write-Output "###JSON_END###"
} catch {
    $errMsg = $_.Exception.Message
    Write-Host "FEHLER: $errMsg"
    $result = @{
        status  = "error"
        message = "Fehler bei Lizenzen: $errMsg"
        upn     = $UPN
    } | ConvertTo-Json -Compress
    Write-Output "###JSON_START###"
    Write-Output $result
    Write-Output "###JSON_END###"
    exit 1
}
