# SPDX-License-Identifier: GPL-3.0-or-later
# Copyright (C) Mag. Thomas Michael Weissel <valueerror@gmail.com>

$script:Mg365GraphClientId = '14d82eec-204b-4c2f-b7e8-296a70dab67e'

# Resolve a bundled assembly from Microsoft.Graph.Authentication.
function Get-Mg365MsalAssemblyPath {
    param([string]$FileName)
    $mod = Get-Module -ListAvailable Microsoft.Graph.Authentication | Sort-Object Version -Descending | Select-Object -First 1
    if (-not $mod) { return $null }
    $hit = Get-ChildItem -Path $mod.ModuleBase -Recurse -Filter $FileName -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($hit) { return $hit.FullName }
    return $null
}

# Register MSAL token cache at ~/.mg/mg.msal.cache (same store Graph SDK uses).
function Register-Mg365MsalCache {
    param($App)
    $extPath = Get-Mg365MsalAssemblyPath 'Microsoft.Identity.Client.Extensions.Msal.dll'
    if (-not $extPath) { return }
    if (-not ('Microsoft.Identity.Client.Extensions.Msal.MsalCacheHelper' -as [type])) {
        Add-Type -Path $extPath
    }
    $mgDir = Join-Path $HOME '.mg'
    if (-not (Test-Path -LiteralPath $mgDir)) { New-Item -ItemType Directory -Path $mgDir -Force | Out-Null }
    $props = [Microsoft.Identity.Client.Extensions.Msal.StorageCreationPropertiesBuilder]::new('mg.msal.cache', $mgDir).Build()
    $helper = [Microsoft.Identity.Client.Extensions.Msal.MsalCacheHelper]::CreateAsync($props).GetAwaiter().GetResult()
    $helper.RegisterCache($App.UserTokenCache)
}

# Write mg.authrecord.json so Connect-MgGraph can attach to the session without WAM interactive login.
function Save-Mg365AuthRecord {
    param($Result, [string]$ClientId)
    $azurePath = Get-Mg365MsalAssemblyPath 'Azure.Identity.dll'
    if (-not $azurePath) { throw 'Azure.Identity.dll nicht gefunden (Microsoft.Graph.Authentication).' }
    if (-not ('Azure.Identity.AuthenticationRecord' -as [type])) {
        Add-Type -Path $azurePath
    }
    $mgDir = Join-Path $HOME '.mg'
    if (-not (Test-Path -LiteralPath $mgDir)) { New-Item -ItemType Directory -Path $mgDir -Force | Out-Null }
    $authority = "https://login.microsoftonline.com/$($Result.TenantId)"
    $homeId = $Result.Account.HomeAccountId.Identifier
    $record = [Azure.Identity.AuthenticationRecord]::new(
        $Result.Account.Username,
        $authority,
        $homeId,
        $Result.TenantId,
        $ClientId
    )
    $authPath = Join-Path $mgDir 'mg.authrecord.json'
    $fs = [System.IO.File]::Open($authPath, [System.IO.FileMode]::Create, [System.IO.FileAccess]::Write)
    try {
        $record.SerializeAsync($fs).GetAwaiter().GetResult()
    } finally {
        $fs.Dispose()
    }
}

# Windows: Graph SDK forces WAM on first Connect-MgGraph (needs HWND). Use system browser instead, same as Linux.
function Connect-Mg365WindowsBrowserLogin {
    param([string[]]$Scopes)

    $clientPath = Get-Mg365MsalAssemblyPath 'Microsoft.Identity.Client.dll'
    if (-not $clientPath) { throw 'Microsoft.Identity.Client.dll nicht gefunden (Microsoft.Graph.Authentication).' }
    if (-not ('Microsoft.Identity.Client.PublicClientApplicationBuilder' -as [type])) {
        Add-Type -Path $clientPath
    }

    $msScopes = foreach ($s in $Scopes) {
        if ($s -match '^https?://') { $s } else { "https://graph.microsoft.com/$s" }
    }

    $builder = [Microsoft.Identity.Client.PublicClientApplicationBuilder]::Create($script:Mg365GraphClientId)
    $builder = $builder.WithAuthority([Uri]'https://login.microsoftonline.com/organizations')
    $builder = $builder.WithRedirectUri('http://localhost')
    $app = $builder.Build()
    Register-Mg365MsalCache -App $app

    $result = $null
    $accounts = $app.GetAccountsAsync().GetAwaiter().GetResult()
    if ($accounts.Count -gt 0) {
        try {
            $result = $app.AcquireTokenSilent($msScopes, $accounts[0]).ExecuteAsync().GetAwaiter().GetResult()
        } catch { }
    }
    if (-not $result) {
        $interactive = $app.AcquireTokenInteractive($msScopes).WithUseEmbeddedWebView($false)
        $result = $interactive.ExecuteAsync().GetAwaiter().GetResult()
    }

    Save-Mg365AuthRecord -Result $result -ClientId $script:Mg365GraphClientId
}

# Shared Graph login; never Import-Module Microsoft.Graph.Authentication -Force after another Graph module loaded it (same assembly twice -> error on Linux/Windows).
function Connect-Mg365App {
    [CmdletBinding()]
    param()
    if (-not (Get-Command Connect-MgGraph -ErrorAction SilentlyContinue)) {
        if (-not (Get-Module -ListAvailable -Name Microsoft.Graph.Authentication)) {
            try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 } catch {}
            try { Install-PackageProvider -Name NuGet -Force -Scope CurrentUser -Confirm:$false -ErrorAction SilentlyContinue | Out-Null } catch {}
            try { Set-PSRepository -Name PSGallery -InstallationPolicy Trusted -ErrorAction SilentlyContinue } catch {}
            Write-Host "Installiere Modul: Microsoft.Graph.Authentication"
            Install-Module Microsoft.Graph.Authentication -Force -Scope CurrentUser -AllowClobber -Confirm:$false -ErrorAction Stop
        }
        Import-Module Microsoft.Graph.Authentication -ErrorAction Stop
    }
    $scopes = @(
        'Device.Read.All',
        'DeviceManagementManagedDevices.Read.All',
        'DeviceManagementManagedDevices.PrivilegedOperations.All',
        'Directory.ReadWrite.All',
        'Group.ReadWrite.All',
        'GroupMember.ReadWrite.All',
        'Organization.Read.All',
        'User.Read.All',
        'User.ReadWrite.All',
        'UserAuthenticationMethod.ReadWrite.All',
        'RoleManagement.ReadWrite.Directory'
    )

    if ($IsWindows) {
        $authRecordPath = Join-Path $HOME '.mg\mg.authrecord.json'
        if (-not (Test-Path -LiteralPath $authRecordPath)) {
            Connect-Mg365WindowsBrowserLogin -Scopes $scopes
        }
    }

    Connect-MgGraph -Scopes $scopes -NoWelcome -ErrorAction Stop
}
