# Erstellt oder aktualisiert Benutzer basierend auf einer CSV-Datei und weist Lizenzen zu.

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

# Installiere/Importiere benötigte Module
if (-not (Get-Module -ListAvailable -Name Microsoft.Graph.Users)) {
    Install-Module Microsoft.Graph.Users -Force -Scope CurrentUser
}
Import-Module Microsoft.Graph.Users -Force

# Microsoft.Graph.Users.Actions für Set-MgUserLicense
if (-not (Get-Module -ListAvailable -Name Microsoft.Graph.Users.Actions)) {
    Install-Module Microsoft.Graph.Users.Actions -Force -Scope CurrentUser
}
Import-Module Microsoft.Graph.Users.Actions -Force

if (-not (Get-Module -ListAvailable -Name Microsoft.Graph.Identity.DirectoryManagement)) {
    Install-Module Microsoft.Graph.Identity.DirectoryManagement -Force -Scope CurrentUser
}
Import-Module Microsoft.Graph.Identity.DirectoryManagement -Force

# Verbinde mit Microsoft Graph
Connect-MgGraph -Scopes "User.ReadWrite.All", "Organization.Read.All" -NoWelcome

# Ermittle Tenant-Domain
try {
    $org = Get-MgOrganization -Top 1
    $tenantDomain = $org.VerifiedDomains | Where-Object { $_.IsDefault -eq $true } | Select-Object -ExpandProperty Name
    if (-not $tenantDomain) {
        $tenantDomain = $org.VerifiedDomains[0].Name
    }
    Write-Host "Tenant-Domain ermittelt: $tenantDomain" -ForegroundColor Cyan
} catch {
    Write-Error "Konnte Tenant-Domain nicht ermitteln: $($_.Exception.Message)"
    Disconnect-MgGraph | Out-Null
    return
}

# Ermittle verfügbare A3-Lizenzen
$studentLicenseSkuId = $null
$teacherLicenseSkuId = $null

try {
    $subscribedSkus = Get-MgSubscribedSku
    # Lizenzen werden intern gespeichert, aber nicht in Logs ausgegeben
    foreach ($sku in $subscribedSkus) {
        $skuPartNumber = $sku.SkuPartNumber
        $consumedUnits = $sku.ConsumedUnits
        $prepaidUnits = $sku.PrepaidUnits
        
        # Suche nach Schüler-Lizenz - verschiedene mögliche Namen
        # Typische Namen: M365EDU_A3_STUDENTUSEQTY, M365EDU_A3_STU, etc.
        if ($studentLicenseSkuId -eq $null) {
            if ($skuPartNumber -like "*A3*STUDENT*" -or 
                $skuPartNumber -eq "M365EDU_A3_STUDENTUSEQTY" -or
                $skuPartNumber -like "*A3_STUDENT*" -or
                $skuPartNumber -like "*STUDENT*A3*" -or
                ($skuPartNumber -like "*A3*" -and $skuPartNumber -like "*STU*" -and $skuPartNumber -notlike "*FACULTY*")) {
                $studentLicenseSkuId = $sku.SkuId
                Write-Host "Schüler-Lizenz gefunden: $skuPartNumber" -ForegroundColor Green
            }
        }
        
        # Suche nach Lehrer-Lizenz - verschiedene mögliche Namen
        # Typische Namen: M365EDU_A3_FACULTYUSEQTY, M365EDU_A3_FAC, etc.
        if ($teacherLicenseSkuId -eq $null) {
            if ($skuPartNumber -like "*A3*FACULTY*" -or 
                $skuPartNumber -eq "M365EDU_A3_FACULTYUSEQTY" -or
                $skuPartNumber -like "*A3_FACULTY*" -or
                $skuPartNumber -like "*FACULTY*A3*" -or
                ($skuPartNumber -like "*A3*" -and $skuPartNumber -like "*FAC*" -and $skuPartNumber -notlike "*STUDENT*")) {
                $teacherLicenseSkuId = $sku.SkuId
                Write-Host "Lehrer-Lizenz gefunden: $skuPartNumber" -ForegroundColor Green
            }
        }
    }
    
    if ($null -eq $studentLicenseSkuId) {
        Write-Host "Warnung: Keine Schüler-Lizenz gefunden! Bitte prüfe die SKU-PartNumbers oben." -ForegroundColor Yellow
    }
    if ($null -eq $teacherLicenseSkuId) {
        Write-Host "Warnung: Keine Lehrer-Lizenz gefunden! Bitte prüfe die SKU-PartNumbers oben." -ForegroundColor Yellow
    }
} catch {
    Write-Host "Warnung: Konnte Lizenzen nicht abrufen. Lizenzzuweisung wird möglicherweise fehlschlagen." -ForegroundColor Yellow
    Write-Host "Fehler: $($_.Exception.Message)" -ForegroundColor Red
}

