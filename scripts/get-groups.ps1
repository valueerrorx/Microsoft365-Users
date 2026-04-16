# Lists directory groups (excludes dynamic membership groups) for picker UI
$ErrorActionPreference = 'Continue'
$ProgressPreference = 'SilentlyContinue'

function Ensure-Module {
    param([string]$Name)
    try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 } catch {}
    try { Install-PackageProvider -Name NuGet -Force -Scope CurrentUser -Confirm:$false | Out-Null } catch {}
    try { Set-PSRepository -Name PSGallery -InstallationPolicy Trusted -ErrorAction SilentlyContinue } catch {}
    if (-not (Get-Module -ListAvailable -Name $Name)) {
        Write-Host "Installiere Modul: $Name"
        Install-Module $Name -Force -Scope CurrentUser -AllowClobber -Confirm:$false
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
        groups  = @()
    } | ConvertTo-Json -Depth 4 -Compress
    Write-Output "###JSON_START###"
    Write-Output $result
    Write-Output "###JSON_END###"
    exit 1
}

$groupsData = @()
try {
    Write-Host "Lade Gruppen..."
    $select = "id,displayName,mailNickname,groupTypes,securityEnabled,mailEnabled,description"
    $groups = Get-MgGroup -All -Property $select -ErrorAction Stop

    foreach ($g in $groups) {
        $types = @()
        if ($null -ne $g.GroupTypes) { $types = @($g.GroupTypes) }
        if ($types -contains 'DynamicMembership') { continue }

        $groupsData += @{
            id              = $g.Id
            displayName     = $g.DisplayName
            mailNickname    = $g.MailNickname
            groupTypes      = $types
            securityEnabled = $g.SecurityEnabled
            mailEnabled     = $g.MailEnabled
            description     = $g.Description
        }
    }
    Write-Host "Gruppen geladen: $($groupsData.Count)"
} catch {
    $result = @{
        status  = "error"
        message = "Fehler beim Laden der Gruppen: $($_.Exception.Message)"
        groups  = @()
    } | ConvertTo-Json -Depth 4 -Compress
    Write-Output "###JSON_START###"
    Write-Output $result
    Write-Output "###JSON_END###"
    exit 1
}

$output = @{
    status = "ok"
    groups = $groupsData
    count  = $groupsData.Count
} | ConvertTo-Json -Depth 6 -Compress

Write-Output "###JSON_START###"
Write-Output $output
Write-Output "###JSON_END###"
