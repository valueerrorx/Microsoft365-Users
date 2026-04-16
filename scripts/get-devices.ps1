# SPDX-License-Identifier: GPL-3.0-or-later
# Copyright (C) Mag. Thomas Michael Weissel <valueerror@gmail.com>

# Lists Entra ID directory devices (overview fields similar to Entra portal Devices blade)
$ErrorActionPreference = 'Continue'
$ProgressPreference = 'SilentlyContinue'

function Ensure-Module {
    param([string]$Name)
    try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 } catch {}
    try { Install-PackageProvider -Name NuGet -Force -Scope CurrentUser -Confirm:$false -ErrorAction Stop | Out-Null } catch {}
    try { Set-PSRepository -Name PSGallery -InstallationPolicy Trusted -ErrorAction SilentlyContinue } catch {}
    if (Get-Module -Name $Name -ErrorAction SilentlyContinue) { return }
    if (-not (Get-Module -ListAvailable -Name $Name)) {
        Write-Host "Installiere Modul: $Name"
        Install-Module $Name -Force -Scope CurrentUser -AllowClobber -Confirm:$false -ErrorAction Stop
    }
    Import-Module $Name -ErrorAction Stop
}

Ensure-Module "Microsoft.Graph.Identity.DirectoryManagement"

$__ms365ConnRoot = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
. (Join-Path $__ms365ConnRoot 'Connect-Mg365App.ps1')
Write-Host "Verbinde mit Microsoft Graph..."
try {
    Connect-Mg365App -ErrorAction Stop
} catch {
    $result = @{
        status = "error"
        message  = "Verbindung fehlgeschlagen: $($_.Exception.Message)"
        devices  = @()
    } | ConvertTo-Json -Depth 4 -Compress
    Write-Output "###JSON_START###"
    Write-Output $result
    Write-Output "###JSON_END###"
    exit 1
}

function Get-TrustTypeLabel {
    param([string]$TrustType)
    $t = if ($null -eq $TrustType) { '' } else { [string]$TrustType }
    switch ($t) {
        'AzureAd' { return 'Microsoft Entra gejoint' }
        'Workplace' { return 'Microsoft Entra registriert' }
        'ServerAd' { return 'Hybrid Microsoft Entra gejoint' }
        default { if ($t) { return $t } return '' }
    }
}

function Get-ManagementLabel {
    param([string]$ManagementType)
    $m = if ($null -eq $ManagementType) { '' } else { [string]$ManagementType.ToLowerInvariant() }
    switch ($m) {
        'intuneclient' { return 'Microsoft Intune' }
        'easintuneclient' { return 'Microsoft Intune' }
        'mdm' { return 'MDM' }
        'easmdm' { return 'EAS + MDM' }
        'eas' { return 'Exchange ActiveSync' }
        'configurationmanagerclient' { return 'Configuration Manager' }
        'configurationmanagerclientmdm' { return 'Configuration Manager + MDM' }
        'configurationmanagerclientmdmeas' { return 'Configuration Manager + MDM + EAS' }
        'unknown' { return 'Unbekannt' }
        default { if ($ManagementType) { return [string]$ManagementType } return '' }
    }
}

function Get-SecurityManagementLabel {
    param($ManagementType, $IsManaged)
    $m = if ($null -eq $ManagementType) { '' } else { [string]$ManagementType.ToLowerInvariant() }
    if ($m -match 'intune') { return 'Microsoft Intune' }
    if ($m -match 'configurationmanager') { return 'Configuration Manager' }
    if ($IsManaged -eq $true -and $ManagementType) { return (Get-ManagementLabel -ManagementType $ManagementType) }
    return ''
}

function Format-Iso {
    param($Val)
    if ($null -eq $Val) { return $null }
    if ($Val -is [datetime]) { return $Val.ToUniversalTime().ToString('o') }
    $s = [string]$Val
    if ([string]::IsNullOrWhiteSpace($s)) { return $null }
    return $s
}

