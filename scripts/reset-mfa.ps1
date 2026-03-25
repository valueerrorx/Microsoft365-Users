# Setzt alle MFA/2FA-Authentifizierungsmethoden eines Benutzers zurück
# Entfernt: Microsoft Authenticator, TOTP, Telefon, E-Mail, FIDO2, TAP
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

Ensure-Module "Microsoft.Graph.Identity.SignIns"
Ensure-Module "Microsoft.Graph.Users"

Write-Host "Verbinde mit Microsoft Graph..."
try {
    Connect-MgGraph -Scopes "UserAuthenticationMethod.ReadWrite.All", "User.Read.All" -NoWelcome -ErrorAction Stop
} catch {
    $result = @{ status = "error"; message = "Verbindung fehlgeschlagen: $($_.Exception.Message)" } | ConvertTo-Json -Compress
    Write-Output "###JSON_START###"
    Write-Output $result
    Write-Output "###JSON_END###"
    exit 1
}

Write-Host "Lade Authentifizierungsmethoden für: $UPN"

$removedCount = 0
$errors = @()

try {
    # Alle Authentifizierungsmethoden des Benutzers laden
    $methods = Get-MgUserAuthenticationMethod -UserId $UPN -ErrorAction Stop

    foreach ($method in $methods) {
        $odata = $method.AdditionalProperties.'@odata.type'
        Write-Host "Gefundene Methode: $odata (ID: $($method.Id))"

        try {
            # Je nach Typ die entsprechende Remove-Funktion aufrufen
            switch ($odata) {
                "#microsoft.graph.microsoftAuthenticatorAuthenticationMethod" {
                    Remove-MgUserAuthenticationMicrosoftAuthenticatorMethod -UserId $UPN -MicrosoftAuthenticatorAuthenticationMethodId $method.Id -ErrorAction Stop
                    Write-Host "Microsoft Authenticator entfernt"
                    $removedCount++
                }
                "#microsoft.graph.phoneAuthenticationMethod" {
                    Remove-MgUserAuthenticationPhoneMethod -UserId $UPN -PhoneAuthenticationMethodId $method.Id -ErrorAction Stop
                    Write-Host "Telefon-Methode entfernt"
                    $removedCount++
                }
                "#microsoft.graph.emailAuthenticationMethod" {
                    Remove-MgUserAuthenticationEmailMethod -UserId $UPN -EmailAuthenticationMethodId $method.Id -ErrorAction Stop
                    Write-Host "E-Mail-Methode entfernt"
                    $removedCount++
                }
                "#microsoft.graph.softwareOathAuthenticationMethod" {
                    Remove-MgUserAuthenticationSoftwareOathMethod -UserId $UPN -SoftwareOathAuthenticationMethodId $method.Id -ErrorAction Stop
                    Write-Host "Software OATH Token entfernt"
                    $removedCount++
                }
                "#microsoft.graph.fido2AuthenticationMethod" {
                    Remove-MgUserAuthenticationFido2Method -UserId $UPN -Fido2AuthenticationMethodId $method.Id -ErrorAction Stop
                    Write-Host "FIDO2-Schlüssel entfernt"
                    $removedCount++
                }
                "#microsoft.graph.temporaryAccessPassAuthenticationMethod" {
                    Remove-MgUserAuthenticationTemporaryAccessPassMethod -UserId $UPN -TemporaryAccessPassAuthenticationMethodId $method.Id -ErrorAction Stop
                    Write-Host "Temporärer Zugangscode entfernt"
                    $removedCount++
                }
                "#microsoft.graph.passwordAuthenticationMethod" {
                    # Passwort-Methode kann nicht entfernt werden - das ist normal
                    Write-Host "Passwort-Methode übersprungen (nicht entfernbar)"
                }
                "#microsoft.graph.windowsHelloForBusinessAuthenticationMethod" {
                    # Windows Hello kann nicht remote entfernt werden
                    Write-Host "Windows Hello übersprungen (nicht remote entfernbar)"
                }
                default {
                    Write-Host "Unbekannte Methode übersprungen: $odata"
                }
            }
        } catch {
            $errMsg = $_.Exception.Message
            Write-Host "Warnung: Methode konnte nicht entfernt werden ($odata): $errMsg"
            $errors += $errMsg
        }
    }

    Disconnect-MgGraph | Out-Null

    $msg = if ($removedCount -gt 0) {
        "$removedCount Authentifizierungsmethode(n) entfernt"
    } else {
        "Keine entfernbaren MFA-Methoden gefunden"
    }

    Write-Host $msg

    $result = @{
        status       = "ok"
        message      = $msg
        upn          = $UPN
        removedCount = $removedCount
        errors       = $errors
    } | ConvertTo-Json -Compress -Depth 3
    Write-Output "###JSON_START###"
    Write-Output $result
    Write-Output "###JSON_END###"

} catch {
    Disconnect-MgGraph | Out-Null
    $errMsg = $_.Exception.Message
    Write-Host "FEHLER: $errMsg"
    $result = @{
        status  = "error"
        message = "Fehler beim MFA-Reset: $errMsg"
        upn     = $UPN
    } | ConvertTo-Json -Compress
    Write-Output "###JSON_START###"
    Write-Output $result
    Write-Output "###JSON_END###"
    exit 1
}
