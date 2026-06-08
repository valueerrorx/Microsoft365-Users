# SPDX-License-Identifier: GPL-3.0-or-later
# Copyright (C) Mag. Thomas Michael Weissel <valueerror@gmail.com>

# Adds a user to an Entra directory role (by role template id)
param(
    [Parameter(Mandatory = $true)]
    [string]$RoleTemplateId,
    [Parameter(Mandatory = $true)]
    [string]$UserId
)

$ErrorActionPreference = 'Continue'
$ProgressPreference = 'SilentlyContinue'

$__mg365ScriptsRoot = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
. (Join-Path $__mg365ScriptsRoot 'Mg365-GraphModules.ps1')

function Test-IsAlreadyMemberError {
    param([string]$Text)
    if ([string]::IsNullOrEmpty($Text)) { return $false }
    $t = $Text.ToLowerInvariant()
    return $t.Contains('already exist') -or $t.Contains('added object references already exist') -or $t.Contains('one or more added object references already exist')
}

$__ms365ConnRoot = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
. (Join-Path $__ms365ConnRoot 'Connect-Mg365App.ps1')
Write-Host "Verbinde mit Microsoft Graph..."
try {
    Connect-Mg365App -ErrorAction Stop
} catch {
    $result = @{ status = "error"; message = "Verbindung fehlgeschlagen: $($_.Exception.Message)" } | ConvertTo-Json -Compress
    Write-Output "###JSON_START###"
    Write-Output $result
    Write-Output "###JSON_END###"
    exit 1
}

$__dirRoleHelper = Join-Path $__ms365ConnRoot 'DirectoryRole-Mg365.ps1'
if (-not (Test-Path -LiteralPath $__dirRoleHelper)) { throw "DirectoryRole-Mg365.ps1 fehlt (erwartet in: $__ms365ConnRoot)" }
. $__dirRoleHelper
if (-not (Get-Command Get-OrActivateDirectoryRole -ErrorAction SilentlyContinue)) { throw "DirectoryRole-Mg365.ps1 konnte nicht geladen werden" }

$uid = $UserId.Trim()
$tid = $RoleTemplateId.Trim()
if (-not $uid -or -not $tid) {
    $result = @{ status = "error"; message = "RoleTemplateId und UserId erforderlich" } | ConvertTo-Json -Compress
    Write-Output "###JSON_START###"
    Write-Output $result
    Write-Output "###JSON_END###"
    exit 1
}

try {
    $dirRole = Get-OrActivateDirectoryRole -TemplateId $tid
    $refPath = "/v1.0/directoryRoles/$($dirRole.Id)/members/`$ref"
    $payload = @{ "@odata.id" = "https://graph.microsoft.com/v1.0/users/$uid" }
    Invoke-MgGraphRequest -Method POST -Uri $refPath -Body $payload -ErrorAction Stop
    $user = Get-MgUser -UserId $uid -Property "id,displayName,userPrincipalName,mail" -ErrorAction SilentlyContinue
    $memberId = if ($user -and $user.Id) { [string]$user.Id } else { $uid }
    $member = @{
        id                = $memberId
        displayName       = if ($user) { $user.DisplayName } else { $null }
        userPrincipalName = if ($user) { $user.UserPrincipalName } else { $null }
        mail              = if ($user) { $user.Mail } else { $null }
        odataType         = "#microsoft.graph.user"
    }
    $result = @{
        status          = "ok"
        message         = "Benutzer zur Rolle hinzugefuegt"
        roleTemplateId  = $tid
        directoryRoleId = $dirRole.Id
        userId          = $uid
        member          = $member
    } | ConvertTo-Json -Depth 6 -Compress
    Write-Output "###JSON_START###"
    Write-Output $result
    Write-Output "###JSON_END###"
    exit 0
} catch {
    $raw = "$($_.Exception.Message)"
    if ($_.ErrorDetails -and $_.ErrorDetails.Message) { $raw += " $($_.ErrorDetails.Message)" }
    if (Test-IsAlreadyMemberError $raw) {
        $result = @{
            status         = "ok"
            message        = "Benutzer ist bereits Mitglied dieser Rolle"
            roleTemplateId = $tid
            userId         = $uid
            skipped        = $true
        } | ConvertTo-Json -Compress
        Write-Output "###JSON_START###"
        Write-Output $result
        Write-Output "###JSON_END###"
        exit 0
    }
    $result = @{
        status         = "error"
        message        = "Fehler: $raw"
        roleTemplateId = $tid
        userId         = $uid
    } | ConvertTo-Json -Compress
    Write-Output "###JSON_START###"
    Write-Output $result
    Write-Output "###JSON_END###"
    exit 1
}
