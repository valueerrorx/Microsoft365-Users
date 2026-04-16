# SPDX-License-Identifier: GPL-3.0-or-later
# Copyright (C) Mag. Thomas Michael Weissel <valueerror@gmail.com>

# Adds directory users to a group sequentially; treats "already member" as skipped
param(
    [Parameter(Mandatory = $true)]
    [string]$GroupId,
    [Parameter(Mandatory = $true)]
    [string]$UserIds
)

$ErrorActionPreference = 'Continue'
$ProgressPreference = 'SilentlyContinue'

function Ensure-Module {
    param([string]$Name)
    try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 } catch {}
    try { Install-PackageProvider -Name NuGet -Force -Scope CurrentUser -Confirm:$false -ErrorAction Stop | Out-Null } catch {}
    try { Set-PSRepository -Name PSGallery -InstallationPolicy Trusted -ErrorAction SilentlyContinue } catch {}
    if (-not (Get-Module -ListAvailable -Name $Name)) {
        Write-Host "Installiere Modul: $Name"
        Install-Module $Name -Force -Scope CurrentUser -AllowClobber -Confirm:$false -ErrorAction Stop
    }
    Import-Module $Name -Force -ErrorAction Stop
}

Ensure-Module "Microsoft.Graph.Groups"

$__ms365ConnRoot = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
. (Join-Path $__ms365ConnRoot 'Connect-Mg365App.ps1')
Write-Host "Verbinde mit Microsoft Graph..."
try {
    Connect-Mg365App -ErrorAction Stop
} catch {
    $result = @{
        status  = "error"
        message = "Verbindung fehlgeschlagen: $($_.Exception.Message)"
        added   = 0
        skipped = 0
        failed  = 0
        errors  = @()
    } | ConvertTo-Json -Depth 4 -Compress
    Write-Output "###JSON_START###"
    Write-Output $result
    Write-Output "###JSON_END###"
    exit 1
}

function Test-IsAlreadyMemberError {
    param([string]$Text)
    if ([string]::IsNullOrEmpty($Text)) { return $false }
    $t = $Text.ToLowerInvariant()
    return $t.Contains('already exist') -or $t.Contains('added object references already exist') -or $t.Contains('one or more added object references already exist')
}

$idList = @($UserIds -split ',' | ForEach-Object { $_.Trim() } | Where-Object { $_ })

if ($idList.Count -eq 0) {
    $empty = @{
        status  = "error"
        message = "Keine User-IDs uebergeben"
        groupId = $GroupId
        added   = 0
        skipped = 0
        failed  = 0
        errors  = @()
    } | ConvertTo-Json -Depth 4 -Compress
    Write-Output "###JSON_START###"
    Write-Output $empty
    Write-Output "###JSON_END###"
    exit 1
}

$added = 0
$skipped = 0
$failed = 0
$errorItems = New-Object System.Collections.Generic.List[hashtable]

foreach ($uid in $idList) {
    Write-Host "Mitglied hinzufuegen: $uid"
    try {
        $refPath = "/v1.0/groups/$GroupId/members/`$ref"
        $payload = @{ "@odata.id" = "https://graph.microsoft.com/v1.0/directoryObjects/$uid" }
        Invoke-MgGraphRequest -Method POST -Uri $refPath -Body $payload -ErrorAction Stop
        $added++
    } catch {
        $raw = "$($_.Exception.Message)"
        if ($_.ErrorDetails -and $_.ErrorDetails.Message) { $raw += " $($_.ErrorDetails.Message)" }
        if (Test-IsAlreadyMemberError $raw) {
            $skipped++
            Write-Host "Uebersprungen (bereits Mitglied): $uid"
        } else {
            $failed++
            $errorItems.Add(@{ userId = $uid; message = $raw })
            Write-Host "FEHLER: $raw"
        }
    }
}

$status = if ($failed -gt 0) { "partial" } else { "ok" }
$result = @{
    status   = $status
    message  = "Hinzugefuegt: $added, uebersprungen: $skipped, fehlgeschlagen: $failed"
    groupId  = $GroupId
    added    = $added
    skipped  = $skipped
    failed   = $failed
    errors   = @($errorItems)
} | ConvertTo-Json -Depth 6 -Compress

Write-Output "###JSON_START###"
Write-Output $result
Write-Output "###JSON_END###"
exit 0
