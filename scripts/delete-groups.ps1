# SPDX-License-Identifier: GPL-3.0-or-later
# Copyright (C) Mag. Thomas Michael Weissel <valueerror@gmail.com>

# Deletes multiple directory groups via Microsoft Graph $batch (max 20 DELETEs per request)
param(
    [Parameter(Mandatory = $true)]
    [string]$GroupIds
)

$ErrorActionPreference = 'Continue'
$ProgressPreference = 'SilentlyContinue'

$__mg365ScriptsRoot = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
. (Join-Path $__mg365ScriptsRoot 'Mg365-GraphModules.ps1')

function Write-JsonResult {
    param([hashtable]$Payload, [int]$ExitCode = 0)
    $json = $Payload | ConvertTo-Json -Depth 6 -Compress
    Write-Output "###JSON_START###"
    Write-Output $json
    Write-Output "###JSON_END###"
    exit $ExitCode
}

Ensure-Module "Microsoft.Graph.Groups"

$__ms365ConnRoot = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
. (Join-Path $__ms365ConnRoot 'Connect-Mg365App.ps1')
Write-Host "Verbinde mit Microsoft Graph..."
try {
    Connect-Mg365App -ErrorAction Stop
} catch {
    Write-JsonResult @{
        status        = "error"
        message       = "Verbindung fehlgeschlagen: $($_.Exception.Message)"
        deleted       = 0
        failed        = 0
        deletedGroupIds = @()
        errors        = @()
    } 1
}

$idList = @($GroupIds -split ',' | ForEach-Object { $_.Trim() } | Where-Object { $_ })

if ($idList.Count -eq 0) {
    Write-JsonResult @{
        status          = "error"
        message         = "Keine GroupIds uebergeben"
        deleted         = 0
        failed          = 0
        deletedGroupIds = @()
        errors          = @()
    } 1
}

$deletedIds = New-Object System.Collections.Generic.List[string]
$errorItems = New-Object System.Collections.Generic.List[hashtable]
$batchSize = 20

Write-Host "Loesche $($idList.Count) Gruppen (Graph Batch)..."

for ($offset = 0; $offset -lt $idList.Count; $offset += $batchSize) {
    $end = [Math]::Min($offset + $batchSize - 1, $idList.Count - 1)
    $chunk = @($idList[$offset..$end])
    $idToGroup = @{}
    $requests = New-Object System.Collections.Generic.List[hashtable]

    for ($i = 0; $i -lt $chunk.Count; $i++) {
        $gid = $chunk[$i]
        $reqId = "$i"
        $idToGroup[$reqId] = $gid
        $encoded = [uri]::EscapeDataString($gid)
        $requests.Add(@{
            id     = $reqId
            method = "DELETE"
            url    = "/groups/$encoded"
        })
    }

    try {
        $resp = Invoke-MgGraphRequest -Method POST -Uri '/v1.0/$batch' -Body @{ requests = @($requests) } -ErrorAction Stop
        $seenIds = @{}
        foreach ($r in @($resp.responses)) {
            $seenIds[$r.id] = $true
            $gid = $idToGroup[[string]$r.id]
            if (-not $gid) { continue }
            $statusCode = [int]$r.status
            if ($statusCode -ge 200 -and $statusCode -lt 300) {
                $deletedIds.Add($gid)
                Write-Host "Gruppe geloescht: $gid"
            } else {
                $msg = "HTTP $statusCode"
                if ($r.body -and $r.body.error -and $r.body.error.message) {
                    $msg = [string]$r.body.error.message
                }
                $errorItems.Add(@{ groupId = $gid; message = $msg })
                Write-Host "FEHLER ($gid): $msg"
            }
        }
        foreach ($reqId in $idToGroup.Keys) {
            if (-not $seenIds.ContainsKey($reqId)) {
                $gid = $idToGroup[$reqId]
                $errorItems.Add(@{ groupId = $gid; message = "Keine Batch-Antwort" })
                Write-Host "FEHLER ($gid): Keine Batch-Antwort"
            }
        }
    } catch {
        $batchErr = $_.Exception.Message
        if ($_.ErrorDetails -and $_.ErrorDetails.Message) { $batchErr += " $($_.ErrorDetails.Message)" }
        foreach ($gid in $chunk) {
            $errorItems.Add(@{ groupId = $gid; message = $batchErr })
            Write-Host "FEHLER ($gid): $batchErr"
        }
    }
}

$deleted = $deletedIds.Count
$failed = $errorItems.Count
$status = if ($failed -gt 0 -and $deleted -gt 0) { "partial" } elseif ($failed -gt 0) { "error" } else { "ok" }
$message = "Geloescht: $deleted, fehlgeschlagen: $failed"

Write-JsonResult @{
    status          = $status
    message         = $message
    deleted         = $deleted
    failed          = $failed
    deletedGroupIds = @($deletedIds)
    errors          = @($errorItems)
} 0
