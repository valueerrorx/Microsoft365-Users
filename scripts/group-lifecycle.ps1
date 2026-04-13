# Tenant group lifecycle policy (list / create / update / addGroups / removeGroups / listForGroup) via Graph v1.0
param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('list', 'create', 'update', 'addGroups', 'removeGroups', 'listForGroup')]
    [string]$Action,
    [string]$PolicyId,
    [string]$GroupId,
    [int]$GroupLifetimeInDays = 0,
    [string]$ManagedGroupTypes,
    [string]$AlternateNotificationEmails,
    [string]$GroupIdsJson
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

function Ensure-Module {
    param([string]$Name)
    if (Get-Module -Name $Name -ErrorAction SilentlyContinue) { return }
    if (-not (Get-Module -ListAvailable -Name $Name)) {
        Write-Host "Installiere Modul: $Name"
        Install-Module $Name -Force -Scope CurrentUser -AllowClobber
    }
    Import-Module $Name -ErrorAction Stop
}

function Write-JsonResult($obj) {
    $json = $obj | ConvertTo-Json -Depth 8 -Compress
    Write-Output "###JSON_START###"
    Write-Output $json
    Write-Output "###JSON_END###"
}

function Get-GraphErrorDetail {
    param($ErrorRecord)
    $msg = $ErrorRecord.Exception.Message
    if ($ErrorRecord.ErrorDetails -and $ErrorRecord.ErrorDetails.Message) {
        try {
            $j = $ErrorRecord.ErrorDetails.Message | ConvertFrom-Json
            if ($j.error.message) { return [string]$j.error.message }
            if ($j.error.code) { return "$($j.error.code): $($j.error.message)" }
        } catch {}
    }
    return $msg
}

Ensure-Module "Microsoft.Graph.Groups"

$__ms365ConnRoot = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
. (Join-Path $__ms365ConnRoot 'Connect-Mg365App.ps1')
Write-Host "Verbinde mit Microsoft Graph..."
try {
    Connect-Mg365App -ErrorAction Stop
} catch {
    Write-JsonResult @{ status = "error"; message = "Verbindung fehlgeschlagen: $($_.Exception.Message)" }
    exit 1
}

