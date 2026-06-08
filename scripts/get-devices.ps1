# SPDX-License-Identifier: GPL-3.0-or-later
# Copyright (C) Mag. Thomas Michael Weissel <valueerror@gmail.com>

# Lists Entra ID directory devices (overview fields similar to Entra portal Devices blade)
$ErrorActionPreference = 'Continue'
$ProgressPreference = 'SilentlyContinue'

$__mg365ScriptsRoot = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
. (Join-Path $__mg365ScriptsRoot 'Mg365-GraphModules.ps1')

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

Ensure-Module "Microsoft.Graph.Identity.DirectoryManagement"

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
$allEntraDevices = New-Object System.Collections.Generic.List[hashtable]
try {
    Write-Host "Lade Geräte (mit registrierten Besitzern)..."
    $uri = "/v1.0/devices?`$select=id,deviceId,displayName,accountEnabled,operatingSystem,operatingSystemVersion,trustType,isCompliant,isManaged,managementType,approximateLastSignInDateTime,createdDateTime&`$expand=registeredOwners(`$select=displayName,userPrincipalName)&`$top=999"
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

            $allEntraDevices.Add(@{
                id                           = $d.id
                deviceId                     = if ($null -ne $d.deviceId -and '' -ne [string]$d.deviceId) { [string]$d.deviceId } else { $null }
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
            })
        }
        Write-Host "… $total Entra-Geräte"
        $uri = $resp.'@odata.nextLink'
    }
    Write-Host "Entra: $($allEntraDevices.Count) Geräte"

    $intuneByAid = @{}
    try {
        Write-Host "Lade Intune managedDevices…"
        $mdUri = "/v1.0/deviceManagement/managedDevices?`$select=id,azureADDeviceId,complianceState,userPrincipalName,deviceName&`$top=999"
        while ($null -ne $mdUri) {
            $mdr = Invoke-MgGraphRequest -Method GET -Uri $mdUri -ErrorAction Stop
            foreach ($m in $mdr.value) {
                $aid = $m.azureADDeviceId
                if ($null -ne $aid -and '' -ne [string]$aid) {
                    $intuneByAid[[string]$aid] = $m
                }
            }
            $mdUri = $mdr.'@odata.nextLink'
        }
        Write-Host "Intune: $($intuneByAid.Count) verwaltete Geräte"
    } catch {
        Write-Host "Hinweis: managedDevices nicht lesbar: $($_.Exception.Message)" -ForegroundColor Yellow
    }

    foreach ($dev in $allEntraDevices) {
        $lookupId = [string]$dev.deviceId
        if ([string]::IsNullOrWhiteSpace($lookupId)) { $lookupId = [string]$dev.id }
        $dev.isIntuneManaged = $false
        if ($intuneByAid.ContainsKey($lookupId)) {
            $managed = $intuneByAid[$lookupId]
            $dev.isIntuneManaged = $true
            $dev.intuneManagedDeviceId = [string]$managed.id
            if (-not $dev.deviceId) { $dev.deviceId = $lookupId }
            $cs = [string]$managed.complianceState
            $dev.intuneComplianceState = $cs
            $csLower = $cs.ToLowerInvariant()
            if ($csLower -eq 'compliant') {
                $dev.isCompliant = $true
            } elseif ($csLower -in @('noncompliant', 'conflict', 'error')) {
                $dev.isCompliant = $false
            }
        }
        $devicesData += $dev
    }
    $intuneCount = ($devicesData | Where-Object { $_.isIntuneManaged -eq $true }).Count
    Write-Host "Liste: $($devicesData.Count) Geräte ($intuneCount in Intune verwaltet)"
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
