# Single delegated scope set for all scripts so each new pwsh process reuses one MSAL token cache entry.
function Ensure-Module {
    param([Parameter(Mandatory = $true)][string]$Name)
    try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 } catch {}
    try { Install-PackageProvider -Name NuGet -Force -Scope CurrentUser -Confirm:$false | Out-Null } catch {}
    try { Set-PSRepository -Name PSGallery -InstallationPolicy Trusted -ErrorAction SilentlyContinue } catch {}
    if (-not (Get-Module -ListAvailable -Name $Name)) {
        Write-Host "Installiere Modul: $Name"
        Install-Module $Name -Force -Scope CurrentUser -AllowClobber -Confirm:$false
    }
    Import-Module $Name -Force -ErrorAction Stop
}

function Connect-Mg365App {
    [CmdletBinding()]
    param()
    Ensure-Module "Microsoft.Graph.Authentication"
    try {
        $psv = $PSVersionTable.PSVersion
        $pse = $PSVersionTable.PSEdition
        $hn = $Host.Name
        $uiOk = $false
        try { $uiOk = ($null -ne $Host.UI) } catch {}
        $userInteractive = $false
        try { $userInteractive = [Environment]::UserInteractive } catch {}
        Write-Host "PowerShell: $pse $psv | Host: $hn | UserInteractive: $userInteractive | HostUI: $uiOk"
        $authMods = @(Get-Module -ListAvailable -Name Microsoft.Graph.Authentication | Select-Object -First 1 -Property Version,Path)
        if ($authMods.Count -gt 0) { Write-Host "Graph.Auth Module: $($authMods[0].Version) | $($authMods[0].Path)" }
        $cmd = Get-Command Connect-MgGraph -ErrorAction SilentlyContinue
        if ($cmd) { Write-Host "Connect-MgGraph: $($cmd.Source) | $($cmd.ModuleName) | $($cmd.Version)" }
    } catch {}

    $scopes = @(
        'Directory.ReadWrite.All',
        'Group.ReadWrite.All',
        'GroupMember.ReadWrite.All',
        'Organization.Read.All',
        'User.Read.All',
        'User.ReadWrite.All',
        'UserAuthenticationMethod.ReadWrite.All'
    )
    try {
        try {
            $ctx = Get-MgContext -ErrorAction SilentlyContinue
            if ($ctx -and $ctx.Account -and $ctx.TenantId) {
                Write-Host "Vorhandener Graph-Context: $($ctx.Account) | Tenant: $($ctx.TenantId)"
            }
        } catch {}
        Connect-MgGraph -Scopes $scopes -NoWelcome -ErrorAction Stop
        return
    } catch {
        $msg = [string]$_.Exception.Message
        if ($msg -match 'Interactive browser credential authentication failed') {
            Write-Host "Hinweis: Browser-Login nicht möglich (headless). Fallback: Device-Code-Login..." -ForegroundColor Yellow
            Connect-MgGraph -Scopes $scopes -UseDeviceCode -NoWelcome -ContextScope Process -ErrorAction Stop
            return
        }
        Write-Host "Connect-MgGraph Fehler: $msg" -ForegroundColor Red
        try {
            if ($_.Exception.InnerException) {
                Write-Host "Inner: $([string]$_.Exception.InnerException.Message)" -ForegroundColor Red
            }
        } catch {}
        throw
    }
}
