# Aktualisiert Benutzereigenschaften in Microsoft 365
param(
    [Parameter(Mandatory = $true)]
    [string]$UPN,

    [Parameter(Mandatory = $false)]
    [string]$DisplayName,

    [Parameter(Mandatory = $false)]
    [string]$GivenName,

    [Parameter(Mandatory = $false)]
    [string]$Surname,

    [Parameter(Mandatory = $false)]
    [string]$Department,

    [Parameter(Mandatory = $false)]
    [string]$JobTitle,

    [Parameter(Mandatory = $false)]
    [string]$AccountEnabled,   # "1" = aktiv, "0" = deaktiviert

    [Parameter(Mandatory = $false)]
    [string]$UsageLocation     # z.B. "AT", "DE", "CH"
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

Write-Host "Aktualisiere Benutzer: $UPN"

try {
    # Nur übergebene Parameter werden aktualisiert
    $updateParams = @{ UserId = $UPN }

    if (-not [string]::IsNullOrWhiteSpace($DisplayName)) { $updateParams.DisplayName = $DisplayName }
    if (-not [string]::IsNullOrWhiteSpace($GivenName))   { $updateParams.GivenName = $GivenName }
    if (-not [string]::IsNullOrWhiteSpace($Surname))     { $updateParams.Surname = $Surname }
    if (-not [string]::IsNullOrWhiteSpace($Department))  { $updateParams.Department = $Department }
    if (-not [string]::IsNullOrWhiteSpace($JobTitle))    { $updateParams.JobTitle = $JobTitle }
    if (-not [string]::IsNullOrWhiteSpace($UsageLocation)) { $updateParams.UsageLocation = $UsageLocation }

    if (-not [string]::IsNullOrWhiteSpace($AccountEnabled)) {
        $updateParams.AccountEnabled = ($AccountEnabled -eq "1")
    }

    Update-MgUser @updateParams -ErrorAction Stop
    Write-Host "Benutzer erfolgreich aktualisiert: $UPN"

    # Aktuellen Benutzer-Status abrufen
    $updatedUser = Get-MgUser -UserId $UPN -Property "id,userPrincipalName,displayName,givenName,surname,department,jobTitle,accountEnabled,usageLocation,mail"

    $userObj = @{
        id                = $updatedUser.Id
        userPrincipalName = $updatedUser.UserPrincipalName
        displayName       = $updatedUser.DisplayName
        givenName         = $updatedUser.GivenName
        surname           = $updatedUser.Surname
        department        = $updatedUser.Department
        jobTitle          = $updatedUser.JobTitle
        accountEnabled    = $updatedUser.AccountEnabled
        usageLocation     = $updatedUser.UsageLocation
        mail              = $updatedUser.Mail
    }

    $result = @{
        status  = "ok"
        message = "Benutzer erfolgreich aktualisiert"
        upn     = $UPN
        user    = $userObj
    } | ConvertTo-Json -Compress -Depth 4
    Write-Output "###JSON_START###"
    Write-Output $result
    Write-Output "###JSON_END###"

} catch {
    $errMsg = $_.Exception.Message
    Write-Host "FEHLER: $errMsg"
    $result = @{
        status  = "error"
        message = "Fehler beim Aktualisieren: $errMsg"
        upn     = $UPN
    } | ConvertTo-Json -Compress
    Write-Output "###JSON_START###"
    Write-Output $result
    Write-Output "###JSON_END###"
    exit 1
}
