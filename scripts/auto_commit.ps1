# auto_commit.ps1
# Automatically commits every modified / untracked file with a smart, per-file message.
# Run from the repository root.

$repoRoot = Resolve-Path "$PSScriptRoot\.."
Set-Location $repoRoot

# -----------------------------------------------------------------------
# Helper: derive a smart commit message from the file path
# -----------------------------------------------------------------------
function Get-CommitMessage {
    param([string]$file, [string]$status)

    $prefix = if ($status -eq "M") { "modified" } else { "new" }
    $name   = [System.IO.Path]::GetFileNameWithoutExtension($file)
    $dir    = Split-Path $file -Parent

    # Choose conventional-commit type based on path
    $type = switch -Wildcard ($file) {
        "*.gitignore"                    { "chore" }
        "*.env.example"                  { "docs" }
        "package.json"                   { "feat" }
        "tsup.config.ts"                 { "build" }
        "tsconfig.json"                  { "build" }
        "docker-compose.yml"             { "build" }
        "start.bat"                      { "build" }
        "prisma/*"                       { "schema" }
        "src/client/*"                   { "refactor" }
        "src/commands/admin/*"           { "feat" }
        "src/commands/moderation/*"      { "feat" }
        "src/commands/music/*"           { "feat" }
        "src/commands/utility/*"         { "feat" }
        "src/components/buttons/*"       { "feat" }
        "src/components/modals/*"        { "feat" }
        "src/components/selectMenus/*"   { "feat" }
        "src/events/*"                   { "feat" }
        "src/handlers/*"                 { "refactor" }
        "src/services/*"                 { "feat" }
        "src/utils/*"                    { "refactor" }
        "src/web/pages/*"                { "feat" }
        "src/web/*"                      { "chore" }
        "src/deploy.ts"                  { "chore" }
        "selfbot/*"                      { "feat" }
        "backend/*"                      { "feat" }
        "bot/*"                          { "feat" }
        "dashboard/*"                    { "feat" }
        "scripts/*"                      { "chore" }
        default                          { "chore" }
    }

    # Build a human-readable scope from the directory
    $scope = $dir -replace "\\", "/" -replace "^src/", "" -replace "^selfbot/src/", "selfbot/" -replace "/", "/"

    $action = if ($status -eq "M") { "update" } else { "add" }

    return "${type}(${scope}): ${action} ${name} - ${prefix} file"
}

# -----------------------------------------------------------------------
# Collect all modified (M) and untracked (?) files
# -----------------------------------------------------------------------
$rawStatus = git status --porcelain
$filesToCommit = @()

foreach ($line in $rawStatus) {
    if ($line.Length -lt 4) { continue }
    $xy   = $line.Substring(0, 2).Trim()
    $path = $line.Substring(3).Trim()

    # Skip files we do not want to commit
    if ($path -match "^node_modules/" -or
        $path -match "^dist/"         -or
        $path -match "^\.env$"        -or
        $path -match "\.db$"          -or
        $path -eq "nul"               -or
        $path -eq "package-lock.json" -or
        $path -match "^pnpm-lock") { continue }

    $status = if ($xy -match "M") { "M" } elseif ($xy -eq "??") { "U" } else { continue }

    $filesToCommit += [PSCustomObject]@{ File = $path; Status = $status }
}

if ($filesToCommit.Count -eq 0) {
    Write-Host "Nothing to commit. Working tree clean."
    exit 0
}

Write-Host "Found $($filesToCommit.Count) file(s) to commit."
Write-Host ""

# -----------------------------------------------------------------------
# Stage + commit each file individually
# -----------------------------------------------------------------------
$success = 0
$failed  = 0

foreach ($entry in $filesToCommit) {
    $file = $entry.File
    $msg  = Get-CommitMessage -file $file -status $entry.Status

    if (-not (Test-Path $file)) {
        Write-Warning "[$file] not on disk, skipping."
        continue
    }

    git add -- $file 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Failed to stage: $file"
        $failed++
        continue
    }

    # Check if the file is actually staged (it might be unchanged)
    $staged = git diff --cached --name-only | Where-Object { $_ -eq $file }
    if (-not $staged) {
        Write-Host "[SKIP] $file (no changes staged)"
        continue
    }

    git commit -m "$msg" 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Failed to commit: $file"
        $failed++
    } else {
        Write-Host "[OK]   $msg"
        $success++
    }
}

Write-Host ""
Write-Host "Done: $success committed, $failed failed."
