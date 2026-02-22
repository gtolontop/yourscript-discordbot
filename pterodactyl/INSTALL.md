# Installation Pterodactyl - Your Script Bot

## Etape 1: Importer l'Egg

1. Connecte-toi au **Panel Admin** Pterodactyl
2. Va dans **Nests** > Choisis un nest (ex: "Discord Bots") ou crée-en un
3. Clique sur **Import Egg**
4. Upload le fichier `egg-your-script-bot.json`
5. Clique sur **Import**

## Etape 2: Creer le Serveur

1. Va dans **Servers** > **Create New**
2. Remplis les infos de base (nom, owner, etc.)
3. Dans **Nest**, selectionne le nest ou tu as importe l'egg
4. Dans **Egg**, selectionne **YourScript Discord Bot**
5. Configure les ressources:
   - **Memory**: 512 MB minimum (1024 MB recommande)
   - **Disk**: 1024 MB minimum
   - **CPU**: 100%
6. Configure les variables:
   - `DISCORD_TOKEN`: Ton token Discord
   - `CLIENT_ID`: L'ID de ton application Discord
   - `CLIENT_SECRET`: Le secret client Discord
   - `WEB_URL`: L'URL publique de ton serveur (pour les transcripts)
7. Clique sur **Create Server**

## Etape 3: Uploader le Code

### Option A: Via Git (recommande)
1. Mets ton code sur GitHub/GitLab
2. Dans les variables du serveur, ajoute l'URL Git dans `GIT_REPO`
3. Reinstalle le serveur

### Option B: Upload manuel
1. Va dans **Files** sur ton serveur Pterodactyl
2. Upload tous les fichiers du projet (zip puis extract, ou drag & drop)
3. Reinstalle le serveur pour compiler

## Etape 4: Demarrer

1. Clique sur **Start**
2. Le bot devrait afficher "Bot is ready!" dans la console

## Ports

Si tu veux acceder au dashboard web:
1. Va dans **Network** sur ton serveur
2. Ajoute une allocation sur le port 3000 (ou celui configure)
3. Met a jour `WEB_URL` avec l'IP:Port public

## Troubleshooting

- **Erreur Prisma**: Reinstalle le serveur pour regenerer le client
- **Module not found**: Verifie que l'installation s'est bien passee
- **Bot ne demarre pas**: Verifie ton DISCORD_TOKEN