$devicesData = @()
try {
    Write-Host "Lade Geräte (mit registrierten Besitzern)..."
    $uri = "/v1.0/devices?`$select=id,displayName,accountEnabled,operatingSystem,operatingSystemVersion,trustType,isCompliant,isManaged,managementType,approximateLastSignInDateTime,createdDateTime&`$expand=registeredOwners(`$select=displayName,userPrincipalName)&`$top=999"
    $total = 0
    while ($null -ne $uri) {
        $resp = Invoke-MgGraphRequest -Method GET -Uri $uri -ErrorAction Stop
        foreach ($d in $resp.value) {
            $total++
            $ownerList = @()
            if ($null -ne $d.registeredOwners) { $ownerList = @($d.registeredOwners) }
            $own = $ownerList | Select-Object -First 1
            $ownerDn = $null
            $ownerUpn = $null
            if ($own) {
                $ownerDn = $own.displayName
                $ownerUpn = $own.userPrincipalName
            }

            $mgmt = $d.managementType
            $tt = $d.trustType
            if ($null -ne $tt) { $tt = [string]$tt }
            if ($null -ne $mgmt) { $mgmt = [string]$mgmt }

            $devicesData += @{
                id                           = $d.id
                displayName                  = $d.displayName
                accountEnabled               = [bool]($d.accountEnabled -eq $true)
                operatingSystem              = $d.operatingSystem
                operatingSystemVersion       = $d.operatingSystemVersion
                trustType                    = $tt
                trustTypeLabel               = (Get-TrustTypeLabel -TrustType $tt)
                ownerDisplayName             = $ownerDn
                ownerUserPrincipalName       = $ownerUpn
                managementType               = $mgmt
                managementLabel              = (Get-ManagementLabel -ManagementType $mgmt)
                securityManagementLabel      = (Get-SecurityManagementLabel -ManagementType $mgmt -IsManaged $d.isManaged)
                isCompliant                  = if ($null -eq $d.isCompliant) { $null } else { [bool]$d.isCompliant }
                isManaged                    = if ($null -eq $d.isManaged) { $null } else { [bool]$d.isManaged }
                approximateLastSignInDateTime = (Format-Iso -Val $d.approximateLastSignInDateTime)
                createdDateTime              = (Format-Iso -Val $d.createdDateTime)
            }
        }
        Write-Host "… $total Geräte"
        $uri = $resp.'@odata.nextLink'
    }
    Write-Host "Fertig: $($devicesData.Count) Geräte"

    $needsManagedDeviceCompliance = $false
    foreach ($dev in $devicesData) {
        if ($dev.isManaged -eq $true -and $null -eq $dev.isCompliant) {
            $needsManagedDeviceCompliance = $true
            break
        }
    }
    if ($needsManagedDeviceCompliance) {
        try {
            Write-Host "Lade Intune-Konformität (managedDevices)…"
            $compByAid = @{}
            $mdUri = "/v1.0/deviceManagement/managedDevices?`$select=azureADDeviceId,complianceState&`$top=999"
            while ($null -ne $mdUri) {
                $mdr = Invoke-MgGraphRequest -Method GET -Uri $mdUri -ErrorAction Stop
                foreach ($m in $mdr.value) {
                    $aid = $m.azureADDeviceId
                    if ($null -ne $aid -and '' -ne [string]$aid) {
                        $compByAid[[string]$aid] = [string]$m.complianceState
                    }
                }
                $mdUri = $mdr.'@odata.nextLink'
            }
            foreach ($dev in $devicesData) {
                $id = [string]$dev.id
                if (-not $compByAid.ContainsKey($id)) { continue }
                $cs = [string]$compByAid[$id]
                $dev.intuneComplianceState = $cs
                $csLower = $cs.ToLowerInvariant()
                if ($csLower -eq 'compliant') {
                    $dev.isCompliant = $true
                } elseif ($csLower -in @('noncompliant', 'conflict', 'error')) {
                    $dev.isCompliant = $false
                } else {
                    $dev.isCompliant = $null
                }
            }
            Write-Host "Intune-Konformität: $($compByAid.Count) Zuordnungen"
        } catch {
            Write-Host "Hinweis: managedDevices/Konformität übersprungen: $($_.Exception.Message)" -ForegroundColor Yellow
        }
    }
} catch {
    $result = @{
        status  = "error"
        message = "Fehler beim Laden: $($_.Exception.Message)"
        devices = @()
    } | ConvertTo-Json -Depth 6 -Compress
    Write-Output "###JSON_START###"
    Write-Output $result
    Write-Output "###JSON_END###"
    exit 1
}

$output = @{
    status  = "ok"
    devices = $devicesData
    count   = $devicesData.Count
} | ConvertTo-Json -Depth 8 -Compress

Write-Output "###JSON_START###"
Write-Output $output
Write-Output "###JSON_END###"
