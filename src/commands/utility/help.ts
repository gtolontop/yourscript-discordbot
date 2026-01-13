import {
  SlashCommandBuilder,
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  MessageFlags,
} from "discord.js";
import type { Command } from "../../types/index.js";
import { Colors } from "../../utils/index.js";

// Category metadata
const categoryInfo: Record<string, { emoji: string; name: string; description: string }> = {
  utility: {
    emoji: "🔧",
    name: "Utilitaires",
    description: "Commandes générales et informations",
  },
  music: {
    emoji: "🎵",
    name: "Musique",
    description: "Écoute de la musique dans les salons vocaux",
  },
  moderation: {
    emoji: "🛡️",
    name: "Modération",
    description: "Gestion et modération du serveur",
  },
  fun: {
    emoji: "🎮",
    name: "Fun & Niveaux",
    description: "Système de niveaux, économie et divertissement",
  },
  admin: {
    emoji: "⚙️",
    name: "Administration",
    description: "Commandes réservées aux administrateurs",
  },
};

export default {
  data: new SlashCommandBuilder()
    .setName("help")
    .setDescription("Affiche toutes les commandes disponibles")
    .addStringOption((option) =>
      option
        .setName("commande")
        .setDescription("Voir les détails d'une commande spécifique")
        .setAutocomplete(true)
    ),

  async execute(interaction, client) {
    const commandName = interaction.options.getString("commande");

    // If specific command requested
    if (commandName) {
      const command = client.commands.get(commandName);

      if (!command) {
        return interaction.reply({
          content: `Commande \`${commandName}\` introuvable.`,
          ephemeral: true,
        });
      }

      const container = new ContainerBuilder()
        .setAccentColor(Colors.Primary)
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(`## /${command.data.name}`)
        )
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(command.data.description)
        );

      // Add options if any
      const commandJson = command.data.toJSON();
      if (commandJson.options && commandJson.options.length > 0) {
        container.addSeparatorComponents(
          new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
        );
        container.addTextDisplayComponents(
          new TextDisplayBuilder().setContent("**Options:**")
        );

        for (const opt of commandJson.options) {
          const required = "required" in opt && opt.required ? " *(requis)*" : "";
          container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              `\`${opt.name}\`${required} - ${opt.description}`
            )
          );
        }
      }

      return interaction.reply({
        components: [container],
        flags: MessageFlags.IsComponentsV2,
      });
    }

    // Group commands by category
    const categories = new Map<string, Command[]>();

    for (const [, command] of client.commands) {
      // Detect category from file path or use "other"
      const category = detectCategory(command.data.name);

      if (!categories.has(category)) {
        categories.set(category, []);
      }
      categories.get(category)!.push(command);
    }

    // Build help message
    const container = new ContainerBuilder()
      .setAccentColor(Colors.Primary)
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent("## Commandes disponibles")
      )
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          `-# Utilise \`/help <commande>\` pour plus de détails`
        )
      );

    // Sort categories
    const sortedCategories = ["utility", "music", "moderation", "fun", "admin"].filter((c) =>
      categories.has(c)
    );

    for (const categoryKey of sortedCategories) {
      const commands = categories.get(categoryKey)!;
      const info = categoryInfo[categoryKey] ?? {
        emoji: "📁",
        name: categoryKey,
        description: "",
      };

      container.addSeparatorComponents(
        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
      );

      container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`### ${info.emoji} ${info.name}`)
      );

      const commandList = commands
        .map((cmd) => `\`/${cmd.data.name}\` - ${cmd.data.description}`)
        .join("\n");

      container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(commandList)
      );
    }

    await interaction.reply({
      components: [container],
      flags: MessageFlags.IsComponentsV2,
    });
  },

  async autocomplete(interaction, client) {
    const focused = interaction.options.getFocused().toLowerCase();

    const choices = client.commands
      .filter((cmd) => cmd.data.name.toLowerCase().includes(focused))
      .map((cmd) => ({
        name: `/${cmd.data.name} - ${cmd.data.description.slice(0, 50)}`,
        value: cmd.data.name,
      }))
      .slice(0, 25);

    await interaction.respond(choices);
  },
} satisfies Command;

// Detect category based on command name
function detectCategory(name: string): string {
  const musicCommands = ["play", "skip", "stop", "queue", "nowplaying", "pause", "join", "leave", "247"];
  const moderationCommands = ["ban", "kick", "mute", "unmute", "warn", "warns", "clear", "timeout"];
  const funCommands = ["level", "leaderboard", "balance", "daily", "rank", "xp"];
  const adminCommands = ["roleall", "config", "setup"];
  const utilityCommands = ["help", "ping", "serverinfo", "avatar", "userinfo", "poll"];

  if (musicCommands.includes(name)) return "music";
  if (moderationCommands.includes(name)) return "moderation";
  if (funCommands.includes(name)) return "fun";
  if (adminCommands.includes(name)) return "admin";
  if (utilityCommands.includes(name)) return "utility";

  return "utility";
}
