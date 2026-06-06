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
    # WAM (Web Account Manager) als Broker deaktivieren: WAM braucht auf Windows einen
    # window handle (HWND), den ein von Electron gespawnter pwsh nicht hat ("window handle
    # must be configured"). Ohne WAM nutzt MSAL den Browser-Redirect (localhost) -> interaktiver
    # Login funktioniert auf Windows und Linux gleich, ohne Device-Code. Idempotent.
    try { Set-MgGraphOption -DisableLoginByWAM $true -ErrorAction SilentlyContinue } catch {}
    # Bei vorhandenem Token reconnectet das still aus dem Cache; sonst oeffnet sich der
    # System-Browser zur Anmeldung (Account waehlen, fertig).
    Connect-MgGraph -Scopes $scopes -NoWelcome -ErrorAction Stop
}
