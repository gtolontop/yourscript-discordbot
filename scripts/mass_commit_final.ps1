
# Script de commit massif thématique

function Commit-Category {
    param (
        [string]$Message,
        [string[]]$Files
    )
    foreach ($File in $Files) {
        if (Test-Path $File) {
            git add $File
        }
    }
    git commit -m $Message
}

# 1. CORE & INFRASTRUCTURE
Commit-Category "build(infra): update core configuration and build tools

- Update .gitignore and .env.example
- Optimize package.json scripts and dependencies
- Configure tsup for production builds
- Update start.bat and project orchestration" @(
    ".gitignore", ".env.example", "package.json", "tsup.config.ts", "start.bat", "docker-compose.yml"
)

Commit-Category "refactor(core): enhance main bot client and handlers

- Update Bot.ts with new service initializations
- Refactor Command, Event and Component handlers for better performance
- Improve deploy script for global command synchronization" @(
    "src/client/Bot.ts", "src/handlers/CommandHandler.ts", "src/handlers/ComponentHandler.ts", "src/handlers/EventHandler.ts", "src/deploy.ts"
)

# 2. SERVICES & UTILS
Commit-Category "feat(services): implement core logic services

- Update TicketService with AI summary logic
- Expand ModerationService and LogService
- Refactor logger and component utilities" @(
    "src/services/TicketService.ts", "src/services/ModerationService.ts", "src/services/LogService.ts", "src/utils/logger.ts", "src/utils/components.ts"
)

# 3. TICKETS & SUPPORT SYSTEM
Commit-Category "feat(tickets): comprehensive support system overhaul

- Add ticket categories and blacklist management
- Create advanced button/modal interactions for ticket lifecycle
- Implement review system (accept/refuse/write)
- Add service category selection menus" @(
    "src/commands/admin/ticket.ts", "src/commands/admin/ticketblacklist.ts", "src/commands/admin/ticketcategory.ts",
    "src/components/buttons/ticketClaim.ts", "src/components/buttons/ticketClose.ts", "src/components/buttons/ticketCreate.ts",
    "src/components/buttons/closereview.ts", "src/components/buttons/closeconfirm.ts", "src/components/buttons/closekeep.ts",
    "src/components/buttons/reviewAccept.ts", "src/components/buttons/reviewRefuse.ts", "src/components/buttons/reviewRequest.ts", "src/components/buttons/reviewWrite.ts",
    "src/components/modals/ticketCreate.ts", "src/components/modals/ticketPanelCreate.ts", "src/components/modals/reviewSubmit.ts", "src/components/modals/closereviewSubmit.ts",
    "src/components/selectMenus/ticketCategory.ts"
)

# 4. ADMIN & AI COMMANDS
Commit-Category "feat(admin): advanced administration and AI modules

- Add AI configuration and response management
- Implement Todo, Team, and Service management commands
- Add ghostping detection and rule panel management
- Update status and autorole configuration" @(
    "src/commands/admin/ai.ts", "src/commands/admin/todo.ts", "src/commands/admin/team.ts", "src/commands/admin/service.ts",
    "src/commands/admin/ghostping.ts", "src/commands/admin/regle.ts", "src/commands/admin/config.ts", "src/commands/admin/status.ts",
    "src/commands/admin/autorole.ts", "src/commands/admin/welcome.ts", "src/commands/admin/annonce.ts",
    "src/components/buttons/rulesAccept.ts", "src/components/buttons/serviceCategory.ts", "src/components/buttons/serviceDetails.ts",
    "src/components/modals/annonceCreate.ts", "src/components/selectMenus/serviceCategory.ts"
)

# 5. MODERATION & LOGS
Commit-Category "feat(moderation): robust moderation tools and logging

- Implementation of ban, kick, mute/unmute and warn commands
- Add comprehensive event logging for messages, channels and members
- Add bulk message deletion tracking" @(
    "src/commands/moderation/ban.ts", "src/commands/moderation/clear.ts", "src/commands/moderation/kick.ts",
    "src/commands/moderation/mute.ts", "src/commands/moderation/unmute.ts", "src/commands/moderation/warn.ts", "src/commands/moderation/warns.ts",
    "src/events/messageDelete.ts", "src/events/messageUpdate.ts", "src/events/messageDeleteBulk.ts"
)

# 6. DISCORD EVENTS
Commit-Category "feat(events): complete discord event coverage

- Manage lifecycle for channels, roles, and members
- Add thread and invite tracking
- Implement voice state management and emoji updates" @(
    "src/events/channelCreate.ts", "src/events/channelDelete.ts", "src/events/channelUpdate.ts",
    "src/events/roleCreate.ts", "src/events/roleDelete.ts", "src/events/roleUpdate.ts",
    "src/events/guildMemberAdd.ts", "src/events/guildMemberRemove.ts", "src/events/guildMemberUpdate.ts",
    "src/events/threadCreate.ts", "src/events/threadDelete.ts", "src/events/threadUpdate.ts",
    "src/events/inviteCreate.ts", "src/events/inviteDelete.ts", "src/events/emojiCreate.ts",
    "src/events/emojiDelete.ts", "src/events/emojiUpdate.ts", "src/events/voiceStateUpdate.ts",
    "src/events/guildUpdate.ts", "src/events/guildBanAdd.ts", "src/events/guildBanRemove.ts",
    "src/events/ready.ts", "src/events/interactionCreate.ts", "src/events/messageCreate.ts"
)

# 7. ENGAGEMENT & UTILITY
Commit-Category "feat(engagement): giveaway, suggestion and reaction roles

- Implementation of giveaway system with enter buttons
- Suggestion system with voting buttons
- Dynamic reaction-role system via components" @(
    "src/commands/admin/suggestion.ts", "src/commands/admin/giveaway.ts", "src/commands/admin/reactionrole.ts",
    "src/components/buttons/giveawayEnter.ts", "src/components/buttons/suggestionVote.ts", "src/components/buttons/reactionRole.ts",
    "src/commands/utility/serverinfo.ts", "src/commands/utility/userinfo.ts"
)

# 8. MUSIC SYSTEM
Commit-Category "feat(music): implementation of music playback system

- Add 24/7 mode toggle
- Implement play command with audio extractor support" @(
    "src/commands/music/247.ts", "src/commands/music/play.ts"
)

# 9. WEB & DASHBOARD
Commit-Category "feat(web): express dashboard and API backend

- Setup Express server with socket.io integration
- Create dashboard and index pages
- Add backend and dashboard directory structures" @(
    "src/web/server.ts", "src/web/pages/dashboard.ts", "src/web/pages/index.ts", "backend", "dashboard"
)

# 10. SELFBOT & EXTERNAL
Commit-Category "feat(selfbot): implementation of AI selfbot module

- Add selfbot directory for autonomous AI interactions" @(
    "selfbot", "pterodactyl"
)

# Final cleanup
git add .
git commit -m "chore: final project synchronization

- Stage all remaining miscellaneous files
- Ensure repository consistency"
