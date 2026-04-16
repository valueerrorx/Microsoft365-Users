# SPDX-License-Identifier: GPL-3.0-or-later
# Copyright (C) Mag. Thomas Michael Weissel <valueerror@gmail.com>

# Group owner labels via Graph REST + directoryObject OData casts; Directory.Read.All matches get-ms365-users consent.
param(
    [Parameter(Mandatory = $true)]
    [string]$GroupId
)

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

function Get-OwnerEntries {
    param([string]$Gid)
    $rows = [System.Collections.ArrayList]::new()
    $uri = "/v1.0/groups/$Gid/owners?`$top=999"
    while ($null -ne $uri) {
        $resp = Invoke-MgGraphRequest -Method GET -Uri $uri -ErrorAction Stop
        foreach ($item in @($resp.value)) {
            $oid = $item.id
            if ([string]::IsNullOrEmpty($oid)) { continue }
            $otype = [string]$item.'@odata.type'
            [void]$rows.Add([pscustomobject]@{ Id = [string]$oid; Type = $otype })
        }
        $uri = $resp.'@odata.nextLink'
    }
    return $rows
}

function Try-UserLabel([string]$id) {
    foreach ($path in @(
            "/v1.0/directoryObjects/$id/microsoft.graph.user?`$select=mail,userPrincipalName,displayName",
            "/v1.0/users/$id?`$select=mail,userPrincipalName,displayName"
        )) {
        try {
            $r = Invoke-MgGraphRequest -Method GET -Uri $path -ErrorAction Stop
            $m = $r.mail
            if (-not $m) { $m = $r.userPrincipalName }
            if ($m) { return [string]$m }
            if ($r.displayName) { return [string]$r.displayName }
        } catch {}
    }
    return $null
}

function Try-GroupLabel([string]$id) {
    foreach ($path in @(
            "/v1.0/directoryObjects/$id/microsoft.graph.group?`$select=mail,displayName",
            "/v1.0/groups/$id?`$select=mail,displayName"
        )) {
        try {
            $r = Invoke-MgGraphRequest -Method GET -Uri $path -ErrorAction Stop
            if ($r.mail) { return [string]$r.mail }
            if ($r.displayName) { return "$($r.displayName) (Gruppe)" }
        } catch {}
    }
    return $null
}

function Try-SpLabel([string]$id) {
    foreach ($path in @(
            "/v1.0/directoryObjects/$id/microsoft.graph.servicePrincipal?`$select=displayName,appId",
            "/v1.0/servicePrincipals/$id?`$select=displayName,appId"
        )) {
        try {
            $r = Invoke-MgGraphRequest -Method GET -Uri $path -ErrorAction Stop
            if ($r.displayName) { return "$($r.displayName) (App)" }
        } catch {}
    }
    return $null
}

function Try-OrgContactLabel([string]$id) {
    try {
        $r = Invoke-MgGraphRequest -Method GET -Uri "/v1.0/directoryObjects/$id/microsoft.graph.orgContact?`$select=mail,displayName" -ErrorAction Stop
        if ($r.mail) { return [string]$r.mail }
        if ($r.displayName) { return [string]$r.displayName }
    } catch {}
    return $null
}

function Resolve-OwnerLabel {
    param([string]$OwnerId, [string]$OdataType)
    if ([string]::IsNullOrEmpty($OwnerId)) { return 'Besitzer (?)' }

    $lbl = Try-UserLabel $OwnerId
    if ($lbl) { return $lbl }
    $lbl = Try-GroupLabel $OwnerId
    if ($lbl) { return $lbl }
    $lbl = Try-SpLabel $OwnerId
    if ($lbl) { return $lbl }
    $lbl = Try-OrgContactLabel $OwnerId
    if ($lbl) { return $lbl }

    if ($OdataType) { return "Besitzer ($OwnerId) [$OdataType]" }
    return "Besitzer ($OwnerId)"
}

Ensure-Module "Microsoft.Graph.Groups"

$__ms365ConnRoot = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
. (Join-Path $__ms365ConnRoot 'Connect-Mg365App.ps1')
Write-Host "Verbinde mit Microsoft Graph..."
try {
    Connect-Mg365App -ErrorAction Stop
} catch {
    $result = @{ status = "error"; message = "Verbindung fehlgeschlagen: $($_.Exception.Message)"; ownerEmails = @() } | ConvertTo-Json -Depth 4 -Compress
    Write-Output "###JSON_START###"
    Write-Output $result
    Write-Output "###JSON_END###"
    exit 1
}

$emails = New-Object System.Collections.Generic.List[string]
try {
    $entries = Get-OwnerEntries -Gid $GroupId
    Write-Host "Besitzer (API): $($entries.Count)"
    foreach ($e in $entries) {
        $emails.Add((Resolve-OwnerLabel -OwnerId $e.Id -OdataType $e.Type))
    }
} catch {
    Write-Host "Fehler Besitzer: $($_.Exception.Message)"
}

$output = @{
    status       = "ok"
    groupId      = $GroupId
    ownerEmails  = @($emails)
} | ConvertTo-Json -Depth 6 -Compress

Write-Output "###JSON_START###"
Write-Output $output
Write-Output "###JSON_END###"
