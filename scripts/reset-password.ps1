# Setzt das Passwort eines einzelnen Benutzers zurück
param(
    [Parameter(Mandatory = $true)]
    [string]$UPN,

    [Parameter(Mandatory = $true)]
    [string]$NewPassword,

    [Parameter(Mandatory = $false)]
    [string]$ForceChange = "1"
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

$forceChangeBool = ($ForceChange -eq "1") -or ($ForceChange -ieq "true")

Write-Host "Setze Passwort für: $UPN"
try {
    $passwordProfile = @{
        Password                      = $NewPassword
        ForceChangePasswordNextSignIn = $forceChangeBool
    }
    Update-MgUser -UserId $UPN -PasswordProfile $passwordProfile -ErrorAction Stop
    Write-Host "Passwort erfolgreich zurückgesetzt für: $UPN"

    Disconnect-MgGraph | Out-Null

    $result = @{
        status  = "ok"
        message = "Passwort erfolgreich zurückgesetzt"
        upn     = $UPN
    } | ConvertTo-Json -Compress
    Write-Output "###JSON_START###"
    Write-Output $result
    Write-Output "###JSON_END###"
} catch {
    Disconnect-MgGraph | Out-Null
    $errMsg = $_.Exception.Message
    Write-Host "FEHLER: $errMsg"
    $result = @{
        status  = "error"
        message = "Fehler beim Zurücksetzen des Passworts: $errMsg"
        upn     = $UPN
    } | ConvertTo-Json -Compress
    Write-Output "###JSON_START###"
    Write-Output $result
    Write-Output "###JSON_END###"
    exit 1
}
