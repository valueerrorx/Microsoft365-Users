# Löscht einen Benutzer in Microsoft 365 (Microsoft Graph)
param(
    [Parameter(Mandatory = $true)]
    [string]$UPN
)

$ErrorActionPreference = 'Continue'
$ProgressPreference = 'SilentlyContinue'

function Ensure-Module {
    param([string]$Name)
    if (-not (Get-Module -ListAvailable -Name $Name)) {
        Write-Host "Installiere Modul: $Name"
        Install-Module $Name -Force -Scope CurrentUser -AllowClobber
    }
    Import-Module $Name -Force -ErrorAction SilentlyContinue
}

Ensure-Module "Microsoft.Graph.Users"

Write-Host "Verbinde mit Microsoft Graph..."
try {
    Connect-MgGraph -Scopes "User.ReadWrite.All" -NoWelcome -ErrorAction Stop
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
