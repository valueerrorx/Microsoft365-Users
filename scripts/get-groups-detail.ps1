# Group list with owner count and Teams flag — one paginated /groups request with $expand=owners; hasTeam from resourceProvisioningOptions
$ErrorActionPreference = 'Continue'
$ProgressPreference = 'SilentlyContinue'

function Ensure-Module {
    param([string]$Name)
    try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 } catch {}
    try { Install-PackageProvider -Name NuGet -Force -Scope CurrentUser -Confirm:$false | Out-Null } catch {}
    try { Set-PSRepository -Name PSGallery -InstallationPolicy Trusted -ErrorAction SilentlyContinue } catch {}
    if (Get-Module -Name $Name -ErrorAction SilentlyContinue) { return }
    if (-not (Get-Module -ListAvailable -Name $Name)) {
        Write-Host "Installiere Modul: $Name"
        Install-Module $Name -Force -Scope CurrentUser -AllowClobber -Confirm:$false
    }
    Import-Module $Name -ErrorAction Stop
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

function Get-OwnerCountExact {
    param([string]$GroupId)
    $n = 0
    $ocUri = "/v1.0/groups/$GroupId/owners?`$select=id&`$top=999"
    while ($null -ne $ocUri) {
        $ocr = Invoke-MgGraphRequest -Method GET -Uri $ocUri -ErrorAction Stop
        $n += @($ocr.value).Count
        $ocUri = $ocr.'@odata.nextLink'
    }
    return $n
}

$groupsData = @()
try {
    Write-Host "Lade Gruppen (eine API-Serie mit Besitzer-Expand)..."
    $uri = "/v1.0/groups?`$select=id,displayName,mailNickname,groupTypes,securityEnabled,mailEnabled,description,resourceProvisioningOptions,visibility,createdDateTime,expirationDateTime&`$expand=owners(`$select=id)&`$top=999"
    $total = 0
    while ($null -ne $uri) {
        $resp = Invoke-MgGraphRequest -Method GET -Uri $uri -ErrorAction Stop
        foreach ($g in $resp.value) {
            $total++
            $types = @()
            if ($null -ne $g.groupTypes) { $types = @($g.groupTypes) }
            $isDynamic = $types -contains 'DynamicMembership'

            $ownerList = @()
            if ($null -ne $g.owners) { $ownerList = @($g.owners) }
            $ownerCount = $ownerList.Count
            if ($ownerCount -ge 20) {
                $ownerCount = Get-OwnerCountExact -GroupId $g.id
            }

            $prov = @()
            if ($null -ne $g.resourceProvisioningOptions) { $prov = @($g.resourceProvisioningOptions) }
            $hasTeam = $prov -contains 'Team'

            $vis = $g.visibility
            if ($null -ne $vis) { $vis = [string]$vis }
            $created = $g.createdDateTime
            if ($null -ne $created -and $created -is [datetime]) { $created = $created.ToUniversalTime().ToString('o') }
            elseif ($null -ne $created) { $created = [string]$created }
            $expires = $g.expirationDateTime
            if ($null -ne $expires -and $expires -is [datetime]) { $expires = $expires.ToUniversalTime().ToString('o') }
            elseif ($null -ne $expires) { $expires = [string]$expires }

            $groupsData += @{
                id               = $g.id
                displayName      = $g.displayName
                mailNickname     = $g.mailNickname
                groupTypes       = $types
                securityEnabled  = $g.securityEnabled
                mailEnabled      = $g.mailEnabled
                description      = $g.description
                visibility       = $vis
                createdDateTime  = $created
                expirationDateTime = $expires
                isDynamic        = [bool]$isDynamic
                ownerCount       = [int]$ownerCount
                ownerEmails      = @()
                hasTeam          = [bool]$hasTeam
            }
        }
        Write-Host "… $total Gruppen"
        $uri = $resp.'@odata.nextLink'
    }
    Write-Host "Fertig: $($groupsData.Count) Gruppen"
} catch {
    $result = @{
        status  = "error"
        message = "Fehler beim Laden: $($_.Exception.Message)"
        groups  = @()
    } | ConvertTo-Json -Depth 6 -Compress
    Write-Output "###JSON_START###"
    Write-Output $result
    Write-Output "###JSON_END###"
    exit 1
}

$output = @{
    status = "ok"
    groups = $groupsData
    count  = $groupsData.Count
} | ConvertTo-Json -Depth 8 -Compress

Write-Output "###JSON_START###"
Write-Output $output
Write-Output "###JSON_END###"
