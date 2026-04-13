# Updates display name and/or description of a directory group
param(
    [Parameter(Mandatory = $true)]
    [string]$GroupId,
    [string]$DisplayName,
    [string]$Description
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

Ensure-Module "Microsoft.Graph.Groups"

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

$body = @{}
if ($PSBoundParameters.ContainsKey('DisplayName')) {
    $body['displayName'] = $DisplayName
}
if ($PSBoundParameters.ContainsKey('Description')) {
    $body['description'] = $Description
}

if ($body.Count -eq 0) {
    $result = @{ status = "error"; message = "Keine Felder zum Aktualisieren" } | ConvertTo-Json -Compress
    Write-Output "###JSON_START###"
    Write-Output $result
    Write-Output "###JSON_END###"
    exit 1
}

try {
    Update-MgGroup -GroupId $GroupId -BodyParameter $body -ErrorAction Stop
    $result = @{
        status  = "ok"
        message = "Gruppe aktualisiert"
        groupId = $GroupId
    } | ConvertTo-Json -Compress
    Write-Output "###JSON_START###"
    Write-Output $result
    Write-Output "###JSON_END###"
    exit 0
} catch {
    $result = @{
        status = "error"
        message = "Fehler: $($_.Exception.Message)"
        groupId = $GroupId
    } | ConvertTo-Json -Compress
    Write-Output "###JSON_START###"
    Write-Output $result
    Write-Output "###JSON_END###"
    exit 1
}
