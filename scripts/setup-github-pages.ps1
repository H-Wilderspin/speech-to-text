param([string]$Repository = 'H-Wilderspin/speech-to-text')
$ErrorActionPreference = 'Stop'
if ($Repository -notmatch '^[A-Za-z0-9][A-Za-z0-9-]*/[A-Za-z0-9][A-Za-z0-9_.-]*$') { throw 'Expected owner/repository.' }
$owner, $repoName = $Repository.Split('/')
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$oldInteractive = $env:GCM_INTERACTIVE
$credentials = @{}
$headers = @{ 'User-Agent' = 'speech-to-text-pages-setup'; Accept = 'application/vnd.github+json'; 'X-GitHub-Api-Version' = '2022-11-28' }

function Invoke-GitHub([string]$Method, [string]$Path, $Body = $null) {
  $request = @{ Uri = "https://api.github.com/$Path"; Method = $Method; Headers = $headers }
  if ($null -ne $Body) { $request.ContentType = 'application/json'; $request.Body = ConvertTo-Json -Depth 10 -Compress $Body }
  Invoke-RestMethod @request
}

try {
  # Use Git's existing GitHub credential through its normal helper. Never print it.
  $env:GCM_INTERACTIVE = 'never'
  $credentialLines = "protocol=https`nhost=github.com`nusername=$owner`n`n" | git credential fill
  if ($LASTEXITCODE -ne 0) { throw 'Sign into this GitHub account with Git Credential Manager, then rerun setup.' }
  foreach ($line in $credentialLines) {
    $separator = $line.IndexOf('=')
    if ($separator -gt 0) { $credentials[$line.Substring(0, $separator)] = $line.Substring($separator + 1) }
  }
  $credentialLines = $null
  if (!$credentials.password) { throw 'Git did not return a GitHub credential.' }
  $headers.Authorization = "Bearer $($credentials.password)"
  $account = Invoke-GitHub GET 'user'
  if ($account.login -ine $owner) { throw "Authenticated account $($account.login) does not match $owner." }

  try { $repo = Invoke-GitHub GET "repos/$Repository" }
  catch {
    if (!$_.Exception.Response -or [int]$_.Exception.Response.StatusCode -ne 404) { throw }
    $repo = Invoke-GitHub POST 'user/repos' @{
      name = $repoName; description = 'Accessible live captions for family conversations';
      private = $false; auto_init = $false; has_wiki = $false
    }
    Write-Output "Created $($repo.full_name)."
  }
  if (!$repo.permissions.admin) { throw 'Repository administration access is needed to configure Pages.' }
  if ($repo.default_branch -ne 'main' -and $repo.size -gt 0) { throw 'The existing repository has a different default branch; inspect it before changing deployment.' }
  $actions = Invoke-GitHub GET "repos/$Repository/actions/permissions"
  if (!$actions.enabled) { throw 'GitHub Actions is disabled for this repository.' }
  Write-Output "Default branch: $($repo.default_branch); Actions enabled: $($actions.enabled); allowed actions: $($actions.allowed_actions)."

  # GitHub Pages must be enabled once through account-level access. The workflow's
  # GITHUB_TOKEN handles subsequent deployments but cannot bootstrap this setting.
  try { $pages = Invoke-GitHub GET "repos/$Repository/pages" }
  catch {
    if (!$_.Exception.Response -or [int]$_.Exception.Response.StatusCode -ne 404) { throw }
    $pages = Invoke-GitHub POST "repos/$Repository/pages" @{ build_type = 'workflow' }
  }
  if ($pages.build_type -ne 'workflow') {
    $null = Invoke-GitHub PUT "repos/$Repository/pages" @{ build_type = 'workflow' }
  }
  $null = Invoke-GitHub PUT "repos/$Repository/environments/github-pages" @{
    deployment_branch_policy = @{ protected_branches = $false; custom_branch_policies = $true }
  }
  $policies = Invoke-GitHub GET "repos/$Repository/environments/github-pages/deployment-branch-policies"
  if (!($policies.branch_policies | Where-Object { $_.name -eq 'main' -and $_.type -eq 'branch' })) {
    $null = Invoke-GitHub POST "repos/$Repository/environments/github-pages/deployment-branch-policies" @{ name = 'main'; type = 'branch' }
  }
  $pages = Invoke-GitHub GET "repos/$Repository/pages"
  if ($pages.build_type -ne 'workflow') { throw 'GitHub did not confirm Actions-based Pages deployment.' }

  $projectRoot = Split-Path $PSScriptRoot -Parent
  if (!(git -C $projectRoot config --get user.name)) { git -C $projectRoot config user.name $account.login }
  if (!(git -C $projectRoot config --get user.email)) { git -C $projectRoot config user.email "$($account.id)+$($account.login)@users.noreply.github.com" }
  Write-Output "Pages configured for pushes to main: $($pages.html_url)"
  Write-Output 'The site becomes available after the first successful workflow deployment.'
} finally {
  $headers.Remove('Authorization'); $credentials.Clear(); $credentialLines = $null
  $env:GCM_INTERACTIVE = $oldInteractive
}
