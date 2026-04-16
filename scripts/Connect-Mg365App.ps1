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
        Connect-MgGraph -Scopes $scopes -NoWelcome -ErrorAction Stop
        return
    } catch {
        $msg = [string]$_.Exception.Message
        if ($msg -match 'Interactive browser credential authentication failed') {
            Write-Host "Hinweis: Browser-Login nicht möglich (headless). Fallback: Device-Code-Login..." -ForegroundColor Yellow
            Connect-MgGraph -Scopes $scopes -UseDeviceCode -NoWelcome -ErrorAction Stop
            return
        }
        throw
    }
}
