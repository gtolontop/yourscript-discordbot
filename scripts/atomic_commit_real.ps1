
# Script de commit Ultra-Atomique (1 fichier exact = 1 commit)

# Récupérer la liste des fichiers individuels (modifiés ou nouveaux)
# L'utilisation de --exclude-standard empêche la prise en compte de node_modules par ex.
$files = git ls-files --modified --others --exclude-standard

$count = 0

foreach ($file in $files) {
    if (-not (Test-Path $file)) { continue }
    
    # Génération d'un message ciblé et humain selon le chemin réel du fichier
    $name = Split-Path $file -Leaf
    $msg = "feat: add or update $file"

    switch -Regex ($file) {
        "^src/commands(.*)/(.*)\.ts$" { $msg = "feat(commands): implement $($matches[2]) command" }
        "^src/events/(.*)\.ts$" { $msg = "feat(events): handle Discord $($matches[1]) event" }
        "^src/components/(.*)/(.*)\.ts$" { $msg = "feat($($matches[1])): add interaction logic for $($matches[2]) component" }
        "^src/services/(.*)\.ts$" { $msg = "feat(services): implement core system logic for $($matches[1])" }
        "^src/web/(.*)\.ts$" { $msg = "feat(web): add logic for $($name)" }
        "^src/(handlers|utils)/(.*)\.ts$" { $msg = "refactor($($matches[1])): apply logic updates for $($matches[2])" }
        "^(selfbot|backend|dashboard|bot|pterodactyl)/(.*)$" { $msg = "feat($($matches[1])): add $($name) component logic" }
        "^\.gitignore$" { $msg = "chore: update git ignoring rules" }
        "^\.env\.example$" { $msg = "chore: update environment variables template" }
        "^package\.json$" { $msg = "build: configure package dependencies and dev scripts" }
        "^tsup\.config\.ts$" { $msg = "build: update typescript bundler configuration" }
        "^start\.bat$" { $msg = "chore: update windows execution script" }
        "^docker-compose\.yml$" { $msg = "chore: update docker orchestration services" }
        "^prisma/schema\.prisma$" { $msg = "schema: expand and configure new database models" }
    }

    # Commit unitaire strict
    git add $file
    git commit -m $msg --quiet
    $count++
}

Write-Host "`nProcessus termine. $count commits atomiques ont ete crees !" -ForegroundColor Green
