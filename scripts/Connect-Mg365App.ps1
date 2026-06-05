# SPDX-License-Identifier: GPL-3.0-or-later
# Copyright (C) Mag. Thomas Michael Weissel <valueerror@gmail.com>

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
    $useDeviceCode = $env:MS365_ELECTRON_APP -eq '1'
    if ($useDeviceCode) {
        Write-Host "Device-Code-Anmeldung - Browser oeffnet sich automatisch..." -ForegroundColor Yellow
        Write-Host "Code steht unten im Ausgabefenster; auf der Seite eingeben und anmelden." -ForegroundColor Yellow
        Connect-MgGraph -Scopes $scopes -UseDeviceCode -NoWelcome -ErrorAction Stop
        return
    }
    try {
        Connect-MgGraph -Scopes $scopes -NoWelcome -ErrorAction Stop
        return
    } catch {
        $msg = [string]$_.Exception.Message
        if ($msg -match 'InteractiveBrowserCredential|Interactive browser credential|window handle must be configured') {
            Write-Host "Hinweis: Browser-Login nicht moeglich. Fallback: Device-Code-Login..." -ForegroundColor Yellow
            Connect-MgGraph -Scopes $scopes -UseDeviceCode -NoWelcome -ErrorAction Stop
            return
        }
        throw
    }
}
