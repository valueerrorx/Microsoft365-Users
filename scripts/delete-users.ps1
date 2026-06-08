# SPDX-License-Identifier: GPL-3.0-or-later
# Copyright (C) Mag. Thomas Michael Weissel <valueerror@gmail.com>

# Deletes multiple users via Microsoft Graph $batch (max 20 DELETEs per request)
param(
    [Parameter(Mandatory = $true)]
    [string]$UPNs
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

Ensure-Module "Microsoft.Graph.Users"

$__ms365ConnRoot = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
. (Join-Path $__ms365ConnRoot 'Connect-Mg365App.ps1')
Write-Host "Verbinde mit Microsoft Graph..."
try {
    Connect-Mg365App -ErrorAction Stop
} catch {
    Write-JsonResult @{
        status      = "error"
        message     = "Verbindung fehlgeschlagen: $($_.Exception.Message)"
        deleted     = 0
        failed      = 0
        deletedUpns = @()
        errors      = @()
    } 1
}

$upnList = @($UPNs -split ',' | ForEach-Object { $_.Trim() } | Where-Object { $_ })

if ($upnList.Count -eq 0) {
    Write-JsonResult @{
        status      = "error"
        message     = "Keine UPNs uebergeben"
        deleted     = 0
        failed      = 0
        deletedUpns = @()
        errors      = @()
    } 1
}

$deletedUpns = New-Object System.Collections.Generic.List[string]
$errorItems = New-Object System.Collections.Generic.List[hashtable]
$batchSize = 20

Write-Host "Loesche $($upnList.Count) Benutzer (Graph Batch)..."

for ($offset = 0; $offset -lt $upnList.Count; $offset += $batchSize) {
    $end = [Math]::Min($offset + $batchSize - 1, $upnList.Count - 1)
    $chunk = @($upnList[$offset..$end])
    $idToUpn = @{}
    $requests = New-Object System.Collections.Generic.List[hashtable]

    for ($i = 0; $i -lt $chunk.Count; $i++) {
        $upn = $chunk[$i]
        $reqId = "$i"
        $idToUpn[$reqId] = $upn
        $encoded = [uri]::EscapeDataString($upn)
        $requests.Add(@{
            id     = $reqId
            method = "DELETE"
            url    = "/users/$encoded"
        })
    }

    try {
        $resp = Invoke-MgGraphRequest -Method POST -Uri '/v1.0/$batch' -Body @{ requests = @($requests) } -ErrorAction Stop
        $seenIds = @{}
        foreach ($r in @($resp.responses)) {
            $seenIds[$r.id] = $true
            $upn = $idToUpn[[string]$r.id]
            if (-not $upn) { continue }
            $statusCode = [int]$r.status
            if ($statusCode -ge 200 -and $statusCode -lt 300) {
                $deletedUpns.Add($upn)
                Write-Host "Benutzer geloescht: $upn"
            } else {
                $msg = "HTTP $statusCode"
                if ($r.body -and $r.body.error -and $r.body.error.message) {
                    $msg = [string]$r.body.error.message
                }
                $errorItems.Add(@{ upn = $upn; message = $msg })
                Write-Host "FEHLER ($upn): $msg"
            }
        }
        foreach ($reqId in $idToUpn.Keys) {
            if (-not $seenIds.ContainsKey($reqId)) {
                $upn = $idToUpn[$reqId]
                $errorItems.Add(@{ upn = $upn; message = "Keine Batch-Antwort" })
                Write-Host "FEHLER ($upn): Keine Batch-Antwort"
            }
        }
    } catch {
        $batchErr = $_.Exception.Message
        if ($_.ErrorDetails -and $_.ErrorDetails.Message) { $batchErr += " $($_.ErrorDetails.Message)" }
        foreach ($upn in $chunk) {
            $errorItems.Add(@{ upn = $upn; message = $batchErr })
            Write-Host "FEHLER ($upn): $batchErr"
        }
    }
}

$deleted = $deletedUpns.Count
$failed = $errorItems.Count
$status = if ($failed -gt 0 -and $deleted -gt 0) { "partial" } elseif ($failed -gt 0) { "error" } else { "ok" }
$message = "Geloescht: $deleted, fehlgeschlagen: $failed"

Write-JsonResult @{
    status      = $status
    message     = $message
    deleted     = $deleted
    failed      = $failed
    deletedUpns = @($deletedUpns)
    errors      = @($errorItems)
} 0