try {
    switch ($Action) {
        'listForGroup' {
            $gid = [string]$GroupId
            if ([string]::IsNullOrWhiteSpace($gid)) {
                Write-JsonResult @{ status = "error"; message = "GroupId fehlt"; policies = @() }
                exit 1
            }
            try {
                $r = Invoke-MgGraphRequest -Method GET -Uri "/v1.0/groups/$gid/groupLifecyclePolicies" -ErrorAction Stop
                $policies = @()
                foreach ($p in @($r.value)) {
                    $policies += @{
                        id = $p.id
                        groupLifetimeInDays         = $p.groupLifetimeInDays
                        managedGroupTypes           = [string]$p.managedGroupTypes
                        alternateNotificationEmails = $p.alternateNotificationEmails
                    }
                }
                Write-JsonResult @{ status = "ok"; policies = @($policies) }
            } catch {
                Write-JsonResult @{ status = "error"; message = (Get-GraphErrorDetail $_); policies = @() }
                exit 1
            }
        }
        'list' {
            $r = Invoke-MgGraphRequest -Method GET -Uri "/v1.0/groupLifecyclePolicies" -ErrorAction Stop
            $policies = @()
            foreach ($p in @($r.value)) {
                $policies += @{
                    id                        = $p.id
                    groupLifetimeInDays       = $p.groupLifetimeInDays
                    managedGroupTypes         = [string]$p.managedGroupTypes
                    alternateNotificationEmails = $p.alternateNotificationEmails
                }
            }
            Write-JsonResult @{ status = "ok"; policies = @($policies) }
        }
        'create' {
            if ($GroupLifetimeInDays -lt 1) {
                Write-JsonResult @{ status = "error"; message = "groupLifetimeInDays muss mindestens 1 sein" }
                exit 1
            }
            if (-not $ManagedGroupTypes) {
                Write-JsonResult @{ status = "error"; message = "managedGroupTypes fehlt (All oder Selected)" }
                exit 1
            }
            $bh = @{
                groupLifetimeInDays = $GroupLifetimeInDays
                managedGroupTypes   = $ManagedGroupTypes
            }
            if ($AlternateNotificationEmails) {
                $bh['alternateNotificationEmails'] = $AlternateNotificationEmails
            }
            $body = $bh | ConvertTo-Json -Compress
            $created = Invoke-MgGraphRequest -Method POST -Uri "/v1.0/groupLifecyclePolicies" -Body $body -ContentType "application/json" -ErrorAction Stop
            Write-JsonResult @{
                status  = "ok"
                message = "Ablaufrichtlinie angelegt"
                policy  = @{
                    id                        = $created.id
                    groupLifetimeInDays       = $created.groupLifetimeInDays
                    managedGroupTypes         = [string]$created.managedGroupTypes
                    alternateNotificationEmails = $created.alternateNotificationEmails
                }
            }
        }
        'update' {
            $policyGuid = [string]$PolicyId
            if (-not $policyGuid) {
                Write-JsonResult @{ status = "error"; message = "PolicyId fehlt" }
                exit 1
            }
            if ($GroupLifetimeInDays -lt 1) {
                Write-JsonResult @{ status = "error"; message = "groupLifetimeInDays muss mindestens 1 sein" }
                exit 1
            }
            if (-not $ManagedGroupTypes) {
                Write-JsonResult @{ status = "error"; message = "managedGroupTypes fehlt" }
                exit 1
            }
            $bh = @{
                groupLifetimeInDays = $GroupLifetimeInDays
                managedGroupTypes   = $ManagedGroupTypes
            }
            if ($AlternateNotificationEmails) {
                $bh['alternateNotificationEmails'] = $AlternateNotificationEmails
            }
            $body = $bh | ConvertTo-Json -Compress
            Invoke-MgGraphRequest -Method PATCH -Uri "/v1.0/groupLifecyclePolicies/$policyGuid" -Body $body -ContentType "application/json" -ErrorAction Stop | Out-Null
            Write-JsonResult @{
                status  = "ok"
                message = "Ablaufrichtlinie gespeichert"
                policy  = @{
                    id                        = $policyGuid
                    groupLifetimeInDays       = $GroupLifetimeInDays
                    managedGroupTypes         = $ManagedGroupTypes
                    alternateNotificationEmails = $AlternateNotificationEmails
                }
            }
        }
        'addGroups' {
            $policyGuid = [string]$PolicyId
            if (-not $policyGuid) {
                Write-JsonResult @{ status = "error"; message = "PolicyId fehlt"; results = @() }
                exit 1
            }
            if ([string]::IsNullOrWhiteSpace($GroupIdsJson)) {
                Write-JsonResult @{ status = "error"; message = "GroupIdsJson fehlt"; results = @() }
                exit 1
            }
            try {
                $pol = Invoke-MgGraphRequest -Method GET -Uri "/v1.0/groupLifecyclePolicies/$policyGuid" -ErrorAction Stop
                $mgt = [string]$pol.managedGroupTypes
                if ($mgt -ne 'Selected') {
                    Write-JsonResult @{
                        status   = "error"
                        message  = "addGroup funktioniert nur wenn die Richtlinie auf 'Ausgewählte Gruppen' (managedGroupTypes=Selected) steht. Aktuell: $mgt. Entweder Richtlinie umstellen oder bei 'Alle M365-Gruppen' ist keine Einzelzuordnung nötig."
                        results  = @()
                        added    = 0
                        failed   = 0
                    }
                    exit 1
                }
            } catch {
                Write-JsonResult @{ status = "error"; message = "Richtlinie konnte nicht gelesen werden: $(Get-GraphErrorDetail $_)"; results = @(); added = 0; failed = 0 }
                exit 1
            }
            $ids = $GroupIdsJson | ConvertFrom-Json
            if (-not $ids) {
                Write-JsonResult @{ status = "error"; message = "Keine Gruppen-IDs"; results = @() }
                exit 1
            }
            if ($ids -isnot [array]) { $ids = @($ids) }
            $results = [System.Collections.Generic.List[hashtable]]::new()
            $ok = 0
            $fail = 0
            foreach ($gid in $ids) {
                $gstr = [string]$gid
                if ([string]::IsNullOrWhiteSpace($gstr)) { continue }
                try {
                    $gmeta = Invoke-MgGraphRequest -Method GET -Uri "/v1.0/groups/$gstr?`$select=groupTypes,displayName" -ErrorAction Stop
                    $gtypes = @()
                    if ($null -ne $gmeta.groupTypes) { $gtypes = @($gmeta.groupTypes) }
                    if ($gtypes -notcontains 'Unified') {
                        $fail++
                        $results.Add(@{
                                groupId = $gstr; success = $false;
                                error   = "Nur Microsoft-365-Gruppen (groupTypes enthält Unified) können zur Ablaufrichtlinie hinzugefügt werden."
                            })
                        continue
                    }
                    $bodyJson = "{`"groupId`":`"$gstr`"}"
                    # addGroup returns JSON primitive true/false; default deserialization throws on non-object roots.
                    $respRaw = Invoke-MgGraphRequest -Method POST -Uri "/v1.0/groupLifecyclePolicies/$policyGuid/addGroup" -Body $bodyJson -ContentType "application/json" -OutputType Json -ErrorAction Stop
                    $parsed = $respRaw | ConvertFrom-Json
                    $added = $false
                    if ($parsed -is [bool]) { $added = $parsed }
                    elseif ($null -ne $parsed.value) { $added = [bool]$parsed.value }
                    else { $added = $true }
                    if ($added) { $ok++ } else { $fail++ }
                    $results.Add(@{ groupId = $gstr; success = [bool]$added; error = $(if ($added) { $null } else { "API meldet false (Gruppe evtl. schon zugeordnet oder nicht berechtigt)." }) })
                } catch {
                    $fail++
                    $results.Add(@{ groupId = $gstr; success = $false; error = (Get-GraphErrorDetail $_) })
                }
            }
            $status = if ($fail -eq 0) { "ok" } elseif ($ok -gt 0) { "partial" } else { "error" }
            $msg = "$ok hinzugefügt"
            if ($fail -gt 0) { $msg += ", $fail fehlgeschlagen" }
            Write-JsonResult @{
                status   = $status
                message  = $msg
                results  = @($results)
                added    = $ok
                failed   = $fail
            }
        }
        'removeGroups' {
            $policyGuid = [string]$PolicyId
            if (-not $policyGuid) {
                Write-JsonResult @{ status = "error"; message = "PolicyId fehlt"; results = @(); removed = 0; failed = 0 }
                exit 1
            }
            if ([string]::IsNullOrWhiteSpace($GroupIdsJson)) {
                Write-JsonResult @{ status = "error"; message = "GroupIdsJson fehlt"; results = @(); removed = 0; failed = 0 }
                exit 1
            }
            try {
                $pol = Invoke-MgGraphRequest -Method GET -Uri "/v1.0/groupLifecyclePolicies/$policyGuid" -ErrorAction Stop
                $mgt = [string]$pol.managedGroupTypes
                if ($mgt -ne 'Selected') {
                    Write-JsonResult @{
                        status   = "error"
                        message  = "removeGroup funktioniert nur wenn die Richtlinie auf 'Ausgewählte Gruppen' (managedGroupTypes=Selected) steht. Aktuell: $mgt."
                        results  = @()
                        removed  = 0
                        failed   = 0
                    }
                    exit 1
                }
            } catch {
                Write-JsonResult @{ status = "error"; message = "Richtlinie konnte nicht gelesen werden: $(Get-GraphErrorDetail $_)"; results = @(); removed = 0; failed = 0 }
                exit 1
            }
            $ids = $GroupIdsJson | ConvertFrom-Json
            if (-not $ids) {
                Write-JsonResult @{ status = "error"; message = "Keine Gruppen-IDs"; results = @(); removed = 0; failed = 0 }
                exit 1
            }
            if ($ids -isnot [array]) { $ids = @($ids) }
            $results = [System.Collections.Generic.List[hashtable]]::new()
            $ok = 0
            $fail = 0
            foreach ($gid in $ids) {
                $gstr = [string]$gid
                if ([string]::IsNullOrWhiteSpace($gstr)) { continue }
                try {
                    $gmeta = Invoke-MgGraphRequest -Method GET -Uri "/v1.0/groups/$gstr?`$select=groupTypes,displayName" -ErrorAction Stop
                    $gtypes = @()
                    if ($null -ne $gmeta.groupTypes) { $gtypes = @($gmeta.groupTypes) }
                    if ($gtypes -notcontains 'Unified') {
                        $fail++
                        $results.Add(@{
                                groupId = $gstr; success = $false;
                                error   = "Nur Microsoft-365-Gruppen (groupTypes enthält Unified) können aus der Ablaufrichtlinie entfernt werden."
                            })
                        continue
                    }
                    $bodyJson = "{`"groupId`":`"$gstr`"}"
                    # removeGroup returns JSON primitive true/false like addGroup.
                    $respRaw = Invoke-MgGraphRequest -Method POST -Uri "/v1.0/groupLifecyclePolicies/$policyGuid/removeGroup" -Body $bodyJson -ContentType "application/json" -OutputType Json -ErrorAction Stop
                    $parsed = $respRaw | ConvertFrom-Json
                    $removedOk = $false
                    if ($parsed -is [bool]) { $removedOk = $parsed }
                    elseif ($null -ne $parsed.value) { $removedOk = [bool]$parsed.value }
                    else { $removedOk = $true }
                    if ($removedOk) { $ok++ } else { $fail++ }
                    $results.Add(@{ groupId = $gstr; success = [bool]$removedOk; error = $(if ($removedOk) { $null } else { "API meldet false (Gruppe evtl. nicht in der Richtlinie)." }) })
                } catch {
                    $fail++
                    $results.Add(@{ groupId = $gstr; success = $false; error = (Get-GraphErrorDetail $_) })
                }
            }
            $status = if ($fail -eq 0) { "ok" } elseif ($ok -gt 0) { "partial" } else { "error" }
            $msg = "$ok entfernt"
            if ($fail -gt 0) { $msg += ", $fail fehlgeschlagen" }
            Write-JsonResult @{
                status   = $status
                message  = $msg
                results  = @($results)
                removed  = $ok
                failed   = $fail
            }
        }
    }
} catch {
    Write-JsonResult @{ status = "error"; message = $_.Exception.Message }
 exit 1
}