# Funktion: Normalisiere String für UPN (lowercase, alle Sonderzeichen ersetzen)
function Normalize-ForUPN {
    param([string]$Text)
    if ([string]::IsNullOrWhiteSpace($Text)) { return '' }
    
    # Ersetze zuerst alle Sonderzeichen (auch Großbuchstaben-Varianten)
    # Deutsche Umlaute
    $Text = $Text -replace '[äÄ]', 'ae'
    $Text = $Text -replace '[öÖ]', 'oe'
    $Text = $Text -replace '[üÜ]', 'ue'
    $Text = $Text -replace '[ß]', 'ss'
    # Französische/Italienische Akzente
    $Text = $Text -replace '[àáâãÀÁÂÃ]', 'a'
    $Text = $Text -replace '[èéêëÈÉÊË]', 'e'
    $Text = $Text -replace '[ìíîïÌÍÎÏ]', 'i'
    $Text = $Text -replace '[òóôõÒÓÔÕ]', 'o'
    $Text = $Text -replace '[ùúûÙÚÛ]', 'u'
    $Text = $Text -replace '[ýÿÝŸ]', 'y'
    $Text = $Text -replace '[çÇ]', 'c'
    $Text = $Text -replace '[ñÑ]', 'n'
    
    # Dann zu lowercase konvertieren
    $Text = $Text.ToLower()
    
    # Zum Schluss alle verbleibenden Sonderzeichen entfernen (außer a-z, 0-9, Punkt)
    $Text = $Text -replace '[^a-z0-9\.]', ''
    
    return $Text
}

# Stelle sicher, dass CSV als UTF-8 gelesen wird
$Utf8Encoding = [System.Text.Encoding]::UTF8
$csvContent = Get-Content -Path $CSVFilePath -Raw -Encoding UTF8
# Entferne BOM falls vorhanden
if ($csvContent.StartsWith([char]0xFEFF)) {
    $csvContent = $csvContent.Substring(1)
}
# Konvertiere zu CSV-Objekt
$csvData = $csvContent | ConvertFrom-Csv -Delimiter ';'

