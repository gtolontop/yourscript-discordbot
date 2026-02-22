
# Script de commit atomique intelligent (1 commit par fichier)

$files = git status --porcelain | ForEach-Object { $_.Substring(3) }

foreach ($file in $files) {
    if (-not (Test-Path $file)) { continue }
    if ($file -match "node_modules" -or $file -match "dist") { continue }
    
    # Déterminer un message intelligent basé sur le nom/chemin
    $name = Split-Path $file -Leaf
    $dir = Split-Path $file -Parent
    $msg = ""

    switch -Regex ($file) {
        "src/commands/admin/(.*)\.ts" { $msg = "feat(commands/admin): implement $($matches[1]) administration command" }
        "src/commands/moderation/(.*)\.ts" { $msg = "feat(commands/mod): implement $($matches[1]) moderation utility" }
        "src/commands/music/(.*)\.ts" { $msg = "feat(commands/music): add $($matches[1]) playback functionality" }
        "src/events/(.*)\.ts" { $msg = "feat(events): handle Discord $($matches[1]) event lifecycle" }
        "src/components/buttons/(.*)\.ts" { $msg = "feat(components/btns): implement interaction logic for $($matches[1])" }
        "src/components/modals/(.*)\.ts" { $msg = "feat(components/modals): add data entry handling for $($matches[1])" }
        "src/components/selectMenus/(.*)\.ts" { $msg = "feat(components/menus): implement selection logic for $($matches[1])" }
        "src/services/(.*)\.ts" { $msg = "feat(services): implement system logic for $($matches[1])" }
        "src/web/pages/(.*)\.ts" { $msg = "feat(web/pages): develop dashboard view for $($matches[1])" }
        "src/web/server\.ts" { $msg = "feat(web): initialize Express server with socket.io integration" }
        "selfbot/(.*)" { $msg = "feat(selfbot): implement autonomous agent logic in $($name)" }
        "backend/(.*)" { $msg = "feat(backend): develop core API component $($name)" }
        "dashboard/(.*)" { $msg = "feat(dashboard): implement frontend component $($name)" }
        "\.gitignore" { $msg = "chore: update git exclusion patterns" }
        "\.env\.example" { $msg = "chore: update environment variables template" }
        "package\.json" { $msg = "build: update project dependencies and scripts" }
        "tsup\.config\.ts" { $msg = "build: configure typescript bundling settings" }
        "prisma/schema\.prisma" { $msg = "schema: expand database models for AI and operations" }
        "start\.bat" { $msg = "chore: update windows startup script" }
        default { $msg = "feat: implement logic for $file" }
    }

    Write-Host "Committing $file with message: $msg" -ForegroundColor Cyan
    git add $file
    git commit -m $msg --quiet
}
