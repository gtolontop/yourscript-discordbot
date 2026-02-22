import {
  SlashCommandBuilder,
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  MessageFlags,
} from "discord.js";
import type { Command } from "../../types/index.js";
import type { Bot } from "../../client/Bot.js";
import { Colors } from "../../utils/index.js";

/** Category display metadata. */
const categoryInfo: Record<
  string,
  { emoji: string; name: string; description: string }
> = {
  admin: {
    emoji: "***",
    name: "Administration",
    description: "Server configuration and management",
  },
  moderation: {
    emoji: "***",
    name: "Moderation",
    description: "Server moderation tools",
  },
  music: {
    emoji: "***",
    name: "Music",
    description: "Play music in voice channels",
  },
  utility: {
    emoji: "***",
    name: "Utility",
    description: "General-purpose commands and info",
  },
};

/** Map command names to their category. */
function detectCategory(name: string): string {
  const musicCommands = [
    "play",
    "skip",
    "stop",
    "queue",
    "nowplaying",
    "pause",
    "join",
    "leave",
    "247",
  ];
  const moderationCommands = [
    "ban",
    "kick",
    "mute",
    "unmute",
    "warn",
    "warns",
    "clear",
    "timeout",
  ];
  const adminCommands = [
    "config",
    "roleall",
    "status",
    "reactionrole",
    "suggestion",
    "giveaway",
    "ticket",
    "autorole",
    "ticketcategory",
    "ticketblacklist",
    "welcome",
    "annonce",
    "regle",
    "service",
    "ghostping",
  ];
  const utilityCommands = [
    "help",
    "ping",
    "serverinfo",
    "userinfo",
    "reminder",
  ];

  if (musicCommands.includes(name)) return "music";
  if (moderationCommands.includes(name)) return "moderation";
  if (adminCommands.includes(name)) return "admin";
  if (utilityCommands.includes(name)) return "utility";

  return "utility";
}

export default {
  data: new SlashCommandBuilder()
    .setName("help")
    .setDescription("Show all available commands")
    .addStringOption((option) =>
      option
        .setName("command")
        .setDescription("View details for a specific command")
        .setAutocomplete(true),
    ),

  async execute(interaction, client) {
    const commandName = interaction.options.getString("command");

    // Specific command detail view
    if (commandName) {
      const command = client.commands.get(commandName);

      if (!command) {
        return interaction.reply({
          content: `Command \`${commandName}\` not found.`,
          ephemeral: true,
        });
      }

      const container = new ContainerBuilder()
        .setAccentColor(Colors.Primary)
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(`## /${command.data.name}`),
        )
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(command.data.description),
        );

      // Show options if present
      const commandJson = command.data.toJSON();
      if (commandJson.options && commandJson.options.length > 0) {
        container.addSeparatorComponents(
          new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small),
        );
        container.addTextDisplayComponents(
          new TextDisplayBuilder().setContent("**Options:**"),
        );

        for (const opt of commandJson.options) {
          const required =
            "required" in opt && opt.required ? " *(required)*" : "";
          container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              `\`${opt.name}\`${required} - ${opt.description}`,
            ),
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
      const category = detectCategory(command.data.name);

      if (!categories.has(category)) {
        categories.set(category, []);
      }
      categories.get(category)!.push(command);
    }

    // Build the help container
    const container = new ContainerBuilder()
      .setAccentColor(Colors.Primary)
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent("## Available Commands"),
      )
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          `-# Use \`/help <command>\` for details on a specific command`,
        ),
      );

    // Display categories in a fixed order
    const sortedCategories = [
      "admin",
      "moderation",
      "music",
      "utility",
    ].filter((c) => categories.has(c));

    for (const categoryKey of sortedCategories) {
      const commands = categories.get(categoryKey)!;
      const info = categoryInfo[categoryKey] ?? {
        emoji: "***",
        name: categoryKey,
        description: "",
      };

      container.addSeparatorComponents(
        new SeparatorBuilder()
          .setSpacing(SeparatorSpacingSize.Small)
          .setDivider(true),
      );

      container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`### ${info.emoji} ${info.name}`),
      );

      const commandList = commands
        .map((cmd) => `\`/${cmd.data.name}\` - ${cmd.data.description}`)
        .join("\n");

      container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(commandList),
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