$csvData | ForEach-Object {
    $Vorname = "$($_.Vorname)".Trim()
    $Nachname = "$($_.Nachname)".Trim()
    $Abteilung = "$($_.Abteilung)".Trim()
    $UserType = "$($_.UserType)".Trim()
    $Password = "$($_.NewPassword)".Trim()
    
    # Verwende bereits normalisierte Werte aus CSV, falls vorhanden
    $VornameNormalized = "$($_.VornameNormalized)".Trim()
    $NachnameNormalized = "$($_.NachnameNormalized)".Trim()
    
    # Falls normalisierte Werte nicht vorhanden, normalisiere selbst (für Rückwärtskompatibilität)
    if ([string]::IsNullOrWhiteSpace($VornameNormalized)) {
        $VornameNormalized = Normalize-ForUPN $Vorname
    }
    if ([string]::IsNullOrWhiteSpace($NachnameNormalized)) {
        $NachnameNormalized = Normalize-ForUPN $Nachname
    }
    
    # UserType Default = "Schüler"
    if ([string]::IsNullOrWhiteSpace($UserType)) {
        $UserType = "Schüler"
    }

    $RawValue = "$($_.ForceChange)".Trim()
    $ForceChange = switch ($RawValue) {
        "1" { $true }
        default { $false }
    }

    # Validiere erforderliche Felder
    if ([string]::IsNullOrWhiteSpace($Vorname) -or [string]::IsNullOrWhiteSpace($Nachname) -or [string]::IsNullOrWhiteSpace($Password)) {
        Write-Host "FEHLER: Vorname, Nachname oder Passwort fehlt für: $Vorname $Nachname" -ForegroundColor Red
        return
    }

    # Generiere UserPrincipalName aus bereits normalisierten Werten: nachname.vorname@{tenant-domain}
    $UPN = "$NachnameNormalized.$VornameNormalized@$tenantDomain"
    
    # Generiere DisplayName: "Nachname Vorname"
    $DisplayName = "$Nachname $Vorname"

    Write-Host "Verarbeite Benutzer: $DisplayName ($UPN)"

    $PasswordProfile = @{
        'Password' = $Password
        'ForceChangePasswordNextSignIn' = $ForceChange
    }

    # Prüfe ob Benutzer existiert
    $existingUser = $null
    try {
        $existingUser = Get-MgUser -UserId $UPN -ErrorAction SilentlyContinue
    } catch {
        # Benutzer existiert nicht
    }

    if ($null -eq $existingUser) {
        # Benutzer erstellen
        Write-Host "Benutzer existiert nicht, wird erstellt..." -ForegroundColor Yellow
        
        # MailNickname ist der Teil vor dem @ im UPN
        $mailNickname = $UPN.Split('@')[0]
        
        $newUserParams = @{
            'UserPrincipalName' = $UPN
            'DisplayName' = $DisplayName
            'GivenName' = $Vorname
            'Surname' = $Nachname
            'MailNickname' = $mailNickname
            'PasswordProfile' = $PasswordProfile
            'AccountEnabled' = $true
        }
        
        if (-not [string]::IsNullOrWhiteSpace($Abteilung)) {
            $newUserParams['Department'] = $Abteilung
        }

        try {
            $newUser = New-MgUser @newUserParams
            if ($null -ne $newUser) {
                Write-Host "Benutzer erfolgreich erstellt: $UPN" -ForegroundColor Green

                # UsageLocation muss gesetzt sein bevor Lizenzen zugewiesen werden können
                # Verwende Österreich als Standard (AT)
                try {
                    Update-MgUser -UserId $UPN -UsageLocation "AT"
                } catch {
                    Write-Host "Warnung: UsageLocation konnte nicht gesetzt werden, versuche trotzdem Lizenz zuzuweisen..." -ForegroundColor Yellow
                }

                # Kurze Pause, damit der Benutzer vollständig im System erstellt wird
                Start-Sleep -Seconds 2

                # Lizenz zuweisen
                $licenseSkuId = $null
                if ($UserType -eq "Lehrer" -or $UserType -eq "Teacher") {
                    $licenseSkuId = $teacherLicenseSkuId
                } else {
                    $licenseSkuId = $studentLicenseSkuId
                }

                if ($null -ne $licenseSkuId) {
                    try {
                        # Versuche zuerst Set-MgUserLicense (falls verfügbar)
                        if (Get-Command Set-MgUserLicense -ErrorAction SilentlyContinue) {
                            Set-MgUserLicense -UserId $UPN -AddLicenses @(@{SkuId = $licenseSkuId}) -RemoveLicenses @()
                            Write-Host "Lizenz zugewiesen ($UserType): $licenseSkuId" -ForegroundColor Green
                        } else {
                            # Fallback: Direkte REST API
                            $body = @{
                                addLicenses = @(
                                    @{
                                        skuId = $licenseSkuId
                                    }
                                )
                                removeLicenses = @()
                            }
                            $jsonBody = $body | ConvertTo-Json -Depth 10
                            
                            $uri = "https://graph.microsoft.com/v1.0/users/$($newUser.Id)/assignLicense"
                            $response = Invoke-MgGraphRequest -Method POST -Uri $uri -Body $jsonBody -ContentType "application/json" -ErrorAction Stop
                            Write-Host "Lizenz zugewiesen ($UserType): $licenseSkuId" -ForegroundColor Green
                        }
                    } catch {
                        $errorMessage = $_.Exception.Message
                        # Versuche detaillierte Fehlermeldung aus Response zu extrahieren
                        if ($_.ErrorDetails) {
                            try {
                                $errorDetails = $_.ErrorDetails.Message | ConvertFrom-Json
                                if ($errorDetails.error) {
                                    $errorMessage = "$($errorDetails.error.message) (Code: $($errorDetails.error.code))"
                                }
                            } catch {}
                        }
                        # Falls ErrorDetails nicht verfügbar, versuche aus Exception zu extrahieren
                        if ($_.Exception.Response) {
                            try {
                                $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
                                $responseBody = $reader.ReadToEnd()
                                $errorObj = $responseBody | ConvertFrom-Json
                                if ($errorObj.error.message) {
                                    $errorMessage = "$($errorObj.error.message) (Code: $($errorObj.error.code))"
                                }
                            } catch {}
                        }
                        Write-Host "FEHLER bei Lizenzzuweisung für ${UPN}: $errorMessage" -ForegroundColor Red
                        Write-Host "SKU ID: $licenseSkuId" -ForegroundColor Yellow
                    }
                } else {
                    Write-Host "Warnung: Keine passende Lizenz gefunden für UserType: $UserType" -ForegroundColor Yellow
                }
            } else {
                Write-Host "FEHLER: Benutzer konnte nicht erstellt werden (keine Antwort von API)" -ForegroundColor Red
            }
        } catch {
            Write-Host "FEHLER beim Erstellen des Benutzers ${UPN}: $($_.Exception.Message)" -ForegroundColor Red
            # Fehler weiterwerfen, damit der Benutzer in der fehlgeschlagenen Liste landet
            throw
        }
    } else {
        # Benutzer existiert bereits, nur Passwort aktualisieren
        Write-Host "Benutzer existiert bereits, Passwort wird aktualisiert..." -ForegroundColor Cyan
        
        try {
            Update-MgUser -UserId $UPN -PasswordProfile $PasswordProfile
            Write-Host "Passwort erfolgreich aktualisiert. Benutzer muss PW bei nächster Anmeldung ändern: $($ForceChange)" -ForegroundColor Green
        } catch {
            Write-Host "FEHLER beim Aktualisieren des Passworts für ${UPN}: $($_.Exception.Message)" -ForegroundColor Red
        }
    }
}

Disconnect-MgGraph | Out-Null
