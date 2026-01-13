import { SlashCommandBuilder, PermissionFlagsBits, ActivityType } from "discord.js";
import type { Command } from "../../types/index.js";
import { successMessage, errorMessage } from "../../utils/index.js";

export default {
  data: new SlashCommandBuilder()
    .setName("status")
    .setDescription("Gérer le status du bot")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((sub) =>
      sub
        .setName("set")
        .setDescription("Définir le status du bot")
        .addStringOption((opt) =>
          opt
            .setName("type")
            .setDescription("Type d'activité")
            .setRequired(true)
            .addChoices(
              { name: "Joue à", value: "playing" },
              { name: "Regarde", value: "watching" },
              { name: "Écoute", value: "listening" },
              { name: "En compétition", value: "competing" },
              { name: "Stream", value: "streaming" }
            )
        )
        .addStringOption((opt) =>
          opt
            .setName("texte")
            .setDescription("Texte du status")
            .setRequired(true)
            .setMaxLength(128)
        )
        .addStringOption((opt) =>
          opt
            .setName("url")
            .setDescription("URL du stream (pour le type Stream)")
            .setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub.setName("clear").setDescription("Supprimer le status du bot")
    )
    .addSubcommand((sub) =>
      sub.setName("show").setDescription("Voir le status actuel du bot")
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
          type: activityTypes[type],
          url,
        });
      } else {
        client.user?.setActivity({
          name: text,
          type: activityTypes[type],
        });
      }

      const typeLabels: Record<string, string> = {
        playing: "Joue à",
        watching: "Regarde",
        listening: "Écoute",
        competing: "En compétition",
        streaming: "Stream",
      };

      return interaction.reply(
        successMessage({
          description: `Status défini: **${typeLabels[type]}** ${text}`,
        })
      );
    }

    if (subcommand === "clear") {
      client.user?.setActivity(null);
      return interaction.reply(
        successMessage({ description: "Status supprimé." })
      );
    }

    if (subcommand === "show") {
      const activity = client.user?.presence?.activities[0];

      if (!activity) {
        return interaction.reply({
          ...errorMessage({ description: "Aucun status défini." }),
          ephemeral: true,
        });
      }

      const typeLabels: Record<number, string> = {
        [ActivityType.Playing]: "Joue à",
        [ActivityType.Watching]: "Regarde",
        [ActivityType.Listening]: "Écoute",
        [ActivityType.Competing]: "En compétition",
        [ActivityType.Streaming]: "Stream",
      };

      return interaction.reply(
        successMessage({
          title: "🤖 Status actuel",
          description: `**${typeLabels[activity.type] ?? "Inconnu"}** ${activity.name}`,
        })
      );
    }
  },
} satisfies Command;
