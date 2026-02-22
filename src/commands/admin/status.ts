import { SlashCommandBuilder, PermissionFlagsBits, ActivityType } from "discord.js";
import type { Command } from "../../types/index.js";
import { successMessage, errorMessage } from "../../utils/index.js";

export default {
  data: new SlashCommandBuilder()
    .setName("status")
    .setDescription("Manage bot status")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((sub) =>
      sub
        .setName("set")
        .setDescription("Set bot status")
        .addStringOption((opt) =>
          opt
            .setName("type")
            .setDescription("Activity type")
            .setRequired(true)
            .addChoices(
              { name: "Playing", value: "playing" },
              { name: "Watching", value: "watching" },
              { name: "Listening", value: "listening" },
              { name: "Competing", value: "competing" },
              { name: "Stream", value: "streaming" }
            )
        )
        .addStringOption((opt) =>
          opt
            .setName("texte")
            .setDescription("Status text")
            .setRequired(true)
            .setMaxLength(128)
        )
        .addStringOption((opt) =>
          opt
            .setName("url")
            .setDescription("Stream URL (for Stream type)")
            .setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub.setName("clear").setDescription("Clear bot status")
    )
    .addSubcommand((sub) =>
      sub.setName("show").setDescription("View current bot status")
    ),

  async execute(interaction, client) {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === "set") {
      const type = interaction.options.getString("type", true);
      const text = interaction.options.getString("texte", true);
      const url = interaction.options.getString("url");

      const activityTypes: Record<string, ActivityType> = {
        playing: ActivityType.Playing,
        watching: ActivityType.Watching,
        listening: ActivityType.Listening,
        competing: ActivityType.Competing,
        streaming: ActivityType.Streaming,
      };

      if (type === "streaming" && url) {
        client.user?.setActivity({
          name: text,
          type: activityTypes[type]!,
          url,
        });
      } else {
        client.user?.setActivity({
          name: text,
          type: activityTypes[type]!,
        });
      }

      const typeLabels: Record<string, string> = {
        playing: "Playing",
        watching: "Watching",
        listening: "Listening",
        competing: "Competing",
        streaming: "Stream",
      };

      return interaction.reply(
        successMessage({
          description: `Status set: **${typeLabels[type]}** ${text}`,
        })
      );
    }

    if (subcommand === "clear") {
      client.user?.setPresence({ activities: [] });
      return interaction.reply(
        successMessage({ description: "Status cleared." })
      );
    }

    if (subcommand === "show") {
      const activity = client.user?.presence?.activities[0];

      if (!activity) {
        return interaction.reply({
          ...errorMessage({ description: "No status set." }),
          ephemeral: true,
        });
      }

      const typeLabels: Record<number, string> = {
        [ActivityType.Playing]: "Playing",
        [ActivityType.Watching]: "Watching",
        [ActivityType.Listening]: "Listening",
        [ActivityType.Competing]: "Competing",
        [ActivityType.Streaming]: "Stream",
      };

      return interaction.reply(
        successMessage({
          title: "🤖 Current Status",
          description: `**${typeLabels[activity.type] ?? "Unknown"}** ${activity.name}`,
        })
      );
    }
  },
} satisfies Command;
