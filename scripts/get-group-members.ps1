# Lists members of a group (users and other directory objects) for UI table
param(
    [Parameter(Mandatory = $true)]
    [string]$GroupId
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
    $result = @{ status = "error"; message = "Verbindung fehlgeschlagen: $($_.Exception.Message)"; members = @() } | ConvertTo-Json -Depth 4 -Compress
    Write-Output "###JSON_START###"
    Write-Output $result
    Write-Output "###JSON_END###"
    exit 1
}

$membersData = @()
try {
    Write-Host "Lade Mitglieder..."
    $uri = "/v1.0/groups/$GroupId/members?`$select=id,displayName,mail,userPrincipalName&`$top=999"
    while ($null -ne $uri) {
        $resp = Invoke-MgGraphRequest -Method GET -Uri $uri -ErrorAction Stop
        foreach ($m in $resp.value) {
            $odataType = $m.'@odata.type'
            if (-not $odataType) { $odataType = '' }
            $membersData += @{
                id                = $m.id
                displayName       = $m.displayName
                mail              = $m.mail
                userPrincipalName = $m.userPrincipalName
                odataType         = $odataType
            }
        }
        $uri = $resp.'@odata.nextLink'
    }
    Write-Host "Mitglieder: $($membersData.Count)"
} catch {
    $result = @{
        status  = "error"
        message = "Fehler: $($_.Exception.Message)"
        members = @()
    } | ConvertTo-Json -Depth 6 -Compress
    Write-Output "###JSON_START###"
    Write-Output $result
    Write-Output "###JSON_END###"
    exit 1
}

$output = @{
    status = "ok"
    groupId = $GroupId
    members = $membersData
    count   = $membersData.Count
} | ConvertTo-Json -Depth 8 -Compress

Write-Output "###JSON_START###"
Write-Output $output
Write-Output "###JSON_END###"
