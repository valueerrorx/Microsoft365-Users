# Single delegated scope set for all scripts so each new pwsh process reuses one MSAL token cache entry.
function Connect-Mg365App {
    [CmdletBinding()]
    param()
    $scopes = @(
        'Directory.ReadWrite.All',
        'Group.ReadWrite.All',
        'GroupMember.ReadWrite.All',
        'Organization.Read.All',
        'User.Read.All',
        'User.ReadWrite.All',
        'UserAuthenticationMethod.ReadWrite.All'
    )
    Connect-MgGraph -Scopes $scopes -NoWelcome -ErrorAction Stop
}
