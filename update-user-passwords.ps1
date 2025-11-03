# Setzt Passwörter für Benutzer basierend auf einer CSV-Datei.

param(
    [Parameter(Mandatory = $false)]
    [string]$CSVPath = $env:CSV_PATH
)

# Unterdrücke Welcome-Message und Telemetrie
$PSDefaultParameterValues['Out-Default:OutVariable'] = $null
$ErrorActionPreference = 'Continue'

# Falls CSVPath leer ist, verwende Umgebungsvariable
if ([string]::IsNullOrWhiteSpace($CSVPath) -and $env:CSV_PATH) {
    $CSVPath = $env:CSV_PATH
}

try {
    $CSVFilePath = (Resolve-Path -Path $CSVPath -ErrorAction Stop).Path
} catch {
    Write-Error "CSV-Pfad ungültig: $CSVPath"
    return
}

if (-not (Test-Path -Path $CSVFilePath)) {
    Write-Error "CSV-Datei nicht gefunden unter: $($CSVFilePath)"
    return
}

if (-not (Get-Module -ListAvailable -Name Microsoft.Graph.Users)) {
    Install-Module Microsoft.Graph.Users -Force -Scope CurrentUser
}

Connect-MgGraph -Scopes "User.ReadWrite.All" -NoWelcome

Import-Csv -Path $CSVFilePath -Delimiter ';' | ForEach-Object {
    $UPN = $_.UserPrincipalName
    $Password = $_.NewPassword

    $RawValue = "$($_.ForceChange)".Trim()

    $ForceChange = switch ($RawValue) {
        "1" { $true }
        default { $false }
    }

    Write-Host "Verarbeite Benutzer: $($UPN)"

    $PasswordProfile = @{
        'Password'        = $Password;
        'ForceChangePasswordNextSignIn' = $ForceChange
    }

    try {
        Update-MgUser -UserId $UPN -PasswordProfile $PasswordProfile
        Write-Host "   -> Passwort erfolgreich gesetzt. Benutzer muss PW bei nächster Anmeldung ändern: $($ForceChange)" -ForegroundColor Green

    } catch {
        Write-Host "   -> FEHLER beim Setzen des Passworts für $($UPN): $($_.Exception.Message)" -ForegroundColor Red
    }
}

Disconnect-MgGraph | Out-Null
