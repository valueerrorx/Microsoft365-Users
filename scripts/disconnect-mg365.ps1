# SPDX-License-Identifier: GPL-3.0-or-later
# Copyright (C) Mag. Thomas Michael Weissel <valueerror@gmail.com>

# Clears Microsoft Graph / MSAL token cache for this app (sign-out).

$ErrorActionPreference = 'Continue'
$ProgressPreference = 'SilentlyContinue'

function Write-JsonResult {
    param([hashtable]$Payload)
    $json = $Payload | ConvertTo-Json -Compress
    Write-Output "###JSON_START###"
    Write-Output $json
    Write-Output "###JSON_END###"
}

function Clear-Mg365TokenCacheFiles {
    $removed = 0
    if ($env:LOCALAPPDATA) {
        $idSvc = Join-Path $env:LOCALAPPDATA '.IdentityService'
        if (Test-Path -LiteralPath $idSvc) {
            Get-ChildItem -LiteralPath $idSvc -Filter 'mg*' -Force -ErrorAction SilentlyContinue |
                ForEach-Object { Remove-Item -LiteralPath $_.FullName -Force -Recurse -ErrorAction SilentlyContinue; $removed++ }
        }
    }
    $profileRoot = if ($env:USERPROFILE) { $env:USERPROFILE } elseif ($env:HOME) { $env:HOME } else { $null }
    if ($profileRoot) {
        foreach ($name in @('.mg', '.graph')) {
            $p = Join-Path $profileRoot $name
            if (Test-Path -LiteralPath $p) {
                Remove-Item -LiteralPath $p -Recurse -Force -ErrorAction SilentlyContinue
                $removed++
            }
        }
    }
    return $removed
}

$__mg365ScriptsRoot = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
. (Join-Path $__mg365ScriptsRoot 'Mg365-GraphModules.ps1')

try {
    if (Get-Module -ListAvailable -Name Microsoft.Graph.Authentication | Where-Object { $_.Version -eq $script:Mg365GraphSdkVersion }) {
        Import-Module Microsoft.Graph.Authentication -RequiredVersion $script:Mg365GraphSdkVersion -ErrorAction SilentlyContinue
        if (Get-Command Disconnect-MgGraph -ErrorAction SilentlyContinue) {
            Disconnect-MgGraph -ErrorAction SilentlyContinue | Out-Null
        }
    }
    $n = Clear-Mg365TokenCacheFiles
    $msg = if ($n -gt 0) { "Microsoft Graph abgemeldet — Token-Cache geleert ($n)." } else { 'Microsoft Graph abgemeldet — keine Cache-Dateien gefunden.' }
    Write-JsonResult @{ status = 'ok'; message = $msg }
    exit 0
} catch {
    $errMsg = [string]$_.Exception.Message
    Write-JsonResult @{ status = 'error'; message = "Abmelden fehlgeschlagen: $errMsg" }
    exit 1
}
